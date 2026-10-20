import type { AnySchema, Principal, Store } from "@graview/core";
import { edgeOfSelection, kindsOf } from "@graview/layout/view";
// From the deriving alone (`@graview/tools/derive`): the tools' index would bring the seat's whole surface with every face that draws an act.
import { applyAffordance, deriveAffordances, previewAffordance, type DeriveOptions } from "@graview/tools/derive";
import type { Affordance, AffordanceProvider, AffordanceSet } from "@graview/tools";
import { useMemo } from "react";
import { useGraph, useGraview } from "./context.js";

/*
 * THE ACTS ON OFFER, as hooks. Apart from `./hooks.ts` because deriving
 * them carries every provider, and a page draws its frame — the strip, the
 * cards — without asking: the inspector, the seat's panel and the pages'
 * acts do, and they are fetched with their face (FR-57).
 */

/** What the acts are derived with, besides the store and the selection. */
export interface AffordancesAsked<S extends AnySchema> {
  readonly principal?: Principal | undefined;
  readonly providers?: readonly AffordanceProvider<S>[] | undefined;
  readonly pins?: DeriveOptions<S>["pins"];
  readonly focus?: string | undefined;
}

/*
 * THE ACTS DERIVED FOR A TARGET ARE KEPT UNTIL THE GRAPH CHANGES (FR-186).
 * A context menu derives its acts as it opens; a face that saw the pointer
 * rest on a record has derived them already (`prepareAffordances`), and
 * the menu draws them in its first frame — and a menu opened again on the
 * same thing derives nothing. Kept per store, by the selection, the seat,
 * the providers, the pins and the focus; any change to the graph, and any
 * change to the log under it, drops them all. Only a derivation asked with
 * no other option is kept: one asked with a `context` or a `limit` is
 * derived as asked, every time.
 */
interface Derived {
  readonly kept: Map<string, AffordanceSet>;
  /** The log's length the kept ones were derived at. */
  at: number;
}
const DERIVED = new WeakMap<object, Derived>();
const KEPT = 64;
const PROVIDERS = new WeakMap<object, number>();
let providersSeen = 0;
const providersId = (providers: object | undefined): number => {
  if (providers === undefined) return 0;
  let id = PROVIDERS.get(providers);
  if (id === undefined) PROVIDERS.set(providers, (id = (providersSeen += 1)));
  return id;
};

function derivedFor<S extends AnySchema>(store: Store<S>, selection: readonly string[], asked: AffordancesAsked<S>, rest: Omit<DeriveOptions<S>, "principal" | "providers"> = {}): AffordanceSet {
  const derive = () => {
    // A selected kind card or district denotes KINDS; the binding owns those
    // ids, so it translates here and providers only ever see the kinds.
    const kindSelection = [...new Set(selection.flatMap((id) => kindsOf(id)))];
    const edgeSelection = selection
      .map((id) => edgeOfSelection(id))
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);
    // Asked as WHOEVER IS HERE, so what the strip offers is what the store
    // would accept — and what it withholds is stated with a reason rather
    // than quietly missing. The installation's declared providers apply to
    // every surface that asks, unless a caller deliberately overrides.
    return deriveAffordances(store, selection, {
      ...(asked.principal ? { principal: asked.principal } : {}),
      kindSelection,
      edgeSelection,
      ...(asked.providers ? { providers: asked.providers } : {}),
      ...(asked.pins ? { pins: asked.pins } : {}),
      ...(asked.focus !== undefined ? { focus: asked.focus } : {}),
      ...rest,
    });
  };
  if (Object.keys(rest).length > 0) return derive();
  let held = DERIVED.get(store);
  if (!held) {
    const fresh: Derived = { kept: new Map(), at: store.log.length };
    DERIVED.set(store, (held = fresh));
    store.subscribe(() => fresh.kept.clear());
  }
  if (held.at !== store.log.length) {
    held.kept.clear();
    held.at = store.log.length;
  }
  const key = JSON.stringify([selection, asked.principal ?? null, providersId(asked.providers), asked.pins ?? null, asked.focus ?? null]);
  const kept = held.kept.get(key);
  if (kept) return kept;
  const set = derive();
  held.kept.set(key, set);
  if (held.kept.size > KEPT) held.kept.delete(held.kept.keys().next().value!);
  return set;
}

/**
 * DERIVE THE ACTS FOR A TARGET BEFORE ANYBODY ASKS (FR-186): what a face
 * calls when the pointer rests on a record, so the menu opened on it next
 * draws its acts without deriving them. The same derivation `useAffordances`
 * makes, kept for it until the graph changes.
 */
export function prepareAffordances<S extends AnySchema>(store: Store<S>, selection: readonly string[], asked: AffordancesAsked<S> = {}): AffordanceSet {
  return derivedFor(store, selection, asked);
}

/**
 * What can be done with the current selection, recomputed whenever the
 * selection or the graph changes.
 *
 * Derivation is cheap enough to run on every selection change — measured
 * under a millisecond on the household example's whole graph — and is kept
 * only so a menu opened again, or opened on what the pointer rested on,
 * draws at once; any change to the graph drops it, so there is no
 * "refresh actions" button.
 */
export function useAffordances<S extends AnySchema>(
  options: DeriveOptions<S> & {
    /**
     * Derive for THESE ids rather than the selection. The seat's panel is
     * about a subject that may be nothing anybody clicked — the place you
     * are looking at — and the acts under its name have to be its own.
     */
    readonly about?: readonly string[];
  } = {},
): AffordanceSet {
  const { store, selection: chosen, principal: here, providers: installed } = useGraview<S>();
  const { about, principal = here, providers = installed, pins, focus, ...rest } = options;
  const selection = about ?? chosen;
  const nodes = useGraph<S>();
  return useMemo(
    () => derivedFor(store, selection, { principal, providers, pins, focus }, rest),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, selection, options, nodes, principal, providers],
  );
}

/** Runs an affordance, or shows what it would do first. */
export function useApplyAffordance<S extends AnySchema>() {
  const { store, principal } = useGraview<S>();
  return useMemo(
    () => ({
      preview: (affordance: Affordance, args?: Record<string, unknown>) =>
        // The preview of the press about to be applied: an act's own input refusing it is told to a watching harness.
        previewAffordance(store, affordance, args ?? {}, { pressed: principal ? { author: principal } : {} }),
      apply: (affordance: Affordance, args?: Record<string, unknown>) =>
        applyAffordance(store, affordance, args ?? {}, {
          // The principal, not a bare "human": the store enforces against
          // this and the log attributes to it, and they must be one object.
          author: principal,
        }),
    }),
    [store, principal],
  );
}
