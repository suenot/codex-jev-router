import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { skillMetadata, suggestSkill } from '../src/skill-suggestion.mjs';

const installer = new URL('../scripts/install-skill-suggestion.mjs', import.meta.url).pathname;
const hook = new URL('../src/skill-suggestion-hook.mjs', import.meta.url).pathname;
const skill = (name, description, body) => `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

test('two-stage skill selection injects only the matching skill and skips irrelevant prompts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codex-router-skill-'));
  try {
    const deck = join(root, 'deck', 'SKILL.md');
    const report = join(root, 'report', 'SKILL.md');
    await mkdir(join(root, 'deck'));
    await mkdir(join(root, 'report'));
    await writeFile(deck, skill('deck', 'Create presentation slides.', 'Build five slides.'));
    await writeFile(report, skill('report', 'Write a PDF report.', 'Render the PDF.'));
    let calls = 0;
    const decide = async request => {
      calls++;
      assert.match(request.state.request, /slides/);
      return calls === 1
        ? { answers: { skill: { type: 'choice', choice: 's0', probabilities: { s0: 0.9, s1: 0.1 } }, needed: { type: 'noul', noul: 0.9 } } }
        : { answers: { skill: { type: 'choice', choice: 's0', probabilities: { s0: 0.95, s1: 0.05 } }, fits: { type: 'noul', noul: 0.93 } } };
    };
    const result = await suggestSkill('Make five slides', [deck, report], decide, { CODEX_ROUTER_DECIDER: 'laya' });
    assert.match(result, /Build five slides/);
    assert.doesNotMatch(result, /Render the PDF/);
    assert.equal(calls, 2);
    const irrelevant = await suggestSkill('Explain a concept', [deck, report], async () => ({ answers: { skill: { type: 'choice', choice: 's0', probabilities: { s0: 0.7, s1: 0.3 } }, needed: { type: 'noul', noul: 0.1 } } }), { CODEX_ROUTER_DECIDER: 'laya' });
    assert.equal(irrelevant, '');
    assert.equal(skillMetadata(await readFile(deck, 'utf8')).name, 'deck');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('private prompts and unavailable hosted decider keep a local skill catalog', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codex-router-private-'));
  try {
    const path = join(root, 'SKILL.md');
    await writeFile(path, skill('deck', 'Create slides.', 'Build slides.'));
    const noCall = () => { throw new Error('must not call hosted decider'); };
    assert.match(await suggestSkill('Create slides', [path], noCall, { CODEX_ROUTER_DECIDER: 'jev', TYPESAFE_API_KEY: 'test' }), /Skill selection is unavailable/);
    assert.match(await suggestSkill('Create slides password=private', [path], noCall, { CODEX_ROUTER_DECIDER: 'laya' }), /Skill selection is unavailable/);
    assert.match(await suggestSkill('Use $deck for this', [path], noCall, { CODEX_ROUTER_DECIDER: 'jev' }), /Build slides/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('optional installer backs up config, hides selected skills, preserves hooks, and is idempotent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codex-router-install-skill-'));
  try {
    const home = join(root, 'codex');
    const skills = join(root, 'skills');
    await mkdir(home);
    await mkdir(join(skills, 'deck'), { recursive: true });
    await writeFile(join(skills, 'deck', 'SKILL.md'), skill('deck', 'Create slides.', 'Build slides.'));
    await writeFile(join(home, 'config.toml'), `model = "gpt-6-sol"\n\n[[skills.config]]\npath = ${JSON.stringify(join(skills, 'deck', 'SKILL.md'))}\nenabled = true\n\n[agents]\nmax_concurrent_threads_per_session = 3\n`);
    await writeFile(join(home, 'hooks.json'), JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo existing' }] }] } }));
    const args = [installer, '--codex-home', home, '--skills-dir', skills, '--hide-skills'];
    const env = { ...process.env, CODEX_ROUTER_DECIDER: 'laya' };
    execFileSync(process.execPath, [...args, '--dry-run'], { env });
    assert.equal((await readdir(home)).length, 2);
    execFileSync(process.execPath, args, { env });
    const config = await readFile(join(home, 'config.toml'), 'utf8');
    assert.match(config, /^model = "gpt-6-sol"$/m);
    assert.match(config, /^max_concurrent_threads_per_session = 3$/m);
    assert.equal((config.match(/^\[\[skills.config\]\]$/gm) || []).length, 1);
    assert.match(config, /^enabled = false$/m);
    const hooks = JSON.parse(await readFile(join(home, 'hooks.json'), 'utf8'));
    assert.equal(hooks.hooks.SessionStart[0].hooks[0].command, 'echo existing');
    assert.match(hooks.hooks.UserPromptSubmit[0].hooks[0].command, /skill-suggestion-hook\.mjs/);
    assert.equal(JSON.parse(await readFile(join(home, 'skill-suggestion.json'), 'utf8')).paths.length, 1);
    execFileSync(process.execPath, args, { env });
    assert.equal((await readdir(join(home, 'backups', 'codex-jev-router'))).length, 1);
    const event = { hook_event_name: 'UserPromptSubmit', prompt: 'Use $deck to make slides' };
    const output = execFileSync(process.execPath, [hook], { input: JSON.stringify(event), env: { ...process.env, CODEX_HOME: home, CODEX_ROUTER_DECIDER: 'jev' } });
    assert.match(JSON.parse(output.toString()).hookSpecificOutput.additionalContext, /Build slides/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
