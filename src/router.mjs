import { getChoiceAnswer, getNoulAnswer } from 'jevrouter';
import { evaluateDecision } from './decider.mjs';
import { containsCredential } from './privacy.mjs';

export const SOL = 'gpt-6-sol';
export const LUNA = 'gpt-6-luna';

const QUESTIONS = {
  tier: {
    type: 'choice',
    instructions: 'Choose the lightest Codex subagent profile sufficient for this task. Judge the actual work, not labels such as search or research. Use sol_high when the scope or required judgment is uncertain.',
    criteria: {
      luna_low: 'One exact target and brief result: find a named symbol or exact log entry, read one known page for a fact, or make a trivial mechanical edit. Almost no judgment.',
      luna_medium: 'Clear bounded brief with several straightforward coordinated steps: extract facts from a few specified files or logs, summarize known material, or make small prescribed edits in known files. Little ambiguity.',
      sol_low: 'Short focused task needing Sol-level judgment: check one specific claim against an authoritative source, assess one small diff, or choose between two documented options. Limited investigation.',
      sol_high: 'Default for ambiguous or multi-source research, root-cause diagnosis, normal implementation, substantial code review, or work requiring synthesis and validation.',
    },
  },
  exceptional: {
    type: 'noul',
    instructions: 'Is this task exceptionally difficult from the start and likely to need Sol at ultra reasoning effort? Ordinary architecture, code review, and implementation do not qualify.',
    criteria: {
      true: 'Several interdependent systems, difficult novel reasoning, or high-stakes correctness with no straightforward approach.',
      false: 'A normal or moderately complex Codex task that Sol can likely solve at high effort.',
    },
  },
};

function score(answer, key) {
  const value = answer.probabilities?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function chooseModel({ tier, exceptional }, { role = 'default', solFailed = false } = {}) {
  if (solFailed) return { model: SOL, reasoning_effort: 'ultra', reason: 'sol_failed' };
  if (exceptional.noul >= 0.8) return { model: SOL, reasoning_effort: 'ultra', reason: 'exceptional' };
  if (role !== 'reviewer' && exceptional.noul <= 0.1) {
    const simple = (tier.choice === 'luna_low' && score(tier, 'luna_low') >= 0.85) ||
      (tier.choice === 'luna' && score(tier, 'luna') >= 0.85);
    if (tier.confidence >= 0.75 && simple) {
      return { model: LUNA, reasoning_effort: 'low', reason: 'simple' };
    }
    if (tier.choice === 'luna_medium' && tier.confidence >= 0.6 && score(tier, 'luna_medium') >= 0.7) {
      return { model: LUNA, reasoning_effort: 'medium', reason: 'bounded' };
    }
    if (tier.choice === 'sol_low' && tier.confidence >= 0.75 && score(tier, 'sol_low') >= 0.8) {
      return { model: SOL, reasoning_effort: 'low', reason: 'focused' };
    }
  }
  return { model: SOL, reasoning_effort: 'high', reason: 'default' };
}

export function isSolFailureRetry(message) {
  return /^\[codex-router:sol-failed\][ \t]+\S/.test(message);
}

const FALLBACK = Object.freeze({ model: SOL, reasoning_effort: 'high', reason: 'fallback' });

function prepareTask(input) {
  const role = typeof input.agent_type === 'string' ? input.agent_type : 'default';
  const message = typeof input.message === 'string' ? input.message : '';
  if (!message || message.startsWith('gAAAAA') || containsCredential(message)) return { role, message, local: FALLBACK };
  if (isSolFailureRetry(message)) return { role, message, local: chooseModel({ tier: {}, exceptional: {} }, { role, solFailed: true }) };
  return { role, message };
}

export async function routeSubagent(input, decide = evaluateDecision) {
  const task = prepareTask(input);
  if (task.local) return task.local;
  try {
    const raw = await decide({
      state: { role: task.role, task: task.message.slice(0, 4000) },
      questions: QUESTIONS,
    });
    return chooseModel({
      tier: getChoiceAnswer(raw, 'tier'),
      exceptional: getNoulAnswer(raw, 'exceptional'),
    }, { role: task.role });
  } catch {
    return FALLBACK;
  }
}

export async function routeSubagents(inputs, decide = evaluateDecision) {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 8 || inputs.some(input => !input || typeof input !== 'object' || Array.isArray(input))) {
    throw new TypeError('Expected an array of 1 to 8 subagent tasks');
  }
  if (inputs.length === 1) return [await routeSubagent(inputs[0], decide)];

  const tasks = inputs.map(prepareTask);
  const results = tasks.map(task => task.local);
  const pending = tasks.flatMap((task, index) => task.local ? [] : [{ ...task, index }]);
  if (pending.length === 0) return results;
  if (pending.length === 1) {
    results[pending[0].index] = await routeSubagent(inputs[pending[0].index], decide);
    return results;
  }

  const questions = {};
  for (const task of pending) {
    for (const [key, question] of Object.entries(QUESTIONS)) {
      questions[`${key}_${task.index}`] = {
        ...question,
        instructions: `Answer only for task ${task.index} in state.tasks. ${question.instructions}`,
      };
    }
  }
  try {
    const raw = await decide({
      state: { tasks: pending.map(task => ({ id: task.index, role: task.role, task: task.message.slice(0, 4000) })) },
      questions,
    });
    for (const task of pending) {
      try {
        results[task.index] = chooseModel({
          tier: getChoiceAnswer(raw, `tier_${task.index}`),
          exceptional: getNoulAnswer(raw, `exceptional_${task.index}`),
        }, { role: task.role });
      } catch {
        results[task.index] = FALLBACK;
      }
    }
  } catch {
    for (const task of pending) results[task.index] = FALLBACK;
  }
  return results;
}
