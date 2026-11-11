/*
 * A PART OF A VIEW THAT FAILS FALLS BACK ALONE (Roadmap f-view-part-fails-alone).
 *
 * A view's runtime hands on a part whose code threw, or took more than its
 * share of a push (`graview.part`), as an empty element marked
 * `data-part-failed` with why in `data-part-why`. After each batch the host
 * draws its own note in that element — "This part could not be drawn." — and
 * takes the note away once the part draws again; the rest of the view stays
 * as it was drawn. Why is said to the host (`onProblem`), once for each part
 * and reason, as the view's console was told it by the runtime.
 *
 * The note is the host's: kept here by the element it made, never found by
 * a selector, so nothing the view draws is taken for one and removed.
 */

/** The words a person reads where a part could not be drawn. */
export const PART_FALLBACK_WORDS = "This part could not be drawn.";

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
  readonly onProblem?: (said: string) => void;
}

export function createPartFallbacks(shadow: ShadowRoot, options: PartFallbackOptions): PartFallbacks {
  const notes = new Map<Element, HTMLElement>();
  const told = new Set<string>();
  return {
    refresh() {
      const root = shadow.querySelector("[data-graview-view-root]");
      for (const [part, note] of notes) {
        if (part.isConnected && part.hasAttribute("data-part-failed") && note.parentNode === part) continue;
        note.remove();
        notes.delete(part);
      }
      if (!root) return;
      for (const part of Array.from(root.querySelectorAll("[data-part][data-part-failed]"))) {
        const name = part.getAttribute("data-part") ?? "";
        const reason = part.getAttribute("data-part-failed") === "slow" ? "took too long" : "threw";
        const why = part.getAttribute("data-part-why") ?? "";
        const said = `The part "${name}" of the view ${options.view} ${reason}, so a note is drawn in its place and the rest of the view is drawn${why ? `: ${why}` : "."}`;
        if (!told.has(said) && told.size < 100) {
          told.add(said);
          options.onProblem?.(said);
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
