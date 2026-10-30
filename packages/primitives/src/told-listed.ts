import { seesId, type AnySchema, type Principal, type Store } from "@graview/core";
import type { Telling, ToldStore } from "@graview/core/told";

/*
 * WHAT A PAGE HAS READ OF ITS HOST'S TELLINGS (Roadmap f-menu-learns), one
 * copy for the menu's suggestions and the answer card's examples alike, and
 * what a reader sees on this page. No React, no part of what a page draws.
 */
/** What a page has read of its host's tellings, for a few seconds, so typing does not ask again on every key. */
const LISTED = new WeakMap<ToldStore, { readonly at: number; readonly list: Promise<readonly Telling[]>; value?: readonly Telling[] }>();
const FRESH_MS = 5000;

/** The host's tellings, as this page last read them; a telling this page kept is in it at once. */
export function toldListed(told: ToldStore): Promise<readonly Telling[]> {
  const held = LISTED.get(told);
  if (held && Date.now() - held.at < FRESH_MS) return held.list;
  const entry: { at: number; list: Promise<readonly Telling[]>; value?: readonly Telling[] } = { at: Date.now(), list: Promise.resolve([]) };
  entry.list = Promise.resolve()
    .then(() => told.list())
    .catch(() => [] as readonly Telling[])
    .then((list) => (entry.value = [...list, ...(entry.value ?? []).filter((one) => !list.some((had) => had.id === one.id))]));
  // What was read last stays at hand while it is read again.
  if (held?.value) entry.value = held.value;
  LISTED.set(told, entry);
  return entry.list;
}

/** What is already at hand, without waiting: the last list read, or nothing yet. */
export const toldHeld = (told: ToldStore): readonly Telling[] | undefined => LISTED.get(told)?.value;

export function heldAlso(told: ToldStore, telling: Telling): void {
  const held = LISTED.get(told);
  if (!held) return;
  const add = (list: readonly Telling[]) => [...list.filter((one) => one.id !== telling.id), telling];
  if (held.value) held.value = add(held.value);
  LISTED.set(told, { at: held.at, list: held.list.then(add), ...(held.value ? { value: held.value } : {}) });
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

