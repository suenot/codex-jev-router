import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jevAnswer } from '../src/alternative-backends.mjs';

function instructions(question) {
  return `${question.instructions} ${Object.entries(question.criteria || {}).map(([id, description]) => `${id}: ${description}`).join('; ')}`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: 'ignore' });
    const stop = () => child.kill('SIGTERM');
    process.on('SIGTERM', stop);
    child.once('error', reject);
    child.once('close', code => {
      process.off('SIGTERM', stop);
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`));
    });
  });
}

export async function semif(input, env = process.env) {
  const directory = await mkdtemp(join(tmpdir(), 'codex-semif-'));
  try {
    const source = join(directory, 'input.jsonl');
    const output = join(directory, 'output.jsonl');
    const rows = Object.entries(input.questions).map(([key, question]) => ({
      id: key,
      state: input.state,
      question: question.instructions,
      options: Object.entries(question.criteria || {}).map(([id, description]) => ({ id, description })),
    }));
    await writeFile(source, rows.map(row => JSON.stringify(row)).join('\n') + '\n', { mode: 0o600 });
    const args = ['--mode', 'direct', '--model', env.CODEX_ROUTER_SEMIF_MODEL, '--revision', env.CODEX_ROUTER_SEMIF_REVISION,
      '--input', source, '--output', output];
    if (env.CODEX_ROUTER_SEMIF_BACKEND) args.push('--backend', env.CODEX_ROUTER_SEMIF_BACKEND);
    if (env.CODEX_ROUTER_SEMIF_DEVICE) args.push('--device', env.CODEX_ROUTER_SEMIF_DEVICE);
    if (env.CODEX_ROUTER_SEMIF_GGUF) args.push('--gguf', env.CODEX_ROUTER_SEMIF_GGUF);
    await run(env.CODEX_ROUTER_SEMIF_COMMAND || 'semif-score', args);
    const predictions = (await readFile(output, 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
    const answers = Object.fromEntries(Object.entries(input.questions).map(([key, question]) => {
      const matches = predictions.filter(row => row.id === key);
      if (matches.length !== 1 || !Array.isArray(matches[0].option_ids) || !Array.isArray(matches[0].probabilities)) throw new Error(`Invalid SemIf output for ${key}`);
      const probability = Object.fromEntries(matches[0].option_ids.map((id, index) => [id, matches[0].probabilities[index]]));
      return [key, jevAnswer(question, probability)];
    }));
    return { answers };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function openJev(input, env = process.env, load) {
  const loader = load || (await import('open-jev')).OpenJev.load;
  const engine = await loader({ model: env.CODEX_ROUTER_OPENJEV_MODEL || 'kev-0.6b',
    ...(env.CODEX_ROUTER_OPENJEV_DEVICE ? { device: env.CODEX_ROUTER_OPENJEV_DEVICE } : {}),
    ...(env.CODEX_ROUTER_OPENJEV_DTYPE ? { dtype: env.CODEX_ROUTER_OPENJEV_DTYPE } : {}) });
  try {
    const questions = Object.fromEntries(Object.entries(input.questions).map(([key, question]) => [key,
      question.type === 'choice' ? { type: 'choice', instructions: question.instructions,
        options: Object.keys(question.criteria), descriptions: question.criteria } :
        { type: 'noul', instructions: instructions(question) }]));
    const state = typeof input.state === 'string' ? input.state : JSON.stringify(input.state);
    const raw = await engine.decide(state, questions);
    const answers = Object.fromEntries(Object.entries(input.questions).map(([key, question]) => [key,
      question.type === 'choice' ? jevAnswer(question, raw[key]?.probabilities || {}) :
        { type: 'noul', noul: raw[key]?.probability }]));
    return { answers };
  } finally {
    await engine.dispose();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const input = JSON.parse(raw);
    const result = process.argv[2] === 'semif' ? await semif(input) : await openJev(input);
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
