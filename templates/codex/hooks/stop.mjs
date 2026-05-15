#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const expectedEvent = 'Stop';
const input = readFileSync(0, 'utf8');

const result = spawnSync('amg', ['codex-hook'], {
  input,
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
  env: { ...process.env, AMG_CODEX_HOOK_EVENT: expectedEvent },
});

if (result.error || result.status !== 0) {
  if (result.stderr) process.stderr.write(result.stderr);
  process.stdout.write(`${JSON.stringify({ continue: true })}\n`);
  process.exit(0);
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

process.exit(0);
