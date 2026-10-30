import { seesId, type AnySchema, type Principal, type Store } from "@graview/core";
import type { Telling, ToldStore } from "@graview/core/told";

/*
 * WHAT A PAGE HAS READ OF ITS HOST'S TELLINGS (Roadmap f-menu-learns), one
 * copy for the menu's suggestions and the answer card's examples alike, and
 * what a reader sees on this page. No React, no part of what a page draws.
 */
/** What a page has read of its host's tellings, for a few seconds, so typing does not ask again on every key. */
const LISTED = new WeakMap<ToldStore, { readonly at: number; readonly list: Promise<readonly Telling[]> }>();
const FRESH_MS = 5000;

/** The host's tellings, as this page last read them; a telling this page kept is in it at once. */
export function toldListed(told: ToldStore): Promise<readonly Telling[]> {
  const held = LISTED.get(told);
  if (held && Date.now() - held.at < FRESH_MS) return held.list;
  const list = Promise.resolve()
    .then(() => told.list())
    .catch(() => [] as readonly Telling[]);
  LISTED.set(told, { at: Date.now(), list });
  return list;
}

export function heldAlso(told: ToldStore, telling: Telling): void {
  const held = LISTED.get(told);
  if (held) LISTED.set(told, { at: held.at, list: held.list.then((list) => [...list.filter((one) => one.id !== telling.id), telling]) });
}

/**
 * WHAT A READER SEES ON THIS PAGE: a record the page holds and the sight
 * lets them see. A page's store is the seat's view, so a record kept from
 * them is not in it at all — and one that is not there is not seen.
 */
export function seenOnThisPage(store: Store<AnySchema>, principal: Principal): (id: string) => boolean {
  const sees = seesId(store as never, principal);
  return (id) => store.graph.getNode(id) !== undefined && sees(id);
}

