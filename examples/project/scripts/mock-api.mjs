// Tiny zero-dependency mock of the example Petstore API, so DOKAI's "Test Request" try-it-out has
// a real server to hit. Matches DOKAI/openapi/petstore.yaml: GET /pets is public, POST /pets needs
// a Bearer token (demonstrates the Authorize / lock-icon flow).
//
// Run alongside the docs UI:
//   pnpm --filter example-project mock     # this server, on :3000
//   pnpm --filter example-project dokai    # the DOKAI UI, on :8128
// Then open http://localhost:8128/dokai/_api/petstore and hit "Test Request".
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 3000);

const PETS = [
  { id: 1, name: 'Rex', species: 'dog' },
  { id: 2, name: 'Whiskers', species: 'cat' },
  { id: 3, name: 'Nibbles', species: 'hamster' },
];

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

const server = createServer((req, res) => {
  const method = req.method ?? 'GET';
  const path = (req.url ?? '/').split('?')[0];
  console.log(`[mock-api] ${method} ${path}`);

  if (method === 'GET' && path === '/pets') {
    return json(res, 200, PETS);
  }

  if (method === 'POST' && path === '/pets') {
    const auth = req.headers['authorization'];
    if (!auth || !/^bearer\s+\S+/i.test(auth)) {
      return json(res, 401, {
        error: 'Unauthorized: POST /pets requires a Bearer token. Use the Authorize button first.',
      });
    }
    return json(res, 201, { id: PETS.length + 1, created: true });
  }

  return json(res, 404, { error: `No mock route for ${method} ${path}` });
});

server.listen(PORT, () => {
  console.log(`[mock-api] DOKAI example mock API listening on http://localhost:${PORT}`);
  console.log('[mock-api] GET /pets (public)  |  POST /pets (requires Bearer token)');
});
