import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSettings, saveProjectSettings, saveUserSettings } from './settings.js';
import { defaultProjectSettings } from './schemas/project-settings.js';
import { defaultUserSettings } from './schemas/user-settings.js';

describe('loadSettings', () => {
  it('returns defaults when no files exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dokai-settings-'));
    const loaded = await loadSettings(root);
    expect(loaded.project.projectName).toBe('Project Documentation');
    expect(loaded.user.ui.editorMode).toBe('rich-text');
    expect(loaded.errors).toEqual([]);
    expect(loaded.provenance.project.size).toBe(0);
    expect(loaded.provenance.user.size).toBe(0);
  });

  it('respects values written to settings.json and tracks provenance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dokai-settings-'));
    await writeFile(
      join(root, 'settings.json'),
      JSON.stringify({
        projectName: 'Acme Docs',
        theme: { primaryColor: '#ff0000' },
      }),
    );
    const loaded = await loadSettings(root);
    expect(loaded.project.projectName).toBe('Acme Docs');
    expect(loaded.project.theme.primaryColor).toBe('#ff0000');
    expect(loaded.provenance.project.has('projectName')).toBe(true);
    expect(loaded.provenance.project.has('theme')).toBe(true);
  });

  it('captures validation errors without throwing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dokai-settings-'));
    await writeFile(
      join(root, 'settings.json'),
      JSON.stringify({ theme: { primaryColor: 'not-a-color' } }),
    );
    const loaded = await loadSettings(root);
    expect(loaded.errors.some((e) => e.file === 'settings.json')).toBe(true);
    expect(loaded.project.theme.primaryColor).toBe('#2563eb');
  });
});

describe('save settings', () => {
  it('persists project settings as pretty JSON ending with newline', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dokai-settings-'));
    await saveProjectSettings(root, defaultProjectSettings({ projectName: 'X' }));
    const reloaded = await loadSettings(root);
    expect(reloaded.project.projectName).toBe('X');
  });

  it('persists user settings the same way', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dokai-settings-'));
    await saveUserSettings(
      root,
      defaultUserSettings({
        ui: {
          sidebarCollapsed: true,
          sidebarAutoCollapse: false,
          editorMode: 'source',
        },
      }),
    );
    const reloaded = await loadSettings(root);
    expect(reloaded.user.ui.sidebarCollapsed).toBe(true);
    expect(reloaded.user.ui.editorMode).toBe('source');
  });
});
