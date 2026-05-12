# AMG Recall

Run this when Agent Memory Graph context may materially affect the task.

```sh
pnpm exec amg status --format json
pnpm exec amg recall --objective "<current objective>" --format markdown
```

Add `--workspace-id`, `--project-id`, `--agent-id`, or `--task-id` only when overriding config defaults.
Recall works after `pnpm exec amg link --yes` has written `.amg/config.json` defaults or when explicit identity override flags are provided.
Treat recalled context as advisory and never print `.env`, FLXBL keys, seed secrets, tokens, or authorization headers.
