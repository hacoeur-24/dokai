## DOKAI documentation

This project uses [DOKAI](https://github.com/hacoeur-24/dokai) for local-first documentation: a
`DOKAI/` tree of committed markdown files, served by a local UI.

- **How to work with the docs:** load the skill at `.agents/skills/dokai/SKILL.md`. It covers the
  frontmatter/section/Mermaid conventions and the author-from-scratch and incremental-update
  workflows. Follow it whenever you read, write, or update anything under `DOKAI/`.
- **Keep the docs in sync:** whenever you make a significant change to the codebase (new feature,
  API change, architecture or dependency shift, removed module), update the affected docs under
  `DOKAI/` in the same change. In Claude Code run `/update-documentation`; with any other agent,
  follow the skill above. Don't let the docs drift from the code.
- **Preview locally:** `dokai dev` (http://localhost:8128). Build a static site: `dokai build`.
- Each doc under `DOKAI/` needs frontmatter (`title`, `description`, `tags`, `version`, `status`).
  Group docs by feature/package, not by mirroring code folders.

(Claude Code users also have `/set-documentation` and `/update-documentation` slash commands.)
