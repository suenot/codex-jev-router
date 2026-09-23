import { evaluate, getChoiceAnswer, getNoulAnswer } from 'jevrouter';

export const SOL = 'gpt-6-sol';
export const LUNA = 'gpt-6-luna';
export const ASTRA = 'gpt-6-astra';

const QUESTIONS = {
  tier: {
    type: 'choice',
    instructions: 'Select the cheapest model likely to complete this Codex subagent task correctly. Sol is the normal choice. Pick Luna only for a bounded, low-risk task with clear instructions. Pick Astra only for exceptionally difficult reasoning where Sol is unlikely to succeed.',
    criteria: {
      luna: 'Simple, bounded, low-risk exploration, summarization, or mechanical changes with clear acceptance criteria.',
      sol: 'Normal implementation, debugging, review, or moderately difficult and ambiguous work. Default choice.',
      astra: 'Exceptionally hard, novel, or high-consequence work requiring deep multi-system reasoning beyond Sol.',
    },
  },
  exceptional: {
    type: 'noul',
    instructions: 'Is this task exceptionally difficult from the start, to the point that Sol is unlikely to succeed? Ordinary architecture, code review, and implementation do not qualify.',
    criteria: {
      true: 'Several interdependent systems, difficult novel reasoning, or high-stakes correctness with no straightforward approach.',
      false: 'A normal or moderately complex Codex task that Sol can likely solve.',
    },
  },
};

const effort = (model) => {
  if (model === ASTRA) return 'xhigh';
  if (model === LUNA) return 'medium';
  return 'high';
};

function score(answer, key) {
  const value = answer.probabilities?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function chooseModel({ tier, exceptional }, { role = 'default', solFailed = false } = {}) {
  if (solFailed) return { model: ASTRA, reasoning_effort: effort(ASTRA), reason: 'sol_failed' };
  if (tier.choice === 'astra' && score(tier, 'astra') >= 0.75 && tier.confidence >= 0.6 && exceptional.noul >= 0.8) {
    return { model: ASTRA, reasoning_effort: effort(ASTRA), reason: 'exceptional' };
  }
  if (role !== 'reviewer' && tier.choice === 'luna' && score(tier, 'luna') >= 0.85 && tier.confidence >= 0.75 && exceptional.noul <= 0.1) {
    return { model: LUNA, reasoning_effort: effort(LUNA), reason: 'simple' };
  }
  return { model: SOL, reasoning_effort: effort(SOL), reason: 'default' };
}

export function isSolFailureRetry(message) {
  return /^\[codex-router:sol-failed\][ \t]+\S/.test(message);
}

function containsCredential(message) {
  return /\b(?:api[_-]?key|secret|password|access[_-]?token)\s*[:=]\s*\S+|\bBearer\s+\S+|\bsk-[A-Za-z0-9_-]{16,}/i.test(message);
}

export async function routeSubagent(input, decide = evaluate) {
  const role = typeof input.agent_type === 'string' ? input.agent_type : 'default';
  const message = typeof input.message === 'string' ? input.message : '';
  const fallback = { model: SOL, reasoning_effort: effort(SOL), reason: 'fallback' };
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
