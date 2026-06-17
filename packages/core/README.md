# dokai-core

Engine for [DOKAI](https://github.com/hacoeur-24/dokai) — local-first documentation for any repo.

This is an internal package consumed by the [`dokai`](https://www.npmjs.com/package/dokai) CLI and [`dokai-ui`](https://www.npmjs.com/package/dokai-ui). You normally install **`dokai`**, not this package directly.

It provides the settings, scan, parse, route, search, and repo-detection utilities. It ships two entry points:

- `dokai-core` — browser-safe (schemas, route + slug helpers, types).
- `dokai-core/node` — Node-only filesystem utilities (`scanDokai`, `parseDoc`, `loadSettings`, `buildSearchIndex`, `detectRepo`).

## License

[MIT](https://github.com/hacoeur-24/dokai/blob/main/LICENSE) © hacoeur-24
