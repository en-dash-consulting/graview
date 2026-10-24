import { retryingImport } from "@graview/core/retry";
import type { AnySchema, ArrangeGraph } from "@graview/core";
import { lazyModule, type OnExport } from "@graview/react/provider";
import { useEffect, useRef } from "react";

/*
 * "EXPORT CSV" (Roadmap f-view-export-csv). A place that lists records
 * offers to write the records it shows — in its order, with its filter,
 * its words and its groups — as a spreadsheet: from the list's own
 * arranging line, and from the place menu. The place says what it shows
 * here (`useShownListExport`), under the key the menu asks by, so both
 * write the one list; what writes it (`@graview/core/csv`) is fetched with
 * the press, so a page that never exports carries none of it.
 */

/** A place's list as it is shown, ready to write: what `listCsv` reads, and the title the file is named by. */
export interface ShownListToExport {
  /** The place's title, which names the file: "Tasks — 2026-10-23.csv". */
  readonly title: string;
  readonly schema: AnySchema;
  /** The graph the records are read in, as the seat sees it. */
  readonly graph: ArrangeGraph;
  readonly kind: string;
  /** The records shown, in order, by group (one unnamed group when the list is not grouped). */
  readonly groups: readonly { readonly label?: string; readonly nodes: readonly { readonly id: string; readonly kind: string }[] }[];
  readonly grouped: boolean;
  /** Where the host saves it; unsaid, the browser downloads it. */
  readonly onExport?: OnExport | undefined;
}

/** The key a kind's list on the routed face is said under. */
export const listExportKey = (kind: string): string => `list:${kind}`;

/** The key a place (a lens) is said under. */
export const placeExportKey = (as: string): string => `place:${as}`;

/**
 * WHAT EACH DRAWN PLACE SHOWS, by key: kept on the page under a name of its
 * own (`SHOWN_LISTS`), so the place menu reads it without importing this
 * module — the menu is drawn by both faces before any list is.
 */
export const SHOWN_LISTS = Symbol.for("graview.shown-lists");
const shown: Map<string, () => ShownListToExport> = ((globalThis as { [SHOWN_LISTS]?: Map<string, () => ShownListToExport> })[SHOWN_LISTS] ??= new Map());

/**
 * SAYS WHAT A PLACE SHOWS, while it is drawn, for the place menu to export
 * by its key. `read` is asked when somebody presses Export, so it says the
 * list as it is then. Nothing is said while `on` is false.
 */
export function useShownListExport(key: string | undefined, read: () => ShownListToExport, on = true): void {
  const latest = useRef(read);
  latest.current = read;
  useEffect(() => {
    if (key === undefined || !on) return;
    const say = () => latest.current();
    shown.set(key, say);
    return () => {
      if (shown.get(key) === say) shown.delete(key);
    };
  }, [key, on]);
}

/** What the place under `key` shows now, when it is drawn and offers "Export CSV". */
export function shownListAt(key: string): (() => ShownListToExport) | undefined {
  return shown.get(key);
}

const writing = /* @__PURE__ */ lazyModule(retryingImport(() => import("./list-export-run.js")));

/** Fetches what writes a list, while the pointer rests on Export. */
export const prefetchExport = (): void => writing.prefetch();

/** Writes a shown list as CSV and saves it: handed to the host's `onExport`, else downloaded by the browser. */
export function exportShownList(list: ShownListToExport): Promise<void> {
  return writing.load().then((module) => module.saveShownList(list));
}
