/**
 * ONE LADDER FOR WHAT STANDS OVER WHAT (FR-76).
 *
 * Every surface used to pick its own number in one stacking context: the
 * profile and the problems at 20, the companion at 40, the altitude
 * control at 5, the zoom at 8, a menu at 60, the studio at 100. Each was
 * right the day it was written and wrong the day a neighbour moved — on a
 * hosted app the profile opened UNDER the seat's rail and could not be
 * read. So there is one ladder, written once, here, and nothing else in
 * the framework writes a number:
 *
 *   scene    the picture, in a stacking context of its own (`SCENE_LAYERS`
 *            order what is inside it, and can never climb out of it)
 *   overview the altitude control on the picture
 *   rail     the rails and the floating controls: the bar, the seat, the
 *            inspector's strip, the pages' Ask, the faces' controls
 *   popover  a popover, a menu, a list of suggestions — the rung a
 *            transient surface stands on where the browser's top layer is
 *            not used; where it is (every popover in the family, see
 *            `usePopover`), it is above every rung by the browser's say
 *   dialog   a modal: the studio
 *   toast    a notice a host or the app says over everything (FR-75)
 *
 * The rungs are custom properties the theme writes on its root (or an
 * embed's box), so a host can see them and a stylesheet can read them;
 * `layer(name)` is the property with the ladder's own number behind it,
 * for a surface drawn where no theme is.
 */
export const LAYERS = {
  scene: 0,
  overview: 10,
  rail: 20,
  popover: 30,
  dialog: 40,
  toast: 50,
} as const;

export type Layer = keyof typeof LAYERS;

/**
 * INSIDE THE SCENE, AND ONLY THERE. The scene's ground is its own stacking
 * context (`isolation: isolate` on `.graview-ground`), so these order the
 * plots, the stage, the lines, the figures and the zoom among themselves
 * and none of them can stand over a rail however high it is written.
 * `local` is for a part ordered within its own box — a link raised over
 * the card it sits in, a lens's sticky header over its rows.
 */
export const SCENE_LAYERS = {
  /** The ground's plots, under everything drawn on them. */
  plots: 0,
  /** The cards' stage; a lit card over its unlit neighbours. */
  stage: 1,
  /** A district's tag and face, over its plate. */
  tag: 2,
  /** The ties between cards. */
  ties: 2,
  /** The lines, the edge signs, a focused card's outline, the drive-in's marquee and a screen's grip. */
  lines: 3,
  /** A tie's own label, over its line. */
  tieLabels: 4,
  /** The figures walking the ground. */
  occupants: 6,
  /** What a seat marks where it acted. */
  seatMarks: 7,
  /** The zoom, over a figure walking past it. */
  zoom: 8,
  /** A card, less its plane: the nearer plane over the farther. */
  card: 10,
  /** A card opened to read, over every other. */
  opened: 11,
} as const;

/** Order within one box: under (0), raised (1) and over (2) its siblings. */
export const LOCAL_LAYERS = { under: 0, raised: 1, over: 2 } as const;

/** The custom property a rung is written as. */
export const layerProperty = (name: Layer): string => `--graview-layer-${name}`;

/** A rung, as a `z-index` value: the theme's property, with the ladder's number behind it. */
export const layer = (name: Layer): string => `var(${layerProperty(name)}, ${LAYERS[name]})`;

/** The ladder as declarations, for the theme to write on its root. */
export function layerVariables(): string {
  return (Object.keys(LAYERS) as Layer[]).map((name) => `  ${layerProperty(name)}: ${LAYERS[name]};`).join("\n");
}
