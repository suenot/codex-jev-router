import { decideBatch } from './batch-decisions.mjs';

let raw = '';
for await (const chunk of process.stdin) {
  raw += chunk;
  if (raw.length > 30_000) {
    process.stderr.write('Batch input is too long.\n');
    process.exit(2);
  }
}

try {
  const results = await decideBatch(JSON.parse(raw));
  process.stdout.write(`${JSON.stringify(results)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
