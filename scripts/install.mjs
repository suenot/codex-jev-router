import { chmod, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
let dryRun = false;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--codex-home' && process.argv[i + 1]) codexHome = process.argv[++i];
  else if (process.argv[i] === '--dry-run') dryRun = true;
  else throw new Error(`Unknown or incomplete option: ${process.argv[i]}`);
}
codexHome = resolve(codexHome);

const readOptional = async path => {
  try { return await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

function upsertKey(section, key, value) {
  const line = `${key} = ${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}\\s*=.*$`, 'm');
  return pattern.test(section) ? section.replace(pattern, line) : `${section.trimEnd()}\n${line}\n`;
}

function updateConfig(original) {
  let config = (original || '').trimEnd() + '\n';
  const header = /^\[agents\]\s*$/m;
  const match = header.exec(config);
  if (!match) config = `${config.trimEnd()}\n\n[agents]\n`;
  const start = (header.exec(config).index) + '[agents]'.length;
  const next = config.slice(start).search(/^\s*\[[^\]]+\]\s*$/m);
  const end = next < 0 ? config.length : start + next;
  let section = config.slice(start, end);
  section = upsertKey(section, 'default_subagent_model', 'gpt-6-sol');
  section = upsertKey(section, 'default_subagent_reasoning_effort', 'high');
  return (config.slice(0, start) + section + config.slice(end)).trimEnd() + '\n';
}

const startMarker = '<!-- codex-jev-router:start -->';
const endMarker = '<!-- codex-jev-router:end -->';
const command = `node ${JSON.stringify(join(root, 'src', 'route.mjs'))} --role=ROLE`;
const routingBlock = `${startMarker}\n## Subagent model routing\n\n` +
  `- Before each Codex subagent spawn, run \`${command}\` with a short, sanitized task summary on stdin. Replace ROLE with the actual agent type. Skip routing only when the user explicitly chooses the subagent model.\n` +
  '- Pass the returned `model` and `reasoning_effort` explicitly to `spawn_agent`. If routing fails, use `gpt-6-sol` with `high` effort.\n' +
  '- Route independent web research and file or log searches before spawning those subagents too. Use `default` for web research and `explorer` for read-only local search. Exact lookup may use Luna low; bounded multi-step extraction may use Luna medium; a short task needing Sol judgment may use Sol low; uncertain research or diagnosis uses Sol high. Direct tool calls by the parent keep the parent model.\n' +
  '- Use Sol with `ultra` effort when the router identifies an exceptionally difficult task or after Sol substantively fails. For a retry, start the routing summary with `[codex-router:sol-failed]` and describe the observed failure.\n' +
  '- Do not put credentials or private source text in summaries; the selected decider receives them. Delegate only when a separate agent benefits the task.\n' +
  `${endMarker}`;

function updateInstructions(original) {
  const text = original || '';
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start >= 0 && end > start) {
    return (text.slice(0, start) + routingBlock + text.slice(end + endMarker.length)).trimEnd() + '\n';
  }
  const legacyHeading = '## Subagent model routing';
  const legacy = text.indexOf(legacyHeading);
  if (legacy >= 0) {
    const next = text.slice(legacy + legacyHeading.length).search(/^## /m);
    const stop = next < 0 ? text.length : legacy + legacyHeading.length + next;
    const oldSection = text.slice(legacy, stop);
    if (!oldSection.includes('src/route.mjs')) throw new Error('Unknown existing subagent routing section; merge manually');
    return (text.slice(0, legacy) + routingBlock + text.slice(stop)).trimEnd() + '\n';
  }
  return `${text.trimEnd()}${text ? '\n\n' : ''}${routingBlock}\n`;
}

const roleTemplates = {
  explorer: 'name = "explorer"\ndescription = "Read-only codebase exploration and evidence gathering."\nsandbox_mode = "read-only"\ndeveloper_instructions = """\nStay read-only. Trace only the assigned path with targeted searches and reads.\nReturn concise evidence with file paths and symbols; do not propose unrelated work.\n"""\n',
  reviewer: 'name = "reviewer"\ndescription = "Read-only review for correctness, security, regressions, and test gaps."\nsandbox_mode = "read-only"\ndeveloper_instructions = """\nStay read-only. Report only actionable findings with file paths, impact, and a minimal fix.\nSkip style-only comments and do not modify files.\n"""\n',
  worker: 'name = "worker"\ndescription = "Focused implementation and verification for a bounded change."\ndeveloper_instructions = """\nImplement only the assigned change. Reuse existing patterns and run the smallest relevant verification.\nReturn changed files and the verification result.\n"""\n',
};
function updateRole(original, name) {
  return (original || roleTemplates[name])
    .replace(/^model\s*=.*(?:\r?\n|$)/gm, '')
    .replace(/^model_reasoning_effort\s*=.*(?:\r?\n|$)/gm, '');
}

const files = [
  { relative: 'config.toml', update: updateConfig },
  { relative: 'AGENTS.md', update: updateInstructions },
  ...Object.keys(roleTemplates).map(name => ({ relative: `agents/${name}.toml`, update: text => updateRole(text, name) })),
];
const changes = [];
for (const file of files) {
  const path = join(codexHome, file.relative);
  const original = await readOptional(path);
  const updated = file.update(original);
  if (original !== updated) changes.push({ ...file, path, original, updated });
}
if (changes.length === 0) {
  console.log('Codex routing is already installed; no files changed.');
  process.exit(0);
}
console.log(`Files to update: ${changes.map(change => change.relative).join(', ')}`);
if (dryRun) process.exit(0);

const stamp = new Date().toISOString().replaceAll(':', '-');
const backup = join(codexHome, 'backups', 'codex-jev-router', stamp);
await mkdir(backup, { recursive: true, mode: 0o700 });
await chmod(backup, 0o700);
for (const change of changes) {
  if (change.original === null) continue;
  const target = join(backup, change.relative);
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await copyFile(change.path, target);
}
await writeFile(join(backup, 'manifest.json'), JSON.stringify({ changed: changes.map(({ relative, original }) => ({ path: relative, existed: original !== null })) }, null, 2) + '\n', { mode: 0o600 });

for (const change of changes) {
  await mkdir(dirname(change.path), { recursive: true });
  const temp = `${change.path}.codex-jev-router-${process.pid}.tmp`;
  await writeFile(temp, change.updated, { mode: 0o600 });
  await rename(temp, change.path);
}
console.log(`Installed. Backup: ${backup}`);
