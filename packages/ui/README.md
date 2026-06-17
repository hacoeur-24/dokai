# dokai-ui

The React app and Vite plugin for [DOKAI](https://github.com/hacoeur-24/dokai) — local-first documentation for any repo.

This is an internal package consumed by the [`dokai-kit`](https://www.npmjs.com/package/dokai-kit) CLI. You normally install **`dokai-kit`**, not this package directly.

It ships two outputs:

- `dokai-ui` — the Vite plugin and `/api` middleware that mount the documentation server.
- `dokai-ui/app` — the React documentation UI entry source (compiled to a prebuilt bundle at publish time).

## License

[MIT](https://github.com/hacoeur-24/dokai/blob/main/LICENSE) © hacoeur-24
