import { aggregateId, isAggregateId, kindCardId, kindOfCard, kindsOfAggregate } from "@graview/layout/view";
import { mixStyles, styleFor } from "@graview/render";
import type { Manner } from "./activity.js";
import type { DrawnBox } from "./context.js";
import type { SceneNode } from "./scene-node.js";

/** How each manner reads in words, for the tooltip and for assistive tech. */
export const WHO: Record<Manner, string> = {
  directed: "You",
  autonomous: "An agent",
  "co-edited": "You and an agent",
  rule: "A rule",
};

/**
 * A selection, mapped onto what is actually DRAWN.
 *
 * The selection holds real node ids. A connector holds the ids of whatever is
 * on screen — which above the stack is always a kind card, because
 * `connectorsFor` resolves every endpoint through the nearest group that
 * contains it. Comparing the two directly matched nothing, so any ordinary
 * selection carried into the Graview receded every line at once and blanked
 * the picture you rose to look at.
 *
 * Exported because it is the whole of that bug, and a pure function is the
 * only way to hold it still.
 */
export function onScreen(
  nodes: readonly SceneNode[],
  selection: readonly string[],
): ReadonlySet<string> {
  const drawn = new Set(nodes.map((node) => node.id));
  const chosen = new Set<string>();
  for (const id of selection) {
    if (drawn.has(id)) {
      chosen.add(id);
      continue;
    }
    // Not drawn as itself: the card standing for it is what the eye can see,
    // and what a connector to it actually points at.
    const container = nodes.find((node) => node.aggregate?.memberIds.includes(id));
    if (container) chosen.add(container.id);
  }
  return chosen;
}

/**
 * HOW STRONGLY A LINE IS DRAWN AT ALTITUDE.
 *
 * Pulled out because it is a rule rather than a detail, and because the
 * thing it gets wrong is invisible in a screenshot until you know to look:
 * up here a selection is resolved to the CARD that stands for it, which is
 * right for asking which cards a line touches and wrong for asking which
 * LINE. With a district opened, every line into it touches that card — so
 * choosing one name lit every name's lines, and clicking a member changed
 * nothing about the picture.
 *
 * When the selection names something the strands actually mention, that
 * finer answer wins. When it names none of them — a district chosen as a
 * district — the card rule stands.
 */
export function altitudeOpacity(state: {
  /** A relation kind is being stressed (hovered in the key). */
  readonly emphasized: boolean;
  /** This line is of that kind, or is itself chosen. */
  readonly stressed: boolean;
  /** Some strand on screen is touched by the chosen members. */
  readonly anyChosen: boolean;
  /** This strand is one of them. */
  readonly mine: boolean;
  /** This line touches the selection once resolved to cards. */
  readonly touches: boolean;
  /**
   * How many lines this one relation is drawing at once.
   *
   * A bundle is unpicked so each line can START at the thing it is about —
   * the week draws every shift as its own span, and a line leaving the span
   * says WHICH shifts are covered, which is worth having. But seven of them
   * arriving at one closed district is a starburst across the whole picture
   * at the same weight as a single fact. So a relation drawing many lines
   * draws each of them quieter: the shape stays legible, and choosing one
   * still brings it fully forward.
   */
  readonly siblings?: number;
}): number {
  if (state.emphasized) return state.stressed ? 0.95 : 0.08;
  if (state.anyChosen) return state.mine ? 0.9 : 0.12;
  if (!state.touches) return 0.12;
  return Math.max(0.34, 0.9 - 0.09 * Math.max(0, (state.siblings ?? 1) - 1));
}

