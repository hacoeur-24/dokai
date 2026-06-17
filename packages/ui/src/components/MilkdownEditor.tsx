import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
// frame-dark.css would unconditionally override frame.css's variables (both stylesheets
// target `.milkdown` with no media query, so the second import always wins). Instead the
// dark `--crepe-color-*` vars are re-declared under [data-theme='dark'] .milkdown in
// global.css, so the editor follows our app theme.

/**
 * Milkdown WYSIWYG editor (Crepe bundle).
 *
 * Mounted exactly once per `key`. We deliberately DO NOT depend on `initial` in the effect:
 * `initial` is the seed value, not a controlled value. If the effect re-ran on every change,
 * each keystroke would destroy and re-create the editor — which caused the cursor to vanish
 * on focus and the slash menu to close on the first click. To re-seed the editor for a new
 * document, pass a different React `key` from the parent.
 */
export function MilkdownEditor({
  initial,
  onChange,
}: {
  initial: string;
  onChange: (markdown: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let disposed = false;
    const crepe = new Crepe({
      root: node,
      defaultValue: initialRef.current,
    });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current(markdown);
      });
    });
    void crepe
      .create()
      .then(() => {
        if (disposed) void crepe.destroy();
      })
      .catch((err: unknown) => {
        console.error('Milkdown editor failed to initialize:', err);
      });

    return () => {
      disposed = true;
      void crepe.destroy();
    };
    // Mount-once: see docstring above.
  }, []);

  return <div ref={containerRef} className="dokai-milkdown-host" />;
}
