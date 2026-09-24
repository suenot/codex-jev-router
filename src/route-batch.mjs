import { logDecision } from './log-decision.mjs';
import { routeSubagents } from './router.mjs';

let raw = '';
for await (const chunk of process.stdin) {
  raw += chunk;
  if (raw.length > 40_000) {
    process.stderr.write('Batch is too long; supply up to eight short, sanitized task summaries.\n');
    process.exit(2);
  }
}

try {
  const tasks = JSON.parse(raw);
  const decisions = await routeSubagents(tasks);
  for (const [index, task] of tasks.entries()) {
    await logDecision({
      role: typeof task.agent_type === 'string' ? task.agent_type : 'default',
      message: typeof task.message === 'string' ? task.message : '',
      decision: decisions[index],
      mode: 'instruction_batch',
    });
  }
  process.stdout.write(`${JSON.stringify(decisions)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
