import type { GuestRecordBox } from "./protocol.js";

/** The most a frame says at once: the host keeps no more than this either. */
const MOST = 200;

/**
 * WHERE A FRAME'S RECORDS ARE, SAID TO ITS HOST (Graview HQ
 * feature:f-one-face-lines-from-frame-views): every element the frame
 * marks with `data-record` — the mark a link to a record already is — in
 * the frame's own CSS pixels, cut to what of it is in sight (a row
 * scrolled out of its list says nothing), said again whenever one moves (a
 * scroll, a resize, a redraw, a picture that arrived) and only when what
 * it would say has changed: a frame at rest sends nothing, and a frame
 * scrolled says it once an animation frame at most, never faster than the
 * host takes it. The host keeps what is inside the frame and names a
 * record the seat may see, to draw a line from it to that record.
 * Returns the stop.
 */
export function reportRecords(at: Window & typeof globalThis, send: (boxes: readonly GuestRecordBox[]) => void): () => void {
  const document = at.document;
  let said = "";
  let frame = 0;
  let last = 0;
  const measure = (now: number) => {
    frame = 0;
    // A display faster than sixty a second: the rest of this one waits for the next frame.
    if (now - last < 16) return schedule();
    const boxes: GuestRecordBox[] = [];
    const clips = new Map<Element, DOMRect | null>();
    const round = (value: number) => Math.round(value * 10) / 10;
    for (const element of document.querySelectorAll("[data-record]")) {
      if (boxes.length >= MOST) break;
      const id = element.getAttribute("data-record");
      let { left, top, right, bottom } = element.getBoundingClientRect();
      // Cut by every box above it that clips what it holds.
      for (let up = element.parentElement; up; up = up.parentElement) {
        let clip = clips.get(up);
        if (clip === undefined) {
          const style = at.getComputedStyle(up);
          clips.set(up, (clip = style.overflowX !== "visible" || style.overflowY !== "visible" ? up.getBoundingClientRect() : null));
        }
        if (!clip) continue;
        left = Math.max(left, clip.left);
        top = Math.max(top, clip.top);
        right = Math.min(right, clip.right);
        bottom = Math.min(bottom, clip.bottom);
      }
      left = Math.max(left, 0);
      top = Math.max(top, 0);
      right = Math.min(right, at.innerWidth);
      bottom = Math.min(bottom, at.innerHeight);
      if (id && right - left >= 1 && bottom - top >= 1) boxes.push({ id, x: round(left), y: round(top), width: round(right - left), height: round(bottom - top) });
    }
    const text = JSON.stringify(boxes);
    if (text === said) return;
    said = text;
    last = now;
    send(boxes);
  };
  const schedule = () => {
    frame ||= at.requestAnimationFrame(measure);
  };
  const changes = new at.MutationObserver(schedule);
  changes.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  const sizes = new at.ResizeObserver(schedule);
  sizes.observe(document.documentElement);
  const events = ["scroll", "resize", "load"];
  for (const type of events) at.addEventListener(type, schedule, true);
  schedule();
  return () => {
    for (const type of events) at.removeEventListener(type, schedule, true);
    changes.disconnect();
    sizes.disconnect();
    at.cancelAnimationFrame(frame);
  };
}
