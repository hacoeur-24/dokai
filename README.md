<div align="center">

# DOKAI

**Local-first documentation, dropped into any repo with one command.**

[![Version](https://img.shields.io/badge/version-1.0.0-2563eb?style=flat-square)](https://github.com/Chrono-Innovation/DOKAI/releases)
[![Status](https://img.shields.io/badge/status-stable-22c55e?style=flat-square)](#)
[![Distribution](https://img.shields.io/badge/distribution-public-6b7280?style=flat-square)](#)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<sub>Built by <a href="https://github.com/hacoeur-24">hacoeur-24</a> · React 19 · Vite · Tailwind v4 · Milkdown · MiniSearch · Claude Code</sub>

</div>

---

## Contents

- [What is DOKAI?](#what-is-DOKAI)
- [Install](#install) — one-time setup, then one command per project
  - [1. One-time machine setup](#1-one-time-machine-setup)
  - [2. Install in your project](#2-install-in-your-project)
  - [3. Daily commands](#3-daily-commands)
- [What lands in your repo](#what-lands-in-your-repo-after-DOKAI-init)
- [FAQ](#faq) — registry conflicts, engine warnings, workspaces
- [Internal repo layout](#internal-repo-layout)

---

## What is DOKAI?

DOKAI is a installable documentation product for any project. Run `DOKAI init` in any repository and you get a fully-functional, locally-served documentation site backed by a `DOKAI/` folder of markdown files — no SaaS, no external service, no source code dumped into your repository.

Designed to drop into:

- 📦 single-package projects (NextJS, Vite, plain Node, anything)
- 🌳 monorepos (pnpm / npm / yarn workspaces)
- ⚡ Turborepo apps
- 🧩 frontend, backend, full-stack, libraries, services

What you get from a single command:

| Feature | What it does |
|---|---|
| 📖 **Live docs UI** | React + Tailwind UI on `localhost:8128`, served by Vite |
| ✍️ **WYSIWYG editor** | Milkdown rich-text editor + raw-markdown toggle |
| 🧭 **Auto-organized sidebar** | Workspace-aware navigation built from your folder structure |
| 🔎 **Local search** | MiniSearch index over titles, headings, body, tags, status, version |
| 🌗 **Light & dark themes** | Configurable per project, overridable per user |
| 📊 **Mermaid diagrams** | Inline rendering, click-to-fullscreen, SVG/PNG export |
| 🌍 **i18n** | English / French UI |
| 🤖 **Claude Code integrations** | `/set-documentation` and `/update-documentation` slash commands |
| 📦 **Static build** | `DOKAI build` produces a deployable read-only site |
| 🔁 **Frontmatter versioning** | Auto-bump on save (rollover semver), team-shared via Git |

**Local-first by design.** Your docs, your repo, your Git history. Engine and UI live entirely inside the installed package, your project receives only its own data.

---

<div align="center">

<sub>Built with care by <a href="https://github.com/hacoeur-24">hacoeur-24</a> · v1.0.0</sub>

</div>
