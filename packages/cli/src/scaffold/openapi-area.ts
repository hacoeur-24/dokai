import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ScaffoldOpenApiResult {
  written: string[];
  skipped: string[];
}

const PETSTORE_YAML = `openapi: 3.1.0
info:
  title: Petstore API
  version: 1.0.0
  description: A tiny sample API. Replace this with your own OpenAPI spec.
servers:
  - url: http://localhost:3000
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
paths:
  /pets:
    get:
      summary: List pets
      responses:
        '200':
          description: A list of pets.
    post:
      summary: Create a pet
      security:
        - bearerAuth: []
      responses:
        '201':
          description: Created.
`;

async function writeOnce(
  path: string,
  contents: string,
  written: string[],
  skipped: string[],
): Promise<void> {
  if (existsSync(path)) {
    skipped.push(path);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
  written.push(path);
}

/**
 * Seed DOKAI/openapi/ with a sample spec. Idempotent.
 *
 * No `_section.json` is written here on purpose: the openapi directory is surfaced in the sidebar
 * as a dedicated API group (built from the scanned specs), not as a docs-tree section. Writing a
 * `_section.json` would make scanDokai emit an empty "APIs" folder alongside that group.
 */
export async function scaffoldOpenApiArea(opts: { dokaiRoot: string }): Promise<ScaffoldOpenApiResult> {
  const written: string[] = [];
  const skipped: string[] = [];
  const dir = join(opts.dokaiRoot, 'openapi');

  await writeOnce(join(dir, 'petstore.yaml'), PETSTORE_YAML, written, skipped);

  return { written, skipped };
}
