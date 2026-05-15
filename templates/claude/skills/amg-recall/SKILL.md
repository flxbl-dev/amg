---
name: amg-recall
description: Use when project memory may materially affect the task and the workspace has Agent Memory Graph configured.
---

# AMG Recall

1. Run `amg status --format json` from the project root when AMG configuration is uncertain.
2. If `safeToUse` is true, run `amg recall --objective "<current objective>" --format markdown` after `amg link --yes` has written `.amg/config.json` defaults.
3. Include `--workspace-id`, `--project-id`, `--agent-id`, or `--task-id` only when overriding config defaults.
4. Treat recall as advisory context. Current files, tests, and explicit user instructions take precedence.
5. During durable implementation work, use `amg task create`, `amg decide`, and `amg remember` to capture what was built, why it was decided, what changed, and what remains.
6. Do not run tenant-writing AMG commands unless the user explicitly intends to write persistent FLXBL data.
