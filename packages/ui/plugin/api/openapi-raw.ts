/** Content-type for a spec file by extension, or null if the extension is not an allowed spec. */
export function resolveSpecContentType(relPath: string): string | null {
  const ext = (relPath.split('.').pop() ?? '').toLowerCase();
  if (ext === 'yaml' || ext === 'yml') return 'application/yaml; charset=utf-8';
  if (ext === 'json') return 'application/json; charset=utf-8';
  return null;
}
