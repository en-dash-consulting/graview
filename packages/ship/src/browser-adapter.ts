import type { Epoch, Operation, PersistenceAdapter } from "@graview/core";
import type { GraphSnapshot } from "./snapshot.js";
import type { StoredMeta } from "./meta.js";

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
  loadMeta(scope: string): StoredMeta | null;
  saveMeta(scope: string, meta: StoredMeta): void;
  /** The storage keys this scope occupies — for a person or a test to look. */
  keysFor(scope: string): { snapshot: string; log: string; meta: string; epochs: string };
}

export interface BrowserAdapterOptions {
  /** Defaults to the page's `localStorage`. */
  readonly storage?: StorageLike;
  /** Key prefix, so two apps on one origin do not read each other's graph. */
  readonly prefix?: string;
}

/**
 * Persistence in the browser itself: the SAME things the file adapter
 * writes — the snapshot, the append-only log, the stored schema version,
 * the epochs the log folds from — as four `localStorage` entries per
 * scope. It slots into `openStore` unchanged, migrations included, so a
 * sample app that remembers is the
 * same lifecycle as a deployment that does, minus the server.
 *
 * `localStorage` is synchronous and small (a few megabytes an origin), which
 * is exactly right for a demo or a single person's graph and exactly wrong
 * for a shared deployment — that is what the file and sqlite adapters are
 * for. If a log outgrows it the honest next step is IndexedDB behind this
 * same interface, not a bigger string.
 *
 * A write that fails (quota, a locked-down browser) THROWS, and `openStore`
 * reports it: an app that believes it remembered and did not is the worst
 * quiet state, so nothing here swallows an error.
 */
export function createBrowserAdapter(options: BrowserAdapterOptions = {}): BrowserAdapter {
  const prefix = options.prefix ?? "graview";
  const storage = options.storage ?? pageStorage();
  const keysFor = (scope: string) => ({
    snapshot: `${prefix}:${scope}:snapshot`,
    log: `${prefix}:${scope}:log`,
    meta: `${prefix}:${scope}:meta`,
    epochs: `${prefix}:${scope}:epochs`,
  });
  const read = <T>(key: string): T | null => {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  };
  const write = (key: string, value: unknown) => storage.setItem(key, JSON.stringify(value));

  return {
    name: "browser",
    keysFor,
    async load(scope) {
      return read<GraphSnapshot>(keysFor(scope).snapshot);
    },
    async save(scope, snapshot) {
      write(keysFor(scope).snapshot, snapshot);
    },
    async delete(scope) {
      const keys = keysFor(scope);
      storage.removeItem(keys.snapshot);
      storage.removeItem(keys.log);
      storage.removeItem(keys.meta);
      storage.removeItem(keys.epochs);
    },
    async loadLog(scope) {
      return read<Operation[]>(keysFor(scope).log) ?? [];
    },
    async appendOps(scope, ops) {
      if (ops.length === 0) return;
      const key = keysFor(scope).log;
      write(key, [...(read<Operation[]>(key) ?? []), ...ops]);
    },
    async loadEpochs(scope) {
      return read<Epoch[]>(keysFor(scope).epochs) ?? [];
    },
    async saveEpochs(scope, epochs) {
      write(keysFor(scope).epochs, epochs);
    },
    loadMeta(scope) {
      return read<StoredMeta>(keysFor(scope).meta);
    },
    saveMeta(scope, meta) {
      write(keysFor(scope).meta, meta);
    },
  };
}

function pageStorage(): StorageLike {
  const found = (globalThis as { localStorage?: StorageLike }).localStorage;
  if (!found) {
    throw new Error(
      "createBrowserAdapter: no localStorage here — pass `storage` (any object with " +
        "getItem/setItem/removeItem) when running outside a browser.",
    );
  }
  return found;
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
 * Drops `?fresh=1` from the address once it has been honoured, so the seed
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
