import { spawn } from 'node:child_process';
import { access, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { routeSubagent, SOL } from '../src/router.mjs';
import { deciderConfig, evaluateDecision } from '../src/decider.mjs';

const tasks = [
  {
    id: 'exact_lookup',
    role: 'explorer',
    summary: 'Find the named function calculateTotal in one small JavaScript repository and report only its file path and line number.',
    files: ['src/billing.mjs'],
    prompt: 'Find the definition of calculateTotal. Return only its relative path and line number in the form path:line.',
    correct: answer => answer.trim() === 'src/billing.mjs:6',
  },
  {
    id: 'bounded_extraction',
    role: 'explorer',
    summary: 'Read three specified configuration files and extract the port, timeout, and retry limit into a short table. No edits or judgment.',
    files: ['config/server.json', 'config/cache.json', 'config/retry.json'],
    prompt: 'Read config/server.json, config/cache.json, and config/retry.json. Return only one line in this exact format: port=NUMBER timeout_ms=NUMBER retry_limit=NUMBER.',
    correct: answer => answer.trim() === 'port=8123 timeout_ms=4500 retry_limit=4',
  },
  {
    id: 'focused_judgment',
    role: 'default',
    summary: 'Check one specific claim against two named local files, decide true or false, and return only a short verdict. No broad investigation.',
    files: ['CONTRACT.md', 'src/billing.mjs'],
    prompt: 'The claim is "calculateTotal applies the discount before tax." Check CONTRACT.md and src/billing.mjs. Return only PASS if the claim is true or FAIL if false.',
    correct: answer => answer.trim() === 'FAIL',
  },
  {
    id: 'cross_file_diagnosis',
    role: 'explorer',
    summary: 'Trace an intermittent duplicate charge across gateway and worker code and logs, reconcile conflicting identifiers, and identify the root cause.',
    files: ['src/gateway.mjs', 'src/worker.mjs', 'logs/checkout.txt'],
    prompt: 'Investigate why order A-17 was charged twice. Inspect src/gateway.mjs, src/worker.mjs, and logs/checkout.txt. Return only KEY_MISMATCH, TIMEOUT, or UNKNOWN.',
    correct: answer => answer.trim() === 'KEY_MISMATCH',
  },
];

const files = {
  'src/billing.mjs': [
    'export const TAX_RATE = 0.2;',
    '',
    'export function roundMoney(value) {',
    '  return Math.round(value * 100) / 100;',
    '}',
    'export function calculateTotal(subtotal, discount) {',
    '  const taxed = subtotal * (1 + TAX_RATE);',
    '  return roundMoney(taxed - discount);',
    '}',
    '',
  ].join('\n'),
  'config/server.json': '{"port":8123,"host":"127.0.0.1"}\n',
  'config/cache.json': '{"timeout_ms":4500,"enabled":true}\n',
  'config/retry.json': '{"retry_limit":4,"backoff_ms":200}\n',
  'CONTRACT.md': 'A discount must be subtracted from the subtotal before tax is applied.\n',
  'src/gateway.mjs': 'export const requestKey = orderId => orderId.toLowerCase();\n',
  'src/worker.mjs': 'export const chargeKey = orderId => orderId;\n',
  'logs/checkout.txt': 'gateway order=A-17 request_key=a-17 charge=accepted\nworker order=A-17 charge_key=A-17 charge=accepted\nprovider idempotency keys are case-sensitive\n',
};

function parseArgs(args) {
  let repetitions = 3;
  let output = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repetitions' && args[i + 1]) repetitions = Number(args[++i]);
    else if (args[i] === '--output' && args[i + 1]) output = args[++i];
    else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) {
    throw new Error('--repetitions must be an integer from 1 to 10');
  }
  return { repetitions, output };
}

