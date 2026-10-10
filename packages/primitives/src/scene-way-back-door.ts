import type { AnySchema, Principal, Store } from "@graview/core";
import type { NoticeBoard } from "./notices.js";
import { freshChangeOf, isTakeBackKey, lastChangeOf, takeBackLast, WAY_BACK_MS } from "./way-back.js";

/** The one offer on the board: an act's own replaces the one before. */
const OFFER = "way-back";

/**
 * THE SCENE'S WAY BACK, BEHIND ITS DOOR (FR-153): heard from each change
 * the store makes, and from ⌘Z or Ctrl+Z while the keyboard is in the app
 * `mark` is drawn in (anywhere on the page, under the whole-page Shell). `seen` is how
 * many batches the log held when the scene was drawn: what was done before
 * is no act to offer back. Returns what stops it.
 */
export function sceneWay<S extends AnySchema>(store: Store<S>, principal: Principal | undefined, board: NoticeBoard | null, seen: number, mark: Element | null): () => void {
  // The app the scene is drawn in: an embed's frame, or none — the whole-page Shell owns the page.
  const app = mark?.closest("[data-graview-embed]");
  let offered: string | undefined;
  const take = () => {
    try {
      const taken = takeBackLast(store, principal);
      if (taken) board?.notify({ kind: "toast", id: OFFER, sentence: `Took back “${taken.intent}”` });
      return taken !== undefined;
    } catch (error) {
      board?.notify({ kind: "toast", id: OFFER, tone: "warn", sentence: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
  const heard = () => {
    const fresh = freshChangeOf(store, principal, seen);
    seen = store.batches().length;
    if (fresh) {
      offered = fresh.batch;
      board?.notify({ kind: "toast", id: OFFER, sentence: fresh.intent, timeout: WAY_BACK_MS, action: { label: "Take back", onSelect: take } });
    } else if (offered && lastChangeOf(store, principal)?.batch !== offered) {
      // Taken back, by the key or from Activity: the offer goes with it.
      offered = undefined;
      board?.dismiss(OFFER);
    }
  };
  const key = (event: KeyboardEvent) => {
    if (isTakeBackKey(event) && (!app || app.contains(event.target as Node)) && take()) event.preventDefault();
  };
  // An act made while this was on its way is offered back as it arrives.
  heard();
  const off = store.subscribe(heard);
  document.addEventListener("keydown", key);
  return () => {
    off();
    document.removeEventListener("keydown", key);
  };
}
