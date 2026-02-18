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

## Example Prompts

Once connected, try asking your AI assistant:

- "What does Article 14 of ZVOP-2 say about data processing?"
- "Search for Slovenian laws about environmental protection (varstvo okolja)"
- "Which EU directives does ZVOP-2 implement?"
- "Is the Criminal Code (KZ-1) currently in force?"
- "Show me court decisions about personal data (osebni podatki)"
- "Build a legal stance on employee dismissal (odpoved pogodbe o zaposlitvi)"
- "Validate the citation: 1. clen ZKP"
- "What are the data sources used by this legal database?"

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

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official PIS/pisrs.si publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is limited** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **EU cross-references** are extracted from Slovenian statute text, not EUR-Lex full text

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. Lawyers should consider Odvetniška zbornica Slovenije (Slovenian Bar Association) confidentiality obligations when using cloud-based AI tools.

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### @ansvar/slovenian-law-mcp (This Project)
**Query Slovenian statutes directly from Claude** -- ZVOP-2, KZ-1, ZGD-1, and more. Full provision text with EU cross-references. `npx @ansvar/slovenian-law-mcp`

### [@ansvar/swedish-law-mcp](https://github.com/Ansvar-Systems/swedish-law-mcp)
**Query 717 Swedish statutes directly from Claude** -- DSL, BrB, ABL, MB, and more. Full provision text with EU cross-references. `npx @ansvar/swedish-law-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npm install @ansvar/us-regulations-mcp`

### [@ansvar/ot-security-mcp](https://github.com/Ansvar-Systems/ot-security-mcp)
**Query IEC 62443, NIST 800-82/53, and MITRE ATT&CK for ICS** -- Specialized for OT/ICS environments. `npx @ansvar/ot-security-mcp`

### [@ansvar/automotive-cybersecurity-mcp](https://github.com/Ansvar-Systems/Automotive-MCP)
**Query UNECE R155/R156 and ISO 21434** -- Automotive cybersecurity compliance. `npx @ansvar/automotive-cybersecurity-mcp`

### [@ansvar/sanctions-mcp](https://github.com/Ansvar-Systems/Sanctions-MCP)
**Offline-capable sanctions screening** -- OFAC, EU, UN sanctions lists. `pip install ansvar-sanctions-mcp`

## Citation

If you use this MCP server in academic research:

```bibtex
@software{slovenian_law_mcp_2025,
  author = {Ansvar Systems AB},
  title = {Slovenian Law MCP Server: Production-Grade Legal Research Tool},
  year = {2025},
  url = {https://github.com/Ansvar-Systems/Slovenian-law-mcp},
  note = {Comprehensive Slovenian legal database with EU law cross-references}
}
```

## Legal

- License: Apache-2.0
- Security policy: see `SECURITY.md`
- Contribution guidelines: see `CONTRIBUTING.md`

### Data Licenses

- **Statutes & Regulations:** Republic of Slovenia (public domain via PIS)
- **Case Law Metadata:** sodnapraksa.si (public domain)
- **EU Metadata:** EUR-Lex (EU public domain)
- **Parliamentary Materials:** Državni zbor (public domain)

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the European market. This MCP server is part of our growing suite of jurisdiction-specific legal research tools.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden
