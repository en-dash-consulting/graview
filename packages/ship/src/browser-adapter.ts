import { assertHead, headOf, type AppendOptions, type Operation, type PersistenceAdapter, type Principal } from "@graview/core";
import type { GraphSnapshot } from "./snapshot.js";
import type { StoredMeta } from "./meta.js";
import { indexedEntries, type IDBFactoryLike, type IndexedEntries } from "./indexed-entries.js";

/**
 * The slice of `Storage` this adapter needs — `localStorage` in a browser,
 * a `Map` dressed as one in a test or a node rehearsal. Declared here rather
 * than as the DOM's own type so the package needs no DOM lib to build.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BrowserAdapter extends PersistenceAdapter<string> {
  loadMeta(scope: string): Promise<StoredMeta | null>;
  saveMeta(scope: string, meta: StoredMeta): Promise<void>;
  /**
   * The keys this scope occupies — for a person or a test to look. In
   * IndexedDB they are keys of the `entries` store of the `graview`
   * database, and the log is kept in pieces: `log` holds how many, and
   * `log:0`, `log:1`, … each hold the ops one write appended.
   */
  keysFor(scope: string): { snapshot: string; log: string; meta: string; through: string; journal: string };
  /**
   * THE WRITE-AHEAD JOURNAL, under `journal` in localStorage: the ops
   * applied whose IndexedDB write has not committed yet, written
   * synchronously the moment they are applied (`openStore` calls this
   * inside the apply). IndexedDB's own write lands a transaction later,
   * and a page that navigates or closes first would lose it. An op is let
   * go of once the log has committed it and a snapshot that reflects it
   * has (the snapshot is kept with `through`, the seq of the last op it
   * reflects). Throws when localStorage refuses even that, and `openStore`
   * reports it. Absent where the store is kept in localStorage alone.
   */
  journal?(scope: string, ops: readonly Operation[]): void;
  /** What the journal holds for a scope, and the seq of the last op the stored snapshot reflects (-1: none), for `openStore` to replay. */
  loadJournal?(scope: string): Promise<{ ops: readonly Operation[]; through: number }>;
  /** Where this adapter keeps a store: IndexedDB, or localStorage where IndexedDB would not open or would not take it. */
  keptIn(): Promise<"indexedDB" | "localStorage">;
}

export interface BrowserAdapterOptions {
  /**
   * The localStorage a store kept before IndexedDB is read from, and the
   * one a store is kept in where IndexedDB would not open. Defaults to the
   * page's `localStorage`. Passed WITHOUT `indexedDB`, it is the only
   * storage: a `Map` dressed as one in a test or a node rehearsal.
   */
  readonly storage?: StorageLike;
  /** Defaults to the page's `indexedDB`, unless `storage` alone was passed. */
  readonly indexedDB?: IDBFactoryLike;
  /** Key prefix, so two apps on one origin do not read each other's graph. */
  readonly prefix?: string;
}

/** The IndexedDB database every scope is kept in, its keys the same as localStorage's were. */
export const BROWSER_DATABASE = "graview";

/**
 * A log kept in more pieces than this is put back together into one the
 * next time it is read: each write appends a piece rather than rewriting
 * the whole log, and reading two thousand pieces on every open would be
 * the cost a long-lived page paid instead.
 */
const MOST_PIECES = 32;

