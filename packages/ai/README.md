# dokai-ai

Coding-agent assets for [DOKAI](https://github.com/hacoeur-24/dokai) — local-first documentation for any repo.

This is an internal package consumed by the [`dokai`](https://www.npmjs.com/package/dokai) CLI. You normally install **`dokai`**, not this package directly.

It bundles the agent-facing templates and the helpers the CLI uses to scaffold them during `dokai init`:

- `copyAgentAssets` — copies the Claude Code slash commands (`/set-documentation`, `/update-documentation`) into `.claude/commands/`, and the single agent-agnostic `dokai` skill into both `.claude/skills/dokai/` and `.agents/skills/dokai/`.
- `patchAgentsMd` — idempotently maintains a managed `dokai` block in the repo root `AGENTS.md`, the file Codex/Cursor/Gemini-style agents read, pointing them at the skill.

Slash commands are Claude-specific; every other agent works from the skill and the `AGENTS.md` pointer.

## License

[MIT](https://github.com/hacoeur-24/dokai/blob/main/LICENSE) © hacoeur-24
