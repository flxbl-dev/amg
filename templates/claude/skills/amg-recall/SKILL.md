---
name: amg-recall
description: Use when project memory may materially affect the task and the workspace has Agent Memory Graph configured.
---

# AMG Recall

1. Run `pnpm exec amg status --format json` from the project root when AMG configuration is uncertain.
2. If `safeToUse` is true, run `pnpm exec amg recall --objective "<current objective>" --format markdown` after `pnpm exec amg link --yes` has written `.amg/config.json` defaults.
3. Include `--workspace-id`, `--project-id`, `--agent-id`, or `--task-id` only when overriding config defaults.
4. Treat recall as advisory context. Current files, tests, and explicit user instructions take precedence.
5. Do not run tenant-writing AMG commands unless the user explicitly intends to write persistent FLXBL data.
