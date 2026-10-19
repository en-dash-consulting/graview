import { placePath, REMOVED_VIEW_DAYS, removedLensName, type KeptViews, type KeptViewsState, type Place, type RemovedView } from "@graview/core";
import { useGraview, useGraviewIfAny, type MenuItem, type MenuSectionSource, type MenuTarget } from "@graview/react/provider";
import { useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { NoticeBoardContext, type NoticeBoard } from "./notices.js";
import type { BarGo, BarPlace } from "./app-bar.js";

/*
 * TIDYING THE VIEWS FROM THE PLACE MENU (Roadmap f-place-menu-views).
 *
 * Right-clicking a place — in the bar, in its drop-down, on a page — offers
 * Hide and Delete for a view somebody may tidy: a script view the host keeps
 * (`ViewMeta.name`), where the host says this viewer may (`may.views`, an
 * owner or an editor); a declared lens (`ViewMeta.declared`), where the host
 * writes the declaration (`KeptViews.lens`) and says this viewer may change
 * it (`may.lenses`, the owner). Both are app-wide. The drop-down's foot
 * lists what is Hidden, with Show, and what was Recently deleted, with
 * Restore, for as long as the host keeps it.
 */

const never = () => () => undefined;
/** Nothing hidden, deleted or allowed: a host that keeps no views. */
const NO_KEPT_VIEWS: KeptViewsState = { hidden: [], removed: [], may: { views: false, lenses: false } };

/** What the host's kept views say now, followed as they change; nothing hidden, deleted or allowed without them. */
export function useKeptViewsState(keeper: KeptViews | undefined): KeptViewsState {
  const subscribe = useMemo(() => (keeper?.onChange ? (listener: () => void) => keeper.onChange!(listener) : never), [keeper]);
  const read = () => keeper?.current() ?? NO_KEPT_VIEWS;
  return useSyncExternalStore(subscribe, read, read);
}

/** The provider's kept views (`keptViews`) and what they say now: `null` where the host keeps none. */
export function useKeptViews(): { readonly keeper: KeptViews; readonly state: KeptViewsState } | null {
  const keeper = useGraviewIfAny()?.keptViews;
  const state = useKeptViewsState(keeper);
  return keeper ? { keeper, state } : null;
}

/** How a place is tidied: by the host, as a view it keeps; as a change to the declaration; or not by this viewer at all. */
export function tidyingOf(place: Pick<Place, "name" | "declared">, state: KeptViewsState, keeper: KeptViews): "view" | "lens" | null {
  if (place.name !== undefined && state.may.views) return "view";
  if (place.declared && state.may.lenses && keeper.lens) return "lens";
  return null;
}

/** Whether this viewer may restore a deleted view: a lens is the declaration's, the rest the host's views. */
const mayRestore = (removed: RemovedView, state: KeptViewsState): boolean => (removed.lens ? state.may.lenses : state.may.views);

/** Runs one tidying, saying in the app's notices what the host refused, in its words. */
async function tidy(board: NoticeBoard | null, run: () => void | Promise<void>, failed: string): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (error) {
    board?.notify({ kind: "toast", tone: "bad", sentence: error instanceof Error && error.message ? error.message : failed });
    return false;
  }
}

/** Keeps a place off the lists, or puts it back. */
export function setHidden(place: Place, how: "view" | "lens", keeper: KeptViews, hidden: boolean, board: NoticeBoard | null): Promise<boolean> {
  const name = place.name;
  return tidy(
    board,
    () => (how === "view" && name !== undefined ? (hidden ? keeper.hide(name) : keeper.show(name)) : keeper.lens?.({ op: "set-lens-hidden", title: place.title, on: place.kind, hidden })),
    hidden ? `“${place.title}” could not be hidden.` : `“${place.title}” could not be shown.`,
  );
}

/** Restores a deleted view, by the name the host lists it under. */
export function restore(removed: Pick<RemovedView, "name" | "title">, keeper: KeptViews, board: NoticeBoard | null): Promise<boolean> {
  return tidy(board, () => keeper.restore(removed.name), `“${removed.title}” could not be restored.`);
}

