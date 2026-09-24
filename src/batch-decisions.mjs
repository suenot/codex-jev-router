import { getChoiceAnswer, getNoulAnswer } from 'jevrouter';
import { evaluateDecision } from './decider.mjs';
import { containsCredential } from './privacy.mjs';

const NAME = /^[a-z][a-z0-9_]{0,31}$/;

function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected a batch decision object');
  const { items, questions, review_threshold: threshold = 0.8 } = input;
  if (!Array.isArray(items) || items.length < 3 || items.length > 24) throw new TypeError('Expected 3 to 24 items');
  if (items.some(item => !item || typeof item.id !== 'string' || !item.id || item.state === undefined)) throw new TypeError('Each item needs a string id and state');
  if (new Set(items.map(item => item.id)).size !== items.length) throw new TypeError('Item ids must be unique');
  if (!questions || typeof questions !== 'object' || Array.isArray(questions) || Object.keys(questions).length < 1 || Object.keys(questions).length > 2) {
    throw new TypeError('Expected one or two questions');
  }
  for (const [name, question] of Object.entries(questions)) {
    if (!NAME.test(name) || !question || !['choice', 'noul'].includes(question.type) || typeof question.instructions !== 'string' || !question.instructions.trim()) {
      throw new TypeError('Questions need a short name, choice or noul type, and instructions');
    }
    if (question.type === 'choice' && (!question.criteria || typeof question.criteria !== 'object' || Array.isArray(question.criteria) || Object.keys(question.criteria).length < 2)) {
      throw new TypeError('Choice questions need at least two criteria');
    }
  }
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold <= 0.5 || threshold > 1) throw new TypeError('review_threshold must be greater than 0.5 and at most 1');
  const rendered = JSON.stringify(input);
  if (rendered.length > 30_000) throw new TypeError('Batch input is too long');
  if (containsCredential(rendered.replaceAll('"', '')) || rendered.includes('gAAAAA')) {
    throw new TypeError('Batch input may contain credentials; supply sanitized items');
  }
  return { items, questions, threshold };
}

export async function decideBatch(input, decide = evaluateDecision) {
  const { items, questions, threshold } = validate(input);
  const requested = {};
  for (const [index] of items.entries()) {
    for (const [name, question] of Object.entries(questions)) {
      requested[`${name}_${index}`] = {
        ...question,
        instructions: `Answer only for item ${index} in state.items. ${question.instructions}`,
      };
    }
  }

  let raw;
  try {
    raw = await decide({ state: { items }, questions: requested });
  } catch {
    return items.map(item => ({ id: item.id, answers: {}, needs_review: true }));
  }

  return items.map((item, index) => {
    const answers = {};
    let needsReview = false;
    for (const [name, question] of Object.entries(questions)) {
      try {
        if (question.type === 'choice') {
          const answer = getChoiceAnswer(raw, `${name}_${index}`);
          if (!Object.hasOwn(question.criteria, answer.choice)) throw new Error('Unknown choice');
          const confidence = Math.min(answer.confidence, answer.probabilities[answer.choice] ?? 0);
          answers[name] = { choice: answer.choice, confidence };
          if (confidence < threshold) needsReview = true;
        } else {
          const answer = getNoulAnswer(raw, `${name}_${index}`);
          const confidence = Math.max(answer.noul, 1 - answer.noul);
          answers[name] = { value: answer.noul >= 0.5, probability: answer.noul, confidence };
          if (confidence < threshold) needsReview = true;
        }
      } catch {
        needsReview = true;
      }
    }
    return { id: item.id, answers, needs_review: needsReview };
  });
}
