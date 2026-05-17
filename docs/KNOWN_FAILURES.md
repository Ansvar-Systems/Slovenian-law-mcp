# Known Failures

## NEEDS_REVIEW — 2026-05-17

Flagged by `scripts/apply-mcp-standard.py`. Treatment was skipped pending resolution.

**Reason:** `citation_drift: 1 file(s) under src/tools/ spread `_citation: buildCitation(...)` into return objects, but no interface in src/ declares `_citation` (optional or required, followed by a type). This blocks G1-build / G2-lint with TS2353. Fix recipe: add `_citation?: CitationMetadata` (or required `_citation: CitationMetadata | null`) to the return-type interfaces and `import { type CitationMetadata } from '../citation.js'`. Files: src/tools/get-provision.ts.`

**Gate state at pre-flight:**
- PASS: (none)
- N/A:  (none)
- FAIL: pre-content

**Profile detected:** `node-wasm-ingested`

**Next steps:** the reason string above maps to a known pattern in
`docs/handover/2026-04-26-golden-standard-next-batch-handover.md` §4. Resolve
on a separate fix branch, then re-run the sweep on a fresh `audit/` branch
once `main` is green.
