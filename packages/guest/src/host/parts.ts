/*
 * A PART OF A VIEW THAT FAILS FALLS BACK ALONE (Roadmap f-view-part-fails-alone).
 *
 * A view's runtime hands on a part whose code threw, or took more than its
 * share of a push (`graview.part`), as an empty element marked
 * `data-part-failed` with why in `data-part-why`, and the mark this host
 * handed it in `data-part-mark`. After each batch the host draws its own
 * note in that element — "This part could not be drawn." — and takes the
 * note away once the part draws again; the rest of the view stays as it
 * was drawn. Why is said to the host (`onProblem`), once for each part and
 * way it failed, and for at most `PART_PROBLEMS_SAID` parts a mount.
 *
 * What the view writes is data: a failed mark without this mount's mark,
 * or named otherwise than a part may be, is not one, and nothing is drawn
 * or said for it. The note is the host's: kept here by the element it made,
 * never found by a selector, so nothing the view draws is taken for one.
 */
import { PART_NAME } from "../part.js";

/** The words a person reads where a part could not be drawn. */
export const PART_FALLBACK_WORDS = "This part could not be drawn.";
/** The most failed parts one mount says to the host. */
export const PART_PROBLEMS_SAID = 10;

const STYLE =
  "box-sizing:border-box;margin:0;padding:8px 12px;border:1px dashed var(--graview-line, currentColor);border-radius:8px;" +
  "font:inherit;font-size:0.8125rem;line-height:1.35;color:var(--graview-ink-muted, inherit);background:none";

export interface PartFallbacks {
  /** After each batch the view draws: a note in each part marked failed, none in a part that drew. */
  refresh(): void;
}

export interface PartFallbackOptions {
  /** The view, as the host's sentences name it. */
  readonly view: string;
  /** The mark this mount handed the view's runtime: only a failed part that carries it is one. */
  readonly mark: string;
  readonly onProblem?: (said: string) => void;
}

/** Why, as the runtime gave it: at most 300 characters, on one line, quoted. */
const quotedWhy = (why: string) => JSON.stringify(why.replace(/[\s\x00-\x1f\x7f]+/g, " ").slice(0, 300));

export function createPartFallbacks(shadow: ShadowRoot, options: PartFallbackOptions): PartFallbacks {
  const notes = new Map<Element, HTMLElement>();
  const told = new Set<string>();
  const failedHere = (part: Element) => part.hasAttribute("data-part-failed") && part.getAttribute("data-part-mark") === options.mark && PART_NAME.test(part.getAttribute("data-part") ?? "");
  return {
    refresh() {
      const root = shadow.querySelector("[data-graview-view-root]");
      for (const [part, note] of notes) {
        if (part.isConnected && failedHere(part) && note.parentNode === part) continue;
        note.remove();
        notes.delete(part);
      }
      if (!root) return;
      for (const part of Array.from(root.querySelectorAll("[data-part][data-part-failed]"))) {
        if (!failedHere(part)) continue;
        const name = part.getAttribute("data-part")!;
        const slow = part.getAttribute("data-part-failed") === "slow";
        const key = `${name} ${slow ? "slow" : "threw"}`;
        if (!told.has(key) && told.size < PART_PROBLEMS_SAID) {
          told.add(key);
          const why = part.getAttribute("data-part-why") ?? "";
          options.onProblem?.(`The part "${name}" of the view ${options.view} ${slow ? "took too long" : "threw"}, so a note is drawn in its place and the rest of the view is drawn${why ? `: ${quotedWhy(why)}` : "."}`);
        }
        if (notes.has(part)) continue;
        const note = shadow.ownerDocument!.createElement("p");
        note.setAttribute("data-graview-part-fallback", "");
        note.setAttribute("role", "note");
        note.setAttribute("style", STYLE);
        note.textContent = PART_FALLBACK_WORDS;
        part.appendChild(note);
        notes.set(part, note);
      }
    },
  };
}
