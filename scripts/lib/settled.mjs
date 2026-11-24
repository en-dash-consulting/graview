/**
 * WAITING ON WHAT A WAIT MEANS, not on a number of milliseconds.
 *
 * Half of the harness chain's time (7,111 s of 14,511 s, 2026-11-23) was
 * fixed `waitForTimeout`s: a press, then 1.5 s "for it to settle", on a page
 * that settled in a tenth of that. A fixed wait is either too long, and the
 * chain pays for it on every run, or too short on a loaded runner, and a
 * claim fails for no fault of the page's. These wait for the thing itself.
 *
 * `settled(page, { most })` is the page's own definition of having drawn
 * (the embed's `data-graview-drawn`, packages/embed/src/drawn.ts) asked of
 * any page: nothing in the document has changed for `quiet` ms, no request
 * the page made is still on its way, no part says it is busy, no transition
 * is running, the fonts are in and the scene (where there is one) has
 * landed, and the watch has taken every look it meant to take at what is
 * there (watch.mjs's `looking`). It never waits longer than `most`, the fixed wait it replaces, so
 * a page that never stops moving costs what it cost before and no more.
 *
 * `frames(page, n)` is n animation frames: what "the frame after a scroll"
 * means.
 */

import { noteSettled } from "./timing.mjs";

/** What counts as nothing having changed, in ms: the embed's own `QUIET_MS`. */
export const QUIET_MS = 200;
const EVERY_MS = 50;
/** A request open this long is a stream (an event source, a long poll), not one on its way. */
const STREAM_MS = 3_000;

const pending = new WeakMap();

/** Count the requests a page has on their way. Called by the watch on every page it sees, and here on any it did not. */
export function trackRequests(page) {
  if (pending.has(page) || typeof page?.on !== "function") return;
  const open = new Map();
  pending.set(page, open);
  page.on("request", (request) => {
    const type = request.resourceType();
    if (type === "eventsource" || type === "websocket") return;
    open.set(request, Date.now());
  });
  const done = (request) => open.delete(request);
  page.on("requestfinished", done);
  page.on("requestfailed", done);
}

function requestsOnTheirWay(page) {
  const open = pending.get(page);
  if (!open) return 0;
  const now = Date.now();
  let count = 0;
  for (const since of open.values()) if (now - since < STREAM_MS) count += 1;
  return count;
}

/*
 * In the page: a watch that counts every change to the document and says
 * whether anything is still on its way. Installed once per document.
 */
const look = () => {
  const watch = (window.__graviewSettle ??= (() => {
    const state = { changedAt: performance.now() };
    new MutationObserver(() => {
      state.changedAt = performance.now();
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    return state;
  })());
  const busy =
    // The watch has looks still to take at what is on the page (watch.mjs): it is judged before the harness moves on.
    (window.__graviewWatch?.looking?.() ?? 0) > 0 ||
    document.fonts?.status === "loading" ||
    document.querySelector('[aria-busy="true"]') !== null ||
    // A scene's ground says when no tween runs and no camera glide is pending (scene-root.tsx).
    [...document.querySelectorAll(".graview-ground")].some((ground) => !ground.hasAttribute("data-graview-settled")) ||
    (typeof document.getAnimations === "function" &&
      document.getAnimations().some((animation) => {
        if (animation.playState !== "running") return false;
        const end = animation.effect?.getComputedTiming?.().endTime;
        return typeof end === "number" && Number.isFinite(end);
      }));
  return { quietFor: performance.now() - watch.changedAt, busy };
};

/**
 * Until the page has settled — nothing changed for `quiet` ms, nothing on its
 * way — or `most` ms have passed, whichever is first. Never throws: a page
 * that navigated or closed meanwhile has nothing left to wait for.
 *
 * @param {import("playwright").Page} page
 * @param {{ most?: number, quiet?: number }} [options] `most` is the fixed wait this replaces
 * @returns {Promise<boolean>} whether it settled before `most`
 */
export async function settled(page, { most = 1_500, quiet = QUIET_MS } = {}) {
  trackRequests(page);
  const began = Date.now();
  const until = began + most;
  try {
    for (;;) {
      let state;
      try {
        state = await page.evaluate(look);
      } catch {
        // Mid-navigation: the new document has its own watch, installed on the next look.
        state = { quietFor: 0, busy: true };
        if (page.isClosed?.()) return false;
      }
      /*
       * Quiet since the wait began as well as since the last change: what was
       * just pressed may change the page a task or a frame later, and a page
       * that was still before the press is not yet the page after it.
       */
      const quietFor = Math.min(state.quietFor, Date.now() - began);
      if (!state.busy && quietFor >= quiet && requestsOnTheirWay(page) === 0) return true;
      const left = until - Date.now();
      if (left <= 0) return false;
      await new Promise((resolve) => setTimeout(resolve, Math.min(EVERY_MS, left)));
    }
  } finally {
    noteSettled(Date.now() - began);
  }
}

/**
 * Until `check()` answers true, asked every tenth of a second, or `most` ms
 * have passed: for a claim that something goes in its own time ("leaves
 * after its time"), whose wait was the whole time and a margin. Whether it
 * held is the claim's to read again; this only stops waiting once it has.
 */
export async function until(check, { most }) {
  const began = Date.now();
  const end = began + most;
  try {
    for (;;) {
      if (await Promise.resolve(check()).catch(() => false)) return true;
      const left = end - Date.now();
      if (left <= 0) return false;
      await new Promise((resolve) => setTimeout(resolve, Math.min(100, left)));
    }
  } finally {
    noteSettled(Date.now() - began);
  }
}

/** `n` animation frames, and the task after the last, where a page paints at all (a tenth of a second at most each, where it does not). */
export async function frames(page, n = 2) {
  await page
    .evaluate(
      (count) =>
        new Promise((resolve) => {
          let left = count;
          const next = () => {
            if (left-- <= 0) return void setTimeout(resolve, 0);
            let once = false;
            const go = () => {
              if (once) return;
              once = true;
              next();
            };
            requestAnimationFrame(go);
            setTimeout(go, 100);
          };
          next();
        }),
      n,
    )
    .catch(() => {});
}
