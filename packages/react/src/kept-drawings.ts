import { createContext, useContext, useEffect, useState } from "react";

/*
 * A CUSTOM PAGE GONE BACK TO STANDS AT ONCE (Graview HQ
 * f-custom-pages-do-not-flash). A view of the app's own was taken down as
 * its page was left, and drawn again from nothing when the page was
 * returned to: a worker started, what it keeps for its viewer asked for, a
 * frame loaded. What it drew is kept here instead, for the visit, and put
 * back in its page as it stood.
 *
 * KEPT NARROWLY. In this page's memory and nowhere else; by the provider
 * that drew it, for the one store and the one seat it was drawn for, and let
 * go as either changes, as the registry does (a view hidden, taken away or
 * handed anew), as a person signs in or out, and as the provider goes; at
 * most `MOST_KEPT`, the one left longest ago let go first; and none longer
 * than `KEPT_MS` after it was left. A drawing lets itself go (`forget`) when
 * it fails, or when a record it shows is no longer its seat's to see.
 */

/** The most drawings a page keeps of pages a person has left. */
export const MOST_KEPT = 6;
/** How long one is kept after its page was left. */
export const KEPT_MS = 5 * 60_000;

/** A drawing put by: what it was drawn from, and how it is let go of. */
export interface KeptDrawing {
  /** What it is a drawing of, by identity: the view's definition, its store, its seat. Taken back only by exactly these. */
  readonly of: readonly unknown[];
  dispose(): void;
}

export interface KeptDrawings {
  /** Keep one under its place's name, in place of any kept there. */
  keep(name: string, drawing: KeptDrawing): void;
  /** Take back the one kept there, when it is a drawing of exactly this; any other kept there is let go. */
  take<D extends KeptDrawing>(name: string, of: readonly unknown[]): D | undefined;
  /** Let this one go. */
  forget(drawing: KeptDrawing): void;
  /** Let every one go. */
  clear(): void;
}

export function createKeptDrawings(): KeptDrawings {
  const kept = new Map<string, { readonly drawing: KeptDrawing; readonly timer: ReturnType<typeof setTimeout> }>();
  const out = (name: string): KeptDrawing | undefined => {
    const one = kept.get(name);
    if (!one) return undefined;
    clearTimeout(one.timer);
    kept.delete(name);
    return one.drawing;
  };
  return {
    keep(name, drawing) {
      out(name)?.dispose();
      kept.set(name, { drawing, timer: setTimeout(() => out(name)?.dispose(), KEPT_MS) });
      if (kept.size > MOST_KEPT) out(kept.keys().next().value!)?.dispose();
    },
    take<D extends KeptDrawing>(name: string, of: readonly unknown[]) {
      const drawing = out(name);
      if (!drawing) return undefined;
      if (drawing.of.length === of.length && drawing.of.every((one, at) => one === of[at])) return drawing as D;
      drawing.dispose();
      return undefined;
    },
    forget(drawing) {
      for (const [name, one] of kept) if (one.drawing === drawing) out(name);
      drawing.dispose();
    },
    clear() {
      for (const name of [...kept.keys()]) out(name)?.dispose();
    },
  };
}

/** Where a view of the app's own finds the drawings kept: the provider's it is drawn under, or none. */
export const KeptDrawingsContext = createContext<KeptDrawings | null>(null);
export const useKeptDrawings = (): KeptDrawings | null => useContext(KeptDrawingsContext);

/**
 * THE PAGE A VIEW IS DRAWN AS: set by a face around the one view that is its
 * page's own — the home's, a place's, a kind's list's, a record's — by what
 * the page is. Unset, what is drawn is a row, a card, a preview or a panel,
 * and is never kept.
 */
export const PageOfItsOwn = createContext<string | null>(null);

/** The drawings a provider keeps, let go as anything they were drawn under changes and as it goes. */
export function useOwnKeptDrawings(...under: readonly unknown[]): KeptDrawings {
  const [kept] = useState(createKeptDrawings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => kept.clear(), [kept, ...under]);
  return kept;
}
