import { drawnSince, type Owed } from "./connectors.js";

/**
 * A VIEW THAT DRAWS LATE STILL GETS ITS LINES.
 *
 * The lines are measured when a frame lands, and again on a scroll, a
 * resize, a new selection or a caption that moved. A view whose picture is
 * fetched as it is first drawn (FR-57) draws its members in a commit of its
 * own, after the frame landed and at the same size, and none of those come:
 * on a CPU four times slower the week's lens arrived a few milliseconds
 * after the last measurement, and its nine entries stood with no line to
 * the lists holding them until something else moved the page. Nothing was
 * shed; the measurement was simply older than the drawing.
 *
 * So the members a measurement looked for and found no drawing of are
 * watched for (`Owed`), inside their own views only, and `again` is asked
 * once one of them is drawn — checked once on arming too, for a view that
 * drew between the measurement and the watch. The check is the
 * measurement's own test, so a member drawn but out of sight (scrolled past
 * its panel's edge) asks nothing: the scroll that brings it back already
 * does. Nothing owed, nothing watched.
 */
export function watchDrawnLate(stage: HTMLElement, owed: Owed, again: () => void): () => void {
  if (owed.size === 0 || typeof MutationObserver === "undefined") return () => {};
  let queued = 0;
  const check = () => {
    queued = 0;
    if (drawnSince(stage, owed)) again();
  };
  const soon = () => {
    if (queued === 0) queued = requestAnimationFrame(check);
  };
  /* A change inside a view that is still owed a member; the rest of the stage is not this watch's business. */
  const inOwedView = ({ target }: MutationRecord) => {
    for (let el = target instanceof Element ? target : target.parentElement; el && el !== stage; el = el.parentElement) {
      if (owed.has(el.getAttribute("data-graview-view") ?? "")) return true;
    }
    return false;
  };
  const observer = new MutationObserver((records) => {
    if (records.some(inOwedView)) soon();
  });
  observer.observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-graview-pick", "data-graview-slot", "data-graview-offstage"] });
  soon();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(queued);
  };
}
