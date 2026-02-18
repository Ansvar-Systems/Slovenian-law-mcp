#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Database from '@ansvar/mcp-sqlite';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { registerTools } from './tools/registry.js';
import { detectCapabilities, readDbMetadata, type Capability, type DbMetadata } from './capabilities.js';
import { MCP_SERVER_NAME as SERVER_NAME, MCP_SERVER_VERSION as SERVER_VERSION, METADATA_RESOURCE_URI } from './server-metadata.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
    dbInstance.pragma('journal_mode = DELETE', { simple: true });
    dbInstance.pragma('foreign_keys = ON');

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
// Tool handlers — shared registry (single source of truth)
// ---------------------------------------------------------------------------

registerTools(server, getDb());

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: METADATA_RESOURCE_URI,
      name: 'Slovenian Legal Database Metadata',
      description:
        'Metadata about the Slovenian legal database including data sources, coverage, and freshness.',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === METADATA_RESOURCE_URI) {
    const metadata = {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      sources: {
        statutes: {
          name: 'PIS (pisrs.si)',
          description: 'Pravno-informacijski sistem RS — official portal for Slovenian legislation',
          url: 'https://pisrs.si',
          license: 'Public domain (government data)',
        },
        case_law: {
          name: 'sodnapraksa.si',
          description: 'Official open data portal for Slovenian court decisions',
          url: 'https://www.sodnapraksa.si',
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
