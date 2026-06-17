import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchManifest, fetchSettings, type Manifest, type SettingsBundle } from './lib/api.js';

interface AsyncResource<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

interface DokaiContextValue {
  manifest: AsyncResource<Manifest>;
  settings: AsyncResource<SettingsBundle>;
  refresh: () => void;
}

const Ctx = createContext<DokaiContextValue | null>(null);

function emptyResource<T>(): AsyncResource<T> {
  return { data: null, isLoading: true, error: null };
}

export function DokaiProvider({ children }: { children: ReactNode }) {
  const [manifest, setManifest] = useState<AsyncResource<Manifest>>(emptyResource());
  const [settings, setSettings] = useState<AsyncResource<SettingsBundle>>(emptyResource());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setManifest((s) => ({ ...s, isLoading: true }));
    fetchManifest()
      .then((data) => {
        if (!cancelled) setManifest({ data, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setManifest({
            data: null,
            isLoading: false,
            error: err instanceof Error ? err.message : String(err),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setSettings((s) => ({ ...s, isLoading: true }));
    fetchSettings()
      .then((data) => {
        if (!cancelled) setSettings({ data, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setSettings({
            data: null,
            isLoading: false,
            error: err instanceof Error ? err.message : String(err),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const value = useMemo<DokaiContextValue>(
    () => ({ manifest, settings, refresh: () => setRefreshKey((n) => n + 1) }),
    [manifest, settings],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useCtx(): DokaiContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDokai hooks must be used inside <DokaiProvider>');
  return ctx;
}

export function useManifest(): AsyncResource<Manifest> {
  return useCtx().manifest;
}

export function useSettings(): AsyncResource<SettingsBundle> {
  return useCtx().settings;
}

export function useRefresh(): () => void {
  return useCtx().refresh;
}
