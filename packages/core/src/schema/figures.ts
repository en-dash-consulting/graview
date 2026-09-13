/*
 * A KIND HAS A FIGURE: a drawing of the THING, not an emblem for it.
 *
 * Every kind is drawn the same way today — a coloured dot on its chips, a
 * plural on its district, an isometric block at altitude, a heading on its
 * page. The picture would say far more if a kind carried a drawing of what
 * it represents: a person's silhouette, a plot of ground, a vehicle, a
 * cleat. The scene, the Graview and, where it fits, the pages then draw it
 * wherever the kind is drawn, from one declaration.
 *
 * HONEST GEOMETRY, and it is the whole rule here. A figure is line art of
 * the thing — single weight, drawn from the isometric city's own three-
 * quarter angle, no fill but the ground's. It is never a decorative badge, a
 * rounded-square app icon, or a shape chosen because it filled the space.
 * A kind whose figure is a circle with a smaller circle in it has learnt
 * nothing about itself and taught the reader nothing.
 *
 * Everything is `currentColor`, so a figure takes the scheme, the kind's own
 * hue and the brand's ink without being redrawn; one `viewBox`, so every
 * surface can size it; and it must read at twenty pixels, because that is
 * the size a chip gives it.
 */

/** A kind's figure: inline SVG, or the name of one from the shipped set. */
export type Figure = string;

/**
 * THE SHIPPED SET — a small vocabulary, so a first app has something true
 * to point at before anybody draws anything.
 *
 * Deliberately few and deliberately generic: the things almost every domain
 * turns out to have. A kind that is none of these declares its own, and the
 * agent draws it (see `graview figure`).
 *
 * Each is drawn on a 24-unit box at the same three-quarter angle, in a
 * single stroke weight, with no fill: the isometric city's own language,
 * so twelve of them on one screen read as one drawing rather than as
 * twelve clip-art imports.
 */
export const FIGURES: Readonly<Record<string, string>> = {
  /** Somebody. A head and shoulders from three-quarters, not a circle on a rectangle. */
  person:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12.6 4.2a3 3 0 1 1-3.2 4.9"/><path d="M9.4 9.1a3 3 0 0 0 3.2-4.9"/>' +
    '<path d="M5.6 20.2v-2.6c0-2.4 2-4.3 4.4-4.5l2.4-.2c2.6-.2 4.9 1.7 5.1 4.3l.2 2.4"/>' +
    '<path d="M10 13.1 12.4 15l5.1-2.1"/></svg>',
  /** A piece of ground, seen from above and to the side. */
  plot:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2.6 9.4 12 4.6l9.4 4.8-9.4 4.8z"/><path d="M2.6 9.4v4.4l9.4 4.8 9.4-4.8V9.4"/>' +
    '<path d="M12 14.2v4.4"/><path d="M7 11.9v3"/><path d="M17 11.9v3"/></svg>',
  /** A thing with a lid, standing on the ground: a box, a crate, a case. */
  box:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3.4 7.9 12 3.6l8.6 4.3-8.6 4.3z"/><path d="M3.4 7.9v8.2L12 20.4l8.6-4.3V7.9"/>' +
    '<path d="M12 12.2v8.2"/></svg>',
  /** Something to be done: a card with a line struck across its corner. */
  task:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4.4 6.6 12 2.9l7.6 3.7v9.5L12 19.8 4.4 16.1z"/><path d="M12 12.4v7.4"/>' +
    '<path d="M4.4 6.6 12 10.3l7.6-3.7"/><path d="M8 9.6l2.4 2.4L16 8.4"/></svg>',
  /** A stretch of time: a block with its hours ruled across it. */
  shift:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3.2 8.2 12 4l8.8 4.2-8.8 4.2z"/><path d="M3.2 8.2v7.2L12 19.6l8.8-4.2V8.2"/>' +
    '<path d="M12 12.4v7.2"/><path d="M6.6 10.8v3.4"/><path d="M9.3 12v3.4"/></svg>',
  /** A place things live: a tray, open at the front. */
  list:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2.8 10.4 12 6l9.2 4.4-9.2 4.4z"/><path d="M2.8 10.4v3.2L12 18l9.2-4.4v-3.2"/>' +
    '<path d="M6.6 8.6 15.8 13"/><path d="M9.4 7.2 18.6 11.6"/></svg>',
  /** Something to drive: a body on wheels, seen from three-quarters. */
  vehicle:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2.8 14.2 5 9.4l8.6-1.6 5.4 3-1 3.6z"/><path d="M2.8 14.2v2.2h2.4"/>' +
    '<path d="M18 16.4h1.9l.1-2.2"/><circle cx="7.6" cy="16.6" r="1.9"/><circle cx="16.1" cy="16.6" r="1.9"/>' +
    '<path d="M8.6 8.2 9.8 12l7.2-1"/></svg>',
  /** A rule: a set square, which is what a standard actually looks like. */
  rule:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4.2 18.4 19.4 5.6l1.4 1.6L5.6 20z"/><path d="M4.2 18.4 5.6 20"/>' +
    '<path d="M8.6 14.7l1 1.1"/><path d="M12 11.8l1 1.1"/><path d="M15.4 8.9l1 1.1"/></svg>',
  /** A note somebody left: a leaf of paper with a folded corner. */
  note:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5.4 4.6h9L19 9.2v10.2H5.4z"/><path d="M14.4 4.6v4.6H19"/>' +
    '<path d="M8.4 12.4h7"/><path d="M8.4 15.4h4.6"/></svg>',
};

export const FIGURE_NAMES = Object.keys(FIGURES);

/** The SVG a figure names, or the figure itself when it is already one. */
export function figureSvg(figure: Figure | undefined): string | undefined {
  if (!figure) return undefined;
  return FIGURES[figure] ?? (figure.trimStart().startsWith("<svg") ? figure : undefined);
}

/**
 * What is wrong with a figure, in the words of somebody about to fix it.
 *
 * Four things, and every one of them is a thing that looks fine in the file
 * and fails on a screen: art with no `viewBox` cannot be sized by anything
 * that draws it, a literal colour ignores the scheme and the kind's hue, a
 * `fill` that is not `none` turns a line drawing into a blob at chip size,
 * and a name that is not in the shipped set is a silent blank.
 */
export function figureFaults(figure: Figure): readonly string[] {
  if (!figure.trimStart().startsWith("<svg")) {
    return FIGURE_NAMES.includes(figure)
      ? []
      : [`"${figure}" is not one of the shipped figures (${FIGURE_NAMES.join(", ")}).`];
  }
  const faults: string[] = [];
  const box = /viewBox\s*=\s*"([^"]+)"/.exec(figure);
  if (!box) faults.push("it has no viewBox, so nothing that draws it can size it.");
  else if (box[1]!.trim().split(/\s+/).length !== 4) {
    faults.push(`its viewBox "${box[1]}" is not four numbers.`);
  }
  /*
   * A literal colour anywhere. `currentColor` is what lets one drawing take
   * the scheme, the kind's hue and the brand's ink without being redrawn —
   * and a figure that hard-codes #333 is invisible in one of the two
   * schemes, which nobody notices until somebody switches.
   */
  const literal = /(?:stroke|fill)\s*=\s*"(?!none|currentColor)([^"]+)"/.exec(figure);
  if (literal) {
    faults.push(`it paints with "${literal[1]}" — use currentColor so it takes the scheme and the kind's hue.`);
  }
  if (!/stroke\s*=\s*"currentColor"/.test(figure)) {
    faults.push('nothing in it is stroked with currentColor, so it will not be drawn in the kind\'s ink.');
  }
  return faults;
}
