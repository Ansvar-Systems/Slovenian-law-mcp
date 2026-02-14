# Slovenian Law MCP

Production-grade [Model Context Protocol](https://modelcontextprotocol.io/) server for Slovenian legal research.

[![npm version](https://badge.fury.io/js/@ansvar%2Fslovenian-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/slovenian-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/Ansvar-Systems/Slovenian-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Slovenian-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/Slovenian-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/Slovenian-law-mcp/actions/workflows/check-updates.yml)

It provides structured access to:
- Slovenian statutes and regulations (PIS / pisrs.si)
- Slovenian case law metadata (sodnapraksa.si)
- EU legal cross-references (EUR-Lex metadata)
- Parliamentary preparatory works (Drzavni zbor)

Package: `@ansvar/slovenian-law-mcp`  
MCP name: `eu.ansvar/slovenian-law-mcp`

## Features

- 14 MCP tools for legal search, citation handling, temporal retrieval, and EU-compliance checks
- SQLite + FTS5 query engine optimized for article-level lookup
- Seed-based database build included in repository
- Optional paid enrichment pipeline (case law ingestion, cross-references, EU import)
- Stdio transport (CLI/MCP clients) and streamable HTTP transport (Vercel API)

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version — zero dependencies, nothing to install.

**Endpoint:** `https://slovenian-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add slovenian-law --transport http https://slovenian-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "slovenian-law": {
      "type": "url",
      "url": "https://slovenian-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** — add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "slovenian-law": {
      "type": "http",
      "url": "https://slovenian-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/slovenian-law-mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "slovenian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/slovenian-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "slovenian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/slovenian-law-mcp"]
    }
  }
}
```

## Local Development

Prerequisites:
- Node.js 18+ (Node 20+ recommended)
- npm

Setup:

```bash
npm install
npm run verify:seeds
npm run build
npm test
```

Run server locally:

```bash
npm run dev
```

## Seeded Database

The repository ships with seed files in `data/seed/*.json`.

- Build seed database: `npm run build:db`
- Audit seed quality: `npm run audit:seeds`
- Full seed verification (audit + rebuild): `npm run verify:seeds`

The `prepublishOnly` hook enforces release verification:
- `npm run verify:release` (seed audit, seed DB build, TypeScript build, tests)

Default runtime DB path:
- `data/database.db`

Override with:
- `SLOVENIAN_LAW_DB_PATH=/absolute/path/to/database.db`

## MCP Tools

1. `search_legislation`
2. `get_provision`
3. `search_case_law`
4. `get_preparatory_works`
5. `validate_citation`
6. `build_legal_stance`
7. `format_citation`
8. `check_currency`
9. `get_eu_basis`
10. `get_slovenian_implementations`
11. `search_eu_implementations`
12. `get_provision_eu_basis`
13. `validate_eu_compliance`
14. `get_provision_at_date`

## HTTP Deployment (Vercel)

This repository includes:
- `api/mcp.ts` (streamable HTTP MCP endpoint)
- `api/health.ts` (health endpoint)
- `vercel.json` rewrites:
  - `/mcp` -> `/api/mcp`
  - `/health` -> `/api/health`

## Docker

Build image (requires prebuilt DB):

```bash
npm run build:db
docker build -t slovenian-law-mcp .
```

## Data Sources

- PIS (Pravno-informacijski sistem RS): https://pisrs.si
- Sodna praksa portal: https://www.sodnapraksa.si
- EUR-Lex: https://eur-lex.europa.eu
- Drzavni zbor legislative materials: https://www.dz-rs.si

## CI/CD & Security

This repository uses [GitHub Actions](.github/workflows/) for automated quality and security enforcement:

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| [CI](.github/workflows/ci.yml) | Push / PR | Build, test (Node 18/20/22), type check, coverage |
| [CodeQL](.github/workflows/codeql.yml) | Push / PR / Weekly | Semantic code analysis (security-extended queries) |
| [Trivy](.github/workflows/trivy.yml) | Push / PR / Daily | Dependency vulnerability scanning (SARIF) |
| [Semgrep](.github/workflows/semgrep.yml) | Push / PR | SAST — OWASP Top 10, secrets, JS/TS rules |
| [Gitleaks](.github/workflows/gitleaks.yml) | Push / PR | Secret scanning across full git history |
| [OSSF Scorecard](.github/workflows/ossf-scorecard.yml) | Push / Weekly | Repository security hygiene scoring |
| [Socket Security](.github/workflows/socket-security.yml) | Push / PR | Supply chain attack detection |
| [Docker Security](.github/workflows/docker-security.yml) | Push / PR / Daily | Container image scanning + SBOM (CycloneDX, SPDX) |
| [Data Freshness](.github/workflows/check-updates.yml) | Daily | PIS portal amendment check, auto-issue creation |
| [Publish](.github/workflows/publish.yml) | Tag `v*` | npm publish (with provenance) + MCP Registry |
| [MCPB Bundle](.github/workflows/mcpb-bundle.yml) | Tag `v*` | MCPB distribution bundle |

## Release Checklist

```bash
npm run verify:release
npm pack --dry-run
```

## Legal

- License: Apache-2.0
- Security policy: see `SECURITY.md`
- Contribution guidelines: see `CONTRIBUTING.md`
