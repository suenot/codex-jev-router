import assert from 'node:assert/strict';
import test from 'node:test';
import { decideBatch } from '../src/batch-decisions.mjs';

const input = {
  items: [
    { id: 'a', state: { ticket: 'A billing question' } },
    { id: 'b', state: { ticket: 'Cannot pay' } },
    { id: 'c', state: { ticket: 'Unclear issue' } },
  ],
  questions: {
    category: { type: 'choice', instructions: 'Which team?', criteria: { billing: 'Billing', support: 'Support' } },
    urgent: { type: 'noul', instructions: 'Is it urgent?' },
  },
};

test('batch returns typed decisions and flags only uncertain or incomplete items', async () => {
  let calls = 0;
  const results = await decideBatch(input, async request => {
    calls++;
    assert.equal(request.state.items.length, 3);
    assert.equal(Object.keys(request.questions).length, 6);
    return { answers: {
      category_0: { type: 'choice', choice: 'billing', confidence: 0.96, probabilities: { billing: 0.96, support: 0.04 } },
      urgent_0: { type: 'noul', noul: 0.05 },
      category_1: { type: 'choice', choice: 'billing', confidence: 0.91, probabilities: { billing: 0.91, support: 0.09 } },
      urgent_1: { type: 'noul', noul: 0.54 },
      category_2: { type: 'choice', choice: 'support', confidence: 0.83, probabilities: { billing: 0.17, support: 0.83 } },
    } };
  });
  assert.equal(calls, 1);
  assert.deepEqual(results.map(result => result.needs_review), [false, true, true]);
  assert.equal(results[0].answers.category.choice, 'billing');
  assert.equal(results[1].answers.urgent.value, true);
  assert.equal(results[2].answers.urgent, undefined);
});

test('batch failure marks all items for review', async () => {
  const results = await decideBatch(input, () => { throw new Error('offline'); });
  assert.deepEqual(results.map(result => result.needs_review), [true, true, true]);
});

test('batch rejects tiny and credential-bearing inputs before calling the decider', async () => {
  await assert.rejects(decideBatch({ ...input, items: input.items.slice(0, 2) }), /3 to 24/);
  await assert.rejects(decideBatch({ ...input, items: [{ ...input.items[0], state: 'api_key=private' }, ...input.items.slice(1)] },
    () => { throw new Error('unexpected provider call'); }), /credentials/);
  await assert.rejects(decideBatch({ ...input, items: [{ ...input.items[0], state: { api_key: 'private' } }, ...input.items.slice(1)] },
    () => { throw new Error('unexpected provider call'); }), /credentials/);
});