/** Deletes a place, saying where it went and offering it back. */
export async function remove(place: Place, how: "view" | "lens", keeper: KeptViews, board: NoticeBoard | null): Promise<boolean> {
  const name = how === "view" && place.name !== undefined ? place.name : removedLensName(place.title);
  const done = await tidy(
    board,
    () => (how === "view" && place.name !== undefined ? keeper.remove(place.name, { title: place.title, kind: place.kind }) : keeper.lens?.({ op: "remove-lens", title: place.title, on: place.kind })),
    `“${place.title}” could not be deleted.`,
  );
  if (done) {
    board?.notify({
      kind: "toast",
      id: `deleted-view-${name}`,
      sentence: `Deleted “${place.title}”. It is under Recently deleted in the places for ${REMOVED_VIEW_DAYS} days.`,
      action: { label: "Restore", onSelect: () => void restore({ name, title: place.title }, keeper, board) },
    });
  }
  return done;
}

/** The kind a menu's target is about, when it is one kind's group. */
function kindOf(target: MenuTarget): string | undefined {
  const about = target.about[0];
  if (target.about.length !== 1 || !about?.startsWith("aggregate:")) return undefined;
  const kinds = about.slice("aggregate:".length).split("+");
  return kinds.length === 1 ? kinds[0] : undefined;
}

/**
 * HIDE AND DELETE IN THE PLACE MENU: a section of the context menu for a
 * target that is a place this viewer may tidy — Show in place of Hide for
 * one already hidden. None where the host keeps no views.
 */
export function useViewTidyingSection(): MenuSectionSource | null {
  const kept = useKeptViews();
  const views = useGraviewIfAny()?.views;
  const board = useContext(NoticeBoardContext);
  const keeper = kept?.keeper;
  const state = kept?.state;
  return useMemo<MenuSectionSource | null>(() => {
    if (!keeper || !state || !views) return null;
    return (target: MenuTarget) => {
      if (target.place === undefined) return null;
      const kind = kindOf(target);
      const place = views.places().find((one) => one.as === target.place && (kind === undefined || one.kind === kind || one.over?.includes(kind) === true));
      if (!place) return null;
      const how = tidyingOf(place, state, keeper);
      if (!how) return null;
      const items: MenuItem[] = [
        place.hidden
          ? { id: "show-view", label: "Show", hint: "Back in the places, for everyone", run: () => void setHidden(place, how, keeper, false, board) }
          : { id: "hide-view", label: "Hide", hint: "Off the places and the scene, for everyone", run: () => void setHidden(place, how, keeper, true, board) },
        { id: "delete-view", label: "Delete", hint: `Kept ${REMOVED_VIEW_DAYS} days under Recently deleted`, run: () => void remove(place, how, keeper, board) },
      ];
      return { id: "tidy-view", items };
    };
  }, [keeper, state, views, board]);
}

