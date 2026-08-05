import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

export interface FieldDescription {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'unknown';
  sample: unknown;
}

export interface DatasetDescription {
  name: string;
  recordCount: number;
  fields: FieldDescription[];
}

function inferType(value: unknown): 'string' | 'number' | 'boolean' | 'unknown' {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'unknown';
}

export function describeDataset(dataset: string): DatasetDescription {
  const filePath = join(DATA_DIR, `${dataset}.json`);

  let records: Record<string, unknown>[];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    records = JSON.parse(raw);
  } catch {
    throw new Error(`Dataset "${dataset}" not found. Use list_datasets to see available datasets.`);
  }

  const fields: FieldDescription[] = records.length > 0
    ? Object.entries(records[0]).map(([name, value]) => ({
        name,
        type: inferType(value),
        sample: value,
      }))
    : [];

  return {
    name: dataset,
    recordCount: records.length,
    fields,
  };
}
