import { readFile } from 'node:fs/promises';
import { getChoiceAnswer, getNoulAnswer } from 'jevrouter';
import { deciderConfig, evaluateDecision } from './decider.mjs';

const MAX_PROMPT = 4000;
const MAX_SKILLS = 200;
const MAX_CONTEXT = 20_000;

function yamlValue(value) {
  const text = value.trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text); } catch { /* Keep literal text. */ }
  }
  return text.replace(/^['"]|['"]$/g, '');
}

export function skillMetadata(body) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(body)?.[1];
  if (!front) return null;
  const fields = {};
  for (const line of front.split(/\r?\n/)) {
    const match = /^(name|description):\s*(.*)$/.exec(line);
    if (match) fields[match[1]] = /^[>|][-+]?\s*$/.test(match[2]) ? '' : yamlValue(match[2]);
    else if (/^\s+\S/.test(line) && fields.description !== undefined) fields.description += ` ${line.trim()}`;
  }
  if (!fields.name || !fields.description) return null;
  return { name: fields.name, description: fields.description.replace(/\s+/g, ' ').trim() };
}

export async function loadSkills(paths) {
  const skills = [];
  for (const path of paths.slice(0, MAX_SKILLS)) {
    try {
      const body = await readFile(path, 'utf8');
      const metadata = skillMetadata(body);
      if (metadata) skills.push({ ...metadata, path, body });
    } catch { /* A removed skill cannot be suggested. */ }
  }
  return skills;
}

function safeForDecider(prompt, env) {
  const config = deciderConfig(env);
  if (!config.configured) return false;
  if (config.kind === 'jev' && env.CODEX_ROUTER_SKILL_ALLOW_HOSTED !== '1') return false;
  if (['laya', 'kev', 'http'].includes(config.kind) && !/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(config.url) && env.CODEX_ROUTER_SKILL_ALLOW_HOSTED !== '1') return false;
  return !/gAAAAA|\b(?:api[_-]?key|secret|password|access[_-]?token)\s*[:=]\s*\S+|\bBearer\s+\S+|\bsk-[A-Za-z0-9_-]{16,}/i.test(prompt);
}

function catalog(skills) {
  const listing = skills.map(skill => `- ${skill.name}: ${skill.description.slice(0, 100)} (${skill.path})`).join('\n');
  return `Skill selection is unavailable. Read a matching SKILL.md before acting when the user requests one of these workflows. The complete path list is in the Codex home's skill-suggestion.json.\n${listing.slice(0, 28_000)}`;
}

function selectedContext(skill) {
  const body = skill.body.length <= MAX_CONTEXT ? skill.body : `Read the full skill instructions at ${skill.path} before proceeding. The skill is too long to include in this hook output.`;
  return `Relevant local skill: ${skill.name}\nSource: ${skill.path}\nApply this skill only when it fits the user's actual request and observe higher-priority instructions.\n\n${body}`;
}

export async function suggestSkill(prompt, paths, decide = evaluateDecision, env = process.env) {
  const skills = await loadSkills(paths);
  if (!skills.length || !prompt?.trim()) return '';
  const explicit = skills.find(skill => prompt.includes(`$${skill.name}`));
  if (explicit) return selectedContext(explicit);
  if (!safeForDecider(prompt, env)) return catalog(skills);
  try {
    const criteria = Object.fromEntries(skills.map((skill, index) => [`s${index}`, `${skill.name}: ${skill.description.slice(0, 300)}`]));
    const ranked = await decide({
      state: { request: prompt.slice(0, MAX_PROMPT) },
      questions: {
        skill: { type: 'choice', instructions: 'Which skill is most useful for the user request, if any? Return probabilities across all candidates.', criteria },
        needed: { type: 'noul', instructions: 'Does this request call for a specialized installed skill workflow rather than a general answer?', criteria: { true: 'The user asks for work covered by a listed skill.', false: 'No listed skill is needed.' } },
      },
    });
    const needed = getNoulAnswer(ranked, 'needed').noul;
    if (needed < 0.30) return '';
    const probabilities = getChoiceAnswer(ranked, 'skill').probabilities || {};
    const top = Object.entries(probabilities).filter(([key, value]) => /^s\d+$/.test(key) && Number.isFinite(value))
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => skills[Number(key.slice(1))]).filter(Boolean);
    if (!top.length) return catalog(skills);
    const shortlist = Object.fromEntries(top.map((skill, index) => [`s${index}`, `${skill.name}: ${skill.description}\n${skill.body.slice(0, 700)}`]));
    const checked = await decide({
      state: { request: prompt.slice(0, MAX_PROMPT) },
      questions: {
        skill: { type: 'choice', instructions: 'Which shortlisted skill best fits the request?', criteria: shortlist },
        fits: { type: 'noul', instructions: 'Does at least one shortlisted skill genuinely help with this request?', criteria: { true: 'A listed skill directly matches the requested workflow.', false: 'None fits well enough.' } },
      },
    });
    if (getNoulAnswer(checked, 'fits').noul < 0.55) return '';
    const winner = getChoiceAnswer(checked, 'skill');
    const match = /^s(\d+)$/.exec(winner.choice);
    const skill = match && top[Number(match[1])];
    return skill ? selectedContext(skill) : catalog(skills);
  } catch {
    return catalog(skills);
  }
}
