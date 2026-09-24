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
    kind: 'kev', configured: true, url: 'http://127.0.0.1:8009/v1/systemone', timeout: 15000,
  });
});

test('named compatible servers have usable local endpoints', () => {
  for (const kind of ['simple-jev', 'open-jev-zefan', 'open-jev-dasein']) {
    const config = deciderConfig({ CODEX_ROUTER_DECIDER: kind });
    assert.equal(config.configured, true);
    assert.match(config.url, /^http:\/\/127\.0\.0\.1:/);
  }
});

test('simple-jev includes its served model ID', async () => {
  let body;
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    body = JSON.parse(raw);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(response));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const env = { CODEX_ROUTER_DECIDER: 'simple-jev', CODEX_ROUTER_DECIDER_URL: `http://127.0.0.1:${server.address().port}/v1/classifier` };
    const result = await routeSubagent({ message: 'Find one symbol.' }, input => evaluateDecision(input, env));
    assert.equal(result.model, 'gpt-6-luna');
    assert.equal(body.model, 'Qwen/Qwen3.5-0.8B');
  } finally {
    server.close();
  }
});

test('local library bridges require their upstream model or checkpoint', () => {
  assert.equal(deciderConfig({ CODEX_ROUTER_DECIDER: 'semif' }).configured, false);
  assert.equal(deciderConfig({ CODEX_ROUTER_DECIDER: 'jevlike' }).configured, false);
  assert.equal(deciderConfig({ CODEX_ROUTER_DECIDER: 'anyjev' }).configured, false);
  assert.equal(deciderConfig({ CODEX_ROUTER_DECIDER: 'open-jev-nico' }).configured, true);
  const configured = deciderConfig({ CODEX_ROUTER_DECIDER: 'semif', CODEX_ROUTER_SEMIF_MODEL: 'local', CODEX_ROUTER_SEMIF_REVISION: 'sha' });
  assert.equal(configured.configured, true);
  assert.equal(configured.timeout, 120000);
  assert.match(configured.args[0], /node-bridge\.mjs$/);
});

for (const [kind, reply, path, check] of [
  ['nanojev', { states: [{ id: 'route', answers: {
    tier: { type: 'choice', probabilities: response.answers.tier.probabilities, choice: 'luna_low' },
    exceptional: { type: 'boolean', probabilities: { false: 0.98, true: 0.02 }, p_true: 0.02 },
  } }] }, '/api/evaluate', body => {
    assert.equal(body.states[0].questions.exceptional.type, 'boolean');
    assert.equal(body.states[0].questions.tier.criteria.luna_low.startsWith('One exact'), true);
  }],
  ['minojev', { records: [
    { id: 'route', qid: 'tier', candidate_ids: ['luna_low', 'luna_medium', 'sol_low', 'sol_high'], probabilities: [0.96, 0.01, 0.01, 0.02] },
    { id: 'route', qid: 'exceptional', candidate_ids: ['false', 'true'], probabilities: [0.98, 0.02] },
  ] }, '/score', body => assert.equal(body.questions.exceptional.type, 'boolean')],
  ['mini-jev', { arms: { split: { fields: {
    tier: { options: ['luna_low', 'luna_medium', 'sol_low', 'sol_high'], p: [0.96, 0.01, 0.01, 0.02] },
    exceptional: { options: ['true', 'false'], p: [0.02, 0.98] },
  } } } }, '/run', body => {
    assert.equal(body.schema.properties.tier.enum.length, 4);
    assert.equal(body.with_labels, false);
    assert.equal(body.repeats, 1);
  }],
]) {
  test(`${kind} converts its native request and response`, async () => {
    let observed;
    const server = createServer(async (req, res) => {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      observed = { path: req.url, body: JSON.parse(raw) };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(reply));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const env = { CODEX_ROUTER_DECIDER: kind, CODEX_ROUTER_DECIDER_URL: `http://127.0.0.1:${server.address().port}${path}` };
      const result = await routeSubagent({ message: 'Find a named function.' }, input => evaluateDecision(input, env));
      assert.equal(result.model, 'gpt-6-luna');
      assert.equal(result.reasoning_effort, 'low');
      assert.equal(observed.path, path);
      check(observed.body);
    } finally {
      server.close();
    }
  });
}

test('malformed native probabilities fail closed', async () => {
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ states: [{ id: 'route', answers: {
      tier: { probabilities: { luna_low: 1.4 } }, exceptional: { probabilities: { false: 1, true: 0 } },
    } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const env = { CODEX_ROUTER_DECIDER: 'nanojev', CODEX_ROUTER_DECIDER_URL: `http://127.0.0.1:${server.address().port}/api/evaluate` };
    const result = await routeSubagent({ message: 'Find a named function.' }, input => evaluateDecision(input, env));
    assert.equal(result.reason, 'fallback');
  } finally {
    server.close();
  }
});

test('invalid decider configuration fails closed to Sol high', async () => {
  const env = { CODEX_ROUTER_DECIDER: 'http', CODEX_ROUTER_DECIDER_URL: 'file:///tmp/decider' };
  assert.equal(deciderConfig(env).configured, false);
  const result = await routeSubagent({ message: 'Find a function.' }, input => evaluateDecision(input, env));
  assert.deepEqual(result, { model: 'gpt-6-sol', reasoning_effort: 'high', reason: 'fallback' });
});
