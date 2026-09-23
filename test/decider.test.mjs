import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { deciderConfig, evaluateDecision } from '../src/decider.mjs';
import { routeSubagent } from '../src/router.mjs';

const response = {
  answers: {
    tier: { type: 'choice', choice: 'luna_low', confidence: 0.96, probabilities: { luna_low: 0.96, luna_medium: 0.01, sol_low: 0.01, sol_high: 0.02 } },
    exceptional: { type: 'noul', noul: 0.02 },
  },
};

test('Laya-compatible HTTP decider receives typed questions and selects Luna', async () => {
  let request;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    request = { path: req.url, auth: req.headers.authorization, body: JSON.parse(Buffer.concat(chunks).toString()) };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(response));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const env = { CODEX_ROUTER_DECIDER: 'laya', CODEX_ROUTER_DECIDER_URL: `http://127.0.0.1:${server.address().port}/v1/systemone`, CODEX_ROUTER_DECIDER_MODEL: 'multilingual', CODEX_ROUTER_DECIDER_API_KEY: 'local-test-token' };
    const result = await routeSubagent({ agent_type: 'explorer', message: 'Locate a named function.' }, input => evaluateDecision(input, env));
    assert.equal(result.model, 'gpt-6-luna');
    assert.equal(result.reasoning_effort, 'low');
    assert.equal(request.path, '/v1/systemone');
    assert.equal(request.auth, 'Bearer local-test-token');
    assert.equal(request.body.model, 'multilingual');
    assert.equal(request.body.state.role, 'explorer');
    assert.equal(request.body.questions.tier.type, 'choice');
    assert.deepEqual(Object.keys(request.body.questions.tier.criteria), ['luna_low', 'luna_medium', 'sol_low', 'sol_high']);
    assert.equal(request.body.questions.exceptional.type, 'noul');
  } finally {
    server.close();
  }
});

test('command adapter accepts the same JSON contract without a shell', async () => {
  const code = `let raw = ''; process.stdin.on('data', chunk => raw += chunk); process.stdin.on('end', () => { const input = JSON.parse(raw); if (input.questions.tier.type !== 'choice') process.exit(2); process.stdout.write(${JSON.stringify(JSON.stringify(response))}); });`;
  const env = {
    CODEX_ROUTER_DECIDER: 'command',
    CODEX_ROUTER_DECIDER_COMMAND: process.execPath,
    CODEX_ROUTER_DECIDER_ARGS: JSON.stringify(['-e', code]),
  };
  const result = await routeSubagent({ message: 'Locate a named function.' }, input => evaluateDecision(input, env));
  assert.equal(result.model, 'gpt-6-luna');
});

test('Kev selects its local System One endpoint by default', () => {
  assert.deepEqual(deciderConfig({ CODEX_ROUTER_DECIDER: 'kev' }), {
    kind: 'kev', configured: true, url: 'http://127.0.0.1:8009/v1/systemone',
  });
});

test('invalid decider configuration fails closed to Sol high', async () => {
  const env = { CODEX_ROUTER_DECIDER: 'http', CODEX_ROUTER_DECIDER_URL: 'file:///tmp/decider' };
  assert.equal(deciderConfig(env).configured, false);
  const result = await routeSubagent({ message: 'Find a function.' }, input => evaluateDecision(input, env));
  assert.deepEqual(result, { model: 'gpt-6-sol', reasoning_effort: 'high', reason: 'fallback' });
});
