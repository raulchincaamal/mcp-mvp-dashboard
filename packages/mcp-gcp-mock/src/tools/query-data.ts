import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// After tsup bundles to dist/index.js, data/ is at ../data relative to dist/
const DATA_DIR = join(__dirname, '../data');

export interface RangeFilter {
  gte?: string | number;
  lte?: string | number;
  gt?: string | number;
  lt?: string | number;
}

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

/**
 * Checks if a value is a range filter object (has gte, lte, gt, or lt keys).
 */
function isRangeFilter(value: unknown): value is RangeFilter {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const keys = Object.keys(value);
  return keys.some((k) => ['gte', 'lte', 'gt', 'lt'].includes(k));
}

/**
 * Evaluates a range filter against a record value.
 * Works with both strings (dates like "2025-07-01") and numbers.
 */
function matchesRange(recordValue: unknown, range: RangeFilter): boolean {
  if (recordValue === undefined || recordValue === null) return false;

  const val = String(recordValue);

  if (range.gte !== undefined && !(val >= String(range.gte))) return false;
  if (range.lte !== undefined && !(val <= String(range.lte))) return false;
  if (range.gt !== undefined && !(val > String(range.gt))) return false;
  if (range.lt !== undefined && !(val < String(range.lt))) return false;

  return true;
}

export function queryData({
  dataset,
  filters,
  limit,
}: QueryDataParams): QueryDataResult {
  const filePath = join(DATA_DIR, `${dataset}.json`);

  let records: Record<string, unknown>[];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    records = JSON.parse(raw);
  } catch {
    throw new Error(
      `Dataset "${dataset}" not found. Use list_datasets to see available datasets.`,
    );
  }

  // Apply filters (supports exact match and range filters)
  if (filters) {
    records = records.filter((record) =>
      Object.entries(filters).every(([key, value]) => {
        if (isRangeFilter(value)) {
          return matchesRange(record[key], value);
        }
        return record[key] === value;
      }),
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

