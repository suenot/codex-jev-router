# Codex Jev Router

[Русская инструкция](README.ru.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md)

<p align="center">
  <img src="assets/subagent-routing-comic.png" alt="A small decider routes a simple lookup to Luna, an ordinary bug to Sol, and a complex task to Sol with deeper reasoning." width="820">
</p>

One short decision before each subagent selects Luna low or medium, Sol low or high, or Sol ultra for exceptional work.

This repository reproduces my Codex subagent setup with [JevRouter](https://github.com/BillionsBobby/JevRouter) or another typed decision engine. It is meant to be handed to a future Codex session as an instruction: **read this file, clone the repository, run the installer, and verify the result**. The installer modifies only local Codex configuration and creates a backup first. It does not require a server deployment.

The [separate benchmark repository](https://github.com/suenot/codex-jev-router-benchmarks) contains the [full report](https://github.com/suenot/codex-jev-router-benchmarks/blob/main/BENCHMARK.md), runner, task data, and traces. It includes real Django source tasks routed to Luna low, Luna medium, and Sol low, plus a SWE-bench Verified Django fix that Luna medium and clean Sol high each passed in three runs. Codex and Jev tokens are reported separately. Earlier synthetic results remain labeled historical.

**Measured Codex token change:** 15.8% fewer tokens across nine paired Django source-task runs (450,240 → 379,265; 9/9 correct in each arm), and 68.8% fewer across three paired runs of one bounded Django fix (1,355,801 → 422,815; 3/3 official tests passed in each arm). These are results for selected tasks, not a general expected saving. Jev decision tokens are excluded from these percentages and reported separately in the [benchmark analysis](https://github.com/suenot/codex-jev-router-benchmarks/blob/main/BENCHMARK.md#measured-codex-token-change).

## What it installs

| Setting | Value |
| --- | --- |
| Normal subagent task or fallback | `gpt-6-sol`, `high` reasoning |
| Very simple, bounded subagent task | `gpt-6-luna`, `low`, only with strong decider confidence |
| Clear, bounded task with a few straightforward steps or a prescribed small edit | `gpt-6-luna`, `medium`, when the decider prefers it with sufficient confidence |
| Short, focused task requiring Sol-level judgment | `gpt-6-sol`, `low`, only with strong decider confidence |
| Exceptional task or verified Sol failure | `gpt-6-sol`, `ultra` |

The installer configures only subagent model defaults, adds a routing section to `~/.codex/AGENTS.md`, and removes fixed models from the `explorer`, `reviewer`, and `worker` role files. It creates those role files when missing. A parent agent routes a short task summary before `spawn_agent`, then passes the selected `model` and `reasoning_effort` explicitly. The `reviewer` role remains on Sol high unless the task qualifies for Sol ultra.

### Search and research

The router also chooses models for **delegated** web research and file or log searches. It chooses a model for the subagent session, not for each web or shell search call. When the parent agent searches directly, it keeps its current model. Delegate only when the research is useful as an independent task; use the `default` role for web research and `explorer` for read-only file or log search.

| Delegated task | Expected route |
| --- | --- |
| Find one named symbol, exact log entry, or fact on one known official page | Luna low when the decider is confident |
| Extract facts from a few specified files or logs and return a structured summary | Luna medium when the decider is confident |
| Verify one specific claim against an authoritative page or compare two documented options | Sol low when the decider is confident |
| Compare current sources, resolve conflicting claims, or synthesize research | Sol high |
| Correlate logs across services or trace an ambiguous cause through files | Sol high |
| Exceptionally difficult investigation or a verified Sol failure | Sol ultra |

Summaries sent to the decider should describe the search objective and scope without copying private logs, source code, or credentials. Uncertain decisions fall back to Sol high.

This is an **instruction-driven workflow**. In a local Codex CLI 0.156.1 smoke test, `collaboration.spawn_agent` did not trigger a `PreToolUse` hook and carried an encrypted task message. The setup therefore does not claim to enforce routing at the tool boundary. [Codex subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) describes explicit spawn values and role overrides.

## Instructions for Codex

When the user asks you to configure Codex like this repository:

1. Read this file and the local `AGENTS.md` instructions. Check that the user has not requested different model choices.
2. Clone the repository into a separate local directory. Do not copy credentials into the clone.
3. Run the commands below, inspect the dry-run file list, then install. The installer makes timestamped backups before changing files.
4. Select the decision backend below. Run the doctor command. Report any missing backend configuration or connection failure. Tell the user that existing Codex sessions need a restart to load the new configuration.
5. Do not claim automatic hook enforcement or guaranteed savings. Read the [benchmark report](https://github.com/suenot/codex-jev-router-benchmarks/blob/main/BENCHMARK.md) before making performance claims. Run an actual subagent smoke test if the current Codex build permits it.

```sh
gh repo clone suenot/codex-jev-router
cd codex-jev-router
npm ci
npm run check
node scripts/install.mjs --dry-run
node scripts/install.mjs
npm run doctor -- --live
```

The `npm ci` dependency is pinned to a JevRouter commit; npm may use GitHub SSH for that dependency. Node.js 20+ and GitHub access are required. To target a nonstandard Codex profile, pass `--codex-home /absolute/path` to `install.mjs` and `doctor.mjs`, or set `CODEX_HOME`.

## Decision backends

`CODEX_ROUTER_DECIDER` selects the decision engine. Set it in the environment inherited by Codex commands. The default is `jev`, preserving existing installations. **Only the decider changes; subagent models are always Codex models.** `http` and `command` name integration methods, not Jev alternatives. A compatible server must accept a JSON state plus both `choice` and `noul` questions; a matching URL alone is insufficient.

| Value | Integration | Configuration |
| --- | --- | --- |
| `jev` (default) | Hosted Jev via JevRouter | `TYPESAFE_API_KEY`, `JEV_API_KEY`, or `OPENROUTER_API_KEY` |
| `laya` | Local [Laya](https://github.com/NandhaKishorM/laya) server | Default `http://127.0.0.1:8000/v1/systemone`; optional `CODEX_ROUTER_DECIDER_URL` |
| `kev` | Local [Kev](https://github.com/jaredpalmer/kev) server | Default `http://127.0.0.1:8009/v1/systemone`; optional `CODEX_ROUTER_DECIDER_URL` |
| `simple-jev`, `open-jev-zefan`, `open-jev-dasein` | Local servers with Jev-shaped responses | Built-in loopback URL; optional `CODEX_ROUTER_DECIDER_URL` |
| `nanojev`, `minojev`, `mini-jev` | Local servers with native protocol conversion | Built-in loopback URL; optional `CODEX_ROUTER_DECIDER_URL` |
| `semif`, `jevlike`, `anyjev`, `open-jev-nico` | Local CLI or library bridge | Install the upstream runtime and set its required model or checkpoint environment variable |
| `http` | Any Jev-compatible `POST /v1/systemone` service | Required `CODEX_ROUTER_DECIDER_URL` |
| `command` | Any other engine via a local executable adapter | Required `CODEX_ROUTER_DECIDER_COMMAND`; optional `CODEX_ROUTER_DECIDER_ARGS` as a JSON string array |

The [alternative backend guide](BACKENDS.md) lists all ten projects, their actual interfaces, setup variables, and limitations. These presets are optional; the default remains hosted Jev. `CODEX_ROUTER_DECIDER_TIMEOUT_MS` can raise the 15-second HTTP timeout or 120-second one-shot bridge timeout (1,000–600,000 ms). A local model's probabilities are not automatically calibrated for this router's confidence thresholds. Test its decisions on your tasks before relying on cheaper routes.

For HTTP backends, `CODEX_ROUTER_DECIDER_API_KEY` adds a bearer token and `CODEX_ROUTER_DECIDER_MODEL` sets the optional request `model` where supported. `simple-jev` defaults to `Qwen/Qwen3.5-0.8B`; set the model variable if the server serves another ID. The `command` adapter receives one JSON request on stdin and must write one Jev-shaped JSON response to stdout. It runs without a shell. The request has `state` and `questions`; the response must contain `answers.tier` (`choice`, `confidence`, `probabilities`) and `answers.exceptional` (`noul`). The `tier` choice is `luna_low`, `luna_medium`, `sol_low`, or `sol_high`; older adapter responses using `luna` still select Luna low. The router validates the answer using JevRouter's typed helpers. A failed or malformed response selects Sol high.

Example adapter response:

```json
{"answers":{"tier":{"type":"choice","choice":"sol_low","confidence":0.9,"probabilities":{"luna_low":0.02,"luna_medium":0.03,"sol_low":0.9,"sol_high":0.05}},"exceptional":{"type":"noul","noul":0.02}}}
```

For local Laya, install and start its [Jev-compatible HTTP server](https://github.com/NandhaKishorM/laya#self-hosting-http-server-jev-compatible) separately:

```sh
python3 -m venv .venv-laya
.venv-laya/bin/python -m pip install 'laya[serve]'
LAYA_HOST=127.0.0.1 LAYA_DEVICE=cpu .venv-laya/bin/laya-serve
```

Then, in the environment that launches Codex, set `export CODEX_ROUTER_DECIDER=laya` and run `npm run doctor -- --live`. Keep Laya bound to loopback if the summaries should stay on this machine. Its checkpoints can be downloaded on first use; warm the server before a live check. Laya's checkpoints have finite input limits, so keep routing summaries short. A shell export in `.zshrc` reaches only processes that inherit that shell environment; a GUI-launched Codex process may need its own environment setup.

For Kev, follow its [local server setup](https://github.com/jaredpalmer/kev/blob/main/README.md#quick-start), start it on port 8009, then set `export CODEX_ROUTER_DECIDER=kev` in the Codex environment. Kev's default model is `kev-latest`; its server accepts the text state and typed questions used here. If the server requires `KEV_API_KEY`, set the same value as `CODEX_ROUTER_DECIDER_API_KEY` for the client. Model weights and runtime are managed by Kev, not this repository.

[PlayJev](https://github.com/OmniJev/PlayJev/blob/main/playjev/serve.py) also exposes `/v1/systemone`, but it requires image frames and supports only `choice`; it rejects the text state and `noul` question used by this router. It is a game-playing model, so it is not a suitable backend here.

For a noncompatible engine, configure a local wrapper, for example `CODEX_ROUTER_DECIDER=command`, `CODEX_ROUTER_DECIDER_COMMAND=/absolute/path/to/adapter`, and optionally `CODEX_ROUTER_DECIDER_ARGS='["--model","local"]'`. The wrapper translates the request and returns the typed response. A failed, malformed, or timed-out decision safely selects Sol high.

## Hosted Jev credential and privacy

The default hosted Jev backend needs one of `TYPESAFE_API_KEY`, `JEV_API_KEY`, or `OPENROUTER_API_KEY` in the **Codex command environment**. Supply it through your existing secret manager or shell environment. Do not write it into this repository, `AGENTS.md`, or `config.toml`. `npm run doctor` reports whether the selected backend is configured; `npm run doctor -- --live` checks a real decision without displaying credentials.

The router sends the role and up to 4,000 characters of a task summary to the selected decider. With hosted Jev, that summary leaves the machine; with loopback Laya, it stays local. Common credential patterns and encrypted messages cause a local Sol fallback. These checks cannot detect every secret, so the caller must sanitize the summary. The summary is not stored; `~/.codex/router-decisions.jsonl` stores the chosen model, role, reason, timestamp, and a truncated task hash. If the decider is unavailable, the router returns Sol high. In our tested Codex `read-only` sandbox, outbound Jev access was unavailable, so it also returned Sol. The installer does not relax sandbox or network settings.

## Direct routing and retry

```sh
printf '%s\n' 'Find the definition of calculateTotal and report its path.' \
  | node src/route.mjs --role=explorer
```

The command prints JSON with `model`, `reasoning_effort`, and `reason`. Pass the first two fields to `spawn_agent`. Sol `ultra` is selected up front only when the decider reports a sufficiently exceptional task. After a **substantive, observed Sol failure**, start the new routing summary with `[codex-router:sol-failed]` followed by the failure description. The parent agent must verify the failure; this marker is not proof by itself.

## Optional skill suggestion

The [Claude Code Jev Skill Suggestion mod](https://www.aitmpl.com/component/mods/productivity/jev-skill-suggestion) uses Claude-specific function hooks. This repository supplies a Codex `UserPromptSubmit` hook instead. It ranks local skills by their `SKILL.md` descriptions, checks up to three candidates against their instructions, and adds at most one matching skill to the turn. [Codex already loads full skill instructions on demand](https://learn.chatgpt.com/docs/build-skills), so suggestion alone does **not** remove its initial list of skill names and descriptions.

Install the hook for an explicit directory of local skills. Add `--hide-skills` to disable those skills in Codex's native catalog and let the hook supply one when relevant. This is the mode that can remove their listing from the initial context; the installer does not hide skills unless asked. Use a trusted local Laya, Kev, or command backend for that mode:

```sh
export CODEX_ROUTER_DECIDER=laya
node scripts/install-skill-suggestion.mjs --skills-dir "$HOME/.codex/skills" --skills-dir "$HOME/.agents/skills" --hide-skills --dry-run
node scripts/install-skill-suggestion.mjs --skills-dir "$HOME/.codex/skills" --skills-dir "$HOME/.agents/skills" --hide-skills
```

Pass `--skills-dir` more than once to manage additional directories. Without `--hide-skills`, the hook only adds a recommendation; it does not save listing tokens. The installer backs up changed files, preserves existing hooks, and writes `~/.codex/skill-suggestion.json`. Restart Codex and review/trust the new hook with `/hooks`; untrusted hooks are skipped. A new skill requires rerunning the installer. Native `$skill` invocation of a disabled skill is unavailable; include `$skill-name` in the prompt for this hook to load it explicitly. Other skill sources, including plugin and system skills, are unaffected.

The hook does not send prompts to a hosted decider by default. To permit that deliberately, set `CODEX_ROUTER_SKILL_ALLOW_HOSTED=1` in the environment inherited by Codex **and** during installation with `--hide-skills`. Then up to 4,000 prompt characters, skill descriptions, and up to 700 characters from each shortlisted skill can reach that backend. Common credential patterns bypass the decider and expose a local fallback catalog instead. A failed or unavailable decider also exposes that catalog for the turn, so token savings disappear for that turn. The hook cannot guarantee that all private data is detected. We have not measured a Codex token saving or skill-selection accuracy for this optional mode; verify those on your own workload before making a savings claim.

## Rollback

Each installation writes a manifest and copies every changed existing file to `~/.codex/backups/codex-jev-router/<timestamp>/`. Restore only the files listed in that manifest. For a file marked `existed: false`, remove the installed file only if no later changes depend on it. Merge later edits rather than overwriting them. Restart Codex after restoring configuration.

This directory has its own Git repository. Installing it changes local Codex files outside Git; the installer never commits or publishes those local settings.
