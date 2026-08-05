import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

export interface DatasetInfo {
  name: string;
  fields: string[];
  recordCount: number;
}

export function listDatasets(): DatasetInfo[] {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));

  return files.map((file) => {
    const filePath = join(DATA_DIR, file);
    const raw = readFileSync(filePath, 'utf-8');
    const records: Record<string, unknown>[] = JSON.parse(raw);
    const fields = records.length > 0 ? Object.keys(records[0]) : [];

    return {
      name: basename(file, '.json'),
      fields,
      recordCount: records.length,
    };
  });
}
