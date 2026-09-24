function stateText(state) {
  return typeof state === 'string' ? state : JSON.stringify(state);
}

function questionsForBooleanBackend(questions) {
  return Object.fromEntries(Object.entries(questions).map(([key, question]) => [key,
    question.type === 'noul' ? { ...question, type: 'boolean' } : question]));
}

export function nativeRequest(kind, input) {
  if (kind === 'nanojev') return { states: [{ id: 'route', state: input.state, questions: questionsForBooleanBackend(input.questions) }] };
  if (kind === 'minojev') return { id: 'route', state: input.state, questions: questionsForBooleanBackend(input.questions) };
  if (kind === 'mini-jev') {
    const properties = Object.fromEntries(Object.entries(input.questions).map(([key, question]) => {
      if (question.type === 'choice') return [key, {
        type: 'string', enum: Object.keys(question.criteria),
        description: `${question.instructions} ${Object.entries(question.criteria).map(([id, description]) => `${id}: ${description}`).join('; ')}`,
      }];
      if (question.type === 'noul') return [key, {
        type: 'boolean', description: `${question.instructions} true: ${question.criteria?.true || 'yes'}; false: ${question.criteria?.false || 'no'}`,
      }];
      throw new Error(`mini-jev does not support ${question.type}`);
    }));
    return { text: stateText(input.state), schema: { type: 'object', properties }, repeats: 1, with_labels: false };
  }
  return input;
}

function distribution(ids, values) {
  if (!Array.isArray(ids) || !Array.isArray(values) || ids.length !== values.length || ids.length < 2) throw new Error('Invalid candidate probabilities');
  const pairs = ids.map((id, index) => [id, values[index]]);
  if (new Set(ids).size !== ids.length || pairs.some(([id, value]) => typeof id !== 'string' || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) throw new Error('Invalid candidate probabilities');
  const total = values.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.01) throw new Error('Probabilities do not sum to one');
  return Object.fromEntries(pairs);
}

export function jevAnswer(question, probabilities) {
  const expected = question.type === 'choice' ? Object.keys(question.criteria) : ['false', 'true'];
  if (Object.keys(probabilities).length !== expected.length || expected.some(id => !Object.hasOwn(probabilities, id))) throw new Error('Decider returned different candidates');
  const valid = distribution(expected, expected.map(id => probabilities[id]));
  if (question.type === 'noul') return { type: 'noul', noul: valid.true };
  if (question.type !== 'choice') throw new Error(`Unsupported question type: ${question.type}`);
  const choice = expected.reduce((best, id) => valid[id] > valid[best] ? id : best);
  return { type: 'choice', choice, confidence: valid[choice], probabilities: valid };
}

export function nativeResponse(kind, input, response) {
  let answers;
  if (kind === 'nanojev') {
    const row = response?.states?.find(row => row.id === 'route');
    answers = Object.fromEntries(Object.entries(input.questions).map(([key, question]) => {
      const raw = row?.answers?.[key];
      return [key, jevAnswer(question, raw?.probabilities || {})];
    }));
  } else if (kind === 'minojev') {
    answers = Object.fromEntries(Object.entries(input.questions).map(([key, question]) => {
      const rows = response?.records?.filter(row => row.id === 'route' && row.qid === key);
      if (rows?.length !== 1) throw new Error(`Expected one minojev record for ${key}`);
      return [key, jevAnswer(question, distribution(rows[0].candidate_ids, rows[0].probabilities))];
    }));
  } else if (kind === 'mini-jev') {
    answers = Object.fromEntries(Object.entries(input.questions).map(([key, question]) => {
      const field = response?.arms?.split?.fields?.[key];
      return [key, jevAnswer(question, distribution(field?.options, field?.p))];
    }));
  } else return response;
  return { answers };
}
