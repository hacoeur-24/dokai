import { useEffect, useRef, type RefObject } from 'react';

/**
 * Toggles `is-scrolling` on the target element while the user is actively scrolling, and clears
 * it after `idleMs` of no scroll activity. Pairs with the `.dokai-scroll-auto` CSS so the
 * scrollbar fades out a beat after the user stops scrolling — same feel as native macOS overlay
 * scrollbars.
 *
 * Returns a ref to attach to the scrollable element.
 */
export function useAutoHideScroll<T extends HTMLElement>(idleMs = 1500): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const onScroll = (): void => {
      node.classList.add('is-scrolling');
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        node.classList.remove('is-scrolling');
        timeout = null;
      }, idleMs);
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      node.removeEventListener('scroll', onScroll);
      if (timeout) clearTimeout(timeout);
    };
  }, [idleMs]);

  return ref;
}
