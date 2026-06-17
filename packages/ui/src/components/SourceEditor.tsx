/**
 * Plain raw-markdown textarea editor. Pairs with MilkdownEditor as the alternate view in
 * EditorPane. Uncontrolled (defaultValue) so typing is fast and React doesn't reconcile per
 * keystroke; the parent listens via onChange to mirror into the draft state used by save.
 *
 * To re-seed (e.g. when the user opens a different doc, or when EditorPane flips back from
 * rich-text mode), pass a different React `key` from the parent — same idea as MilkdownEditor.
 */
export function SourceEditor({
  initial,
  onChange,
}: {
  initial: string;
  onChange: (markdown: string) => void;
}) {
  return (
    <div className="dokai-source-editor-host">
      <textarea
        defaultValue={initial}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="dokai-source-editor"
        aria-label="Markdown source"
      />
    </div>
  );
}
