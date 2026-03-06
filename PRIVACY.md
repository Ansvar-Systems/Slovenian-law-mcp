# Privacy & Client Confidentiality

**IMPORTANT READING FOR LEGAL PROFESSIONALS**

This document addresses privacy and confidentiality considerations when using this Tool, with particular attention to professional obligations under Slovenian bar association rules.

---

## Executive Summary

**Key Risks:**
- Queries through Claude API flow via Anthropic cloud infrastructure
- Query content may reveal client matters and privileged information
- Slovenian professional conduct rules (Odvetniška zbornica Slovenije — OZS) require strict client confidentiality and data processing controls

**Safe Use Options:**
1. **General Legal Research**: Use Tool for non-client-specific queries
2. **Local npm Package**: Install `@ansvar/slovenian-law-mcp` locally — database queries stay on your machine
3. **Remote Endpoint**: Vercel Streamable HTTP endpoint — queries transit Vercel infrastructure
4. **On-Premise Deployment**: Self-host with local LLM for privileged matters

---

## Data Flows and Infrastructure

### MCP (Model Context Protocol) Architecture

This Tool uses the **Model Context Protocol (MCP)** to communicate with AI clients:

```
User Query -> MCP Client (Claude Desktop/Cursor/API) -> Anthropic Cloud -> MCP Server -> Database
```

### Deployment Options

#### 1. Local npm Package (Most Private)

```bash
npx @ansvar/slovenian-law-mcp
```

- Database is local SQLite file on your machine
- No data transmitted to external servers (except to AI client for LLM processing)
- Full control over data at rest

#### 2. Remote Endpoint (Vercel)

```
Endpoint: https://slovenian-law-mcp.vercel.app/mcp
```

- Queries transit Vercel infrastructure
- Tool responses return through the same path
- Subject to Vercel's privacy policy

### What Gets Transmitted

When you use this Tool through an AI client:

- **Query Text**: Your search queries and tool parameters
- **Tool Responses**: Statute text (besedilo zakona), provision content, search results
- **Metadata**: Timestamps, request identifiers

**What Does NOT Get Transmitted:**
- Files on your computer
- Your full conversation history (depends on AI client configuration)

---

## Professional Obligations (Slovenia)

### Odvetniška zbornica Slovenije (OZS)

Attorneys (odvetniki) in Slovenia are regulated by the **Odvetniška zbornica Slovenije (OZS)** under the Zakon o odvetništvu (ZOdv) and the OZS Kodeks odvetniške poklicne etike. Key obligations when using AI tools:

#### Poklicna skrivnost (Professional Secrecy)

- All client communications are protected under § 8 ZOdv (poklicna skrivnost)
- Client identity may itself be confidential in sensitive matters
- Case strategy and legal analysis are protected
- Information that could identify clients or matters must be safeguarded
- Breach of professional secrecy may result in disciplinary proceedings (disciplinski postopek) before the OZS disciplinary commission

### Notaries and Other Legal Professionals

Notaries (notarji) are regulated by the **Notarska zbornica Slovenije** under the Zakon o notariatu (ZN). Similar confidentiality obligations apply. Consult the Notarska zbornica for specific guidance on AI tool use.

### GDPR and the Zakon o varstvu osebnih podatkov (ZVOP-2)

Under **GDPR** and the **Zakon o varstvu osebnih podatkov (ZVOP-2)**, when using services that process client data:

- You are the **Upravljavec (Data Controller)**
- AI service providers (Anthropic, Vercel) may be **Obdelovalci (Data Processors)**
- A **Pogodba o obdelavi podatkov (Data Processing Agreement)** may be required before transmitting any personal data
- Ensure adequate technical and organisational measures (tehnični in organizacijski ukrepi) are in place
- The **Informacijski pooblaščenec** oversees compliance in Slovenia — ip-rs.si
- International transfers of personal data (e.g., to US-based Anthropic) require appropriate safeguards under GDPR Chapter V

---

## Risk Assessment by Use Case

### LOW RISK: General Legal Research

**Safe to use through any deployment:**

```
Example: "What does člen 131 of the Obligacijski zakonik (OZ) say about contractual liability?"
```

- No client identity involved
- No case-specific facts
- Publicly available legal information

### MEDIUM RISK: Anonymized Queries

**Use with caution:**

```
Example: "What are the penalties for tax fraud under the Kazenski zakonik (KZ-1)?"
```

- Query pattern may reveal the nature of a matter you are working on
- Anthropic/Vercel logs may link queries to your API key

### HIGH RISK: Client-Specific Queries

**DO NOT USE through cloud AI services:**

- Remove ALL identifying details
- Use the local npm package with a self-hosted LLM
- Or use commercial legal databases with proper data processing agreements

---

## Data Collection by This Tool

### What This Tool Collects

**Nothing.** This Tool:

- Does NOT log queries
- Does NOT store user data
- Does NOT track usage
- Does NOT use analytics
- Does NOT set cookies

The database is read-only. No user data is written to disk.

### What Third Parties May Collect

- **Anthropic** (if using Claude): Subject to [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- **Vercel** (if using remote endpoint): Subject to [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

---

## Recommendations

### For Solo Practitioners / Small Firms (Samostojni odvetniki / Majhne pisarne)

1. Use local npm package for maximum privacy
2. General research: Cloud AI is acceptable for non-client queries
3. Client matters: Use official databases (pisrs.si, uradni-list.si) or commercial legal databases with proper data processing agreements

### For Large Firms / Corporate Legal (Večje pisarne / Pravne službe)

1. Negotiate Data Processing Agreements with AI service providers before any client data is transmitted
2. Consider on-premise deployment with self-hosted LLM
3. Train staff on safe vs. unsafe query patterns
4. Review Informacijski pooblaščenec guidance on AI and data protection

### For Government / Public Sector (Javni sektor)

1. Use self-hosted deployment, no external APIs
2. Follow Slovenian government IT security requirements (ZVOP-2, NIS2 transposition)
3. Air-gapped option available for sensitive matters

---

## Questions and Support

- **Privacy Questions**: Open issue on [GitHub](https://github.com/Ansvar-Systems/Slovenian-law-mcp/issues)
- **Anthropic Privacy**: Contact privacy@anthropic.com
- **OZS Guidance**: Consult Odvetniška zbornica Slovenije ethics guidance at odv-zb.si
- **Informacijski pooblaščenec**: Consult ip-rs.si for data protection queries

---

**Last Updated**: 2026-03-06
**Tool Version**: 1.0.0
