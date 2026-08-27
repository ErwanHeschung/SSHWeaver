/** An empty list means "nothing saved" only once `loaded` is true. */
export interface LoadState {
  loaded: boolean;
  error?: string;
}

export const UNLOADED: LoadState = { loaded: false };

export interface ListLoader {
  /** Fetch unconditionally, discarding any previous result. */
  load: () => Promise<void>;
  /** Fetch only if it has not already succeeded. */
  ensureLoaded: () => Promise<void>;
}

interface LoaderConfig<T> {
  fetch: () => Promise<T>;
  commit: (value: T) => void;
  patch: (state: Partial<LoadState>) => void;
  isLoaded: () => boolean;
}

/**
 * Concurrent callers share one request. A failure is recorded rather than
 * thrown and leaves the store unloaded, so reopening the tab retries.
 */
export function createListLoader<T>(config: LoaderConfig<T>): ListLoader {
  let inFlight: Promise<void> | null = null;

  const run = async () => {
    config.patch({ error: undefined });
    try {
      const value = await config.fetch();
      config.commit(value);
      config.patch({ loaded: true });
    } catch (err) {
      config.patch({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      inFlight = null;
    }
  };

  const load = () => (inFlight ??= run());

  return {
    load,
    ensureLoaded: () => (config.isLoaded() ? Promise.resolve() : load()),
  };
}
