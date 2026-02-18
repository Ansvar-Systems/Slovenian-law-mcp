# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-02-18

### Added
- `list_sources` tool for data provenance (returns PIS, sodnapraksa.si, EUR-Lex metadata)
- 3 new golden contract tests: provenance (si-013), currency check (si-014), special characters (si-015)
- Response size bounds on `get_provision` (LIMIT 200 with truncation warning)
- Input validation guard on `search_case_law` when called with no arguments

### Changed
- Shared tool registry (`src/tools/registry.ts`) is now the single source of truth for tool definitions
- Enhanced tool descriptions with examples, enum constraints, and Slovenian terminology
- `build_legal_stance` limit clamped to max 20 (matching schema constraint)
- Health endpoint uses shared `server-metadata.ts` constants and expanded capabilities list
- Contract test runner uses `describe.skipIf` for graceful DB-absent handling

### Fixed
- SQLite journal mode changed from WAL to DELETE for Vercel serverless compatibility
- Added `foreign_keys = ON` pragma in stdio entry point (matching HTTP entry point)
- FTS5 quote balancing in `escapeExplicitQuery` to prevent unclosed-quote syntax errors
- Contract test connection order fix (client connects before server)

### Security
- CI/CD timeout guards on all workflow jobs (15-20 min)
- Concurrency blocks on publish and drift-detect workflows
- `journal_mode = DELETE` pragma added to HTTP entry point

## [1.1.0] - 2026-02-14

### Added
- Public release documentation (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`)
- Repository license file (`LICENSE`, Apache-2.0)
- Release verification scripts:
  - `verify:seeds` (seed audit + database build)
  - `verify:release` (seed verification + build + tests)

### Changed
- Unified MCP server identity and version metadata across stdio and HTTP entrypoints
- `prepublishOnly` now runs full release verification before publish
- Expanded `.gitignore` to exclude local npm cache artifacts (`.npm-cache/`)

### Verified
- Seed database rebuild from repository seed files
- TypeScript build and test suite passing
