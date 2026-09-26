# Changelog

All notable changes are documented here in Keep a Changelog format.

## Unreleased

## [0.9.0] - 2026-09-26

### Changed

- Keep the continuing parent session on its configured Sol model and effort; require a useful delegation before asking the decider for a child model.
- Disable automatic Sol-low routing and map older Sol-low replies to the Sol-high fallback.
- Update the four setup guides and installer instructions for the delegation gate and fixed parent model.
- Document the randomized four-arm benchmark: optional delegation used no children and cost 2.7% more than direct Sol xhigh; Jev-routed children cost 27.2% less than fixed Sol-high children but 69.7% more than direct Sol xhigh.
- Document full parent-plus-child benchmark costs in all four setup guides and distinguish them from earlier worker-only savings.
- Document the routing economics audit, external router research, and the measured break-even limits in English and Russian.
- Link the directly routed root experiment and its quality and API-price limits from all four setup guides.

## [0.8.0] - 2026-09-25

### Added

- Route up to eight planned Codex subagent tasks in one typed decision request, with per-task Sol-high fallback for incomplete answers.
- Classify 3–24 short records with shared Choice or Noul questions, and mark uncertain or incomplete items for Codex review.
- Document both optional batch commands and runnable examples in all four setup guides.

### Changed

- Lead with estimated API cost savings, including Jev, and state the pricing assumptions and sample limits in all setup guides.
- Reuse one decision logger for single and batch subagent routing.

## [0.7.1] - 2026-09-25

### Changed

- Move the benchmark report, runner, grading code, and recorded artifacts to [suenot/codex-jev-router-benchmarks](https://github.com/suenot/codex-jev-router-benchmarks).
- Link the separate benchmark report from all setup guides.

### Removed

- Remove the synthetic benchmark command and archived benchmark files from the router package; run them from the benchmark repository.

## [0.7.0] - 2026-09-24

### Added

- Add named local decision backends for SemIf, NanoJev, jevlike, simple-jev, AnyJev, mini-jev, nico-martin/open-jev, minojev, Zefan-Cai/Open-Jev, and daseinlabs/open-jev.
- Convert NanoJev, minojev, and mini-jev server responses and provide optional one-shot bridges for SemIf, jevlike, AnyJev, and nico-martin/open-jev.
- Document the upstream interfaces, required models and checkpoints, timeout settings, and validation limits in English and Russian.

### Changed

- Apply local-endpoint privacy checks to every named HTTP backend in the optional skill suggestion hook.
- Keep all alternative backends opt-in and preserve Sol-high fallback on invalid decisions.

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
