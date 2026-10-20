/**
 * The slice of IndexedDB the browser adapter needs: one database, one
 * object store of string entries under string keys, read and written a
 * transaction at a time. Declared here rather than as the DOM's own types
 * so the package needs no DOM lib to build, and so a test can hand a
 * small fake in its place.
 */
export interface IDBFactoryLike {
  open(name: string, version?: number): IDBOpenRequestLike;
}

export interface IDBRequestLike<T> {
  readonly result: T;
  readonly error: unknown;
  onsuccess: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface IDBOpenRequestLike extends IDBRequestLike<IDBDatabaseLike> {
  onupgradeneeded: ((event: unknown) => void) | null;
}

export interface IDBDatabaseLike {
  readonly objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string): unknown;
  transaction(stores: string | readonly string[], mode: "readonly" | "readwrite"): IDBTransactionLike;
  onclose?: ((event: unknown) => void) | null;
}

export interface IDBTransactionLike {
  readonly error: unknown;
  objectStore(name: string): IDBObjectStoreLike;
  oncomplete: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onabort: ((event: unknown) => void) | null;
}

export interface IDBObjectStoreLike {
  get(key: string): IDBRequestLike<unknown>;
  put(value: string, key: string): IDBRequestLike<unknown>;
  delete(key: string): IDBRequestLike<unknown>;
}

/** Entries read and written a transaction at a time: `null` is "absent" on a read and "delete" on a write. */
export interface IndexedEntries {
  /** Opens the database, or rejects with why it would not open. */
  ready(): Promise<void>;
  read(keys: readonly string[]): Promise<(string | null)[]>;
  write(entries: ReadonlyMap<string, string | null>): Promise<void>;
}

const STORE = "entries";

/**
 * Opens the database on the FIRST read or write, not when the adapter is
 * made: a page that never touches its store never opens one, and the open
 * is a few milliseconds the page's first load does not wait on before it
 * asks for its graph. A failed open rejects that call and every later one.
 */
export function indexedEntries(factory: IDBFactoryLike, name: string): IndexedEntries {
  let opened: Promise<IDBDatabaseLike> | undefined;
  const database = () =>
    (opened ??= new Promise<IDBDatabaseLike>((resolve, reject) => {
      const request = factory.open(name, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        // A connection the browser closed (WebKit does, under a backgrounded tab) is opened again next time.
        request.result.onclose = () => void (opened = undefined);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error(`IndexedDB would not open "${name}"`));
    }));

  const transact = async <T>(mode: "readonly" | "readwrite", body: (store: IDBObjectStoreLike) => () => T): Promise<T> => {
    let db = await database();
    let tx: IDBTransactionLike;
    try {
      tx = db.transaction(STORE, mode);
    } catch {
      // A connection closed under us: open it again, once.
      opened = undefined;
      db = await database();
      tx = db.transaction(STORE, mode);
    }
    return new Promise<T>((resolve, reject) => {
      const settle = body(tx.objectStore(STORE));
      // Resolved on COMPLETE, not on each request's success: a write is kept when its transaction commits.
      tx.oncomplete = () => resolve(settle());
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction was aborted"));
    });
  };

  return {
    ready: async () => void (await database()),
    read: (keys) =>
      transact("readonly", (store) => {
        const requests = keys.map((key) => store.get(key));
        return () => requests.map((request) => (typeof request.result === "string" ? request.result : null));
      }),
    write: (entries) =>
      transact("readwrite", (store) => {
        for (const [key, value] of entries) {
          if (value === null) store.delete(key);
          else store.put(value, key);
        }
        return () => undefined;
      }),
  };
}
