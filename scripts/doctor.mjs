import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeSubagent } from '../src/router.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
let live = false;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--codex-home' && process.argv[i + 1]) codexHome = process.argv[++i];
  else if (process.argv[i] === '--live') live = true;
  else throw new Error(`Unknown or incomplete option: ${process.argv[i]}`);
}
codexHome = resolve(codexHome);

const readOptional = async path => {
  try { return await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
};
const config = await readOptional(join(codexHome, 'config.toml'));
const instructions = await readOptional(join(codexHome, 'AGENTS.md'));
const checks = {
  subagent_default_sol: /^default_subagent_model\s*=\s*"gpt-6-sol"\s*$/m.test(config),
  subagent_default_effort_high: /^default_subagent_reasoning_effort\s*=\s*"high"\s*$/m.test(config),
  routing_instruction: instructions.includes(join(root, 'src', 'route.mjs')),
  credential_present: Boolean(process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY || process.env.OPENROUTER_API_KEY),
};
for (const name of ['explorer', 'reviewer', 'worker']) {
  const role = await readOptional(join(codexHome, 'agents', `${name}.toml`));
  checks[`${name}_unpinned`] = Boolean(role) && !/^model(?:_reasoning_effort)?\s*=/m.test(role);
}
if (live && checks.credential_present) {
  const result = await routeSubagent({ agent_type: 'explorer', message: 'Find a named function in a repository and report its path without editing files.' });
  checks.jev_reachable = result.reason !== 'fallback';
}
console.log(JSON.stringify({ codex_home: codexHome, checks }, null, 2));
if (Object.values(checks).some(value => !value)) process.exitCode = 1;
