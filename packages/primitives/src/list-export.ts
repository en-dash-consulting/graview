import type { ShownListSaid } from "@graview/core/csv";
import { createElement, useEffect, type ReactElement } from "react";

/*
 * "EXPORT CSV" (Roadmap f-view-export-csv), as a lens says it. A lens that
 * lists records says what it shows while it is drawn (`useShownListExport`),
 * in the page's map the place menu reads (`Symbol.for("graview.shown-lists")`,
 * `ShownListSaid` on `@graview/core/csv`), and ends its arranging line with
 * `ExportPress`. Everything that writes and saves the list —
 * `@graview/core/csv`'s `saveShownList` — is fetched with the press. The
 * routed face's list keeps a copy of these few lines of its own, so a page
 * that draws no list carries none of them.
 */

type Lists = { [key: symbol]: Map<string, () => ShownListSaid> | undefined };

/** The key a kind's list on the routed face is said under. */
export const listExportKey = (kind: string): string => `list:${kind}`;

/** The key a place (a lens) is said under. */
export const placeExportKey = (as: string): string => `place:${as}`;

/** Says what a place shows while it is drawn, for the place menu: asked when the menu opens, so it says the list as it is then. */
export function useShownListExport(key: string | undefined, said: ShownListSaid): void {
  // Said again as each draw says it, so the menu reads the list as it is now.
  useEffect(() => {
    if (key === undefined) return;
    const lists = ((globalThis as Lists)[Symbol.for("graview.shown-lists")] ??= new Map());
    lists.set(key, () => said);
    return () => void lists.delete(key);
  });
}

/** What a place shows, written and saved: fetched with the press. */
export const exportShownList = (said: ShownListSaid): Promise<void> => import("@graview/core/csv").then((csv) => csv.saveShownList(said.read()));

/** What a list says it shows, with the place menu's rows for it: "Export CSV", and the owner's switch, each fetched with the press. */
export function shownListSaid(off: boolean, about: ShownListSaid["about"], read: ShownListSaid["read"]): ShownListSaid {
  const said: ShownListSaid = {
    off,
    about,
    read,
    menu: (owner, keeper, board) => [
      ...(off ? [] : [{ id: "export-csv", label: "Export CSV", run: () => void exportShownList(said) }]),
      ...(owner && keeper ? [{ id: off ? "export-on" : "export-off", label: off ? "Turn on export" : "Turn off export", run: () => void import("@graview/core/csv").then((csv) => csv.switchExport(said, keeper, off, board)) }] : []),
    ],
  };
  return said;
}

/** The arranging line's last press: quiet, short, and named "Export CSV". */
export function ExportPress({ said }: { readonly said: ShownListSaid }): ReactElement {
  return createElement(
    "button",
    { type: "button", className: "graview-arrange-open", "data-testid": "arrange-export", "aria-label": "Export CSV", title: "Export CSV", onClick: () => void exportShownList(said) },
    createElement("span", { "aria-hidden": "true" }, "↓"),
    "CSV",
  );
}
