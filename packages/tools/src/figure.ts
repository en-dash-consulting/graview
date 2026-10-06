import { figureFaults, FIGURE_NAMES, FIGURES } from "@graview/core/figures";
import type { Completion } from "./intelligence.js";

/**
 * AN AGENT DRAWS A KIND'S FIGURE — in the house style, or not at all.
 *
 * The declaration is a graph and a brand is a declaration, so the drawing
 * of a kind is a thing an agent can propose like any other change. What it
 * must not be is a free hand: twelve figures drawn without a shared
 * discipline read as twelve clip-art imports rather than as one city, and
 * the isometric city's feel is the entire reason a figure is worth having.
 *
 * So the prompt is the style guide, and the ANSWER IS JUDGED before it is
 * offered: `figureFaults` is the same function `graview check` runs, so a
 * drawing that would fail the build never reaches a person as a proposal.
 * Where a model gives nothing usable, the nearest shipped figure is a
 * better answer than a bad drawing, and saying which is better than both.
 */

export interface DrawnFigure {
  readonly kind: string;
  /** The SVG, or the name of a shipped figure. */
  readonly figure: string;
  /** Where it came from, so a person keeping it knows what they are keeping. */
  readonly from: "model" | "shipped";
  /** What the model produced and why it was not used, when it was not. */
  readonly refused?: readonly string[];
}

export const FIGURE_STYLE = `You are drawing one figure for a kind of thing in a software application.

The house style, and every rule matters:
- ONE SVG element, with one viewBox of "0 0 24 24" and nothing outside it.
- Line art only: stroke="currentColor", stroke-width="1.4", fill="none",
  stroke-linecap="round", stroke-linejoin="round". Never a literal colour,
  never a fill, never a gradient, never text.
- Drawn from the same three-quarter isometric angle as an architect's
  blueprint: the thing seen from slightly above and to one side, with the
  edges that would be hidden left out rather than dashed.
- It is a drawing of the THING, not an emblem for it. A vehicle is a body
  on wheels; a person is a head and shoulders; a plot is ground with an
  edge. Never a badge, a rounded-square icon, a letter, or an abstract mark.
- It must read at twenty pixels: at most about eight paths, nothing thinner
  than the stroke width, no detail smaller than a fortieth of the box.

Answer with the SVG and nothing else — no prose, no code fence.`;

/**
 * Asks a model for a figure and judges what comes back.
 *
 * `nearest` is the honest fallback: a kind called "vehicle" gets the
 * shipped vehicle rather than a drawing that fails the checker, and the
 * result says which happened so a person is never shown a machine's work
 * and told it was a choice.
 */
export async function drawFigure(
  kind: string,
  description: string | undefined,
  complete: Completion,
): Promise<DrawnFigure> {
  const asked = `${FIGURE_STYLE}

The kind is called "${kind}".${description ? `\nIt is described as: ${description}` : ""}`;
  let answer = "";
  try {
    answer = await complete(asked);
  } catch (error) {
    return {
      kind,
      figure: nearestFigure(kind),
      from: "shipped",
      refused: [error instanceof Error ? error.message : String(error)],
    };
  }
  const svg = onlyTheSvg(answer);
  if (svg) {
    const faults = figureFaults(svg);
    if (faults.length === 0) return { kind, figure: svg, from: "model" };
    return { kind, figure: nearestFigure(kind), from: "shipped", refused: faults };
  }
  return {
    kind,
    figure: nearestFigure(kind),
    from: "shipped",
    refused: ["the answer contained no <svg> element."],
  };
}

/**
 * The SVG out of whatever a model wrapped it in.
 *
 * Models fence code, apologise first and explain afterwards; none of that
 * is a reason to refuse a good drawing, and none of it is something to
 * store in a declaration.
 */
export function onlyTheSvg(answer: string): string | undefined {
  const at = answer.indexOf("<svg");
  const end = answer.lastIndexOf("</svg>");
  if (at === -1 || end === -1 || end < at) return undefined;
  return answer.slice(at, end + "</svg>".length).trim();
}

/**
 * The shipped figure whose name is closest to a kind's.
 *
 * By name, and only by name: guessing that a "cleat" is a "box" because
 * both are objects would be the framework having an opinion about a domain
 * it has never met. An exact name, a name the kind contains, or nothing —
 * and "nothing" is the `note`, which is honest about being a placeholder.
 */
export function nearestFigure(kind: string): string {
  const said = kind.toLowerCase();
  if (FIGURES[said]) return said;
  const held = FIGURE_NAMES.find((name) => said.includes(name) || name.includes(said));
  return held ?? "note";
}
