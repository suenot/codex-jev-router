# Changelog

All notable changes are documented here in Keep a Changelog format.

## Unreleased

## [0.6.0] - 2026-09-24

### Added

- Add an optional Codex `UserPromptSubmit` skill suggestion hook with two-stage decider selection and one-skill context injection.
- Add an installer that backs up Codex settings, preserves existing hooks, and can hide explicitly managed local skills from the native listing.

### Changed

- Document local-only skill selection by default, the explicit hosted opt-in, and the current absence of measured Codex skill-token savings.

## [0.5.0] - 2026-09-24

### Added

- Record a passing SWE-bench Verified Django task with clean Sol-high and Jev-routed runs, official regression verdicts, full auth/session suite results, traces, token usage, and estimated API costs.
- Measure three real Django source tasks with Luna low, Luna medium, and Sol low routes against clean Sol high, and publish tool traces and graded answers.
- Measure a bounded Django code fix across three Sol-high and three Luna-medium runs using the official regression test; preserve an unstable second candidate as exploratory data.

### Changed

- Keep the earlier failed pytest task visible and clarify that same-model run variation does not establish routing savings.
- Allow Luna medium for bounded tasks when Jev selects it with at least 0.60 confidence and 0.70 probability, while retaining the exceptional-task guard and Sol-high fallback.
- Report Codex tokens separately from Jev tokens in benchmark comparisons.

## [0.4.1] - 2026-09-24

### Added

- Add Simplified and Traditional Chinese setup guides.
- Add a reproducible Codex/Jev routing benchmark and publish its measured limitations.
- Add a real SWE-bench Verified task with isolated Codex homes, agent traces, generated patches, and a regression-test verdict.

### Changed

- Show the benchmark's synthetic inputs and estimated API cost by task, including the percentage difference and calculation method.
- Label the earlier synthetic comparison as unisolated and withdraw its clean-baseline savings claim.

### Fixed

- Replace the file-tool-confounded benchmark with controlled inline-evidence results and retain the original runs as diagnostic data.
- Run future synthetic benchmark sessions with an isolated Codex home so installed global routing instructions cannot enter either arm.

## [0.4.0] - 2026-09-24

### Added

- Route confident, bounded multi-step subagent tasks to Luna medium and short tasks needing Sol judgment to Sol low.

### Changed

- Ask the decision backend to distinguish four model-effort profiles while retaining Sol high as the fallback.
- Document the new routes and install their guidance in the global Codex instructions.

## [0.3.1] - 2026-09-24

### Fixed

- Distinguish exact web, file, and log lookups from multi-source research and log diagnosis when choosing a subagent model.

### Changed

- Document how model routing applies to delegated searches and remove an unrelated project reference.

## [0.3.0] - 2026-09-24

### Added

- Add a four-panel comic to the English and Russian README files to explain subagent model routing.
- Add a local Kev decision backend preset.

### Changed

- Clarify the compatibility requirements for HTTP and command adapters and document why PlayJev is not a decision backend for this router.

## [0.2.0] - 2026-09-23

### Added

- Select hosted Jev, local Laya, another Jev-compatible HTTP server, or a local executable adapter as the decision engine.
- Validate the selected backend and optionally test a live decision with the doctor command.

### Changed

- Make the installed routing instruction provider-neutral while retaining hosted Jev as the default.

## [0.1.1] - 2026-09-23

### Changed

- Route exceptional tasks and verified Sol retries to Sol ultra; use Luna low for very simple tasks and remove Astra.
- Limit installation and diagnostics to subagent routing settings, leaving the main Codex and Plan mode settings to the user.

## [0.1.0] - 2026-09-23

### Added

- JevRouter-based Sol-first model selection for Codex subagents.
- Portable installer with backups, dry run, idempotence, and Codex diagnostics.
- Separate English and Russian setup instructions.
