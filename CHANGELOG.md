# Changelog

All notable changes are documented here in Keep a Changelog format.

## Unreleased

### Added

- Add a four-panel comic to the English and Russian README files to explain subagent model routing.

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
