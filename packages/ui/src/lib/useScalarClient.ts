import { useCallback, useEffect, useState } from 'react';

// Scalar toggles `scalar-client--open` on its `.scalar-container` element when the "Test Request"
// API-client modal opens/closes. We watch that class to coordinate DOKAI's sidebar with it.
const OPEN_SELECTOR = '.scalar-container.scalar-client--open';
// The full-viewport scrim doubles as Scalar's exit affordance — clicking it closes the client.
const EXIT_SELECTOR = `${OPEN_SELECTOR} .scalar-app-exit`;

export interface ScalarClient {
  /** True while Scalar's Test Request modal is open. */
  clientOpen: boolean;
  /** Close the open Test Request modal (no-op when closed). */
  closeClient: () => void;
}

/**
 * Observe Scalar's Test Request client and expose its open state plus a programmatic close. The
 * client lives in Scalar's own DOM (Vue web component), so we detect it via the class it toggles
 * and close it by clicking its exit overlay — both verified against @scalar/api-reference@1.60.0.
 */
export function useScalarClient(): ScalarClient {
  const [clientOpen, setClientOpen] = useState(false);

  useEffect(() => {
    const sync = (): void => setClientOpen(!!document.querySelector(OPEN_SELECTOR));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    sync();
    return () => observer.disconnect();
  }, []);

  const closeClient = useCallback((): void => {
    document.querySelector<HTMLElement>(EXIT_SELECTOR)?.click();
  }, []);

  return { clientOpen, closeClient };
}

export interface SidebarTogglePlan {
  /** Whether the Test Request client should be closed first. */
  closeClient: boolean;
  /** The sidebar collapsed state to apply. */
  nextCollapsed: boolean;
}

/**
 * Decide what the sidebar toggle should do. Sidebar and Test Request client are mutually exclusive:
 * if the client is open, toggling the sidebar closes the client and reveals the sidebar; otherwise
 * it flips the collapsed state normally. Pure so it can be unit-tested without a DOM.
 */
export function planSidebarToggle(clientOpen: boolean, collapsed: boolean): SidebarTogglePlan {
  if (clientOpen) return { closeClient: true, nextCollapsed: false };
  return { closeClient: false, nextCollapsed: !collapsed };
}
