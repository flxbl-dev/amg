# Agent Memory Graph

Use `.amg/agent-command-contract.md` as the local AMG command contract.
Run `pnpm exec amg status --format json` when AMG configuration is uncertain.
Use `pnpm exec amg recall` for context-sensitive work when AMG is safe to use.
Tenant-writing commands require explicit intent: `link`, `remember`, `task create`, `decide`, `recall --persist`, and `export-context --persist`.
Never print `.env`, FLXBL keys, seed secrets, tokens, or authorization headers.
