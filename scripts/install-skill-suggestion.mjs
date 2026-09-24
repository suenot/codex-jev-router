import { chmod, copyFile, mkdir, readFile, readdir, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deciderConfig } from '../src/decider.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let home = process.env.CODEX_HOME || join(homedir(), '.codex');
let dryRun = false;
let hide = false;
const dirs = [];
for (let i = 2; i < process.argv.length; i++) {
  const option = process.argv[i];
  if (option === '--codex-home' && process.argv[i + 1]) home = process.argv[++i];
  else if (option === '--skills-dir' && process.argv[i + 1]) dirs.push(resolve(process.argv[++i]));
  else if (option === '--hide-skills') hide = true;
  else if (option === '--dry-run') dryRun = true;
  else throw new Error(`Unknown or incomplete option: ${option}`);
}
home = resolve(home);
if (!dirs.length) throw new Error('Pass at least one --skills-dir containing local skills.');
const backend = (process.env.CODEX_ROUTER_DECIDER || 'jev').toLowerCase();
const endpoint = deciderConfig().url || '';
const localBackend = ['command', 'semif', 'jevlike', 'anyjev', 'open-jev-nico'].includes(backend) || (endpoint && /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(endpoint));
if (hide && !localBackend && process.env.CODEX_ROUTER_SKILL_ALLOW_HOSTED !== '1') {
  throw new Error('Hiding skills requires a local decision backend or CODEX_ROUTER_SKILL_ALLOW_HOSTED=1.');
}

const readOptional = async path => {
  try { return await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

async function scan(directory, depth = 0, seen = new Set()) {
  if (depth > 4) return [];
  const resolved = await realpath(directory);
  if (seen.has(resolved)) return [];
  seen.add(resolved);
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(directory, entry.name);
    const info = entry.isSymbolicLink() ? await stat(path).catch(() => null) : entry;
    if (info?.isFile() && entry.name === 'SKILL.md') found.push(path);
    else if (info?.isDirectory()) found.push(...await scan(path, depth + 1, seen));
  }
  return found;
}

const paths = [...new Set((await Promise.all(dirs.map(dir => scan(dir)))).flat())].sort();
if (!paths.length) throw new Error('No SKILL.md files found in the supplied directories.');
if (paths.length > 200) throw new Error('Too many skills for one catalog (maximum 200). Split the installation into smaller directories.');

function disableSkills(original) {
  let updated = original || '';
  for (const path of paths) {
    const headings = [...updated.matchAll(/^\[[^\n]+\]\s*$/gm)];
    const sections = headings.filter(match => match[0].trim() === '[[skills.config]]');
    const existing = sections.find(match => {
      const end = headings.find(heading => heading.index > match.index)?.index ?? updated.length;
      return updated.slice(match.index, end).split(/\r?\n/).some(line => line.trim() === `path = ${JSON.stringify(path)}`);
    });
    if (existing) {
      const end = headings.find(heading => heading.index > existing.index)?.index ?? updated.length;
      const section = updated.slice(existing.index, end);
      if (/^enabled\s*=/m.test(section)) updated = updated.slice(0, existing.index) + section.replace(/^enabled\s*=.*$/m, 'enabled = false') + updated.slice(end);
      else updated = updated.slice(0, end) + 'enabled = false\n' + updated.slice(end);
    } else {
      updated = `${updated.trimEnd()}\n\n[[skills.config]]\npath = ${JSON.stringify(path)}\nenabled = false\n`;
    }
  }
  return updated;
}

function addHook(original) {
  const hooks = original ? JSON.parse(original) : { hooks: {} };
  hooks.hooks ||= {};
  hooks.hooks.UserPromptSubmit ||= [];
  const command = `node ${JSON.stringify(join(root, 'src', 'skill-suggestion-hook.mjs'))}`;
  if (!hooks.hooks.UserPromptSubmit.some(group => group.hooks?.some(hook => hook.command === command))) {
    hooks.hooks.UserPromptSubmit.push({ hooks: [{ type: 'command', command, timeout: 35, additionalContextLimit: 30000 }] });
  }
  return JSON.stringify(hooks, null, 2) + '\n';
}

const updates = [
  { relative: 'skill-suggestion.json', update: () => JSON.stringify({ paths }, null, 2) + '\n' },
  { relative: 'hooks.json', update: addHook },
  ...(hide ? [{ relative: 'config.toml', update: disableSkills }] : []),
];
const changes = [];
for (const item of updates) {
  const path = join(home, item.relative);
  const original = await readOptional(path);
  const updated = item.update(original);
  if (updated !== original) changes.push({ ...item, path, original, updated });
}
if (!changes.length) {
  console.log('Skill suggestion is already installed; no files changed.');
  process.exit(0);
}
console.log(`Managed skills: ${paths.length}; files to update: ${changes.map(change => change.relative).join(', ')}`);
if (dryRun) process.exit(0);

const stamp = new Date().toISOString().replaceAll(':', '-');
const backup = join(home, 'backups', 'codex-jev-router', `skill-suggestion-${stamp}`);
await mkdir(backup, { recursive: true, mode: 0o700 });
await chmod(backup, 0o700);
for (const change of changes) {
  if (change.original === null) continue;
  const target = join(backup, change.relative);
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await copyFile(change.path, target);
}
await writeFile(join(backup, 'manifest.json'), JSON.stringify({ changed: changes.map(change => ({ path: change.relative, existed: change.original !== null })) }, null, 2) + '\n', { mode: 0o600 });
for (const change of changes) {
  await mkdir(dirname(change.path), { recursive: true });
  const temp = `${change.path}.codex-jev-router-${process.pid}.tmp`;
  await writeFile(temp, change.updated, { mode: 0o600 });
  await rename(temp, change.path);
}
console.log(`Installed. Backup: ${backup}`);
