import { retryingImport } from "@graview/core/retry";
import { placeTidying, pluralLabel, REMOVED_VIEW_DAYS, type Place } from "@graview/core";
import { aggregateId, withOverview, withPicture } from "@graview/layout/view";
import { MenuSections } from "@graview/react/drawing";
import { lazyModule, useGraviewIfAny, useNavigation, type MenuItem, type MenuSectionSource, type MenuTarget } from "@graview/react/provider";
import { useCallback, useContext, useMemo, type ReactNode } from "react";
import { NoticeBoardContext } from "./notices.js";

/*
 * HIDE AND DELETE IN THE PLACE MENU (Roadmap f-place-menu-views), as much
 * of it as the menu needs to say its rows: whether a place is one this
 * viewer may tidy, and the rows. What a press does — the host asked, the
 * toast, Restore — is the tidying's own (`./view-tidying.tsx`), fetched
 * while the pointer rests on the menu or with the press, so a face that is
 * never right-clicked carries none of it. Its own module, beside the faces'
 * menus: `MenuSections` is the drawn faces' (`@graview/react/drawing`).
 */

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
    if (!keeper || !views) return null;
    return (target: MenuTarget) => {
      // What the host says as the menu opens.
      const state = keeper.current();
      const kind = kindOf(target);
      /*
       * A KIND'S LIST, on Pages: kept off the places (`pages.hide`) as a
       * change to the declaration — `set-lens-hidden` on the kind — by
       * whoever may change it. Still at its address, and Show brings it back.
       */
      if (target.place === undefined) {
        if (target.face !== "pages" || kind === undefined || target.on !== undefined || !state.may.lenses || !keeper.lens) return null;
        const hidden = views.arrangement?.()?.hide?.includes(kind) === true;
        const setListHidden = (hide: boolean) => void tidying.load().then((module) => module.setListHidden(kind, pluralLabel(context!.store.schema, kind), keeper, hide, board), String);
        const items: MenuItem[] = [hidden ? { id: "show-list", label: "Show", hint: "Back in the places, for everyone", run: () => setListHidden(false) } : { id: "hide-list", label: "Hide", hint: "Off the places, for everyone; still at its address", run: () => setListHidden(true) }];
        return { id: "tidy-view", items, prepare: () => tidying.prefetch() };
      }
      const place = views.places().find((one) => one.as === target.place && (kind === undefined || one.kind === kind || one.over?.includes(kind) === true));
      if (!place) return null;
      const how = placeTidying(place, state, keeper);
      if (!how) return null;
      const setHidden = (hidden: boolean) => void tidying.load().then((module) => module.setHidden(place, how, keeper, hidden, board), String);
      const items: MenuItem[] = [
        place.hidden
          ? { id: "show-view", label: "Show", hint: "Back in the places, for everyone", run: () => setHidden(false) }
          : { id: "hide-view", label: "Hide", hint: "Off the places and the scene, for everyone", run: () => setHidden(true) },
        {
          id: "delete-view",
          label: "Delete",
          hint: `Kept ${REMOVED_VIEW_DAYS} days under Recently deleted`,
          run: () => {
            const after = placeAfter(views.places(), place);
            void tidying.load().then((module) => module.remove(place, how, keeper, board).then((done) => done && away?.(place, after)), String);
          },
        },
      ];
      // What a press does, fetched while the pointer rests on the menu.
      return { id: "tidy-view", items, prepare: () => tidying.prefetch() };
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
