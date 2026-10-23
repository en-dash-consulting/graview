import type { Dismissal, DismissalStore, Principal } from "@graview/core";

/*
 * WHERE "NOT NOW" IS KEPT WHEN THE HOST KEEPS IT NOWHERE: in this browser,
 * for one app and one person — localStorage where the page may use it, else
 * the page's memory, gone with it. A person's own state, never the app's:
 * nobody else reads it, and the log says nothing of it. One store per key,
 * so the scene's bar, the routed face's and the seat read the same one.
 */
const kept = new Map<string, DismissalStore>();

/** A day: how long "Not now" hides a suggestion when nothing else was said. */
export const DISMISSED_FOR_MS = 86_400_000;

/** When "Not now" said at `now` shows it again: tomorrow, at this time. */
export const tomorrow = (now: number = Date.now()): string => new Date(now + DISMISSED_FOR_MS).toISOString();

/** What was kept under `key`, less any dismissal whose time has passed; nothing, where the page may not read it. */
function read(key: string): Dismissal[] {
  try {
    const said = JSON.parse(globalThis.localStorage?.getItem(key) ?? "[]") as unknown;
    const now = Date.now();
    return Array.isArray(said) ? said.filter((one): one is Dismissal => typeof one?.suggestion === "string" && typeof one?.at === "string" && (one.until === undefined || Date.parse(one.until) > now)) : [];
  } catch {
    return [];
  }
}

/** This browser's dismissals under `key`: localStorage where it may be used, else memory. */
export function pageDismissals(key: string): DismissalStore {
  const found = kept.get(key);
  if (found) return found;
  let held = read(key);
  const listeners = new Set<() => void>();
  const store: DismissalStore = {
    list: () => held,
    dismiss(dismissal) {
      // The most a person keeps here is a few hundred; the oldest go first.
      held = [...held.filter((one) => one.suggestion !== dismissal.suggestion), dismissal].slice(-300);
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(held));
      } catch {
        // A private window, blocked site data: kept in memory for this page.
      }
      for (const listener of listeners) listener();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  kept.set(key, store);
  return store;
}

/** Where this person's "Not now" is kept: the host's store, else this browser's for this app and person (the person an agent acts for). */
export function dismissalsOf(host: DismissalStore | undefined, app: string, principal?: Principal): DismissalStore {
  if (host) return host;
  const person = principal?.onBehalfOf ?? principal;
  return pageDismissals(`graview:not-now:${app}:${person?.id ?? person?.kind ?? "reader"}`);
}
