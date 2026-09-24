import { logDecision } from './log-decision.mjs';
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
await logDecision({ role, message, decision });
process.stdout.write(`${JSON.stringify(decision)}\n`);
