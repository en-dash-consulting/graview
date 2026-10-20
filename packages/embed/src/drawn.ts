import { partsArriving, placeDrawn, placeWatched } from "@graview/react/provider";
import { useLayoutEffect, useRef } from "react";
import type { EmbedWhere } from "./where.js";

/*
 * THE PAGE SAYS WHEN A PLACE HAS DRAWN AND SETTLED (FR-188).
 *
 * A host picturing a place — Graview Cloud's describe_place, headless —
 * waited on a guess: the opening frame gone, the network quiet, then 600
 * ms. The embed knows better. Once the place it is on has drawn — the face
 * here, every part drawn on it arrived (or said it did not), the fonts and
 * images loaded, every worker view drawn (or failed, its plain face drawn
 * in its place), every frame guest drawn (or silent past its time) — and nothing in it has moved for a moment, its root says
 * `data-graview-drawn`, its value the place's path, and the host is told
 * `onDrawn(place)`. A move to another place takes it off in the same
 * commit, and the new place says it again once it settles.
 */

/** The attribute the embed's root wears while the place it is on has drawn and settled. */
export const DRAWN_ATTRIBUTE = "data-graview-drawn";

/** How long nothing may move before a place is said to have settled. */
const QUIET_MS = 200;
/** How often a place still settling is looked at. */
const EVERY_MS = 50;
/** A place that never stops moving — a clock, a view that draws forever — is said drawn after this long all the same. */
const MOST_MS = 10_000;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Every image the place draws, the worker views' own among them (their shadow roots are open). */
function images(root: HTMLElement): HTMLImageElement[] {
  const all = [...root.querySelectorAll("img")];
  for (const view of root.querySelectorAll("[data-worker-view]")) if (view.shadowRoot) all.push(...view.shadowRoot.querySelectorAll("img"));
  return all;
}

/** Whether what the place draws is all here: the face, its parts, its fonts, its images and its views. */
function here(root: HTMLElement): boolean {
  const fonts = (root.ownerDocument as Document & { fonts?: { status?: string } }).fonts;
  if (fonts?.status === "loading") return false;
  if (partsArriving() > 0) return false;
  // The face on its way, or a part of it saying it is busy: a frame guest among them, until it has drawn or its time is up.
  if (root.querySelector('[aria-busy="true"]')) return false;
  // An image off screen and lazy is not waited for: it never loads until it is scrolled to.
  if (images(root).some((image) => !image.complete && image.loading !== "lazy")) return false;
  // Each worker view drawn, or failed with its plain face: the region inside its place says which.
  for (const place of root.querySelectorAll("[data-worker-view-place]")) {
    if (!place.querySelector("[data-worker-view][data-worker-view-drawn], [data-worker-view][data-worker-view-failed]")) return false;
  }
  return true;
}

/** What a move would change: the sizes of the root, the face and each worker view, whose own drawing the observer cannot see. */
function measure(root: HTMLElement): string {
  const content = root.querySelector("[data-embed-content]");
  const views = [...root.querySelectorAll<HTMLElement>("[data-worker-view]")].map((view) => `${view.offsetWidth}x${view.offsetHeight}`);
  return `${root.scrollWidth}x${root.scrollHeight}|${content ? `${content.scrollWidth}x${content.scrollHeight}` : ""}|${views.join(",")}`;
}

/**
 * Watch a place settle: takes `data-graview-drawn` off the root at once,
 * and puts it back — `path` its value — once the place has drawn and
 * nothing has moved for a moment, then calls `settled`. The answer stops
 * watching; a place left before it settled is never said drawn.
 */
export function watchDrawn(root: HTMLElement, path: string, settled: () => void): () => void {
  root.removeAttribute(DRAWN_ATTRIBUTE);
  const window = root.ownerDocument.defaultView;
  if (!window) return () => undefined;
  const started = now();
  let moved = started;
  let last = measure(root);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = typeof MutationObserver === "undefined" ? undefined : new MutationObserver((records) => {
    if (records.some((record) => !(record.target === root && record.attributeName === DRAWN_ATTRIBUTE))) moved = now();
  });
  observer?.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
  const stop = () => {
    stopped = true;
    observer?.disconnect();
    if (timer !== undefined) clearTimeout(timer);
  };
  // Said after the browser has painted what settled, where it paints at all.
  // A tab out of sight paints nothing, so a frame that never comes is not waited for past a tenth of a second.
  const afterPaint = (then: () => void) => {
    let once = false;
    const go = () => {
      if (once) return;
      once = true;
      then();
    };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(() => setTimeout(go, 0));
    setTimeout(go, 100);
  };
  const look = () => {
    if (stopped) return;
    const size = measure(root);
    if (size !== last) {
      last = size;
      moved = now();
    }
    const at = now();
    if ((here(root) && at - moved >= QUIET_MS) || at - started >= MOST_MS) {
      afterPaint(() => {
        if (stopped) return;
        stop();
        root.setAttribute(DRAWN_ATTRIBUTE, path);
        placeDrawn();
        settled();
      });
      return;
    }
    timer = setTimeout(look, EVERY_MS);
  };
  timer = setTimeout(look, EVERY_MS);
  return stop;
}

/**
 * SAYS WHEN THE PLACE HAS DRAWN AND SETTLED, on the root and to the host:
 * watched again from nothing each time `key` moves — another page, another
 * stop on the scene, another face, another draft — so the attribute comes
 * off in the commit that moved and goes back on once the new place
 * settles. The whole embed and the pages alone say it alike.
 */
export function useDrawnSignal(rootRef: { readonly current: HTMLElement | null }, key: string, place: EmbedWhere, onDrawn: ((place: EmbedWhere) => void) | undefined): void {
  // What is fetched early waits for the first draw (FR-194): said as the embed first renders, before any part's effect runs.
  placeWatched();
  const latest = useRef({ place, onDrawn });
  latest.current = { place, onDrawn };
  useLayoutEffect(() => {
    const watch = (root: HTMLElement) => watchDrawn(root, latest.current.place.path, () => latest.current.onDrawn?.(latest.current.place));
    if (rootRef.current) return watch(rootRef.current);
    // First drawn below the root, its ref is set after this effect runs: watched once the commit is done (there is nothing to take off yet).
    let stop: (() => void) | undefined;
    let gone = false;
    queueMicrotask(() => {
      if (!gone && rootRef.current) stop = watch(rootRef.current);
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, [key, rootRef]);
}
