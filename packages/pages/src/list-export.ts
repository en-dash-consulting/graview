import type { ShownListSaid } from "@graview/core/csv";
import { useEffect } from "react";

/*
 * "EXPORT CSV" (Roadmap f-view-export-csv), as a kind's list says it: what
 * it shows, said while it is drawn in the page's map the place menu reads
 * (`Symbol.for("graview.shown-lists")`, `ShownListSaid` on
 * `@graview/core/csv`). The lenses keep the same few lines in
 * `@graview/primitives`, which this face does not import them from: a page
 * opened on a form alone carries neither. What writes and saves the list is
 * fetched with the press.
 */

type Lists = { [key: symbol]: Map<string, () => ShownListSaid> | undefined };

/** Says what a list shows while it is drawn, for the place menu: asked when the menu opens, so it says the list as it is then. */
export function useShownListExport(key: string, said: ShownListSaid): void {
  // Said again as each draw says it, so the menu reads the list as it is now.
  useEffect(() => {
    const lists = ((globalThis as Lists)[Symbol.for("graview.shown-lists")] ??= new Map());
    lists.set(key, () => said);
    return () => void lists.delete(key);
  });
}

/** What a list shows, written and saved: fetched with the press. */
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
