import { holdRecordBoxes, judgeRecordBoxes, judgeRecordIds, MOST_RECORD_BOXES, recordBoxesMoved, type RecordBox } from "@graview/core/record-boxes";

/** A box in the window's pixels. */
interface Seen {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ViewRecords {
  /** What the view drew may have moved its records: read them again when next asked, and say so if which it shows changed. */
  moved(): void;
  dispose(): void;
}

/**
 * WHERE A WORKER VIEW'S RECORDS ARE (Graview HQ
 * feature:f-one-face-lines-from-frame-views): each element it drew marked
 * with `data-record`, what of it is in sight inside what clips it, in the
 * region's own pixels. Measured only once something in the view has moved
 * since — what it drew, a scroll inside it, its size, a picture arriving —
 * and otherwise answered from what was measured: a page scrolled or moved
 * a level moves the region, and the region's pixels with it, so a line to
 * a record is on it every frame without measuring it again.
 */
export function createViewRecords(region: HTMLElement, root: ShadowRoot, mayName: (id: string) => boolean): ViewRecords {
  const window = region.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  let measured: { boxes: RecordBox[]; shows: string[] } | undefined;
  let showsSaid = "";
  const measure = () => {
    const boxes: RecordBox[] = [];
    const shows: string[] = [];
    if (!window) return { boxes, shows };
    const marked = root.querySelectorAll("[data-record]");
    if (marked.length === 0) return { boxes, shows };
    const box = region.getBoundingClientRect();
    /* The page may be scaled as it moves a level: the region's own pixels are its layout's. */
    const scale = region.offsetWidth > 0 && box.width > 0 ? box.width / region.offsetWidth : 1;
    /*
     * What every box above an element leaves in sight of it, worked out once
     * a measure for each box above — its own clip, if it clips what it holds,
     * cut by what is above it — so each record costs its own box and no
     * more however deep it is drawn. `null`: nothing above clips.
     */
    const kept = new Map<Element, Seen | null | "none">();
    const keptBy = (element: Element | null): Seen | null | "none" => {
      if (!element) return null;
      const known = kept.get(element);
      if (known !== undefined) return known;
      const above = keptBy(element.parentElement);
      let mine: Seen | null | "none" = above;
      if (above !== "none") {
        const style = window.getComputedStyle(element);
        if (style.overflowX !== "visible" || style.overflowY !== "visible") {
          const r = element.getBoundingClientRect();
          const cut = above ? { left: Math.max(r.left, above.left), top: Math.max(r.top, above.top), right: Math.min(r.right, above.right), bottom: Math.min(r.bottom, above.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          mine = cut.right - cut.left < 1 || cut.bottom - cut.top < 1 ? "none" : cut;
        }
      }
      kept.set(element, mine);
      return mine;
    };
    const limit = Math.min(marked.length, MOST_RECORD_BOXES * 2);
    for (let at = 0; at < limit; at++) {
      const one = marked[at]!;
      const id = one.getAttribute("data-record");
      if (!id) continue;
      shows.push(id);
      const clip = keptBy(one.parentElement);
      if (clip === "none") continue;
      const r = one.getBoundingClientRect();
      const seen: Seen = clip ? { left: Math.max(r.left, clip.left), top: Math.max(r.top, clip.top), right: Math.min(r.right, clip.right), bottom: Math.min(r.bottom, clip.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      if (seen.right - seen.left >= 1 && seen.bottom - seen.top >= 1) boxes.push({ id, x: (seen.left - box.left) / scale, y: (seen.top - box.top) / scale, width: (seen.right - seen.left) / scale, height: (seen.bottom - seen.top) / scale });
    }
    return { boxes, shows };
  };
  /*
   * WHILE ANYTHING IN IT MOVES OF ITSELF — a transition, an animation, one
   * that never ends — it is measured again every frame it is read in, and
   * no more than once a frame: the frame's time, the same for every read in
   * it, says whether this one was measured already.
   */
  let measuredAt: number | null | undefined;
  const frameTime = () => (region.ownerDocument.timeline?.currentTime ?? null) as number | null;
  /* Only what moves a record counts: an animation on a marked element or on what holds one, never a spinner beside them. */
  const moving = () => {
    const running = root.getAnimations?.() ?? [];
    for (const animation of running) {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (target && (target.hasAttribute("data-record") || target.querySelector("[data-record]") !== null)) return true;
    }
    return false;
  };
  const now = () => {
    if (measured && moving()) {
      const time = frameTime();
      if (time === null || time !== measuredAt) measured = undefined;
    }
    if (!measured) {
      measured = measure();
      measuredAt = frameTime();
    }
    return measured;
  };
  const dirty = () => {
    measured = undefined;
  };
  holdRecordBoxes(region, {
    boxes: () => judgeRecordBoxes(now().boxes, { width: region.offsetWidth, height: region.offsetHeight, sees: mayName }),
    shows: () => judgeRecordIds(now().shows, mayName),
  });
  const changes = window?.MutationObserver ? new window.MutationObserver(dirty) : undefined;
  changes?.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
  // The app's look changed (its scheme, its brand): what the view drew is laid out again inside a region of the same size.
  changes?.observe(region.ownerDocument.documentElement, { attributes: true });
  const sizes = window?.ResizeObserver ? new window.ResizeObserver(dirty) : undefined;
  sizes?.observe(region);
  // What moves its records without a change to what it drew: a scroll in it, a picture, a transition or an animation starting or ending, a pointer over it and the keyboard in it (:hover, :focus-within).
  const events = ["scroll", "load", "transitionrun", "transitionend", "transitioncancel", "animationstart", "animationend", "animationcancel", "pointerover", "pointerout", "focusin", "focusout"];
  for (const type of events) root.addEventListener(type, dirty, true);
  /* A face arriving lays words out again without anything else moving. */
  const fonts = region.ownerDocument.fonts as FontFaceSet | undefined;
  fonts?.addEventListener?.("loadingdone", dirty);
  return {
    moved() {
      dirty();
      /* Which records it shows, said again only when that changed: a list beside it is read again. */
      const marked = root.querySelectorAll("[data-record]");
      const said = Array.from({ length: Math.min(marked.length, MOST_RECORD_BOXES * 2) }, (_, at) => marked[at]!.getAttribute("data-record")).join(" ");
      if (said === showsSaid) return;
      showsSaid = said;
      recordBoxesMoved(region);
    },
    dispose() {
      changes?.disconnect();
      sizes?.disconnect();
      for (const type of events) root.removeEventListener(type, dirty, true);
      fonts?.removeEventListener?.("loadingdone", dirty);
      holdRecordBoxes(region, undefined);
    },
  };
}
