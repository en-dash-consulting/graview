import type { AnySchema } from "@graview/core";
import { withPan } from "@graview/layout/view-moves";
import type { ViewState } from "@graview/layout";
import { useRef, type ReactNode } from "react";
import { GraviewContext, useGraview, type GraviewContextValue } from "./context.js";

/**
 * THE CARDS ARE NOT TOLD THE PAN, NOR THE PANELS OVER THEM.
 *
 * Where the camera is panned to is part of the view, and the view is part of
 * the Graview context — so letting go of a drag, or the wheel coming to
 * rest, re-rendered every reader of the context inside every card in the
 * scene: a board of two hundred and fifty cards drew each one again to show
 * it a few hundred pixels to the left, which is the one thing a card never
 * draws. The pan is the scene's: the scene moves the cards; what is in them
 * does not change. The same is true of a panel beside the map listing a
 * district's hundred and seventy records, and of the menu at the pointer.
 *
 * So they read the context through this (`PanFree`, around them): the same value, with the view
 * as it is less its pan, kept while nothing but the pan has changed (and
 * whether a hand moved it, which only the trail says). Anything else that
 * changes — the stop, the selection, the graph, the seat — gives the cards
 * a new value, as before.
 *
 * And a card that writes the view whole — `go(withSearch(view, …))` — wrote
 * it from a view with no pan in it, which would have put the camera back.
 * A write that left the pan as the card was given it keeps the pan the view
 * has now; one that says a pan of its own keeps that.
 */
export function usePanFreeContext<S extends AnySchema>(outer: GraviewContextValue<S>): GraviewContextValue<S> {
  const latest = useRef(outer);
  latest.current = outer;
  const held = useRef<{ outer: GraviewContextValue<S>; inner: GraviewContextValue<S> } | null>(null);
  /*
   * WHAT IT DOES IS ALWAYS TODAY'S. The provider's own callbacks are made
   * again with the view they resolve against, so they would say "changed"
   * on every pan; while only the pan moves, each is called through to the
   * one the provider has now. A callback the provider has not made again is
   * handed on as the same callback, so an effect keyed on it runs when it
   * ran before and not otherwise.
   */
  const calls = useRef(new Map<string, { readonly made: unknown; readonly call: (...args: unknown[]) => unknown }>());
  const last = held.current;
  if (last && (last.outer === outer || onlyThePanMoved(last.outer, outer))) {
    last.outer = outer;
    return last.inner;
  }
  const view = withPan(outer.view, null);
  const callThrough = (key: string, made: unknown, call: (...args: unknown[]) => unknown) => {
    const kept = calls.current.get(key);
    if (kept && kept.made === made) return kept.call;
    calls.current.set(key, { made, call });
    return call;
  };
  const free = Object.fromEntries(
    Object.entries(outer).map(([key, value]) => [
      key,
      key === "view"
        ? view
        : key === "setView"
          ? callThrough(key, value, keepingThePan(latest))
          : typeof value === "function"
            ? callThrough(key, value, (...args: unknown[]) => (latest.current as unknown as Record<string, (...a: unknown[]) => unknown>)[key]!(...args))
            : value,
    ]),
  ) as unknown as GraviewContextValue<S>;
  held.current = { outer, inner: free };
  return free;
}

/** A write of the whole view that says no pan keeps the pan the view has now; a functional one is the view's own. */
function keepingThePan<S extends AnySchema>(latest: { readonly current: GraviewContextValue<S> }) {
  return ((next: ViewState | ((current: ViewState) => ViewState)) =>
    latest.current.setView(typeof next === "function" ? next : (current) => (next.pan === undefined && current.pan ? { ...next, pan: current.pan } : next))) as (...args: unknown[]) => unknown;
}

/** The two values differ in the view's pan at most, and in whether a hand moved it. */
function onlyThePanMoved<S extends AnySchema>(before: GraviewContextValue<S>, after: GraviewContextValue<S>): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key === "view" || key === "movedByHand") continue;
    const was = (before as unknown as Record<string, unknown>)[key];
    const is = (after as unknown as Record<string, unknown>)[key];
    // A callback made again is the same callback: what reads this calls through to the latest.
    if (was !== is && !(typeof was === "function" && typeof is === "function")) return false;
  }
  return samePanless(before.view, after.view);
}

/** Two stops that are the same place, whatever either is panned to. */
export function samePanless(before: ViewState, after: ViewState): boolean {
  if (before === after) return true;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key === "pan") continue;
    if ((before as unknown as Record<string, unknown>)[key] !== (after as unknown as Record<string, unknown>)[key]) return false;
  }
  return true;
}

/**
 * What is drawn inside reads the Graview context free of the pan: kept while
 * only the pan moves (`usePanFreeContext`). The scene draws its cards in one;
 * a face puts what floats over the picture — the panel beside the map, the
 * menu at the pointer — in another. Not for what says where the camera is:
 * the trail's "Reset view", the address, Escape's way back.
 */
export function PanFree({ children }: { readonly children?: ReactNode }) {
  const free = usePanFreeContext(useGraview());
  return <GraviewContext.Provider value={free as unknown as GraviewContextValue<AnySchema>}>{children}</GraviewContext.Provider>;
}
