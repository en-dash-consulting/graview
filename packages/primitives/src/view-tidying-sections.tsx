import { retryingImport } from "@graview/core/retry";
import { placeTidying, pluralLabel, REMOVED_VIEW_DAYS, type Place } from "@graview/core";
import { aggregateId, withOverview, withPicture } from "@graview/layout/view";
import { MenuSections } from "@graview/react/drawing";
import { lazyModule, useGraviewIfAny, useNavigation, type MenuItem, type MenuSectionSource, type MenuTarget } from "@graview/react/provider";
import { useCallback, useContext, useMemo, type ReactNode } from "react";
import { NoticeBoardContext } from "./notices.js";
import type { ShownListToExport } from "./list-export.js";

/*
 * HIDE AND DELETE IN THE PLACE MENU (Roadmap f-place-menu-views), as much
 * of it as the menu needs to say its rows: whether a place is one this
 * viewer may tidy, and the rows. What a press does — the host asked, the
 * toast, Restore — is the tidying's own (`./view-tidying.tsx`), fetched
 * while the pointer rests on the menu or with the press, so a face that is
 * never right-clicked carries none of it. Its own module, beside the faces'
 * menus: `MenuSections` is the drawn faces' (`@graview/react/drawing`).
 */

/** What a drawn place shows, by key (`list:<kind>`, `place:<as>`): what `useShownListExport` says, read off the page (`SHOWN_LISTS`). */
const shownAt = (key: string) => (globalThis as { [key: symbol]: Map<string, () => ShownListToExport> | undefined })[Symbol.for("graview.shown-lists")]?.get(key);

/** What a place's export switch is set on: a lens by its title and kind, a kind's list by its kind. */
type ExportAbout = { readonly lens: string; readonly on?: string } | { readonly kind: string };

const tidying = /* @__PURE__ */ lazyModule(retryingImport(() => import("./view-tidying.js")));

/** The kind a menu's target is about, when it is one kind's group. */
function kindOf(target: MenuTarget): string | undefined {
  const about = target.about[0];
  if (target.about.length !== 1 || !about?.startsWith("aggregate:")) return undefined;
  const kinds = about.slice("aggregate:".length).split("+");
  return kinds.length === 1 ? kinds[0] : undefined;
}

/**
 * THE PLACE A KIND FALLS BACK TO when `gone` is deleted: the one its kind
 * draws when an address names none — the last registered of the kind's
 * others still listed — or none, and the face goes home.
 */
export function placeAfter(places: readonly Place[], gone: Place): Place | undefined {
  return places.filter((one) => one.as !== gone.as && !one.hidden && (one.kind === gone.kind || one.over?.includes(gone.kind) === true)).at(-1);
}

/**
 * HIDE AND DELETE IN THE PLACE MENU: a section of the context menu for a
 * target that is a place this viewer may tidy — Show in place of Hide for
 * one already hidden. None where the host keeps no views. `away` is told of
 * a place once it is deleted, so a face on it goes somewhere that stands
 * (`placeAfter`) rather than drawing what it falls back to.
 */
