# dokai-ai

Coding-agent assets for [DOKAI](https://github.com/hacoeur-24/dokai) — local-first documentation for any repo.

This is an internal package consumed by the [`dokai-kit`](https://www.npmjs.com/package/dokai-kit) CLI. You normally install **`dokai-kit`**, not this package directly.

It bundles the agent-facing templates and the helpers the CLI uses to scaffold them during `dokai init`:

- `copyAgentAssets` — installs the Claude Code assets into `.claude/` (the `/set-documentation` and `/update-documentation` slash commands → `.claude/commands/`, the `dokai` sub-agent → `.claude/agents/`, and the focused `dokai-docs` + `dokai-api` skills → `.claude/skills/`), plus the agent-agnostic `dokai-docs` + `dokai-api` skills → `.agents/skills/`.
- `patchClaudeMd` / `patchAgentsMd` — idempotently maintain a managed `dokai` block in `CLAUDE.md` (Claude-optimized) and the repo root `AGENTS.md` (read by Codex/Cursor/Gemini-style agents), each pointing the agent at its skills/commands.
- `removeLegacyAssets` — on upgrade, removes the pre-split single `dokai` skill (`.claude/skills/dokai/`, `.agents/skills/dokai/`).

Slash commands and the sub-agent are Claude-specific; every other agent works from the `.agents/` skills (which carry the set/update workflow) and the `AGENTS.md` pointer. The skills are split so each stays focused: `dokai-docs` for the `DOKAI/` markdown tree, `dokai-api` for the OpenAPI specs under `DOKAI/openapi/`.

## License

[MIT](https://github.com/hacoeur-24/dokai/blob/main/LICENSE) © hacoeur-24
