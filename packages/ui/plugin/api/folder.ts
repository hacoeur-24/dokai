export function sectionJsonPath(folderRelPath: string): string {
  const clean = folderRelPath.replace(/^\/+|\/+$/g, '');
  return clean ? `${clean}/_section.json` : '_section.json';
}
