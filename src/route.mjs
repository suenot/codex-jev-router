import { createHash } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { routeSubagent } from './router.mjs';

const role = process.argv.find(arg => arg.startsWith('--role='))?.slice('--role='.length) || 'default';
let message = '';
for await (const chunk of process.stdin) {
  message += chunk;
  if (message.length > 20_000) {
    process.stderr.write('Task summary is too long; supply a short summary.\n');
    process.exit(2);
  }
}

const decision = await routeSubagent({ agent_type: role, message: message.trim() });
if (process.env.CODEX_ROUTER_LOG !== '0') {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    mode: 'instruction',
    role,
    selected: decision.model,
    reason: decision.reason,
    task_hash: createHash('sha256').update(message).digest('hex').slice(0, 16),
  });
  try {
    await appendFile(join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'router-decisions.jsonl'), `${line}\n`, { mode: 0o600 });
  } catch {
    // Logging must not stop a subagent launch.
  }
}
process.stdout.write(`${JSON.stringify(decision)}\n`);
