#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import Database from '@ansvar/mcp-sqlite';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { searchLegislation, type SearchLegislationInput } from './tools/search-legislation.js';
import { getProvision, type GetProvisionInput } from './tools/get-provision.js';
import { searchCaseLaw, type SearchCaseLawInput } from './tools/search-case-law.js';
import { getPreparatoryWorks, type GetPreparatoryWorksInput } from './tools/get-preparatory-works.js';
import { validateCitationTool, type ValidateCitationInput } from './tools/validate-citation.js';
import { buildLegalStance, type BuildLegalStanceInput } from './tools/build-legal-stance.js';
import { formatCitationTool, type FormatCitationInput } from './tools/format-citation.js';
import { checkCurrency, type CheckCurrencyInput } from './tools/check-currency.js';
import { getEUBasis, type GetEUBasisInput } from './tools/get-eu-basis.js';
import { getSlovenianImplementations, type GetSlovenianImplementationsInput } from './tools/get-slovenian-implementations.js';
import { searchEUImplementations, type SearchEUImplementationsInput } from './tools/search-eu-implementations.js';
import { getProvisionEUBasis, type GetProvisionEUBasisInput } from './tools/get-provision-eu-basis.js';
import { validateEUCompliance, type ValidateEUComplianceInput } from './tools/validate-eu-compliance.js';
import { getProvisionAtDate, type GetProvisionAtDateInput } from './tools/get-provision-at-date.js';
import { detectCapabilities, readDbMetadata, type Capability, type DbMetadata } from './capabilities.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVER_NAME = 'slovenian-legal-citations';
const SERVER_VERSION = '1.0.0';
const DB_ENV_VAR = 'SLOVENIAN_LAW_DB_PATH';
const DEFAULT_DB_PATH = '../data/database.db';

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDefaultDbPath(): string {
  return path.resolve(__dirname, DEFAULT_DB_PATH);
}

let dbInstance: InstanceType<typeof Database> | null = null;
let dbCapabilities: Set<Capability> | null = null;
let dbMetadata: DbMetadata | null = null;

function getDb(): InstanceType<typeof Database> {
  if (!dbInstance) {
    const dbPath = process.env[DB_ENV_VAR] ?? getDefaultDbPath();
    dbInstance = new Database(dbPath, { readonly: true });
    dbInstance.pragma('journal_mode = WAL', { simple: true });

    // Detect capabilities on first open
    dbCapabilities = detectCapabilities(dbInstance);
    dbMetadata = readDbMetadata(dbInstance);
    console.error(`[${SERVER_NAME}] Database tier: ${dbMetadata.tier}, capabilities: ${[...dbCapabilities].join(', ')}`);
  }
  return dbInstance;
}

export function getCapabilities(): Set<Capability> {
  if (!dbCapabilities) getDb(); // ensure detection has run
  return dbCapabilities!;
}

export function getMetadata(): DbMetadata {
  if (!dbMetadata) getDb(); // ensure detection has run
  return dbMetadata!;
}

