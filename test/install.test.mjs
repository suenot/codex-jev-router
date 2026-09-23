import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const installer = new URL('../scripts/install.mjs', import.meta.url).pathname;

test('installer backs up existing settings, preserves unrelated sections, and is idempotent', async () => {
  const home = await mkdtemp(join(tmpdir(), 'codex-jev-router-'));
  try {
    await mkdir(join(home, 'agents'));
    await writeFile(join(home, 'config.toml'), 'model = "old"\nmodel_reasoning_effort = "max"\nplan_mode_reasoning_effort = "low"\n\n[plugins.test]\nenabled = true\n\n[agents]\nmax_concurrent_threads_per_session = 3\n');
    await writeFile(join(home, 'AGENTS.md'), '# Existing rules\n\nKeep this rule.\n');
    await writeFile(join(home, 'agents', 'explorer.toml'), 'name = "explorer"\nmodel = "old"\nmodel_reasoning_effort = "low"\nsandbox_mode = "read-only"\n');
    execFileSync(process.execPath, [installer, '--codex-home', home], { stdio: 'pipe' });
    const config = await readFile(join(home, 'config.toml'), 'utf8');
    assert.match(config, /^model = "old"$/m);
    assert.match(config, /^model_reasoning_effort = "max"$/m);
    assert.match(config, /^plan_mode_reasoning_effort = "low"$/m);
    assert.match(config, /^max_concurrent_threads_per_session = 3$/m);
    assert.match(config, /^\[plugins.test\]$/m);
    const instructions = await readFile(join(home, 'AGENTS.md'), 'utf8');
    assert.match(instructions, /Keep this rule/);
    assert.match(instructions, /src\/route.mjs/);
    const explorer = await readFile(join(home, 'agents', 'explorer.toml'), 'utf8');
    assert.doesNotMatch(explorer, /^model\s*=/m);
    assert.match(explorer, /sandbox_mode = "read-only"/);
    assert.match(await readFile(join(home, 'agents', 'worker.toml'), 'utf8'), /name = "worker"/);
    const backupRoot = join(home, 'backups', 'codex-jev-router');
    const backups = await readdir(backupRoot);
    assert.equal(backups.length, 1);
    assert.match(await readFile(join(backupRoot, backups[0], 'config.toml'), 'utf8'), /model = "old"/);
    execFileSync(process.execPath, [installer, '--codex-home', home], { stdio: 'pipe' });
    assert.equal((await readdir(backupRoot)).length, 1);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('installer creates a usable clean Codex profile and dry run leaves it untouched', async () => {
  const home = await mkdtemp(join(tmpdir(), 'codex-jev-router-clean-'));
  try {
    execFileSync(process.execPath, [installer, '--codex-home', home, '--dry-run'], { stdio: 'pipe' });
    assert.deepEqual(await readdir(home), []);
    execFileSync(process.execPath, [installer, '--codex-home', home], { stdio: 'pipe' });
    const config = await readFile(join(home, 'config.toml'), 'utf8');
    assert.match(config, /^\[agents\]$/m);
    assert.match(config, /^default_subagent_model = "gpt-6-sol"$/m);
    assert.doesNotMatch(config, /^model\s*=/m);
    assert.doesNotMatch(config, /^plan_mode_reasoning_effort\s*=/m);
    assert.match(await readFile(join(home, 'AGENTS.md'), 'utf8'), /codex-jev-router:start/);
    for (const name of ['explorer', 'reviewer', 'worker']) {
      assert.match(await readFile(join(home, 'agents', `${name}.toml`), 'utf8'), new RegExp(`name = "${name}"`));
    }
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
