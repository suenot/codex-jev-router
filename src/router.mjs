import { getChoiceAnswer, getNoulAnswer } from 'jevrouter';
import { evaluateDecision } from './decider.mjs';

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
  if (role !== 'reviewer' && exceptional.noul <= 0.1 && tier.confidence >= 0.75) {
    if ((tier.choice === 'luna_low' && score(tier, 'luna_low') >= 0.85) || (tier.choice === 'luna' && score(tier, 'luna') >= 0.85)) {
      return { model: LUNA, reasoning_effort: 'low', reason: 'simple' };
    }
    if (tier.choice === 'luna_medium' && score(tier, 'luna_medium') >= 0.8) {
      return { model: LUNA, reasoning_effort: 'medium', reason: 'bounded' };
    }
    if (tier.choice === 'sol_low' && score(tier, 'sol_low') >= 0.8) {
      return { model: SOL, reasoning_effort: 'low', reason: 'focused' };
    }
  }
  return { model: SOL, reasoning_effort: 'high', reason: 'default' };
}

export function isSolFailureRetry(message) {
  return /^\[codex-router:sol-failed\][ \t]+\S/.test(message);
}

function containsCredential(message) {
  return /\b(?:api[_-]?key|secret|password|access[_-]?token)\s*[:=]\s*\S+|\bBearer\s+\S+|\bsk-[A-Za-z0-9_-]{16,}/i.test(message);
}

export async function routeSubagent(input, decide = evaluateDecision) {
  const role = typeof input.agent_type === 'string' ? input.agent_type : 'default';
  const message = typeof input.message === 'string' ? input.message : '';
  const fallback = { model: SOL, reasoning_effort: 'high', reason: 'fallback' };
  if (!message || message.startsWith('gAAAAA') || containsCredential(message)) return fallback;
  if (isSolFailureRetry(message)) return chooseModel({ tier: {}, exceptional: {} }, { role, solFailed: true });
  try {
    const raw = await decide({
      state: { role, task: message.slice(0, 4000) },
      questions: QUESTIONS,
    });
    return chooseModel({
      tier: getChoiceAnswer(raw, 'tier'),
      exceptional: getNoulAnswer(raw, 'exceptional'),
    }, { role });
  } catch {
    return fallback;
  }
}
