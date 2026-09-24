import { createHash } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export async function logDecision({ role, message, decision, mode = 'instruction' }) {
  if (process.env.CODEX_ROUTER_LOG === '0') return;
  const line = JSON.stringify({
    at: new Date().toISOString(),
    mode,
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
