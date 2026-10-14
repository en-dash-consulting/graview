import type { AnySchema, Principal, Store } from "@graview/core";
import type { NoticeBoard } from "./notices.js";
import { freshChangeOf, isTakeBackKey, lastChangeOf, takeBackLast, WAY_BACK_MS } from "./way-back.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/** The one offer on the board: an act's own replaces the one before. */
const OFFER = "way-back";
const TOASTS = '[data-testid="notices-toasts"]';

/*
 * THE KEYBOARD OFF THE NOTICE ONCE ITS TAKE BACK IS PRESSED. The press
 * takes the control from under the keyboard, and the keyboard fell to the
 * notice's × beside it — where it stayed, so every offer after, said in the
 * same place, was held by a keyboard nobody had put there and never went
 * (FR-152). It goes, as the press is made, where the routed face lands it
 * on its page: on the app's name, the heading of what is drawn — before the
 * control goes, so nothing lands it beside the control afterwards (a
 * click in WebKit and Firefox on macOS gives a button no keyboard at all).
 */
function landOnTheApp(app: Element | null | undefined) {
  const active = document.activeElement;
  if (active !== null && active !== document.body && !active.closest(TOASTS)) return;
  (app ?? document).querySelector<HTMLElement>('[data-graview-app-bar] [data-testid="app-home"]')?.focus({ preventScroll: true });
}

/**
 * THE SCENE'S WAY BACK, BEHIND ITS DOOR (FR-153): heard from each change
 * the store makes, and from ⌘Z or Ctrl+Z while the keyboard is in the app
 * `mark` is drawn in (anywhere on the page, under the whole-page Shell). `seen` is how
 * many batches the log held when the scene was drawn: what was done before
 * is no act to offer back. Returns what stops it — and, told the scene is
 * gone, takes its offer off the board.
 */
export function sceneWay<S extends AnySchema>(store: Store<S>, principal: Principal | undefined, board: NoticeBoard | null, seen: number, mark: Element | null): (gone?: boolean) => void {
  // The app the scene is drawn in: an embed's frame, or none — the whole-page Shell owns the page.
  const app = mark?.closest("[data-graview-embed]");
  let offered: string | undefined;
  const take = (only?: string) => {
    // The toast's Take back is its own act's: once another came after it, there is nothing for it to take.
    if (only !== undefined && lastChangeOf(store, principal)?.batch !== only) return false;
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
      const batch = (offered = fresh.batch);
      board?.notify({ kind: "toast", id: OFFER, sentence: fresh.intent, timeout: WAY_BACK_MS, action: { label: "Take back", onSelect: () => (landOnTheApp(app), take(batch)) } });
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
  /*
   * `gone` when the scene itself is: a face switch unmounts it while the
   * board — an embed's frame's, or a host's — stays, and the offer would
   * stand for an act this scene is no longer there to judge.
   */
  return (gone = false) => {
    off();
    document.removeEventListener("keydown", key);
    if (gone && offered) board?.dismiss(OFFER);
  };
}
