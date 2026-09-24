# Changelog

All notable changes are documented here in Keep a Changelog format.

## Unreleased

### Added

- Add Simplified and Traditional Chinese setup guides.
- Add a reproducible Codex/Jev routing benchmark and publish its measured limitations.

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
