# Contributing

Thanks for contributing to Slovenian Law MCP.

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm

## Development Setup

```bash
npm install
npm run verify:seeds
npm run build
npm test
```

## Common Commands

- `npm run dev` - run stdio MCP server from TypeScript source
- `npm run build` - compile TypeScript to `dist/`
- `npm run test` - run test suite
- `npm run audit:seeds` - audit seed data quality
- `npm run build:db` - rebuild database from seed files
- `npm run verify:release` - full pre-release verification

## Pull Request Guidelines

- Keep changes focused and scoped
- Include tests for behavior changes when possible
- Update docs when adding/changing tools, scripts, configuration, or API behavior
- Ensure `npm run verify:release` passes before requesting review

## Commit Style

Use clear commit messages, ideally Conventional Commits:

- `feat: add provision history filter`
- `fix: handle missing provision_ref in tool input`
- `docs: update setup instructions`

## Data and Legal Notes

- Source data originates from public legal information systems
- Do not commit credentials or private data
- This project is a research/compliance tooling interface, not legal advice