/**
 * Persistence in the browser itself: the SAME things the file adapter
 * writes — the snapshot, the append-only log, the stored schema version —
 * kept in IndexedDB. Not the epochs (FR-27): each keeps a whole copy of
 * the graph as its base, and a page's store is verified by the host it is
 * served from, not in the page. It slots into `openStore` unchanged,
 * migrations included, so a sample app that remembers is the same
 * lifecycle as a deployment that does, minus the server.
 *
 * INDEXEDDB, BECAUSE A STORE OUTGROWS LOCALSTORAGE. localStorage is a few
 * megabytes an origin, and WebKit counts each character twice: the
 * gauntlet's 2.8 MB seed did not fit in Safari, so the store opened and
 * kept nothing. IndexedDB holds hundreds of megabytes in every engine, and
 * an append writes the ops it appends rather than the whole log again. It
 * is the default rather than where a store spills when localStorage is
 * full, so where a store is kept never depends on how big it once grew.
 *
 * A STORE KEPT IN LOCALSTORAGE IS CARRIED FORWARD, not lost: the first
 * time a scope is read, what localStorage holds for it is written into
 * IndexedDB in one transaction, and only once that transaction has
 * committed is it removed from localStorage. When the write fails, the
 * store stays where it was and this adapter keeps it there; when IndexedDB
 * will not open at all (a locked-down browser), it is localStorage as
 * before.
 *
 * The database opens on the first read, not when the adapter is made, and
 * every read and write waits for the ones asked for before it.
 *
 * A WRITE IS KEPT WHEN `apply` RETURNS, not when IndexedDB commits it: an
 * IndexedDB write lands a transaction later, and a person who changed
 * something and left the page at once lost it. `openStore` writes each op
 * to a journal in localStorage (`<prefix>:<scope>:journal`) inside the
 * apply, synchronously; the journal holds only the ops IndexedDB has not
 * committed yet, and the next open puts back what it holds, each op once
 * (the snapshot is kept with `<prefix>:<scope>:through`, the seq of the
 * last op it reflects).
 *
 * A write that fails (quota, a locked-down browser) THROWS, and `openStore`
 * reports it: an app that believes it remembered and did not is the worst
 * quiet state, so nothing here swallows an error.
 */
export function createBrowserAdapter(options: BrowserAdapterOptions = {}): BrowserAdapter {
  const prefix = options.prefix ?? "graview";
  const keysFor = (scope: string) => ({
    snapshot: `${prefix}:${scope}:snapshot`,
    log: `${prefix}:${scope}:log`,
    meta: `${prefix}:${scope}:meta`,
    through: `${prefix}:${scope}:through`,
    journal: `${prefix}:${scope}:journal`,
  });
  const factory = options.indexedDB ?? (options.storage ? undefined : pageIndexedDB());
  const storage = options.storage ?? (factory ? pageStorageIfAny() : pageStorage());
  const local = storage ? localBackend(storage, keysFor) : undefined;
  if (!factory) {
    if (!local) throw noStorage();
    const only: Chosen = { backend: local, kept: "localStorage" };
    return adapterOver(keysFor, async () => only, undefined);
  }

  let chosen: Promise<Chosen> | undefined;
  const entries = indexedEntries(factory, BROWSER_DATABASE);
  const indexed = indexedBackend(entries, storage, keysFor, () => {
    // A store localStorage holds and IndexedDB would not take stays where it is, and so does this adapter.
    if (local) chosen = Promise.resolve({ backend: local, kept: "localStorage" });
  });
  const choose = () =>
    (chosen ??= entries.ready().then(
      (): Chosen => ({ backend: indexed, kept: "indexedDB" }),
      (error: unknown): Chosen => {
        if (!local) throw error;
        return { backend: local, kept: "localStorage" };
      },
    ));
  return adapterOver(keysFor, choose, storage);
}

interface Backend {
  load(scope: string): Promise<GraphSnapshot | null>;
  /** `through`: the seq of the last op the snapshot reflects, kept with it in the same write. */
  save(scope: string, snapshot: GraphSnapshot, through: number | undefined): Promise<void>;
  /** The seq of the last op the stored snapshot reflects, or -1 when it was kept without one. */
  loadThrough(scope: string): Promise<number>;
  delete(scope: string): Promise<void>;
  loadLog(scope: string): Promise<Operation[]>;
  appendOps(scope: string, ops: readonly Operation[], options?: AppendOptions): Promise<void>;
  loadMeta(scope: string): Promise<StoredMeta | null>;
  saveMeta(scope: string, meta: StoredMeta): Promise<void>;
}
interface Chosen {
  readonly backend: Backend;
  readonly kept: "indexedDB" | "localStorage";
}
type Keys = (scope: string) => { snapshot: string; log: string; meta: string; through: string; journal: string };

/**
 * One adapter over whichever backend was chosen, every call waiting for
 * the ones asked for before it — so a `saveMeta` a page does not await
 * still lands before the `openStore` after it reads.
 *
 * With `journalIn`, it also keeps the write-ahead journal there: the ops
 * applied and not yet committed, written synchronously. An op is let go
 * of once the log has committed it AND a snapshot that reflects it has,
 * which the adapter knows by seq: a snapshot is kept with the seq of the
 * newest op heard of when `save` was CALLED — `openStore` journals every
 * op inside the apply and takes the snapshot as it calls `save`, so that
 * is the last op the snapshot reflects, whenever its write's turn comes.
 */
