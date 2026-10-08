/**
 * NOTICES FLOAT, AND NEVER MOVE THE PAGE (FR-133).
 *
 * Nick, on a desk, with an app open in place: the top "is … broken when
 * there's a notification in the top right." The way back ("Take back “Mark
 * done: Could Val lead…”") was a sticky box in the face's flow, so on an
 * embed it opened a band of its own under the strip, pushed every heading
 * and row down, and cut its own sentence off with an ellipsis.
 *
 * A notice is drawn OVER the picture it is about, never in its flow: at the
 * foot's middle on a phone, above the safe area, and at the foot's left on
 * a desk. It does not cover what already stands at that foot — a control
 * marked `data-graview-foot` (the pages' Ask, the way back, the scene's
 * zoom), the seat — it stands above a short one and beside a tall one, and
 * several stand one above the other.
 */

/** What stands at the foot of a picture, that a notice placed there must not cover. */
export const FOOT_OBSTACLES = "[data-graview-foot], [data-testid='companion']";

/** Said on `window` when something marked `data-graview-foot` appears, moves or goes, so what stands above it places itself again. */
export const FOOT_MOVED = "graview:foot-moved";

/** A picture narrower than this has its notices at the middle of its foot; a wider one, at its left. */
export const NARROW_PICTURE = 640;

/** The gap between a notice and the edge it stands by, or what it stands above. */
const GAP = 16;

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const viewport = () => ({ width: document.documentElement.clientWidth || innerWidth, height: innerHeight });

/**
 * Places a fixed `element` at the foot of `anchor`'s box as it shows on the
 * screen (the viewport when there is none), clear of what stands there.
 */
export function placeAtTheFoot(element: HTMLElement, anchor: HTMLElement | null): void {
  const view = viewport();
  const box: Box = anchor?.getBoundingClientRect() ?? { left: 0, top: 0, right: view.width, bottom: view.height };
  const left = Math.max(0, box.left);
  const right = Math.min(view.width, box.right);
  const top = Math.max(0, box.top);
  const foot = Math.min(view.height, box.bottom);
  const span = Math.max(0, right - left);
  const narrow = span < NARROW_PICTURE;
  element.style.translate = "none";
  element.style.top = "auto";
  element.style.right = "auto";
  element.style.maxWidth = `${Math.max(0, Math.min(560, span - 2 * GAP))}px`;
  const size = element.getBoundingClientRect();
  /* Not drawn just now (put away, or not laid out yet): it keeps where it was, so it comes back there rather than jumping when it shows. */
  if (size.width === 0 && size.height === 0 && element.style.left !== "") return;
  const width = size.width;
  const height = size.height;
  /* An embed scrolled out of the window keeps its notices: they are not drawn over the host's page meanwhile (still said aloud). */
  element.style.visibility = anchor && foot - top < height + GAP ? "hidden" : "";
  let x = narrow ? left + (span - width) / 2 : left + GAP;
  let lift = view.height - foot + GAP;
  const standing = [...document.querySelectorAll<HTMLElement>(FOOT_OBSTACLES)]
    .filter((one) => one !== element && !element.contains(one) && !one.contains(element))
    .map((one) => one.getBoundingClientRect())
    .filter((one) => one.width > 0 && one.height > 0 && one.right > left && one.left < right && one.bottom > top && one.top < foot);
  const tall = (one: Box) => one.bottom - one.top > (foot - top) * 0.4;
  /* Beside a tall one at the left of a desk's picture — the seat docked there — rather than over it. */
  if (!narrow) for (const one of standing) if (tall(one) && one.left <= x + 1 && one.right + GAP > x && one.right + GAP + width <= right) x = one.right + GAP;
  /* Above a short one it would stand on, and again above whatever that lifts it onto. */
  const short = standing.filter((one) => !tall(one));
  for (let moved = true, rounds = 0; moved && rounds < short.length + 1; rounds++) {
    moved = false;
    for (const one of short) {
      const bottomEdge = view.height - lift;
      if (one.right > x && one.left < x + width && one.bottom > bottomEdge - height && one.top < bottomEdge) {
        lift = view.height - one.top + GAP / 2;
        moved = true;
      }
    }
  }
  element.style.left = `${Math.round(x)}px`;
  element.style.bottom = `calc(${Math.round(lift)}px + env(safe-area-inset-bottom, 0px))`;
}

/** Places a fixed `element` at the top of `anchor`'s box, at its middle: a banner, over the picture, directly under the bar above it. */
export function placeAtTheTop(element: HTMLElement, anchor: HTMLElement | null): void {
  const view = viewport();
  const box: Box = anchor?.getBoundingClientRect() ?? { left: 0, top: 0, right: view.width, bottom: view.height };
  const left = Math.max(0, box.left);
  const right = Math.min(view.width, box.right);
  const span = Math.max(0, right - left);
  element.style.translate = "none";
  element.style.bottom = "auto";
  element.style.right = "auto";
  element.style.maxWidth = `${Math.max(0, Math.min(560, span - 2 * GAP))}px`;
  const width = element.getBoundingClientRect().width;
  element.style.left = `${Math.round(left + (span - width) / 2)}px`;
  element.style.top = `${Math.round(Math.max(GAP / 2, box.top + GAP / 2))}px`;
}
