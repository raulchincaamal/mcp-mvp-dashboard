import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/local.ts'],
  format: ['cjs'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
});