function adapterOver(keysFor: Keys, choose: () => Promise<Chosen>, journalIn: StorageLike | undefined): BrowserAdapter {
  let chain: Promise<unknown> = Promise.resolve();
  const queued = <T>(run: (chosen: Chosen) => Promise<T>): Promise<T> => {
    const next = chain.then(async () => {
      try {
        return await run(await choose());
      } catch (error) {
        // The carry IndexedDB refused moved this adapter to localStorage, where the store still is: ask there.
        if (error instanceof StayInLocalStorage) return run(await choose());
        throw error;
      }
    });
    chain = next.catch(() => undefined);
    return next;
  };
  const adapter: BrowserAdapter = {
    name: "browser",
    keysFor,
    keptIn: () => queued(async (chosen) => chosen.kept),
    load: (scope) => queued(({ backend }) => backend.load(scope)),
    save: (scope, snapshot) => queued(({ backend }) => backend.save(scope, snapshot, undefined)),
    delete: (scope) => queued(({ backend }) => backend.delete(scope)),
    loadLog: (scope) => queued(({ backend }) => backend.loadLog(scope)),
    appendOps: (scope, ops, options) => queued(({ backend }) => (ops.length === 0 ? Promise.resolve() : backend.appendOps(scope, ops, options))),
    loadMeta: (scope) => queued(({ backend }) => backend.loadMeta(scope)),
    saveMeta: (scope, meta) => queued(({ backend }) => backend.saveMeta(scope, meta)),
  };
  return journalIn ? journaled(adapter, keysFor, queued, journalIn) : adapter;
}

/** Per scope: the journal as last written, the newest seq heard of, and the newest the log and the snapshot have committed. */
interface JournalState {
  journal: Operation[] | undefined;
  head: number;
  logged: number;
  through: number;
}

/** The adapter with its write-ahead journal in `storage`: see `BrowserAdapter.journal`. */
function journaled(
  plain: BrowserAdapter,
  keysFor: Keys,
  queued: <T>(run: (chosen: Chosen) => Promise<T>) => Promise<T>,
  storage: StorageLike,
): BrowserAdapter {
  const scopes = new Map<string, JournalState>();
  const stateOf = (scope: string): JournalState => {
    let state = scopes.get(scope);
    // Nothing is let go of until what the log and the snapshot hold has been read or written.
    if (!state) scopes.set(scope, (state = { journal: undefined, head: -1, logged: -Infinity, through: -Infinity }));
    return state;
  };
  const newest = (ops: readonly Operation[]) => ops.reduce((most, op) => Math.max(most, op.seq), -1);
  const heard = (scope: string, ops: readonly Operation[]) => {
    const state = stateOf(scope);
    state.head = Math.max(state.head, newest(ops));
  };
  const journalOf = (scope: string): Operation[] => {
    const state = stateOf(scope);
    if (!state.journal) {
      try {
        const raw = storage.getItem(keysFor(scope).journal);
        state.journal = raw === null ? [] : (JSON.parse(raw) as Operation[]);
      } catch {
        // Storage locked away, or a journal that does not read, holds nothing to replay.
        state.journal = [];
      }
    }
    return state.journal;
  };
  const write = (scope: string, ops: readonly Operation[]) => {
    const key = keysFor(scope).journal;
    if (ops.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(ops));
  };
  /** Lets go of what the log and the snapshot have both committed. */
  const prune = (scope: string) => {
    const state = stateOf(scope);
    const kept = Math.min(state.logged, state.through);
    const journal = journalOf(scope);
    const left = journal.filter((op) => op.seq > kept);
    if (left.length === journal.length) return;
    state.journal = left;
    try {
      write(scope, left);
    } catch {
      // Left in localStorage, it is skipped on the next open: the log and the snapshot already have it.
    }
  };
  const throughOf = async (backend: Backend, scope: string) => ((await backend.load(scope)) === null ? -1 : backend.loadThrough(scope));

  return {
    ...plain,
    load: (scope) =>
      queued(async ({ backend }) => {
        const snapshot = await backend.load(scope);
        stateOf(scope).through = snapshot === null ? -1 : await backend.loadThrough(scope);
        return snapshot;
      }),
    save: (scope, snapshot) => {
      // Read NOW, not when the write's turn comes: the snapshot was taken now, after every op journaled so far.
      const through = stateOf(scope).head;
      return queued(async ({ backend }) => {
        await backend.save(scope, snapshot, through);
        const state = stateOf(scope);
        state.through = Math.max(state.through, through);
        prune(scope);
      });
    },
    delete: (scope) =>
      queued(async ({ backend }) => {
        await backend.delete(scope);
        scopes.set(scope, { journal: [], head: -1, logged: -1, through: -1 });
        write(scope, []);
      }),
    loadLog: (scope) =>
      queued(async ({ backend }) => {
        const log = await backend.loadLog(scope);
        heard(scope, log);
        stateOf(scope).logged = newest(log);
        return log;
      }),
    appendOps: (scope, ops, options) => {
      heard(scope, ops);
      return queued(async ({ backend }) => {
        if (ops.length === 0) return;
        await backend.appendOps(scope, ops, options);
        const state = stateOf(scope);
        state.logged = Math.max(state.logged, newest(ops));
        prune(scope);
      });
    },
    journal(scope, ops) {
      if (ops.length === 0) return;
      heard(scope, ops);
      const journal = journalOf(scope);
      journal.push(...ops);
      // Throws when localStorage refuses it: `openStore` reports that, and the op is kept here to be written with the next.
      write(scope, journal);
    },
    loadJournal: (scope) =>
      queued(async ({ backend }) => {
        const ops = [...journalOf(scope)].sort((a, b) => a.seq - b.seq);
        heard(scope, ops);
        return { ops, through: await throughOf(backend, scope) };
      }),
  };
}