/** What the drop-down's foot lists: the hidden places this viewer may show, and the deleted views they may restore. */
export function useTidied(): { readonly keeper: KeptViews; readonly hidden: readonly Place[]; readonly removed: readonly RemovedView[]; readonly how: (place: Place) => "view" | "lens" | null } | null {
  const kept = useKeptViews();
  const views = useGraviewIfAny()?.views;
  return useMemo(() => {
    if (!kept || !views) return null;
    const { keeper, state } = kept;
    const how = (place: Place) => tidyingOf(place, state, keeper);
    const seen = new Set<string>();
    // Each picture once, as every list of places names it.
    const hidden = views.places().filter((place) => {
      if (!place.hidden || how(place) === null) return false;
      const key = `${place.name ?? ""}|${place.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { keeper, hidden, removed: state.removed.filter((one) => mayRestore(one, state)), how };
  }, [kept?.keeper, kept?.state, views]);
}

/** A day as the drop-down says it: "Nov 18". */
function dayOf(iso: string, locale: string | undefined): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(locale ?? "en-US", { month: "short", day: "numeric" });
}

/** The foot's own rules, drawn with it. */
const TIDY_CSS = `.graview-bar-list li.graview-bar-tidied{display:flex;align-items:flex-start;gap:8px;padding:0 0 0 2px}
.graview-bar-tidied>.graview-bar-item,.graview-bar-gone{flex:1 1 auto;min-width:0}
.graview-bar-gone{display:grid;gap:1px;padding:7px 8px;font-size:.875rem;line-height:1.3;overflow-wrap:anywhere;color:var(--graview-ink-muted)}
.graview-bar-gone small{font-size:.75rem}
.graview-bar-tidy{flex:0 0 auto;margin:3px 2px;padding:4px 10px;border:1px solid var(--graview-edge);border-radius:6px;background:none;font:inherit;font-size:.8125rem;color:var(--graview-ink);cursor:pointer}
.graview-bar-tidy:hover{background:color-mix(in srgb,var(--graview-ink) 7%,transparent)}
.graview-bar-tidy:focus-visible{outline:2px solid var(--graview-accent);outline-offset:1px}`;

/** A hidden place's name in the foot: a link to it on Pages, where it is still at its address; its name alone on the scene. */
function HiddenName({ place, scene, reach, done }: { readonly place: Place; readonly scene: boolean; readonly reach: BarGo; readonly done: () => void }): ReactNode {
  if (scene) return <span className="graview-bar-gone">{place.title}</span>;
  const entry: BarPlace = { key: `place:${place.kind}:${place.as}`, label: place.title, path: placePath(place.as), group: "pictures", kind: place.kind };
  const href = reach.href?.(entry.path);
  const Entry = (href !== undefined ? "a" : "button") as "a";
  return (
    <Entry
      className="graview-bar-item"
      data-testid="app-view-hidden-place"
      {...(href !== undefined ? { href } : { type: "button" as const })}
      onClick={(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault(): void }) => {
        done();
        if (!reach.go || (href !== undefined && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))) return;
        event.preventDefault();
        reach.go(entry);
      }}
    >
      {place.title}
    </Entry>
  );
}

/**
 * THE DROP-DOWN'S FOOT: Hidden, each with Show, and Recently deleted, each
 * with Restore and the day it is gone for good. A hidden place's name is a
 * link to it where the face has one. Fetched with the bar's panes.
 */
export function TidyGroups({ id, scene, reach, done }: { readonly id: string; readonly scene: boolean; readonly reach: BarGo; readonly done: () => void }) {
  const tidied = useTidied();
  const { locale } = useGraview();
  const board = useContext(NoticeBoardContext);
  if (!tidied || (tidied.hidden.length === 0 && tidied.removed.length === 0)) return null;
  const { keeper, hidden, removed, how } = tidied;
  return (
    <>
      <style>{TIDY_CSS}</style>
      {hidden.length > 0 ? (
        <div role="group" aria-labelledby={`${id}-hidden`} data-place-group="hidden">
          <p id={`${id}-hidden`}>Hidden</p>
          <ul>
            {hidden.map((place) => (
              <li key={`${place.kind}:${place.as}`} className="graview-bar-tidied">
                <HiddenName place={place} scene={scene} reach={reach} done={done} />
                <button type="button" className="graview-bar-tidy" data-testid="app-view-show" data-view={place.name ?? place.title} aria-label={`Show “${place.title}”`} onClick={() => void setHidden(place, how(place)!, keeper, false, board)}>
                  Show
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {removed.length > 0 ? (
        <div role="group" aria-labelledby={`${id}-removed`} data-place-group="removed">
          <p id={`${id}-removed`}>Recently deleted</p>
          <ul>
            {removed.map((one) => (
              <li key={one.name} className="graview-bar-tidied">
                <span className="graview-bar-gone">
                  <span>{one.title}</span>
                  <small>until {dayOf(one.until, locale)}</small>
                </span>
                <button type="button" className="graview-bar-tidy" data-testid="app-view-restore" data-view={one.name} aria-label={`Restore “${one.title}”`} onClick={() => void restore(one, keeper, board)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
