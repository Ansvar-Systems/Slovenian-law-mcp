/**
 * Tool registry for Slovenian Legal Citation MCP Server.
 * Shared between stdio (index.ts) and HTTP (api/mcp.ts) entry points.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import Database from '@ansvar/mcp-sqlite';

import { searchLegislation, type SearchLegislationInput } from './search-legislation.js';
import { getProvision, type GetProvisionInput } from './get-provision.js';
import { searchCaseLaw, type SearchCaseLawInput } from './search-case-law.js';
import { getPreparatoryWorks, type GetPreparatoryWorksInput } from './get-preparatory-works.js';
import { validateCitationTool, type ValidateCitationInput } from './validate-citation.js';
import { buildLegalStance, type BuildLegalStanceInput } from './build-legal-stance.js';
import { formatCitationTool, type FormatCitationInput } from './format-citation.js';
import { checkCurrency, type CheckCurrencyInput } from './check-currency.js';
import { getEUBasis, type GetEUBasisInput } from './get-eu-basis.js';
import { getSlovenianImplementations, type GetSlovenianImplementationsInput } from './get-slovenian-implementations.js';
import { searchEUImplementations, type SearchEUImplementationsInput } from './search-eu-implementations.js';
import { getProvisionEUBasis, type GetProvisionEUBasisInput } from './get-provision-eu-basis.js';
import { validateEUCompliance, type ValidateEUComplianceInput } from './validate-eu-compliance.js';
import { getProvisionAtDate, type GetProvisionAtDateInput } from './get-provision-at-date.js';

export const TOOLS: Tool[] = [
  {
    name: 'search_legislation',
    description:
      'Search Slovenian statutes and regulations by keyword. Searches FTS-indexed provisions from PIS (pisrs.si). Use document_id to narrow to a specific statute. Supports temporal queries via as_of_date.',
    inputSchema: {
      type: 'object',
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
      'Retrieve a specific provision from a Slovenian statute. Examples: document_id="zakon-o-kazenskem-postopku", article="148" for 148. clen ZKP. Can also use provision_ref directly (e.g. "148").',
    inputSchema: {
      type: 'object',
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
      'Search Slovenian court decisions from sodnapraksa.si. Supports full-text search with optional filters for court (e.g. USRS, VSRS, VSL, VSM), legal domain, procedure type, and date range.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms' },
        court: { type: 'string', description: 'Court code: USRS, VSRS, VSL, VSM, VSK, VSC, UPRS, VDSS' },
        ecli: { type: 'string', description: 'Direct ECLI lookup (e.g. "ECLI:SI:VSRS:2020:123")' },
        legal_domain: { type: 'string', description: 'Legal domain filter (e.g. "civilno", "kazensko", "upravno")' },
        procedure_type: { type: 'string', description: 'Procedure type filter (e.g. "revizija", "pritozba")' },
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
      'Get preparatory works (zakonodajno gradivo) for a Slovenian statute. Returns related parliamentary documents such as predlog zakona (bill), porocilo, mnenje, and other legislative materials.',
    inputSchema: {
      type: 'object',
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
      'Validate a Slovenian legal citation and check whether the referenced document and provision exist in the database.',
    inputSchema: {
      type: 'object',
      properties: {
        citation: { type: 'string', description: 'Citation string to validate' },
      },
      required: ['citation'],
    },
  },
  {
    name: 'build_legal_stance',
    description:
      'Build a comprehensive legal stance on a topic by combining statute provisions, case law, preparatory works, and cross-references.',
    inputSchema: {
      type: 'object',
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
      'Format a Slovenian legal citation into the standard format. Supports full, short, and pinpoint formats.',
    inputSchema: {
      type: 'object',
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
      'Check whether a Slovenian statute or provision is currently in force (veljavno pravo). Returns the document status, validity dates, and any warnings.',
    inputSchema: {
      type: 'object',
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
      'Get the EU legal basis for a Slovenian statute. Shows which EU directives and regulations the statute implements or references.',
    inputSchema: {
      type: 'object',
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
      'Get Slovenian statutes that implement a given EU directive or regulation.',
    inputSchema: {
      type: 'object',
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
      'Search EU directives and regulations with optional filters. Shows which EU instruments have been implemented in Slovenian law.',
    inputSchema: {
      type: 'object',
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
      'Get EU references for a specific provision in a Slovenian statute.',
    inputSchema: {
      type: 'object',
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
      'Validate EU compliance for a Slovenian statute or provision. Checks for missing, partial, or outdated implementations.',
    inputSchema: {
      type: 'object',
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
      'Retrieve a specific provision from a Slovenian statute as it was at a given date. Uses the provision version history.',
    inputSchema: {
      type: 'object',
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

export function registerTools(
  server: Server,
  db: InstanceType<typeof Database>,
): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case 'search_legislation':
          result = await searchLegislation(db, args as unknown as SearchLegislationInput);
          break;
        case 'get_provision':
          result = await getProvision(db, args as unknown as GetProvisionInput);
          break;
        case 'search_case_law':
          result = await searchCaseLaw(db, args as unknown as SearchCaseLawInput);
          break;
        case 'get_preparatory_works':
          result = await getPreparatoryWorks(db, args as unknown as GetPreparatoryWorksInput);
          break;
        case 'validate_citation':
          result = await validateCitationTool(db, args as unknown as ValidateCitationInput);
          break;
        case 'build_legal_stance':
          result = await buildLegalStance(db, args as unknown as BuildLegalStanceInput);
          break;
        case 'format_citation':
          result = await formatCitationTool(args as unknown as FormatCitationInput);
          break;
        case 'check_currency':
          result = await checkCurrency(db, args as unknown as CheckCurrencyInput);
          break;
        case 'get_eu_basis':
          result = await getEUBasis(db, args as unknown as GetEUBasisInput);
          break;
        case 'get_slovenian_implementations':
          result = await getSlovenianImplementations(db, args as unknown as GetSlovenianImplementationsInput);
          break;
        case 'search_eu_implementations':
          result = await searchEUImplementations(db, args as unknown as SearchEUImplementationsInput);
          break;
        case 'get_provision_eu_basis':
          result = await getProvisionEUBasis(db, args as unknown as GetProvisionEUBasisInput);
          break;
        case 'validate_eu_compliance':
          result = await validateEUCompliance(db, args as unknown as ValidateEUComplianceInput);
          break;
        case 'get_provision_at_date':
          result = await getProvisionAtDate(db, args as unknown as GetProvisionAtDateInput);
          break;
        default:
          return {
            content: [{ type: 'text', text: `Error: Unknown tool "${name}".` }],
            isError: true,
          };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error executing ${name}: ${message}` }],
        isError: true,
      };
    }
  });
}
