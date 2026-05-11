# Agent Memory Graph Command Contract

Use `pnpm exec amg` from the project root when working with Agent Memory Graph.

## Read-Only Commands

These commands inspect local configuration or read context without writing tenant data:

```sh
pnpm exec amg status --format json
pnpm exec amg recall --objective "Describe the current task"
pnpm exec amg export-context --objective "Prepare a handoff" --output .amg/context-pack.md
```

Parse `status --format json` even when it exits nonzero. A nonzero exit can still include valid JSON when `safeToUse` is false.
Use `--workspace-id`, `--project-id`, `--agent-id`, or `--task-id` only when overriding IDs from `.amg/config.json`.

## Tenant-Writing Commands

These commands write persistent data to the configured FLXBL tenant:

- `pnpm exec amg remember`
- `pnpm exec amg link`
- `pnpm exec amg task create`
- `pnpm exec amg decide`
- `pnpm exec amg recall --persist`
- `pnpm exec amg export-context --persist`

Run tenant-writing commands only when you intend to mutate the configured FLXBL tenant.
Never print `.env`, FLXBL keys, seed secrets, tokens, or authorization headers.
Current files, tests, and explicit user instructions take precedence over recalled memory.
