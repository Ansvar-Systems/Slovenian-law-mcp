# Slovenian Law MCP Server

**The Uradni list RS (Pravno-informacijski sistem) alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fslovenian-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/slovenian-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/slovenian-law-mcp?style=social)](https://github.com/Ansvar-Systems/slovenian-law-mcp)
[![CI](https://github.com/Ansvar-Systems/slovenian-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/slovenian-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/slovenian-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/slovenian-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/EU_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-11%2C970-blue)](docs/EU_INTEGRATION_GUIDE.md)

Query **40 Slovenian statutes** -- from ZVOP-2 (Zakon o varstvu osebnih podatkov) and Kazenski zakonik to Obligacijski zakonik, Zakon o elektronskih komunikacijah, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Slovenian legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Slovenian legal research means navigating PISRS (Pravno-informacijski sistem Republike Slovenije) and the Uradni list RS, cross-referencing between Zakoni, Pravilniki, and Uredbe, and manually tracking EU transpositions. Whether you're:

- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking ZVOP-2 obligations or NIS2 requirements
- A **legal tech developer** building tools on Slovenian law
- A **researcher** tracing EU directives through to Slovenian implementation

...you shouldn't need dozens of browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Slovenian law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-si/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add slovenian-law --transport http https://mcp.ansvar.eu/law-si/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "slovenian-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-si/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "slovenian-law": {
      "type": "http",
      "url": "https://mcp.ansvar.eu/law-si/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/slovenian-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

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

## Example Queries

Once connected, just ask naturally -- in Slovenian or English:

- *"Kaj določa ZVOP-2 (Zakon o varstvu osebnih podatkov) glede privolitve?"*
- *"Ali je Kazenski zakonik (KZ-1) še v veljavi?"*
- *"Poiščite določbe o 'varstvu osebnih podatkov' v slovenskem pravu"*
- *"Katere EU direktive implementira ZVOP-2?"*
- *"Kaj določa Obligacijski zakonik (OZ) glede pogodbene odgovornosti?"*
- *"Poiščite kazenske določbe v KZ-1 za kibernetske napade"*
- *"Kateri slovenski zakoni implementirajo direktivo NIS2?"*
- *"Which Slovenian laws implement the GDPR?"*
- *"Find data protection provisions in Slovenian law"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 40 statutes | Core Slovenian legislation (curated set) |
| **Provisions** | 11,970 sections | Full-text searchable with FTS5 |
| **Preparatory Works** | 497,722 documents | Predlogi zakonov and parliamentary materials (Premium) |
| **Database Size** | ~42 MB | Optimized SQLite, portable |
| **Daily Updates** | Automated | Freshness checks against PISRS |

> **Coverage note:** The current free-tier database covers 40 core statutes, representing the primary legislation most relevant for compliance and legal research. The curated selection prioritises data protection, criminal law, obligations, company law, and electronic communications. Premium tier includes expanded coverage and 497,722 preparatory works documents.

**Verified data only** -- every citation is validated against official sources (pisrs.si). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from PISRS (Pravno-informacijski sistem RS) official sources
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains regulation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by zakon identifier + člen/odstavek
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
pisrs.si API → Parse → SQLite → FTS5 snippet() → MCP response
                 ↑                      ↑
          Provision parser       Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search PISRS by zakon name | Search by plain Slovenian: *"varstvo osebnih podatkov"* |
| Navigate multi-člen statutes manually | Get the exact provision with context |
| Manual cross-referencing between zakoni | `build_legal_stance` aggregates across sources |
| "Je ta zakon še v veljavi?" → manual check | `check_currency` tool → answer in seconds |
| Find EU basis → dig through EUR-Lex | `get_eu_basis` → linked EU directives instantly |
| Check PISRS for updates | Daily automated freshness checks |
| No API, no integration | MCP protocol → AI-native |

**Traditional:** Search PISRS → Download PDF → Ctrl+F → Cross-reference with predlog zakona → Check EUR-Lex → Repeat

**This MCP:** *"Kateri člen ZVOP-2 ureja privolitev in katera EU direktiva je osnova?"* → Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 search on 11,970 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by zakon identifier + člen/odstavek |
| `validate_citation` | Validate citation against database (zero-hallucination check) |
| `build_legal_stance` | Aggregate citations from statutes and preparatory works |
| `format_citation` | Format citations per Slovenian conventions (full/short/pinpoint) |
| `check_currency` | Check if statute is in force, amended, or repealed |
| `list_sources` | List all available statutes with metadata and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### EU Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations for Slovenian statute |
| `get_slovenian_implementations` | Find Slovenian laws implementing EU act |
| `search_eu_implementations` | Search EU documents with Slovenian implementation counts |
| `get_provision_eu_basis` | Get EU law references for specific provision |
| `validate_eu_compliance` | Check implementation status (requires EU MCP) |

---

## EU Law Integration

Slovenia is an EU member state since 2004 and implements EU law through a systematic transposition process published in the Uradni list RS.

| Metric | Value |
|--------|-------|
| **EU Member Since** | 2004 |
| **GDPR Implementation** | ZVOP-2 (Zakon o varstvu osebnih podatkov-2) |
| **NIS2 Implementation** | ZIIKS (Zakon o informacijski varnosti) |
| **Data Authority** | Informacijski pooblaščenec (IP RS) |
| **EUR-Lex Integration** | Automated metadata fetching |

### Key Slovenian EU Implementations

- **GDPR** (2016/679) → ZVOP-2 (Zakon o varstvu osebnih podatkov)
- **NIS2 Directive** (2022/2555) → ZIIKS (Zakon o informacijski varnosti)
- **AI Act** (2024/1689) → Slovenian implementation in progress
- **eIDAS** (910/2014) → ZEPEP-UPB1 (Zakon o elektronskem poslovanju)
- **Consumer Rights Directive** (2011/83) → ZVPot (Zakon o varstvu potrošnikov)
- **AML Directive** (2015/849) → ZPPDFT-2 (Zakon o preprečevanju pranja denarja)

See [EU_INTEGRATION_GUIDE.md](docs/EU_INTEGRATION_GUIDE.md) for detailed documentation.

---

## Data Sources & Freshness

All content is sourced from authoritative Slovenian legal databases:

- **[PISRS - Pravno-informacijski sistem RS](https://www.pisrs.si/)** -- Official consolidated law database
- **[Uradni list RS](https://www.uradni-list.si/)** -- Official Gazette of the Republic of Slovenia
- **[EUR-Lex](https://eur-lex.europa.eu/)** -- Official EU law database (metadata only)

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Pravno-informacijski sistem RS (PISRS) |
| **Retrieval method** | PISRS API + HTML parse |
| **Language** | Slovenian |
| **License** | Slovenian public data (open government) |
| **Coverage** | 40 core statutes (curated) |
| **Last ingested** | 2026-02-25 |

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors all data sources:

| Source | Check | Method |
|--------|-------|--------|
| **Statute amendments** | PISRS API date comparison | All covered statutes checked |
| **New statutes** | Uradni list RS publication feed | Diffed against database |
| **EU reference staleness** | Git commit timestamps | Flagged if >90 days old |

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Docker Security** | Container image scanning + SBOM generation | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **OSSF Scorecard** | OpenSSF best practices scoring | Weekly |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official PISRS publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Coverage is currently limited** to 40 core statutes -- verify whether your statute is included before relying on this for research
> - **Court case coverage** is not included in the current release -- do not rely on this for case law research
> - **Verify critical citations** against primary sources (pisrs.si) for court filings
> - **EU cross-references** are extracted from Slovenian statute text, not EUR-Lex full text

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. See [PRIVACY.md](PRIVACY.md) for Odvetniška zbornica Slovenije compliance guidance.

---

## Documentation

- **[EU Integration Guide](docs/EU_INTEGRATION_GUIDE.md)** -- Detailed EU cross-reference documentation
- **[EU Usage Examples](docs/EU_USAGE_EXAMPLES.md)** -- Practical EU lookup examples
- **[Security Policy](SECURITY.md)** -- Vulnerability reporting and scanning details
- **[Disclaimer](DISCLAIMER.md)** -- Legal disclaimers and professional use notices
- **[Privacy](PRIVACY.md)** -- Client confidentiality and data handling

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/slovenian-law-mcp
cd slovenian-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest                     # Ingest statutes from PISRS
npm run ingest:all                 # Auto-ingest all statutes
npm run ingest:cases               # Ingest case law from sodnapraksa.si
npm run ingest:prep-works          # Ingest preparatory works
npm run build:db                   # Rebuild SQLite database
npm run drift:detect               # Run drift detection
npm run check-updates              # Check for amendments and new statutes
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~42 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### @ansvar/slovenian-law-mcp (This Project)
**Query 40 core Slovenian statutes directly from Claude** -- ZVOP-2, KZ-1, OZ, ZGD-1, and more. Full provision text with EU cross-references. `npx @ansvar/slovenian-law-mcp`

### [@ansvar/croatian-law-mcp](https://github.com/Ansvar-Systems/croatian-law-mcp)
**Query Croatian legislation** -- ZZOP, KZ, ZOO, and more. `npx @ansvar/croatian-law-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Austria, Belgium, Denmark, Finland, France, Germany, Ireland, Italy, Netherlands, Norway, Poland, Portugal, Spain, Sweden, Switzerland, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Statute coverage expansion (currently 40 statutes -- many more in PISRS)
- Court case law coverage (Vrhovno sodišče, Ustavno sodišče)
- EU regulation cross-reference expansion
- Historical statute versions and amendment tracking

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Corpus ingestion (40 statutes, 11,970 provisions)
- [x] EU law integration tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [x] Daily freshness checks
- [ ] Statute coverage expansion (target: 500+ statutes)
- [ ] Court case law (Vrhovno sodišče, Ustavno sodišče)
- [ ] Historical statute versions (amendment tracking)
- [ ] English translations for key statutes

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{slovenian_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Slovenian Law MCP Server: Production-Grade Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/slovenian-law-mcp},
  note = {40 core Slovenian statutes with 11,970 provisions and EU law cross-references}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Pravno-informacijski sistem RS (public domain)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the European market. This MCP server started as our internal reference tool for Slovenian law -- turns out everyone building compliance tools for the CEE market has the same research frustrations.

So we're open-sourcing it. Navigating PISRS shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