/**
 * How strongly a line is drawn INSIDE THE STACK.
 *
 * The twin of `altitudeOpacity`, and for a long time the reason the two
 * altitudes disagreed: up there an untouched line recedes to 0.12 the
 * moment anything is chosen, while down here the rule was a single
 * expression with no name and no recede in it. Every unlit line kept its
 * resting weight whatever was selected, so choosing one thing lit two lines
 * and left fifteen others at full strength across the same picture — the
 * two you asked for were the quietest thing on screen.
 *
 * The kit owns both numbers: `rest` is the crowd's weight while nothing is
 * lit, `dim` what the crowd keeps once something is. A line's own declared
 * opacity multiplies through, so a relation a brand made faint stays
 * fainter than its neighbors at every step.
 */
export function stackOpacity(state: {
  /** This line IS the chosen edge. */
  readonly edgeChosen: boolean;
  /** This line touches the selection. */
  readonly lit: boolean;
  /** Something on screen is lit — a selection, or a relation kind stressed. */
  readonly anyLit: boolean;
  /** The line's own opacity, from the kit. */
  readonly own: number;
  readonly kit: { readonly rest: number; readonly dim: number };
}): number {
  if (state.edgeChosen) return 0.9;
  if (state.lit) return 0.78;
  return state.own * (state.anyLit ? state.kit.dim : state.kit.rest);
}

/** A node's box as DRAWN, after its plane's scale — anchored at its top-left. */
export function drawnBox(
  node: SceneNode | undefined,
  scheme: "light" | "dark",
): { x: number; y: number; width: number; height: number } | null {
  if (!node) return null;
  const lower = Math.max(0, Math.min(2, Math.floor(node.plane))) as 0 | 1 | 2;
  const upper = Math.max(0, Math.min(2, Math.ceil(node.plane))) as 0 | 1 | 2;
  const { scale } =
    lower === upper
      ? styleFor(lower, scheme)
      : mixStyles(styleFor(lower, scheme), styleFor(upper, scheme), node.plane - lower);
  return { x: node.x, y: node.y, width: node.width * scale, height: node.height * scale };
}

/**
 * The box a person can SEE for a laid-out node, measured from the DOM.
 *
 * A host is a band slot with the view somewhere inside it — the focus band
 * pokes above its panel, a shrunk view centers in a taller natural box, and
 * from altitude the visible thing is the iso block at the bottom of the
 * card. Lines anchored to host borders ended in open air on every one of
 * those; lines anchored to the measured inner box end on the thing itself.
 * Null when there is no DOM to measure (tests, SSR) — callers fall back to
 * the layout box.
 */
/**
 * WHAT A PERSON CAN SEE OF AN ELEMENT, in stage coordinates, or null.
 *
 * A line is anchored on a measured box, and a box has a rectangle whether
 * or not anything of it is on screen: a chip scrolled off the end of a
 * roster, a row under a panel's fold, a name behind the fade at the foot of
 * a card. Anchoring there drew lines that began in the air at the edge of
 * a card and read as the picture being wrong about the graph. The
 * rectangle is cut down by every ancestor that clips — scrollers and
 * overflow-hidden boxes alike — up to the stage, and nothing is left when
 * nothing shows.
 */
export function visibleRect(
  el: Element,
  stageEl: HTMLElement,
): { x: number; y: number; width: number; height: number } | null {
  if (typeof getComputedStyle === "undefined") return null;
  if (getComputedStyle(el).visibility === "hidden") return null;
  let left = -Infinity;
  let top = -Infinity;
  let right = Infinity;
  let bottom = Infinity;
  const own = el.getBoundingClientRect();
  left = Math.max(left, own.left);
  top = Math.max(top, own.top);
  right = Math.min(right, own.right);
  bottom = Math.min(bottom, own.bottom);
  let up: Element | null = el.parentElement;
  while (up && up !== stageEl) {
    const style = getComputedStyle(up);
    if (style.overflowX !== "visible" || style.overflowY !== "visible") {
      const box = up.getBoundingClientRect();
      if (style.overflowX !== "visible") {
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
      }
      if (style.overflowY !== "visible") {
        top = Math.max(top, box.top);
        bottom = Math.min(bottom, box.bottom);
      }
    }
    up = up.parentElement;
  }
  if (right - left <= 2 || bottom - top <= 2) return null;
  const stage = stageEl.getBoundingClientRect();
  return { x: left - stage.left, y: top - stage.top, width: right - left, height: bottom - top };
}

