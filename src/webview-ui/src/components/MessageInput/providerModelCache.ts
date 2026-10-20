// in-memory only (lost on webview reload) — upgrade path: persist to localStorage
type Listener = () => void;

const store = new Map<string, unknown>();
const listeners = new Set<Listener>();

export const providersKey = (scope: string) => `providers:${scope}`;

export const accountsKey = (scope: string, providerId: string) =>
  `accounts:${scope}:${providerId}`;

export const cacheGet = <T>(key: string): T | undefined =>
  store.get(key) as T | undefined;

export const cacheSet = (key: string, value: unknown) => {
  store.set(key, value);
  listeners.forEach((listener) => listener());
};

export const cacheSubscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};