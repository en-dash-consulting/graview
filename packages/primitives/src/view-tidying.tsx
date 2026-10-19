import { NO_KEPT_VIEWS, placePath, placeTidying, REMOVED_VIEW_DAYS, removedLensName, type KeptViews, type KeptViewsState, type Place, type RemovedView } from "@graview/core";
import { useGraview, useGraviewIfAny } from "@graview/react/provider";
import { useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { NoticeBoardContext, type NoticeBoard } from "./notices.js";
import type { BarGo, BarPlace } from "./app-bar.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

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
 *
 * This is what a press does and the drop-down's foot: fetched with the
 * bar's panes, or by the menu's rows (`./view-tidying-sections.tsx`) while
 * the pointer rests on them, never with the page.
 */

const never = () => () => undefined;

/** What the host's kept views say now, followed as they change; nothing hidden, deleted or allowed without them. */
export function useKeptViewsState(keeper: KeptViews | undefined): KeptViewsState {
  const subscribe = useMemo(() => (keeper?.onChange ? (listener: () => void) => keeper.onChange!(listener) : never), [keeper]);
  const read = () => keeper?.current() ?? NO_KEPT_VIEWS;
  return useSyncExternalStore(subscribe, read, read);
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

/** What the drop-down's foot lists: the hidden places this viewer may show, and the deleted views they may restore. */
export function useTidied(): { readonly keeper: KeptViews; readonly hidden: readonly Place[]; readonly removed: readonly RemovedView[]; readonly how: (place: Place) => "view" | "lens" | null } | null {
  const context = useGraviewIfAny();
  const keeper = context?.keptViews;
  const state = useKeptViewsState(keeper);
  const views = context?.views;
  return useMemo(() => {
    if (!keeper || !views) return null;
    const how = (place: Place) => placeTidying(place, state, keeper);
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
  }, [keeper, state, views]);
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