export function measureVisible(
  stageEl: HTMLElement | null,
  id: string,
  preferBlock: boolean,
): { x: number; y: number; width: number; height: number } | null {
  if (!stageEl || typeof document === "undefined") return null;
  const host = stageEl.querySelector(`[data-graview-view="${CSS.escape(id)}"]`);
  if (!host) return null;
  const inner =
    (preferBlock ? host.querySelector(".graview-kind-block") : null) ??
    host.querySelector('[data-graview-primitive="panel"], .graview-kind-face, .graview-kind-card') ??
    host;
  // Cut down to what shows: a host half under a scroller's fold anchors a
  // line where its visible half is, and one wholly under it anchors none.
  return visibleRect(inner, stageEl);
}

/**
 * WHERE SOMETHING IS, in the frame being drawn.
 *
 * `id` may be a node, a kind card (`kind:<kind>`), a group
 * (`aggregate:<kind>`) or a Place slug. Each is resolved to the node in
 * the frame that stands for it — a kind and its group are one card at
 * altitude and one group in the stack, so either name finds whichever is
 * drawn — and a node not drawn itself resolves to the nearest container
 * that holds it, exactly as a connector's endpoint does. The box is what
 * a person can see when there is a DOM to measure, and the drawn box
 * otherwise, so the answer is the same one the ties land on.
 */
export function whereIsIn(
  frame: { readonly nodes: readonly SceneNode[] },
  stageEl: HTMLElement | null,
  scheme: "light" | "dark",
  views: { places(): readonly { readonly kind: string; readonly as: string }[] },
  id: string,
): DrawnBox | null {
  const find = (wanted: string) => frame.nodes.find((node) => node.id === wanted);
  /*
   * THE AUDIENCE STRIP in front of a drive-in's screen: the ground between
   * the screen's foot and the plot's near half, where figures will stand.
   * Nothing draws there yet; the address is what later tasks stand on.
   */
  if (id.startsWith("screen:")) {
    const kind = id.slice("screen:".length);
    const screen = frame.nodes.find((node) => node.screenOf === kind);
    if (!screen) return null;
    const box = measureVisible(stageEl, screen.id, false) ?? drawnBox(screen, scheme);
    if (!box) return null;
    const card = frame.nodes.find((node) => node.id === kindCardId(kind));
    const plate = card ? drawnBox(card, scheme) : null;
    const foot = box.y + box.height;
    const depth = plate ? Math.max(20, plate.y - foot) : Math.max(20, box.height * 0.18);
    return { x: box.x, y: foot, width: box.width, height: depth };
  }
  let target = find(id);
  const kind = kindOfCard(id);
  if (!target && kind !== null) target = find(aggregateId(kind));
  if (!target && isAggregateId(id)) {
    const [first] = kindsOfAggregate(id);
    if (first) target = find(kindCardId(first));
  }
  if (!target) {
    const place = views.places().find((candidate) => candidate.as === id);
    if (place) target = find(aggregateId(place.kind)) ?? find(kindCardId(place.kind));
  }
  if (!target) {
    target = [...frame.nodes]
      .filter((node) => node.aggregate?.memberIds.includes(id))
      .sort((a, b) => a.plane - b.plane)[0];
  }
  if (!target) return null;
  /*
   * The iso BLOCK is the district's visible thing only from altitude; in
   * the stack it is invisible and hangs a few pixels below the card, and
   * a figure docked on it stood past the bottom of the ground.
   */
  const aloft = (frame as { readonly city?: unknown }).city !== undefined;
  return (
    measureVisible(stageEl, target.id, aloft && target.aggregate !== undefined && Math.round(target.plane) === 2) ??
    drawnBox(target, scheme)
  );
}
