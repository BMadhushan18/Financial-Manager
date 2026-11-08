import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';

/** Loads JSON from the API and reloads whenever a dependency changes. */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let alive = true;
    setLoading(true);
    api<T>(path)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/** Hash-based routing: "#/wishlist" → "wishlist". */
export function useHashRoute(): string {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Runs a callback while a request is in flight, guarding against double taps. */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const ref = useRef(false);
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (ref.current) return;
    ref.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      ref.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

export function readLocal(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage may be unavailable (private mode) – the app still works
  }
}
