/**
 * THE WAY BACK TO THE EXAMPLE, ASKED FOR IN THIS TAB. Starting fresh
 * discards everything a browser remembers of an app, so the address alone
 * cannot ask for it: any other site can send a person to `?fresh=1`. A
 * "Start fresh" control writes a one-time value into this tab's
 * `sessionStorage` and goes to the address carrying it (`freshAddress`);
 * `browserStartsFresh` in `@graview/ship` honors the address only when it
 * carries that value, and forgets it on the way. A link from elsewhere
 * carries no value this tab wrote, and nothing is discarded.
 */

/** Where a "Start fresh" control keeps its one-time value, in `sessionStorage`. */
export const FRESH_KEY = "graview:fresh";

/** The part of `sessionStorage` a fresh start reads and writes. */
export interface FreshStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The address a "Start fresh" control goes to: `href` with `fresh=<a value
 * only this tab knows>`, the value kept in `session` (this tab's
 * `sessionStorage` unsaid) for the load that follows. Where the tab keeps
 * nothing, the address says `fresh=1`, which a person's browser does not honor.
 */
export function freshAddress(href: string, session?: FreshStorage): string {
  const url = new URL(href);
  let value = "1";
  try {
    const minted = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    (session ?? (globalThis as unknown as { sessionStorage: FreshStorage }).sessionStorage).setItem(FRESH_KEY, minted);
    value = minted;
  } catch {
    // A tab that keeps nothing cannot ask; the address says so, and is not honored.
  }
  url.searchParams.set("fresh", value);
  return url.toString();
}
