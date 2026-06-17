import { useSearchParams } from 'react-router-dom';
import { DocView } from './DocView.js';
import { EditorView } from './EditorView.js';

/** Switches between read-only DocView and the Milkdown EditorView based on `?edit=1`. */
export function DocOrEditor() {
  const [params] = useSearchParams();
  return params.get('edit') === '1' ? <EditorView /> : <DocView />;
}
