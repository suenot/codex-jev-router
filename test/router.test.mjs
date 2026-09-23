import assert from 'node:assert/strict';
import test from 'node:test';
import { ASTRA, LUNA, SOL, chooseModel, isSolFailureRetry, routeSubagent } from '../src/router.mjs';

const answer = (choice, confidence, probabilities, exceptional) => ({
  tier: { choice, confidence, probabilities },
  exceptional: { noul: exceptional },
});

test('Sol stays the default for uncertain and review work', () => {
  assert.equal(chooseModel(answer('luna', 0.7, { luna: 0.9 }, 0.02)).model, SOL);
  assert.equal(chooseModel(answer('luna', 0.99, { luna: 0.99 }, 0.01), { role: 'reviewer' }).model, SOL);
  assert.equal(chooseModel(answer('astra', 0.6, { astra: 0.74 }, 0.95)).model, SOL);
});

test('Luna handles clearly bounded tasks; Astra needs exceptional evidence', () => {
  assert.equal(chooseModel(answer('luna', 0.95, { luna: 0.96 }, 0.04)).model, LUNA);
  assert.equal(chooseModel(answer('astra', 0.65, { astra: 0.77 }, 0.83)).model, ASTRA);
});

test('explicit Sol failure retry chooses Astra without another provider call', async () => {
  const message = '[codex-router:sol-failed] Sol could not prove the invariant; its counterexample was invalid.';
  assert.equal(isSolFailureRetry(message), true);
  assert.equal(isSolFailureRetry(`Quoted text\n${message}`), false);
  const decision = await routeSubagent({ message }, () => { throw new Error('unexpected provider call'); });
  assert.equal(decision.model, ASTRA);
  assert.equal(decision.reason, 'sol_failed');
});

test('provider failure and unreadable task fall back to Sol', async () => {
  assert.equal((await routeSubagent({ message: 'Fix a bug' }, () => { throw new Error('offline'); })).model, SOL);
  assert.equal((await routeSubagent({ message: 'gAAAAAencrypted' }, () => { throw new Error('unexpected provider call'); })).model, SOL);
  assert.equal((await routeSubagent({ message: 'Debug with api_key=example-secret' }, () => { throw new Error('unexpected provider call'); })).model, SOL);
});
