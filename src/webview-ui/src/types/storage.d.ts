interface StorageAPI {
  get(
    key: string,
    shared?: boolean
  ): Promise<{ key: string; value: string } | null>;
  set(
    key: string,
    value: string,
    shared?: boolean
  ): Promise<{ key: string; value: string } | null>;
  delete(
    key: string,
    shared?: boolean
  ): Promise<{ key: string; deleted: boolean } | null>;
  list(prefix?: string, shared?: boolean): Promise<{ keys: string[] } | null>;
}

declare global {
  interface Window {
    storage: StorageAPI;
  }
}

export {};
