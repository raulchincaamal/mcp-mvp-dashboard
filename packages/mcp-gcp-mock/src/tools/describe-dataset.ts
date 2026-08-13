import { readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../data');

export interface FieldSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  sampleValues: unknown[];
  uniqueCount: number;
}

export interface DatasetDescription {
  name: string;
  totalRecords: number;
  fields: FieldSchema[];
}

/**
 * Detects the type of a field by sampling values.
 */
function detectType(values: unknown[]): 'string' | 'number' | 'boolean' | 'date' {
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  if (nonNull.length === 0) return 'string';

  const first = nonNull[0];

  if (typeof first === 'number') return 'number';
  if (typeof first === 'boolean') return 'boolean';
  if (typeof first === 'string') {
    // Detect ISO date patterns: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    if (/^\d{4}-\d{2}-\d{2}/.test(first)) return 'date';
    return 'string';
  }

  return 'string';
}

/**
 * Describes a dataset's schema by inspecting its records.
 * Returns field names, types, sample values, and unique counts.
 * Completely generic — works with any JSON dataset.
 */
export function describeDataset(datasetName: string): DatasetDescription {
  const filePath = join(DATA_DIR, `${datasetName}.json`);

  let records: Record<string, unknown>[];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    records = JSON.parse(raw);
  } catch {
    throw new Error(
      `Dataset "${datasetName}" not found. Use list_datasets to see available datasets.`,
    );
  }

  if (records.length === 0) {
    return { name: datasetName, totalRecords: 0, fields: [] };
  }

  const sampleSize = Math.min(records.length, 200);
  const sample = records.slice(0, sampleSize);
  const fieldNames = Object.keys(records[0]);

  const fields: FieldSchema[] = fieldNames.map((name) => {
    const values = sample.map((r) => r[name]);
    const nonNull = values.filter((v) => v !== null && v !== undefined);
    const uniqueValues = [...new Set(nonNull.map(String))];

    return {
      name,
      type: detectType(nonNull),
      sampleValues: uniqueValues.slice(0, 5),
      uniqueCount: uniqueValues.length,
    };
  });

  return {
    name: datasetName,
    totalRecords: records.length,
    fields,
  };
}