function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const TOOLS: Tool[] = [
  {
    name: 'search_legislation',
    description:
      'Search Slovenian statutes and regulations by keyword. Searches FTS-indexed provisions from PIS (pisrs.si). Use document_id to narrow to a specific statute. Supports temporal queries via as_of_date.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search terms (Slovenian or English)' },
        document_id: { type: 'string', description: 'Document ID to restrict search to a specific statute' },
        status: { type: 'string', description: 'Filter by status: in_force, repealed, amended' },
        as_of_date: { type: 'string', description: 'ISO date to query historical versions (e.g. "2020-01-01")' },
        limit: { type: 'number', description: 'Max results (1-50, default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_provision',
    description:
      'Retrieve a specific provision from a Slovenian statute. Examples: document_id="zakon-o-kazenskem-postopku", article="148" for 148. člen ZKP. Can also use provision_ref directly (e.g. "148").',
    inputSchema: {
      type: 'object' as const,
      properties: {
        document_id: { type: 'string', description: 'Document ID of the statute (e.g. "zakon-o-kazenskem-postopku")' },
        chapter: { type: 'string', description: 'Chapter number if applicable' },
        article: { type: 'string', description: 'Article number (e.g. "148")' },
        provision_ref: { type: 'string', description: 'Full provision reference (e.g. "148" or "3:5")' },
        as_of_date: { type: 'string', description: 'ISO date to retrieve historical version' },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'search_case_law',
    description:
      'Search Slovenian court decisions from sodnapraksa.si. Supports full-text search with optional filters for court (e.g. USRS, VSRS, VSL, VSM), legal domain, procedure type, and date range. Use ecli for direct ECLI lookup (e.g. "ECLI:SI:VSRS:2020:123").',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search terms' },
        court: { type: 'string', description: 'Court code: USRS (Ustavno sodišče), VSRS (Vrhovno sodišče), VSL (Višje sodišče Ljubljana), VSM (Višje sodišče Maribor), VSK (Višje sodišče Koper), VSC (Višje sodišče Celje), UPRS (Upravno sodišče), VDSS (Višje delovno in socialno sodišče)' },
        ecli: { type: 'string', description: 'Direct ECLI lookup (e.g. "ECLI:SI:VSRS:2020:123")' },
        legal_domain: { type: 'string', description: 'Legal domain filter (e.g. "civilno", "kazensko", "upravno")' },
        procedure_type: { type: 'string', description: 'Procedure type filter (e.g. "revizija", "pritožba")' },
        date_from: { type: 'string', description: 'Start date filter (ISO format)' },
        date_to: { type: 'string', description: 'End date filter (ISO format)' },
        limit: { type: 'number', description: 'Max results (1-50, default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_preparatory_works',
    description:
      'Get preparatory works (zakonodajno gradivo) for a Slovenian statute. Returns related parliamentary documents such as predlog zakona (bill), poročilo, mnenje, and other legislative materials from the Državni zbor.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        statute_id: { type: 'string', description: 'Document ID of the statute' },
        document_type: { type: 'string', description: 'Filter by type: predlog, porocilo, mnenje, etc.' },
        limit: { type: 'number', description: 'Max results (1-50, default 20)' },
      },
      required: ['statute_id'],
    },
  },
  {
    name: 'validate_citation',
    description:
      'Validate a Slovenian legal citation and check whether the referenced document and provision exist in the database. Supported formats: "1. člen ZKP", "Uradni list RS, št. 63/13", "ECLI:SI:VSRS:2020:123".',
    inputSchema: {
      type: 'object' as const,
      properties: {
        citation: { type: 'string', description: 'Citation string to validate' },
      },
      required: ['citation'],
    },
  },
  {
    name: 'build_legal_stance',
    description:
      'Build a comprehensive legal stance on a topic by combining statute provisions, case law, preparatory works, and cross-references. Returns a structured research bundle for Slovenian law analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Legal question or topic to research' },
        document_id: { type: 'string', description: 'Document ID to focus on a specific statute' },
        as_of_date: { type: 'string', description: 'ISO date for temporal context' },
        limit: { type: 'number', description: 'Max results per category (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'format_citation',
    description:
      'Format a Slovenian legal citation into the standard format. Outputs proper Slovenian citation format, e.g. "1. člen Zakon o kazenskem postopku (ZKP)". Supports full, short, and pinpoint formats.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        citation: { type: 'string', description: 'Citation string to format' },
        format: { type: 'string', description: 'Output format: full, short, or pinpoint', enum: ['full', 'short', 'pinpoint'] },
      },
      required: ['citation'],
    },
  },
  {
    name: 'check_currency',
    description:
      'Check whether a Slovenian statute or provision is currently in force (veljavno pravo). Returns the document status (in_force / repealed / not_yet_in_force), validity dates, and any warnings about outdated or razveljavljen (repealed) legislation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        document_id: { type: 'string', description: 'Document ID of the statute to check' },
        provision_ref: { type: 'string', description: 'Provision reference to check (e.g. "148")' },
        as_of_date: { type: 'string', description: 'ISO date to check validity at a specific point in time' },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_eu_basis',
    description:
      'Get the EU legal basis for a Slovenian statute. Shows which EU directives and regulations the statute implements or references. Returns CELEX numbers, EUR-Lex links, and reference types.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        document_id: { type: 'string', description: 'Document ID of the Slovenian statute' },
        include_articles: { type: 'boolean', description: 'Include referenced EU articles (default false)' },
        reference_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by reference type: implements, references, supplements, applies',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_slovenian_implementations',
    description:
      'Get Slovenian statutes that implement a given EU directive or regulation. Returns a list of Slovenian statutes with their implementation status, showing which laws transpose the EU instrument into national law.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        eu_document_id: { type: 'string', description: 'EU document ID to look up implementations for' },
        primary_only: { type: 'boolean', description: 'Only return primary implementations (default false)' },
        in_force_only: { type: 'boolean', description: 'Only return statutes currently in force (default false)' },
      },
      required: ['eu_document_id'],
    },
  },
  {
    name: 'search_eu_implementations',
    description:
      'Search EU directives and regulations with optional filters. Shows which EU instruments have been implemented in Slovenian law and which ones are pending implementation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search terms for EU document titles' },
        type: { type: 'string', description: 'Filter by type: directive or regulation', enum: ['directive', 'regulation'] },
        year_from: { type: 'number', description: 'Start year filter' },
        year_to: { type: 'number', description: 'End year filter' },
        community: { type: 'string', description: 'EU community: EU, EG, EEG, Euratom', enum: ['EU', 'EG', 'EEG', 'Euratom'] },
        has_slovenian_implementation: { type: 'boolean', description: 'Filter by whether a Slovenian implementation exists' },
        limit: { type: 'number', description: 'Max results (1-100, default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_provision_eu_basis',
    description:
      'Get EU references for a specific provision in a Slovenian statute. Shows which EU articles are referenced or implemented by a particular Slovenian provision.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        document_id: { type: 'string', description: 'Document ID of the Slovenian statute' },
        provision_ref: { type: 'string', description: 'Provision reference (e.g. "148" or "3:5")' },
      },
      required: ['document_id', 'provision_ref'],
    },
  },
  {
    name: 'validate_eu_compliance',
    description:
      'Validate EU compliance for a Slovenian statute or provision. Checks for missing, partial, or outdated implementations and returns compliance issues with severity levels and recommendations (in Slovenian).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        document_id: { type: 'string', description: 'Document ID of the Slovenian statute to validate' },
        provision_ref: { type: 'string', description: 'Provision reference to narrow the check' },
        eu_document_id: { type: 'string', description: 'EU document ID to check compliance against' },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_provision_at_date',
    description:
      'Retrieve a specific provision from a Slovenian statute as it was at a given date. Uses the provision version history to return the text valid at the specified date. Supports amendment tracking.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        document_id: { type: 'string', description: 'Document ID of the statute' },
        provision_ref: { type: 'string', description: 'Provision reference (e.g. "148")' },
        date: { type: 'string', description: 'ISO date to query the provision at (YYYY-MM-DD)' },
        include_amendments: { type: 'boolean', description: 'Include amendment history records (default false)' },
      },
      required: ['document_id', 'provision_ref', 'date'],
    },
  },
];

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result: unknown;

  switch (name) {
    case 'search_legislation':
      result = await searchLegislation(getDb(), args as unknown as SearchLegislationInput);
      break;
    case 'get_provision':
      result = await getProvision(getDb(), args as unknown as GetProvisionInput);
      break;
    case 'search_case_law':
      result = await searchCaseLaw(getDb(), args as unknown as SearchCaseLawInput);
      break;
    case 'get_preparatory_works':
      result = await getPreparatoryWorks(getDb(), args as unknown as GetPreparatoryWorksInput);
      break;
    case 'validate_citation':
      result = await validateCitationTool(getDb(), args as unknown as ValidateCitationInput);
      break;
    case 'build_legal_stance':
      result = await buildLegalStance(getDb(), args as unknown as BuildLegalStanceInput);
      break;
    case 'format_citation':
      result = await formatCitationTool(args as unknown as FormatCitationInput);
      break;
    case 'check_currency':
      result = await checkCurrency(getDb(), args as unknown as CheckCurrencyInput);
      break;
    case 'get_eu_basis':
      result = await getEUBasis(getDb(), args as unknown as GetEUBasisInput);
      break;
    case 'get_slovenian_implementations':
      result = await getSlovenianImplementations(getDb(), args as unknown as GetSlovenianImplementationsInput);
      break;
    case 'search_eu_implementations':
      result = await searchEUImplementations(getDb(), args as unknown as SearchEUImplementationsInput);
      break;
    case 'get_provision_eu_basis':
      result = await getProvisionEUBasis(getDb(), args as unknown as GetProvisionEUBasisInput);
      break;
    case 'validate_eu_compliance':
      result = await validateEUCompliance(getDb(), args as unknown as ValidateEUComplianceInput);
      break;
    case 'get_provision_at_date':
      result = await getProvisionAtDate(getDb(), args as unknown as GetProvisionAtDateInput);
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'case-law-stats://slovenian-law-mcp/metadata',
      name: 'Slovenian Legal Database Metadata',
      description:
        'Metadata about the Slovenian legal database including data sources, coverage, and freshness.',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'case-law-stats://slovenian-law-mcp/metadata') {
    const metadata = {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      sources: {
        statutes: {
          name: 'PIS (pisrs.si)',
          description: 'Pravno-informacijski sistem RS — official portal for Slovenian legislation',
          url: 'http://www.pisrs.si',
          license: 'Public domain (government data)',
        },
        case_law: {
          name: 'sodnapraksa.si',
          description: 'Official open data portal for Slovenian court decisions',
          url: 'http://www.sodnapraksa.si',
          license: 'Public domain (government data)',
        },
        eu_law: {
          name: 'EUR-Lex',
          description: 'Official EU legislation database',
          url: 'https://eur-lex.europa.eu',
          license: 'Open Data',
        },
      },
      attribution:
        'Data sourced from pisrs.si and sodnapraksa.si. Case law metadata provided under public domain.',
    };

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(metadata, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_NAME}] Server started on stdio`);
}

process.on('SIGINT', () => {
  console.error(`[${SERVER_NAME}] Shutting down (SIGINT)...`);
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error(`[${SERVER_NAME}] Shutting down (SIGTERM)...`);
  closeDb();
  process.exit(0);
});

main().catch((error: unknown) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, error);
  closeDb();
  process.exit(1);
});
