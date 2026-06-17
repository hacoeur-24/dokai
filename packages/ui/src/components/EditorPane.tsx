import { Type, Code } from 'lucide-react';
import type { UserSettings } from 'dokai-core';
import { saveUserSettings } from '../lib/api.js';
import { useRefresh, useSettings } from '../state.js';
import { useToast } from './Toast.js';
import { MilkdownEditor } from './MilkdownEditor.js';
import { SourceEditor } from './SourceEditor.js';
import { useT } from '../i18n/index.js';

type EditorMode = UserSettings['ui']['editorMode'];

/**
 * Pane that wraps the active editor (Milkdown rich-text OR raw markdown textarea) and floats a
 * mode switcher in the top-right corner of the editor box. Mode is persisted in user settings
 * (`ui.editorMode`), so the choice survives reloads and follows the user across documents.
 *
 * The two editors are mounted with mode-specific React keys so that flipping the switcher
 * cleanly remounts the chosen editor with the latest draft markdown — the previous editor's
 * onChange has already mirrored every keystroke into the parent's draft state, so `initial`
 * carries the up-to-date content into the new mount.
 */
export function EditorPane({
  route,
  initial,
  onChange,
}: {
  /** Route used as part of the editor's mount key — switching docs forces a fresh mount. */
  route: string;
  /** The current draft markdown. Re-passed every render; only consumed at mount-time by the
   *  underlying editor. */
  initial: string;
  /** Fires on every keystroke from whichever editor is active. */
  onChange: (markdown: string) => void;
}) {
  const settings = useSettings();
  const refresh = useRefresh();
  const toast = useToast();
  const t = useT();
  const mode: EditorMode = settings.data?.user.ui.editorMode ?? 'rich-text';

  const setMode = (next: EditorMode): void => {
    if (!settings.data || next === mode) return;
    void saveUserSettings({
      ...settings.data.user,
      ui: { ...settings.data.user.ui, editorMode: next },
    })
      .then(() => refresh())
      .catch((err: unknown) => {
        toast.show({
          message: t('editor.couldntSwitchMode', {
            error: err instanceof Error ? err.message : String(err),
          }),
          kind: 'error',
        });
      });
  };

  return (
    <div className="dokai-editor-pane">
      <div className="dokai-editor-pane-toolbar">
        <ModeSwitcher mode={mode} onChange={setMode} t={t} />
      </div>
      {mode === 'source' ? (
        <SourceEditor key={`${route}-source`} initial={initial} onChange={onChange} />
      ) : (
        <MilkdownEditor key={`${route}-rich`} initial={initial} onChange={onChange} />
      )}
    </div>
  );
}

function ModeSwitcher({
  mode,
  onChange,
  t,
}: {
  mode: EditorMode;
  onChange: (next: EditorMode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="dokai-editor-switcher" role="group" aria-label={t('editor.modeRich')}>
      <button
        type="button"
        className="dokai-editor-switcher-btn"
        data-active={mode === 'rich-text' ? 'true' : undefined}
        onClick={() => onChange('rich-text')}
        title={t('editor.modeRichTitle')}
      >
        {/* `Type` is lucide's Aa icon — the canonical "rich text" affordance used by Medium,
            Notion, etc. Lucide doesn't ship a `TextInitial` icon at the version we depend on. */}
        <Type className="h-3.5 w-3.5" />
        <span>{t('editor.modeRich')}</span>
      </button>
      <button
        type="button"
        className="dokai-editor-switcher-btn"
        data-active={mode === 'source' ? 'true' : undefined}
        onClick={() => onChange('source')}
        title={t('editor.modeMarkdownTitle')}
      >
        <Code className="h-3.5 w-3.5" />
        <span>{t('editor.modeMarkdown')}</span>
      </button>
    </div>
  );
}
