# CLAUDE.md

## Git Workflow

- **Never commit directly to `main`.** Always create a feature branch and open a Pull Request.
- Branch protection requires: verified signatures, PR review, and 6 status checks to pass.
- Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, etc.

## Project Overview

Slovenian Law MCP — an MCP server providing Slovenian legal research tools (statutes, case law, EU cross-references, citations). Published as `@ansvar/slovenian-law-mcp`.

## Key Paths

- `src/index.ts` — stdio entry point
- `api/mcp.ts` — Vercel serverless entry point
- `src/tools/registry.ts` — shared tool definitions (single source of truth)
- `src/tools/` — individual tool implementations
- `__tests__/contract/golden.test.ts` — contract tests driven by `fixtures/golden-tests.json`
- `tests/` — unit tests

## Commands

- `npm run build` — TypeScript compilation
- `npm test` — run all tests (unit + contract)
- `npm run test:contract` — contract tests only
