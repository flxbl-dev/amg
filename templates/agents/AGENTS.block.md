## Agent Memory Graph

- Use `.amg/agent-command-contract.md` as the local AMG command contract.
- Run `pnpm exec amg status --format json` when AMG configuration is uncertain.
- Run `pnpm exec amg recall --objective "<current objective>" --format markdown` for context-sensitive work after `pnpm exec amg link --yes` has written `.amg/config.json` defaults, or pass explicit `--workspace-id`, `--project-id`, and `--agent-id` overrides.
- Tenant-writing commands require explicit intent: `link --yes`, `remember`, `task create`, `decide`, `recall --persist`, and `export-context --persist`.
- Never print `.env`, FLXBL keys, seed secrets, tokens, or authorization headers.
