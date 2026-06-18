import { describe, expect, it } from 'vitest';
import { planSidebarToggle } from './useScalarClient.js';

describe('planSidebarToggle', () => {
  it('closes the client and reveals the sidebar when the client is open (sidebar shown)', () => {
    expect(planSidebarToggle(true, false)).toEqual({ closeClient: true, nextCollapsed: false });
  });

  it('closes the client and reveals the sidebar when the client is open (sidebar collapsed)', () => {
    // Even if the saved preference was collapsed, opening the sidebar must expand it.
    expect(planSidebarToggle(true, true)).toEqual({ closeClient: true, nextCollapsed: false });
  });

  it('collapses an expanded sidebar normally when no client is open', () => {
    expect(planSidebarToggle(false, false)).toEqual({ closeClient: false, nextCollapsed: true });
  });

  it('expands a collapsed sidebar normally when no client is open', () => {
    expect(planSidebarToggle(false, true)).toEqual({ closeClient: false, nextCollapsed: false });
  });

  it('never closes the client when the client is not open', () => {
    expect(planSidebarToggle(false, false).closeClient).toBe(false);
    expect(planSidebarToggle(false, true).closeClient).toBe(false);
  });
});
