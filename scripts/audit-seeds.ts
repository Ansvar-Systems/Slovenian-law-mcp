#!/usr/bin/env tsx
/**
 * Audit seed files for completeness and consistency.
 *
 * Checks for missing fields, broken references, and data quality issues.
 *
 * Usage: npm run audit:seeds
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');

interface AuditIssue {
  file: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

async function main(): Promise<void> {
  console.log('=== Seed File Audit ===');
  console.log();

  if (!fs.existsSync(SEED_DIR)) {
    console.log('No seed directory found.');
    process.exit(0);
  }

  const seedFiles = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'));
  const issues: AuditIssue[] = [];
  const allDocIds = new Set<string>();

  // Collect all document IDs first
  for (const file of seedFiles) {
    const raw = fs.readFileSync(path.join(SEED_DIR, file), 'utf-8');
    const seed = JSON.parse(raw);
    if (seed.documents) {
      for (const doc of seed.documents) {
        allDocIds.add(doc.id);
      }
    }
  }

  for (const file of seedFiles) {
    const filePath = path.join(SEED_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    let seed: Record<string, unknown>;

    try {
      seed = JSON.parse(raw);
    } catch {
      issues.push({ file, severity: 'error', message: 'Invalid JSON' });
      continue;
    }

    // Check documents
    const docs = seed.documents as Array<Record<string, unknown>> | undefined;
    if (!docs || docs.length === 0) {
      issues.push({ file, severity: 'warning', message: 'No documents array' });
    } else {
      for (const doc of docs) {
        if (!doc.id) issues.push({ file, severity: 'error', message: 'Document missing id' });
        if (!doc.title) issues.push({ file, severity: 'warning', message: `Document ${doc.id}: missing title` });
        if (!doc.type) issues.push({ file, severity: 'error', message: `Document ${doc.id}: missing type` });
      }
    }

    // Check provisions
    const provs = seed.provisions as Array<Record<string, unknown>> | undefined;
    if (provs) {
      for (const prov of provs) {
        if (!prov.document_id) {
          issues.push({ file, severity: 'error', message: 'Provision missing document_id' });
        } else if (!allDocIds.has(prov.document_id as string)) {
          issues.push({ file, severity: 'warning', message: `Provision references unknown document: ${prov.document_id}` });
        }
        if (!prov.content) {
          issues.push({ file, severity: 'warning', message: `Provision ${prov.provision_ref}: empty content` });
        }
      }
    }

    // Check cross_references
    const xrefs = seed.cross_references as Array<Record<string, unknown>> | undefined;
    if (xrefs) {
      for (const xr of xrefs) {
        if (!allDocIds.has(xr.target_document_id as string)) {
          issues.push({ file, severity: 'warning', message: `Cross-reference to unknown document: ${xr.target_document_id}` });
        }
      }
    }
  }

  // Print results
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  if (errors.length > 0) {
    console.log('ERRORS:');
    for (const issue of errors) {
      console.log(`  [${issue.file}] ${issue.message}`);
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log('WARNINGS:');
    for (const issue of warnings) {
      console.log(`  [${issue.file}] ${issue.message}`);
    }
    console.log();
  }

  console.log(`Summary: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info`);
  console.log(`Files checked: ${seedFiles.length}`);

  if (errors.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
