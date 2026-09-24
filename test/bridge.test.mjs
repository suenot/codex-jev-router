import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openJev, semif } from '../scripts/node-bridge.mjs';

const input = {
  state: { task: 'Find one symbol.' },
  questions: {
    tier: { type: 'choice', instructions: 'Choose a profile.', criteria: { luna_low: 'Exact lookup', sol_high: 'Complex work' } },
    exceptional: { type: 'noul', instructions: 'Exceptionally hard?', criteria: { true: 'Yes', false: 'No' } },
  },
};

test('SemIf bridge exchanges two typed questions with its JSONL scorer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'semif-bridge-test-'));
  try {
    const command = join(directory, 'fake-scorer');
    await writeFile(command, `#!${process.execPath}\nconst fs=require('fs'); const args=process.argv; const input=args[args.indexOf('--input')+1]; const output=args[args.indexOf('--output')+1]; const rows=fs.readFileSync(input,'utf8').trim().split('\\n').map(JSON.parse); if(rows.length!==2 || rows[0].options[0].description!=='Exact lookup') process.exit(2); fs.writeFileSync(output,rows.map(row=>JSON.stringify({id:row.id,option_ids:row.options.map(option=>option.id),probabilities:row.id==='tier'?[0.96,0.04]:[0.02,0.98]})).join('\\n')+'\\n');`);
    await chmod(command, 0o700);
    const result = await semif(input, { CODEX_ROUTER_SEMIF_MODEL: 'test', CODEX_ROUTER_SEMIF_REVISION: 'test', CODEX_ROUTER_SEMIF_COMMAND: command });
    assert.equal(result.answers.tier.choice, 'luna_low');
    assert.equal(result.answers.tier.confidence, 0.96);
    assert.equal(result.answers.exceptional.noul, 0.02);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('OpenJev bridge converts its probability field and releases its model', async () => {
  let disposed = false;
  const result = await openJev(input, {}, async () => ({
    async decide(state, questions) {
      assert.match(state, /Find one symbol/);
      assert.deepEqual(questions.tier.options, ['luna_low', 'sol_high']);
      return {
        tier: { probabilities: { luna_low: 0.9, sol_high: 0.1 } },
        exceptional: { probability: 0.04 },
      };
    },
    async dispose() { disposed = true; },
  }));
  assert.equal(result.answers.tier.choice, 'luna_low');
  assert.equal(result.answers.exceptional.noul, 0.04);
  assert.equal(disposed, true);
});
