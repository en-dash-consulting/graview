import type { AnySchema, Principal, Store } from "@graview/core";
import type { Telling } from "@graview/core/told";
import type { HostAi } from "@graview/tools";
import { useEffect, useMemo, useState } from "react";
import type { ToldSuggestion } from "./menu-told.js";

export type { ToldSuggestion } from "./menu-told.js";

/**
 * WHAT WORKED BEFORE, OFFERED AS THE MENU IS TYPED IN (Roadmap
 * f-menu-learns) — the door. The menu filters on its own words at the first
 * key, whatever else is here; the suggestions (`menu-told.ts`, with
 * `@graview/core/told`) are fetched apart, on the first key typed or when
 * the page is idle with a menu open, and only where the host keeps
 * tellings (`HostAi.told`). Until they are here the menu offers none.
 */

/** How many the menu offers. */
export const TOLD_SUGGESTED_MOST = 2;

type MenuTold = typeof import("./told-ui.js");
let fetched: Promise<MenuTold> | undefined;
const fetchMenuTold = (): Promise<MenuTold> => (fetched ??= import("./told-ui.js").catch((error: unknown) => ((fetched = undefined), Promise.reject(error))));

type Read = { readonly tellings: readonly Telling[]; readonly module: MenuTold };

/*
 * READ AHEAD, AS THE MENU IS GOT READY (Roadmap f-jev-fast-polish): the
 * pointer resting on a record, or a right-click pressed on it, reads what
 * worked here before, so the menu that opens has its Suggested rows whole
 * in its first frame and asks the Fast slot once — not again when the
 * tellings arrive. A read is good for a moment (`AHEAD_MS`); a menu opened
 * later reads them again.
 */
interface Ahead {
  readonly store: Store<AnySchema>;
  readonly principal: string | undefined;
  readonly at: number;
  readonly reading: Promise<Read>;
  done?: Read;
}
const AHEAD = /* @__PURE__ */ new WeakMap<object, Ahead>();
const AHEAD_MS = 10_000;

const aheadFor = (told: object | undefined, store: Store<AnySchema>, principal: Principal): Ahead | undefined => {
  const ahead = told ? AHEAD.get(told) : undefined;
  return ahead && ahead.store === store && ahead.principal === principal.id && Date.now() - ahead.at < AHEAD_MS ? ahead : undefined;
};

/** Reads what worked here before, ahead of a menu that may open: only where the host keeps tellings, and once a moment. */
export function prepareTold(ai: HostAi | undefined, store: Store<AnySchema>, principal: Principal): void {
  const told = ai && !ai.off ? ai.told : undefined;
  if (!told || aheadFor(told, store, principal)) return;
  const ahead: Ahead = {
    store,
    principal: principal.id,
    at: Date.now(),
    reading: fetchMenuTold().then(async (module) => ({ tellings: await module.readToldHere(told, store, principal), module })),
  };
  AHEAD.set(told, ahead);
  ahead.reading.then(
    (read) => void (ahead.done = read),
    () => void (AHEAD.get(told) === ahead && AHEAD.delete(told)),
  );
}

/** The tellings like the words typed in the menu that worked, re-aimed here: at most `most`, before the Fast slot re-ranks them. */
export function useToldSuggestions(ai: HostAi | undefined, store: Store<AnySchema>, principal: Principal, words: string, on: string | undefined, opened: unknown, most = 4): readonly ToldSuggestion[] {
  const told = ai && !ai.off ? ai.told : undefined;
  const typing = words.trim() !== "";
  const [read, setRead] = useState<Read | null>(() => aheadFor(told, store, principal)?.done ?? null);
  // Each menu reads them again — what was told since the last one is suggested in the next — unless they were read just now, as it was got ready.
  useEffect(() => setRead(aheadFor(told, store, principal)?.done ?? null), [opened]);
  /* Read ahead and on its way: the menu takes it as it arrives, not at the next idle moment. */
  useEffect(() => {
    if (read || opened === null || opened === undefined) return;
    const ahead = aheadFor(told, store, principal);
    if (!ahead || ahead.done) return;
    let live = true;
    void ahead.reading.then((arrived) => live && setRead(arrived), () => undefined);
    return () => {
      live = false;
    };
  }, [opened, read, told, store, principal]);
  /* Fetched on the first key, or when the page is idle with a menu open: never before the menu filters. */
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (!told || opened === null || opened === undefined) return;
    const idle = globalThis as { requestIdleCallback?: (run: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (!idle.requestIdleCallback) return;
    const asked = idle.requestIdleCallback(() => setWanted(true), { timeout: 3000 });
    return () => idle.cancelIdleCallback?.(asked);
  }, [told, opened]);
  useEffect(() => {
    if (!told || read || !(typing || wanted)) return;
    let live = true;
    void fetchMenuTold()
      .then(async (module) => {
        const tellings = await module.readToldHere(told, store, principal);
        if (live) setRead({ tellings, module });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [told, typing, wanted, read, store, principal]);
  return useMemo(() => (read ? (typing ? read.module.toldSuggestionsFrom(read.tellings, store, principal, words, on, most) : read.module.toldForHere(read.tellings, store, principal, on, 3)) : []), [read, typing, words, store, principal, on, most]);
}