/** The three entries per scope in localStorage, as the adapter kept them before IndexedDB. */
function localBackend(storage: StorageLike, keysFor: Keys): Backend {
  const read = <T>(key: string): T | null => {
    const raw = storage.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as T);
  };
  const write = (key: string, value: unknown) => storage.setItem(key, JSON.stringify(value));
  return {
    async load(scope) {
      return read<GraphSnapshot>(keysFor(scope).snapshot);
    },
    async save(scope, snapshot, through) {
      write(keysFor(scope).snapshot, snapshot);
      if (through !== undefined) write(keysFor(scope).through, through);
    },
    async loadThrough(scope) {
      return read<number>(keysFor(scope).through) ?? -1;
    },
    async delete(scope) {
      const keys = keysFor(scope);
      storage.removeItem(keys.snapshot);
      storage.removeItem(keys.log);
      storage.removeItem(keys.meta);
      storage.removeItem(keys.through);
    },
    async loadLog(scope) {
      return read<Operation[]>(keysFor(scope).log) ?? [];
    },
    async appendOps(scope, ops, options) {
      const key = keysFor(scope).log;
      const log = read<Operation[]>(key) ?? [];
      // One writer: another tab that appended since is seen, read now from storage (compare-and-set).
      assertHead(scope, ops, options, () => headOf(log));
      write(key, [...log, ...ops]);
    },
    async loadMeta(scope) {
      return read<StoredMeta>(keysFor(scope).meta);
    },
    async saveMeta(scope, meta) {
      write(keysFor(scope).meta, meta);
    },
  };
}

/** A carry IndexedDB refused: the adapter goes on in localStorage, where the store still is. */
class StayInLocalStorage extends Error {
  constructor(readonly refused: unknown) {
    super("graview ship: IndexedDB would not take the store localStorage holds, so it stays in localStorage");
  }
}

/**
 * The same three things in IndexedDB, the log in pieces. Each scope is
 * SETTLED before its first read or write: what localStorage still holds
 * for it is carried in, then removed from localStorage.
 */
