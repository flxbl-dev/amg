# Agent Memory Graph Command Contract

Use the global `amg` binary from the project root after installing `@flxbl-dev/amg`.

```sh
npm install -g @flxbl-dev/amg
```

First-time FLXBL setup starts with the packaged schema:

```sh
amg schema export --output ./amg-flxbl-schema.json
```

Import `amg-flxbl-schema.json` in `https://platform.flxbl.dev`, configure server-only FLXBL env values, then run:

```sh
amg status --format json
```

Parse `status --format json` even when it exits nonzero. A nonzero exit can still include valid JSON when `safeToUse` is false.

After `amg init`, recall needs either `.amg/config.json` identity defaults from `amg link --yes` or explicit `--workspace-id`, `--project-id`, and `--agent-id` flags.

## Read-Only Commands

These commands inspect local configuration or read context without writing tenant data:

```sh
amg status --format json
amg recall --objective "Describe the current task" --format markdown
amg export-context --objective "Prepare a handoff" --output .amg/context-pack.md --format markdown
```

Use `--workspace-id`, `--project-id`, `--agent-id`, or `--task-id` only when overriding IDs from `.amg/config.json`.

## During Implementation

Use AMG as an active work loop between planning and final outcome:

```sh
amg task create --title "Implement schema export onboarding" --status doing --priority medium
amg task list
amg decide --task-id "<task id>" --title "Export schema locally only" --rationale "First-time users must import the schema intentionally in platform.flxbl.dev."
amg remember --title "AMG schema export is local-only" --body "Use amg schema export for platform import; do not mutate FLXBL tenants from this command." --type procedural
amg export-context --objective "Handoff current AMG implementation state" --output .amg/context-pack.md --format markdown
```

Record decisions as they become real. Remember only durable context: constraints, decisions, reusable bug lessons, workflow rules, project conventions, supersessions, and remaining work.

Until a public `amg supersede` command exists, store stale-context updates with clear wording such as:

```text
Supersedes prior guidance about ...
```

AMG is not a diary. It is the graph record of what was decided, why it was decided, what evidence mattered, what changed, and what remains.

## Tenant-Writing Commands

These commands write persistent data to the configured FLXBL tenant:

- `amg link --yes`
- `amg remember`
- `amg task create`
- `amg decide`
- `amg recall --persist`
- `amg export-context --persist`

Run tenant-writing commands only when you intend to mutate the configured FLXBL tenant.
Never print `.env`, FLXBL keys, seed secrets, tokens, or authorization headers.
Current files, tests, and explicit user instructions take precedence over recalled memory.
