import type { Principal } from "./permissions/types.js";
import type { AnySchema } from "./schema/schema.js";
import type { Store } from "./store.js";

/*
 * WHOSE VIEW A STORE IS: the store behind a seat's view (`seenBy`) and the
 * seat, so what reads a store from outside it — the past (`pastOf`), the
 * suggestions (`@graview/core/tidying`) — reads the whole store and hands
 * the seat back only what it may see. Read off the view by a key it
 * answers, so a part fetched later imports neither the store nor the seat's
 * view: a bundler puts a whole module in every chunk that reaches it, and
 * one fetched later that reached `store.ts` would put the store in what a
 * page that never draws one loads first.
 */
const SEAT = Symbol.for("@graview/core:seat");

/** The store a seat's view is of, and the seat; undefined for a store itself. */
export const seatOf = <S extends AnySchema>(store: Store<S>): { readonly store: Store<S>; readonly principal: Principal } | undefined =>
  (store as unknown as Record<symbol, { readonly store: Store<S>; readonly principal: Principal } | undefined>)[SEAT];