function indexedBackend(
  entries: IndexedEntries,
  legacy: StorageLike | undefined,
  keysFor: Keys,
  stayInLocalStorage: () => void,
): Backend {
  const pieces = new Map<string, number>();
  const settled = new Map<string, Promise<void>>();
  const piece = (scope: string, n: number) => `${keysFor(scope).log}:${n}`;
  const count = async (scope: string) => {
    const known = pieces.get(scope);
    if (known !== undefined) return known;
    const [raw] = await entries.read([keysFor(scope).log]);
    const n = Number(raw ?? 0) || 0;
    pieces.set(scope, n);
    return n;
  };
  const legacyItem = (key: string) => {
    try {
      return legacy?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const forgetLegacy = (scope: string) => {
    const keys = keysFor(scope);
    try {
      legacy?.removeItem(keys.snapshot);
      legacy?.removeItem(keys.log);
      legacy?.removeItem(keys.meta);
      legacy?.removeItem(keys.through);
    } catch {
      // Left behind, it is carried in again next time: the same store, not a lost one.
    }
  };

  /*
   * CARRIED FORWARD, THEN FORGOTTEN, IN THAT ORDER. A scope localStorage
   * holds and IndexedDB does not is moved in. One BOTH hold is a build from
   * before IndexedDB opened since the move and started again from its
   * seed: IndexedDB's store, the one with the history, stands, and
   * localStorage's is left where it is, untouched — nothing is replaced
   * and nothing deleted that a person did not ask to be (`fresh` deletes
   * both).
   */
  const carry = async (scope: string) => {
    const keys = keysFor(scope);
    const snapshot = legacyItem(keys.snapshot);
    if (snapshot === null) return;
    const [held] = await entries.read([keys.snapshot]);
    if (held != null) return;
    const write = new Map<string, string | null>();
    // Pieces of a log whose snapshot is gone (a write that never finished) are not this store's.
    for (let n = 0, had = await count(scope); n < had; n++) write.set(piece(scope, n), null);
    write.set(keys.snapshot, snapshot);
    write.set(keys.meta, legacyItem(keys.meta));
    write.set(keys.through, legacyItem(keys.through));
    const log = legacyItem(keys.log);
    const hasLog = log !== null && log !== "[]";
    if (hasLog) write.set(piece(scope, 0), log);
    write.set(keys.log, hasLog ? "1" : null);
    try {
      await entries.write(write);
    } catch (error) {
      stayInLocalStorage();
      throw new StayInLocalStorage(error);
    }
    pieces.set(scope, hasLog ? 1 : 0);
    forgetLegacy(scope);
  };
  const settle = (scope: string) => {
    let done = settled.get(scope);
    if (!done) {
      done = carry(scope);
      settled.set(scope, done);
    }
    return done;
  };

  return {
    async load(scope) {
      await settle(scope);
      const [raw] = await entries.read([keysFor(scope).snapshot]);
      return raw == null ? null : (JSON.parse(raw) as GraphSnapshot);
    },
    async save(scope, snapshot, through) {
      await settle(scope);
      // The snapshot and the seq it reflects in one transaction: a journal is never replayed onto a snapshot that has it.
      const write = new Map<string, string | null>([[keysFor(scope).snapshot, JSON.stringify(snapshot)]]);
      if (through !== undefined) write.set(keysFor(scope).through, String(through));
      await entries.write(write);
    },
    async loadThrough(scope) {
      await settle(scope);
      const [raw] = await entries.read([keysFor(scope).through]);
      const through = raw == null ? Number.NaN : Number(raw);
      return Number.isInteger(through) ? through : -1;
    },
    async delete(scope) {
      const keys = keysFor(scope);
      const had = await count(scope);
      const write = new Map<string, string | null>([
        [keys.snapshot, null],
        [keys.log, null],
        [keys.meta, null],
        [keys.through, null],
      ]);
      for (let n = 0; n < had; n++) write.set(piece(scope, n), null);
      await entries.write(write);
      pieces.set(scope, 0);
      // Deleted is deleted in both: nothing is left in localStorage to carry in again.
      forgetLegacy(scope);
      settled.set(scope, Promise.resolve());
    },
    async loadLog(scope) {
      await settle(scope);
      const n = await count(scope);
      if (n === 0) return [];
      const raws = await entries.read(Array.from({ length: n }, (_, i) => piece(scope, i)));
      const log = raws.flatMap((raw) => (raw === null ? [] : (JSON.parse(raw) as Operation[])));
      if (n > MOST_PIECES) {
        // Put back together in one transaction: the one piece and its count, or the many as they were.
        const write = new Map<string, string | null>([
          [piece(scope, 0), JSON.stringify(log)],
          [keysFor(scope).log, "1"],
        ]);
        for (let i = 1; i < n; i++) write.set(piece(scope, i), null);
        await entries.write(write);
        pieces.set(scope, 1);
      }
      return log;
    },
    async appendOps(scope, ops, options) {
      await settle(scope);
      if (options?.head !== undefined && ops.length > 0) {
        /*
         * ONE WRITER (compare-and-set): the count and the newest piece read
         * now, not remembered, so another tab that appended since is seen.
         * The read and the write are two transactions; two tabs writing in
         * the same instant between them are not caught.
         */
        const [raw] = await entries.read([keysFor(scope).log]);
        const stored = Number(raw ?? 0) || 0;
        pieces.set(scope, stored);
        const [last] = stored === 0 ? [null] : await entries.read([piece(scope, stored - 1)]);
        assertHead(scope, ops, options, () => headOf(last == null ? [] : (JSON.parse(last) as Operation[])));
      }
      const n = await count(scope);
      // The piece and the count in one transaction: a log never counts a piece it does not have.
      await entries.write(
        new Map([
          [piece(scope, n), JSON.stringify(ops)],
          [keysFor(scope).log, String(n + 1)],
        ]),
      );
      pieces.set(scope, n + 1);
    },
    async loadMeta(scope) {
      await settle(scope);
      const [raw] = await entries.read([keysFor(scope).meta]);
      return raw == null ? null : (JSON.parse(raw) as StoredMeta);
    },
    async saveMeta(scope, meta) {
      await settle(scope);
      await entries.write(new Map([[keysFor(scope).meta, JSON.stringify(meta)]]));
    },
  };
}

function pageIndexedDB(): IDBFactoryLike | undefined {
  try {
    return (globalThis as { indexedDB?: IDBFactoryLike }).indexedDB ?? undefined;
  } catch {
    // A sandboxed frame may refuse even the look.
    return undefined;
  }
}

function pageStorageIfAny(): StorageLike | undefined {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

function noStorage(): Error {
  return new Error(
    "createBrowserAdapter: no localStorage here, and no IndexedDB — pass `storage` (any object with " +
      "getItem/setItem/removeItem) when running outside a browser.",
  );
}

function pageStorage(): StorageLike {
  const found = (globalThis as { localStorage?: StorageLike }).localStorage;
  if (!found) throw noStorage();
  return found;
}

/** Where a page keeps who its reader is: `rememberedPrincipal` reads it. */
export const PRINCIPAL_KEY = "graview:principal";

/**
 * WHO THIS PAGE'S READER IS, as the browser remembers them: the name kept
 * under `graview:principal`, or `fallback` ("reader") when none is kept or
 * storage is locked away. Handed to the store (`openStore`'s
 * `storeOptions: { principal }`, or `new Store({ principal })`), it is who
 * every act on the page is attributed to — over a memory adapter seeded
 * from a snapshot as much as over this one.
 */
export function rememberedPrincipal(
  options: { readonly storage?: StorageLike; readonly key?: string; readonly fallback?: string; readonly roles?: readonly string[] } = {},
): Principal {
  let id: string | null = null;
  try {
    id = (options.storage ?? pageStorage()).getItem(options.key ?? PRINCIPAL_KEY);
  } catch {
    // Storage locked away is a reader with no name, not a page that fails.
  }
  return { kind: "human", id: id || (options.fallback ?? "reader"), ...(options.roles ? { roles: options.roles } : {}) };
}

/**
 * Whether THIS load should start from the seed rather than from what the
 * browser remembers.
 *
 * `?fresh=1` asks for it outright — the address a "start fresh" control
 * navigates to. Beyond that, a DRIVEN browser starts fresh unless it says
 * `?remember=1`: a harness is a specification of the example, and a
 * harness whose second `goto` inherited its first one's edits would be
 * testing its own residue. A person's browser is never driven, so a
 * person always gets what they left.
 */
export function browserStartsFresh(
  location: { readonly search: string } = (globalThis as unknown as { location: { search: string } })
    .location,
  navigator: { readonly webdriver?: boolean } = (
    globalThis as { navigator: { webdriver?: boolean } }
  ).navigator,
): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get("fresh") === "1") return true;
  if (params.get("remember") === "1") return false;
  return navigator?.webdriver === true;
}

/**
 * Drops `?fresh=1` from the address once it has been honored, so the seed
 * is the FIRST load rather than every load: a reload after starting fresh
 * must keep what was done since, or "start fresh" is really "stop
 * remembering".
 */
export function forgetFreshParam(
  win: {
    readonly location: { readonly href: string };
    readonly history: { replaceState(data: unknown, unused: string, url: string): void };
  } = globalThis as never,
): void {
  const url = new URL(win.location.href);
  if (url.searchParams.get("fresh") !== "1") return;
  url.searchParams.delete("fresh");
  win.history.replaceState(null, "", url.toString());
}

/** The address a "start fresh" control goes to: here, from the seed. */
export function freshHref(
  location: { readonly href: string } = (globalThis as unknown as { location: { href: string } })
    .location,
): string {
  const url = new URL(location.href);
  url.searchParams.set("fresh", "1");
  return url.toString();
}
