#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const forbiddenSecretPattern =
  /FLXBL_API_KEY=[^\n\s]*[A-Za-z0-9_]{8,}|Authorization:\s*Bearer\s+[A-Za-z0-9._-]+|AMG_DEMO_SEED_SECRET=[^\n\s]+/i;

let tempRoot;

try {
  tempRoot = await mkdtemp(join(tmpdir(), 'amg-cli-package-'));
  const packDir = join(tempRoot, 'pack');
  const consumerDir = join(tempRoot, 'consumer');
  await mkdir(packDir, { recursive: true });
  await mkdir(consumerDir, { recursive: true });

  run('pnpm', ['build'], { cwd: packageRoot });
  run('pnpm', ['pack', '--pack-destination', packDir], { cwd: packageRoot });

  const tarballPath = findPackedTarball(packDir);
  assertTarballContainsTemplates(tarballPath);

  await writeFile(
    join(consumerDir, 'package.json'),
    `${JSON.stringify({ name: 'amg-cli-package-fixture', private: true, type: 'module' }, null, 2)}\n`,
  );

  run('pnpm', ['add', '-D', tarballPath], { cwd: consumerDir });

  const help = run('pnpm', ['exec', 'amg', '--help'], { cwd: consumerDir });
  assertIncludes(help.stdout, 'Usage: amg', 'amg --help should include Usage: amg');
  assertNoSecretOutput(help.stdout + help.stderr, 'amg --help');

  const dryRun = run('pnpm', ['exec', 'amg', 'init', '--assistants', 'codex,cursor', '--dry-run'], {
    cwd: consumerDir,
  });
  assertIncludes(dryRun.stdout, 'AGENTS.md', 'amg init --dry-run should plan AGENTS.md');
  assertNoSecretOutput(dryRun.stdout + dryRun.stderr, 'amg init --dry-run');

  run('pnpm', ['exec', 'amg', 'init', '--assistants', 'codex,cursor', '--codex-hooks'], { cwd: consumerDir });
  run('pnpm', ['exec', 'amg', 'init', '--assistants', 'codex,cursor', '--codex-hooks'], { cwd: consumerDir });

  const agentsText = await readFile(join(consumerDir, 'AGENTS.md'), 'utf8');
  const managedBlockCount = (agentsText.match(/BEGIN AMG MANAGED BLOCK/g) ?? []).length;
  if (managedBlockCount !== 1) {
    throw new Error(`Expected one AMG managed block in AGENTS.md after repeated init, found ${managedBlockCount}.`);
  }
  assertNoSecretOutput(agentsText, 'AGENTS.md');

  const codexConfig = await readFile(join(consumerDir, '.codex/config.example.toml'), 'utf8');
  assertIncludes(codexConfig, 'hooks.SessionStart', 'amg init --codex-hooks should install SessionStart config');
  assertIncludes(codexConfig, 'hooks.PreToolUse', 'amg init --codex-hooks should install PreToolUse config');

  const preToolUseHook = await readFile(join(consumerDir, '.codex/hooks/pre-tool-use.mjs'), 'utf8');
  assertIncludes(preToolUseHook, 'AMG_CODEX_HOOK_EVENT', 'Codex hook should set the event environment variable');
  assertIncludes(preToolUseHook, 'codex-hook', 'Codex hook should dispatch to amg codex-hook');
  assertNoSecretOutput(codexConfig + preToolUseHook, 'Codex hook files');

  const statusEnv = { ...process.env };
  delete statusEnv.FLXBL_TENANT_ID;
  delete statusEnv.FLXBL_API_KEY;
  delete statusEnv.FLXBL_INSTANCE_URL;
  delete statusEnv.AMG_DEMO_SEED_SECRET;

  const status = spawn('pnpm', ['exec', 'amg', 'status', '--format', 'json'], {
    cwd: consumerDir,
    env: statusEnv,
    allowFailure: true,
  });
  if (status.status === 0) {
    throw new Error('Expected amg status --format json to exit nonzero without FLXBL env.');
  }

  let parsedStatus;
  try {
    parsedStatus = JSON.parse(status.stdout);
  } catch (error) {
    throw new Error(`Expected amg status stdout to be valid JSON. ${error instanceof Error ? error.message : error}`);
  }

  if (parsedStatus.safeToUse !== false) {
    throw new Error(`Expected status.safeToUse to be false without FLXBL env, received ${parsedStatus.safeToUse}.`);
  }
  assertNoSecretOutput(status.stdout + status.stderr, 'amg status --format json');

  process.stdout.write(`Verified AMG CLI package fixture with ${tarballPath}\n`);
} finally {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function run(command, args, options) {
  return spawn(command, args, { ...options, allowFailure: false });
}

function spawn(command, args, { cwd, env = process.env, allowFailure = false }) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assertNoSecretOutput(output, `${command} ${args.join(' ')}`);

  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `Command failed (${result.status ?? 'signal'}): ${command} ${args.join(' ')}\n${summarizeOutput(output)}`,
    );
  }

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function findPackedTarball(packDir) {
  const tarballs = readdirSync(packDir)
    .filter((entry) => entry.endsWith('.tgz'))
    .map((entry) => join(packDir, entry));

  if (tarballs.length !== 1) {
    throw new Error(`Expected one packed tarball in ${packDir}, found ${tarballs.length}.`);
  }

  return tarballs[0];
}

function assertTarballContainsTemplates(tarballPath) {
  const listing = run('tar', ['-tf', tarballPath], { cwd: packageRoot }).stdout;
  assertIncludes(listing, 'package/templates/agents/AGENTS.block.md', 'package tarball should include assistant templates');
  assertIncludes(listing, 'package/templates/cursor/amg.mdc', 'package tarball should include Cursor rule templates');
  assertIncludes(listing, 'package/templates/amg/env.example', 'package tarball should include AMG env template');
  assertIncludes(listing, 'package/LICENSE', 'package tarball should include license');
  assertExcludes(listing, 'package/docs/', 'package tarball should not include local app docs');
  assertExcludes(listing, 'package/.env', 'package tarball should not include env files');
  assertExcludes(listing, 'package/node_modules/', 'package tarball should not include dependencies');
}

function assertIncludes(value, expected, message) {
  if (!value.includes(expected)) {
    throw new Error(`${message}. Missing "${expected}".`);
  }
}

function assertNoSecretOutput(value, label) {
  if (forbiddenSecretPattern.test(value)) {
    throw new Error(`Potential secret-like value detected in ${label} output.`);
  }
}

function assertExcludes(value, forbidden, message) {
  if (value.includes(forbidden)) {
    throw new Error(`${message}. Found "${forbidden}".`);
  }
}

function summarizeOutput(output) {
  return output.split('\n').slice(-40).join('\n');
}
