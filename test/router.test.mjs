import assert from 'node:assert/strict';
import test from 'node:test';
import { LUNA, SOL, chooseModel, isSolFailureRetry, routeSubagent } from '../src/router.mjs';

const answer = (choice, confidence, probabilities, exceptional) => ({
  tier: { choice, confidence, probabilities },
  exceptional: { noul: exceptional },
});

test('Sol stays the default for uncertain and review work', () => {
  assert.equal(chooseModel(answer('luna_medium', 0.7, { luna_medium: 0.9 }, 0.02)).model, SOL);
  assert.equal(chooseModel(answer('sol_low', 0.99, { sol_low: 0.99 }, 0.01), { role: 'reviewer' }).reasoning_effort, 'high');
  assert.equal(chooseModel(answer('sol_high', 0.99, { sol_high: 0.99 }, 0.79)).reasoning_effort, 'high');
});

test('Luna low and medium and Sol low handle confident bounded tasks', () => {
  const simple = chooseModel(answer('luna_low', 0.95, { luna_low: 0.96 }, 0.04));
  assert.equal(simple.model, LUNA);
  assert.equal(simple.reasoning_effort, 'low');
  assert.deepEqual(chooseModel(answer('luna_medium', 0.94, { luna_medium: 0.92 }, 0.04)), {
    model: LUNA, reasoning_effort: 'medium', reason: 'bounded',
  });
  assert.deepEqual(chooseModel(answer('sol_low', 0.94, { sol_low: 0.91 }, 0.04)), {
    model: SOL, reasoning_effort: 'low', reason: 'focused',
  });
  assert.equal(chooseModel(answer('luna', 0.95, { luna: 0.96 }, 0.04)).reasoning_effort, 'low');
});

test('uncertain routes use Sol high; exceptional tasks use Sol ultra', () => {
  assert.equal(chooseModel(answer('sol_low', 0.94, { sol_low: 0.79 }, 0.04)).reasoning_effort, 'high');
  assert.equal(chooseModel(answer('luna_medium', 0.94, { luna_medium: 0.92 }, 0.2)).reasoning_effort, 'high');
  const exceptional = chooseModel(answer('sol_high', 0.65, { sol_high: 0.77 }, 0.83));
  assert.equal(exceptional.model, SOL);
  assert.equal(exceptional.reasoning_effort, 'ultra');
});

test('explicit Sol failure retry chooses Sol ultra without another provider call', async () => {
  const message = '[codex-router:sol-failed] Sol could not prove the invariant; its counterexample was invalid.';
  assert.equal(isSolFailureRetry(message), true);
  assert.equal(isSolFailureRetry(`Quoted text\n${message}`), false);
  const decision = await routeSubagent({ message }, () => { throw new Error('unexpected provider call'); });
  assert.equal(decision.model, SOL);
  assert.equal(decision.reasoning_effort, 'ultra');
  assert.equal(decision.reason, 'sol_failed');
});

test('provider failure and unreadable task fall back to Sol', async () => {
  assert.equal((await routeSubagent({ message: 'Fix a bug' }, () => { throw new Error('offline'); })).model, SOL);
  assert.equal((await routeSubagent({ message: 'gAAAAAencrypted' }, () => { throw new Error('unexpected provider call'); })).model, SOL);
  assert.equal((await routeSubagent({ message: 'Debug with api_key=example-secret' }, () => { throw new Error('unexpected provider call'); })).model, SOL);
});
