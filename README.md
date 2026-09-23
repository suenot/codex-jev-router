# Codex Jev Router

[Русская инструкция](README.ru.md)

This repository reproduces my Codex subagent setup with [JevRouter](https://github.com/BillionsBobby/JevRouter). It is meant to be handed to a future Codex session as an instruction: **read this file, clone the repository, run the installer, and verify the result**. The installer modifies only local Codex configuration and creates a backup first. It does not require a server deployment.

## What it installs

| Setting | Value |
| --- | --- |
| Main Codex model | `gpt-6-sol`, `high` reasoning |
| Plan mode reasoning | `xhigh` (the model remains Sol) |
| Subagent fallback | `gpt-6-sol`, `high` reasoning |
| Simple, bounded subagent task | `gpt-6-luna`, `medium`, only with strong Jev confidence |
| Exceptional task or verified Sol failure | `gpt-6-astra`, `xhigh` |

The installer adds a routing section to `~/.codex/AGENTS.md` and removes fixed models from the `explorer`, `reviewer`, and `worker` role files. It creates those role files when missing. A parent agent routes a short task summary before `spawn_agent`, then passes the selected `model` and `reasoning_effort` explicitly. Review tasks remain on Sol unless Astra qualifies.

This is an **instruction-driven workflow**. In a local Codex CLI 0.156.1 smoke test, `collaboration.spawn_agent` did not trigger a `PreToolUse` hook and carried an encrypted task message. The setup therefore does not claim to enforce routing at the tool boundary. [Codex subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) describes explicit spawn values and role overrides.

## Instructions for Codex

When the user asks you to configure Codex like this repository:

1. Read this file and the local `AGENTS.md` instructions. Check that the user has not requested different model choices.
2. Clone the repository into a separate local directory. Do not copy credentials into the clone.
3. Run the commands below, inspect the dry-run file list, then install. The installer makes timestamped backups before changing files.
4. Run the doctor command. Report any missing Jev credential or network restriction. Tell the user that existing Codex sessions need a restart to load the new configuration.
5. Do not claim automatic hook enforcement or measured cost savings. Run an actual subagent smoke test if the current Codex build permits it.

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

## Jev credential

The routing command needs one of `TYPESAFE_API_KEY`, `JEV_API_KEY`, or `OPENROUTER_API_KEY` in the **Codex command environment**. Supply it through your existing secret manager or shell environment. Do not write it into this repository, `AGENTS.md`, or `config.toml`. `npm run doctor` reports only whether a credential is present; `npm run doctor -- --live` also checks a real Jev decision without displaying the key.

The router sends the role and up to 4,000 characters of a sanitized task summary to the Jev provider. Common credential patterns and encrypted messages cause a local Sol fallback. These checks cannot detect every secret. The summary is not stored; `~/.codex/router-decisions.jsonl` stores the chosen model, role, reason, timestamp, and a truncated task hash. If Jev is unavailable, the router returns Sol high. In our tested Codex `read-only` sandbox, outbound Jev access was unavailable, so it also returned Sol. The installer does not relax sandbox or network settings.

## Direct routing and retry

```sh
printf '%s\n' 'Find the definition of calculateTotal and report its path.' \
  | node src/route.mjs --role=explorer
```

The command prints JSON with `model`, `reasoning_effort`, and `reason`. Pass the first two fields to `spawn_agent`. Astra is selected up front only when Jev reports a sufficiently exceptional task. After a **substantive, observed Sol failure**, start the new routing summary with `[codex-router:sol-failed]` followed by the failure description. The parent agent must verify the failure; this marker is not proof by itself.

## Rollback

Each installation writes a manifest and copies every changed existing file to `~/.codex/backups/codex-jev-router/<timestamp>/`. Restore only the files listed in that manifest. For a file marked `existed: false`, remove the installed file only if no later changes depend on it. Merge later edits rather than overwriting them. Restart Codex after restoring configuration.

This directory has its own Git repository. Installing it changes local Codex files outside Git; the installer never commits or publishes those local settings.
