# @flxbl-dev/amg

Portable Agent Memory Graph adoption CLI for existing repositories.

## Install

```sh
pnpm add -D @flxbl-dev/amg
pnpm exec amg init --assistants codex,cursor
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
pnpm exec amg status --format json
pnpm exec amg link --workspace "FLXBL Labs" --project "Agent Memory Graph" --agents codex,cursor --yes
pnpm exec amg recall --objective "Prepare implementation context" --format markdown
```

`amg status --format json` can exit nonzero when `safeToUse` is false while
still printing parseable JSON on stdout.

`amg link --yes` writes local AMG identity defaults to `.amg/config.json` so
later `recall`, `remember`, and `export-context` commands do not need repeated
workspace, project, and agent IDs.

## Hooks

`amg init --assistants codex,claude,cursor` installs assistant guidance.
Add `--codex-hooks` to install Codex hook wrappers for recall and safety
checks. Hooks call `pnpm exec amg` from the consuming repository, fail open for
recall when AMG is not configured, and deny obvious secret-printing commands
before they run.

## Safety Contract

Read-only or local-only commands:

- `pnpm exec amg init`
- `pnpm exec amg status --format json`
- `pnpm exec amg recall` without `--persist`
- `pnpm exec amg export-context` without `--persist`

Tenant-writing commands:

- `pnpm exec amg link --yes`
- `pnpm exec amg remember`
- `pnpm exec amg task create`
- `pnpm exec amg decide`
- `pnpm exec amg recall --persist`
- `pnpm exec amg export-context --persist`

Run tenant-writing commands only when you intend to mutate the configured FLXBL
tenant. Hooks fail open for recall and never auto-write memory.

## License

MIT. See `LICENSE` for the full terms.
