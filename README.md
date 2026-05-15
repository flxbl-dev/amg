# @flxbl-dev/amg

Portable Agent Memory Graph adoption CLI for existing repositories.

## Install

```sh
npm install -g @flxbl-dev/amg
```

## First-Time FLXBL Schema Setup

Export the packaged AMG schema:

```sh
amg schema export --output ./amg-flxbl-schema.json
```

Import `amg-flxbl-schema.json` in `https://platform.flxbl.dev`, then configure
server-only FLXBL values for the tenant where the schema is active.

## Initialize A Repository

```sh
amg init --assistants codex,cursor
```

`amg init` writes local `.amg` guidance, assistant instruction blocks, optional
rules or hook wrappers, and `.gitignore` entries. It does not contact FLXBL and
does not write tenant data.

## Configure

Set server-only FLXBL values in your shell, `.env`, or `.env.local`:

```sh
FLXBL_INSTANCE_URL=https://api.flxbl.dev
FLXBL_TENANT_ID=
FLXBL_API_KEY=
```

Never expose `FLXBL_API_KEY` through `NEXT_PUBLIC_*`, browser config,
screenshots, logs, or agent context packs.

## Use

```sh
amg status --format json
amg link --workspace "FLXBL Labs" --project "Agent Memory Graph" --agents codex,cursor --yes
amg recall --objective "Prepare implementation context" --format markdown
```

`amg status --format json` can exit nonzero when `safeToUse` is false while
still printing parseable JSON on stdout.

`amg link --yes` writes local AMG identity defaults to `.amg/config.json` so
later `recall`, `remember`, and `export-context` commands do not need repeated
workspace, project, and agent IDs.

## Hooks

`amg init --assistants codex,claude,cursor` installs assistant guidance.
Add `--codex-hooks` to install Codex hook wrappers for recall and safety
checks. Hooks call `amg` from the consuming repository, fail open for
recall when AMG is not configured, and deny obvious secret-printing commands
before they run.

## Safety Contract

Read-only or local-only commands:

- `amg init`
- `amg schema export --output ./amg-flxbl-schema.json`
- `amg status --format json`
- `amg recall` without `--persist`
- `amg export-context` without `--persist`

Tenant-writing commands:

- `amg link --yes`
- `amg remember`
- `amg task create`
- `amg decide`
- `amg recall --persist`
- `amg export-context --persist`

Run tenant-writing commands only when you intend to mutate the configured FLXBL
tenant. Hooks fail open for recall and never auto-write memory.

## License

MIT. See `LICENSE` for the full terms.
