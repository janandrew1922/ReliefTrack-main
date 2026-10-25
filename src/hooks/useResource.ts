
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../services/http';

interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads data from the API once on mount, with loading and error states.
 * Pass a stable loader (defined outside the component, or wrapped in useCallback).
 */
export function useResource<T>(loader: (signal?: AbortSignal) => Promise<T>, deps: unknown[] = []): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    loader(controller.signal).
    then((result) => {
      if (!cancelled) setData(result);
    }).
    catch((cause: unknown) => {
      if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return;
      if (cause instanceof ApiError && cause.status === 401) window.dispatchEvent(new Event('relieftrack:unauthorized'));
      setError(cause instanceof ApiError ? cause.message : 'Something went wrong while loading data.');
    }).
    finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  useEffect(() => {
    const refreshOnFocus = () => reload();
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [reload]);

  return { data, loading, error, reload };
}