export function useViewTidyingSection(away?: (place: Place, after: Place | undefined) => void): MenuSectionSource | null {
  const context = useGraviewIfAny();
  const keeper = context?.keptViews;
  const views = context?.views;
  const board = useContext(NoticeBoardContext);
  return useMemo<MenuSectionSource | null>(() => {
    if (!views) return null;
    return (target: MenuTarget) => {
      // What the host says as the menu opens.
      const state = keeper?.current();
      const kind = kindOf(target);
      const section = (items: MenuItem[]) => (items.length > 0 ? { id: "tidy-view", items, prepare: () => tidying.prefetch() } : null);
      const tidy = <K extends "setListHidden" | "setHidden" | "remove" | "setExport" | "exportList">(name: K, ...args: unknown[]) => tidying.load().then((module) => (module[name] as (...given: unknown[]) => Promise<boolean>)(...args), () => false);
      /*
       * "EXPORT CSV" (Roadmap f-view-export-csv): the records the place
       * shows, where it is drawn and lists records, unless its declaration
       * offers it to nobody — and, for whoever may change the declaration,
       * the switch that offers it or not, `set-lens-export`.
       */
      const exporting = (key: string, off: boolean, title: string, about: ExportAbout, owner: boolean): MenuItem[] => {
        const shown = shownAt(key);
        const items: MenuItem[] = shown && !off ? [{ id: "export-csv", label: "Export CSV", hint: "The records shown, as a spreadsheet", run: () => void tidy("exportList", shown()) }] : [];
        if (owner && (off || shown)) items.push({ id: off ? "export-on" : "export-off", label: off ? "Turn on export" : "Turn off export", hint: off ? "Offer Export CSV here" : "Offer Export CSV to nobody", run: () => void tidy("setExport", title, about, keeper, off, board) });
        return items;
      };
      /*
       * A KIND'S LIST, on Pages: kept off the places (`pages.hide`) as a
       * change to the declaration — `set-lens-hidden` on the kind — by
       * whoever may change it. Still at its address, and Show brings it back.
       */
      if (target.place === undefined) {
        if (target.face !== "pages" || kind === undefined || target.on !== undefined) return null;
        const owner = state?.may.lenses === true && keeper?.lens !== undefined;
        const title = pluralLabel(context!.store.schema, kind);
        const hidden = views.arrangement?.()?.hide?.includes(kind) === true;
        return section([
          ...(owner ? [{ id: hidden ? "show-list" : "hide-list", label: hidden ? "Show" : "Hide", hint: hidden ? "Back in the places, for everyone" : "Off the places, for everyone; still at its address", run: () => void tidy("setListHidden", kind, title, keeper, !hidden, board) }] : []),
          ...exporting(`list:${kind}`, views.arrangement?.()?.lists?.[kind]?.export === false, title, { kind }, owner),
        ]);
      }
      const place = views.places().find((one) => one.as === target.place && (kind === undefined || one.kind === kind || one.over?.includes(kind) === true));
      if (!place) return null;
      const how = keeper && state ? placeTidying(place, state, keeper) : null;
      return section([
        ...(how
          ? [
              place.hidden
                ? { id: "show-view", label: "Show", hint: "Back in the places, for everyone", run: () => void tidy("setHidden", place, how, keeper, false, board) }
                : { id: "hide-view", label: "Hide", hint: "Off the places and the scene, for everyone", run: () => void tidy("setHidden", place, how, keeper, true, board) },
              {
                id: "delete-view",
                label: "Delete",
                hint: `Kept ${REMOVED_VIEW_DAYS} days under Recently deleted`,
                run: () => {
                  const after = placeAfter(views.places(), place);
                  void tidy("remove", place, how, keeper, board).then((done) => done && away?.(place, after));
                },
              },
            ]
          : []),
        ...exporting(`place:${place.as}`, place.export === false, place.title, { lens: place.title, on: place.kind }, how === "lens"),
      ]);
    };
  }, [keeper, views, board, away]);
}

const NONE: readonly MenuSectionSource[] = [];

/** The context menu drawn inside, with Hide and Delete in it for a place this viewer may tidy (Roadmap f-place-menu-views). */
export function ViewTidyingSections({ children }: { readonly children: ReactNode }) {
  /* The scene showing a picture just deleted goes to its kind's own picture, else up to the whole thing. */
  const { view, go } = useNavigation();
  const away = useCallback(
    (place: Place, after: Place | undefined) => {
      const showing = view.within?.["view"];
      const on = view.focusId === aggregateId(place.kind) && (showing === undefined || showing === place.as);
      if (on) go(after ? withPicture(view, after.kind, after.as) : withOverview(view, true));
    },
    [view, go],
  );
  const section = useViewTidyingSection(away);
  const sections = useMemo(() => (section ? [section] : NONE), [section]);
  return <MenuSections sections={sections}>{children}</MenuSections>;
}
