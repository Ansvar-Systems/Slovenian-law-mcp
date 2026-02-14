# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
