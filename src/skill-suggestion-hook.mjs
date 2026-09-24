import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { suggestSkill } from './skill-suggestion.mjs';

const home = process.env.CODEX_HOME || join(homedir(), '.codex');
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 1_000_000) process.exit(0);
}
try {
  const event = JSON.parse(input);
  const config = JSON.parse(await readFile(join(home, 'skill-suggestion.json'), 'utf8'));
  const additionalContext = await suggestSkill(event.prompt, config.paths);
  if (additionalContext) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext } }) + '\n');
} catch {
  // A broken optional hook must not block the user prompt.
}
