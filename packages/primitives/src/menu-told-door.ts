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

/** The tellings like the words typed in the menu that worked, re-aimed here: at most `most`, before the Fast slot re-ranks them. */
export function useToldSuggestions(ai: HostAi | undefined, store: Store<AnySchema>, principal: Principal, words: string, on: string | undefined, opened: unknown, most = 4): readonly ToldSuggestion[] {
  const told = ai && !ai.off ? ai.told : undefined;
  const typing = words.trim() !== "";
  const [read, setRead] = useState<{ readonly tellings: readonly Telling[]; readonly module: MenuTold } | null>(null);
  // Each menu reads them again: what was told since the last one is suggested in the next.
  useEffect(() => setRead(null), [opened]);
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
  return useMemo(() => (read && typing ? read.module.toldSuggestionsFrom(read.tellings, store, principal, words, on, most) : []), [read, typing, words, store, principal, on, most]);
}
