import type { IDBFactoryLike } from "../../src/browser.js";

/**
 * A SMALL INDEXEDDB, as much of one as the browser adapter uses: one
 * database of named object stores, string keys, get / put / delete, and a
 * transaction that commits on `complete` — every write of it or none, the
 * way a real one does. Requests answer on a later turn, so a caller that
 * forgot to wait for a transaction is caught as it would be in a page.
 *
 * `quota` is how many characters every store may hold together; a
 * transaction that would hold more aborts with a QuotaExceededError and
 * keeps nothing. `refuseOpen` makes the open fail, as a locked-down
 * browser's does.
 */
export interface FakeIndexedDB extends IDBFactoryLike {
  /** What is committed, store by store. */
  readonly stores: Map<string, Map<string, string>>;
  quota: number;
  refuseOpen: boolean;
  /** How many times a database was opened. */
  opens: number;
}

export function fakeIndexedDB(): FakeIndexedDB {
  const stores = new Map<string, Map<string, string>>();
  const later = (run: () => void) => setTimeout(run, 0);
  const size = (all: Map<string, Map<string, string>>) =>
    [...all.values()].reduce((sum, store) => sum + [...store].reduce((n, [key, value]) => n + key.length + value.length, 0), 0);

  const fake: FakeIndexedDB = {
    stores,
    quota: Number.POSITIVE_INFINITY,
    refuseOpen: false,
    opens: 0,
    open(_name: string) {
      const request = { result: undefined as never, error: null as unknown, onsuccess: null, onerror: null, onupgradeneeded: null } as {
        result: never;
        error: unknown;
        onsuccess: ((event: unknown) => void) | null;
        onerror: ((event: unknown) => void) | null;
        onupgradeneeded: ((event: unknown) => void) | null;
      };
      fake.opens++;
      later(() => {
        if (fake.refuseOpen) {
          request.error = Object.assign(new Error("The operation is insecure."), { name: "SecurityError" });
          request.onerror?.({});
          return;
        }
        const db = {
          objectStoreNames: { contains: (name: string) => stores.has(name) },
          createObjectStore: (name: string) => void stores.set(name, new Map()),
          onclose: null,
          transaction(names: string | readonly string[], mode: "readonly" | "readwrite") {
            // Every write lands on a copy, kept only when the transaction commits.
            const working = new Map([...stores].map(([name, store]) => [name, new Map(store)]));
            let pending = 0;
            const tx = {
              error: null as unknown,
              oncomplete: null as ((event: unknown) => void) | null,
              onerror: null as ((event: unknown) => void) | null,
              onabort: null as ((event: unknown) => void) | null,
              objectStore(name: string) {
                if (!(typeof names === "string" ? [names] : names).includes(name)) throw new Error(`${name} is not in this transaction`);
                const store = working.get(name)!;
                const ask = (answer: () => unknown, writes: boolean) => {
                  if (writes && mode !== "readwrite") throw Object.assign(new Error("read-only transaction"), { name: "ReadOnlyError" });
                  const request = { result: undefined as unknown, error: null, onsuccess: null as ((event: unknown) => void) | null, onerror: null };
                  pending++;
                  later(() => {
                    request.result = answer();
                    request.onsuccess?.({});
                    if (--pending === 0) later(finish);
                  });
                  return request;
                };
                return {
                  get: (key: string) => ask(() => store.get(key), false),
                  put: (value: string, key: string) => ask(() => void store.set(key, value), true),
                  delete: (key: string) => ask(() => void store.delete(key), true),
                };
              },
            };
            const finish = () => {
              if (pending > 0) return;
              if (mode === "readwrite" && size(working) > fake.quota) {
                tx.error = Object.assign(new Error("The quota has been exceeded."), { name: "QuotaExceededError" });
                tx.onerror?.({});
                tx.onabort?.({});
                return;
              }
              if (mode === "readwrite") for (const [name, store] of working) stores.set(name, store);
              tx.oncomplete?.({});
            };
            // A transaction that asked for nothing still completes.
            later(() => {
              if (pending === 0) finish();
            });
            return tx;
          },
        };
        (request as { result: unknown }).result = db;
        if (!stores.has("entries")) request.onupgradeneeded?.({});
        request.onsuccess?.({});
      });
      return request as never;
    },
  };
  return fake;
}
