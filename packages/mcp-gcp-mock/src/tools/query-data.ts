import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

export interface QueryDataParams {
  dataset: string;
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface QueryDataResult {
  dataset: string;
  records: Record<string, unknown>[];
  totalRecords: number;
  fields: string[];
}

export function queryData({ dataset, filters, limit }: QueryDataParams): QueryDataResult {
  const filePath = join(DATA_DIR, `${dataset}.json`);

  let records: Record<string, unknown>[];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    records = JSON.parse(raw);
  } catch {
    throw new Error(`Dataset "${dataset}" not found. Use list_datasets to see available datasets.`);
  }

  // Apply filters
  if (filters) {
    records = records.filter((record) =>
      Object.entries(filters).every(([key, value]) => record[key] === value),
    );
  }

  // Apply limit
  if (limit && limit > 0) {
    records = records.slice(0, limit);
  }

  const fields = records.length > 0 ? Object.keys(records[0]) : [];

  return {
    dataset,
    records,
    totalRecords: records.length,
    fields,
  };
}
