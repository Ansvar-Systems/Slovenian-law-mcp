# Slovenian Law MCP Server Design

## Overview

Full-parity port of Dutch-law-mcp / Swedish-law-mcp for Slovenian legislation. 14 MCP tools, SQLite+FTS5 database, PIS (pisrs.si) as primary data source.

## Data Source

- **Primary:** PIS (Pravno-informacijski sistem RS) at pisrs.si
- **Case law:** sodnapraksa.si (sodna praksa portal)
- **EU law:** EUR-Lex metadata
- **Preparatory works:** National Assembly (dz-rs.si)

## Tool Set (14 tools)

1. search_legislation, 2. get_provision, 3. search_case_law, 4. get_preparatory_works, 5. validate_citation, 6. build_legal_stance, 7. format_citation, 8. check_currency, 9. get_eu_basis, 10. get_slovenian_implementations, 11. search_eu_implementations, 12. get_provision_eu_basis, 13. validate_eu_compliance, 14. get_provision_at_date

## Architecture

Exact mirror of Dutch-law-mcp: `src/{index,citation/,tools/,parsers/,types/,utils/}`, `scripts/`, `data/seed/`.

## Slovenian Specifics

- Citation format: `1. clen ZKP`, `Uradni list RS, st. 63/13`
- Court codes: USRS, VSRS, VSL, VSM, VSK, VSC, UPRS, VDSS
- Document types: statute, regulation, constitutional, case_law, parliamentary
- Schema identical to Dutch (same tables, FTS5 indexes, EU reference tables)
