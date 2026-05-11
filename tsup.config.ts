import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/amg': 'src/bin/amg.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