function runCodex({ cwd, codexHome, model, reasoning_effort, prompt, evidence }) {
  const args = [
    'exec', '--json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check',
    '-s', 'read-only', '-C', cwd, '-m', model,
    '-c', `model_reasoning_effort=${reasoning_effort}`,
    `All evidence for this task is supplied below. Do not call tools, edit files, or delegate. ${prompt}\n\n${evidence}`,
  ];
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const child = spawn('codex', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CODEX_HOME: codexHome },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), 120_000);
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 2_000_000) child.kill(); });
    child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 2_000_000) child.kill(); });
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`codex exec exited ${code}: ${stderr.slice(-1000)}`));
      const events = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
      const completed = events.findLast(event => event.type === 'turn.completed');
      const answer = events.filter(event => event.type === 'item.completed' && event.item?.type === 'agent_message').at(-1)?.item?.text;
      if (!completed?.usage || typeof answer !== 'string') return reject(new Error('Missing Codex usage or final answer'));
      const tool_calls = events.filter(event => event.type === 'item.completed' && event.item?.type === 'command_execution').length;
      resolve({ usage: completed.usage, answer, tool_calls, duration_ms: Math.round(performance.now() - start) });
    });
  });
}

async function main() {
  const { repetitions, output } = parseArgs(process.argv.slice(2));
  const fixture = await mkdtemp(join(tmpdir(), 'codex-router-benchmark-'));
  const codexHome = await mkdtemp(join(tmpdir(), 'codex-router-clean-home-'));
  try {
    const activeHome = resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));
    const authFile = join(activeHome, 'auth.json');
    try {
      await access(authFile);
      await symlink(authFile, join(codexHome, 'auth.json'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const results = {
      benchmark: 'codex-jev-router synthetic tasks with inline evidence',
      generated_at: new Date().toISOString(),
      repetitions,
      codex_version: '',
      decider_backend: deciderConfig().kind,
      baseline: { model: SOL, reasoning_effort: 'high' },
      codex_isolation: 'Temporary CODEX_HOME with authentication only; no AGENTS.md or config.toml',
      tasks: [],
    };
    const version = await new Promise((resolve, reject) => {
      const child = spawn('codex', ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
      let data = '';
      child.stdout.on('data', chunk => { data += chunk; });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve(data.trim()) : reject(new Error('Cannot get Codex version')));
    });
    results.codex_version = version;
    for (const task of tasks) {
      const evidence = task.files.map(name => `--- ${name} ---\n${files[name]}`).join('\n');
      const entry = { id: task.id, role: task.role, summary: task.summary, prompt: task.prompt, evidence, runs: [] };
      results.tasks.push(entry);
      for (let repeat = 1; repeat <= repetitions; repeat++) {
        let decider_usage = null;
        const start = performance.now();
        const route = await routeSubagent({ agent_type: task.role, message: task.summary }, async input => {
          const raw = await evaluateDecision(input);
          decider_usage = raw.usage ?? null;
          return raw;
        });
        const decider_duration_ms = Math.round(performance.now() - start);
        const profiles = repeat % 2 === 1 ? ['baseline', 'routed'] : ['routed', 'baseline'];
        for (const profile of profiles) {
          const selection = profile === 'baseline' ? results.baseline : route;
          const run = await runCodex({ cwd: fixture, codexHome, ...selection, prompt: task.prompt, evidence });
          entry.runs.push({
            profile, repeat, model: selection.model, reasoning_effort: selection.reasoning_effort,
            ...(profile === 'routed' ? { route_reason: route.reason, decider_usage, decider_duration_ms } : {}),
            ...run, correct: task.correct(run.answer),
          });
          process.stderr.write(`${task.id} ${profile} ${repeat}: ${task.correct(run.answer) ? 'correct' : 'incorrect'}, ${run.tool_calls} tool calls, ${run.usage.input_tokens + run.usage.output_tokens} Codex tokens, ${run.duration_ms} ms\n`);
        }
      }
    }
    const json = `${JSON.stringify(results, null, 2)}\n`;
    if (output) await writeFile(output, json);
    else process.stdout.write(json);
  } finally {
    await Promise.all([
      rm(fixture, { recursive: true, force: true }),
      rm(codexHome, { recursive: true, force: true }),
    ]);
  }
}

await main();
