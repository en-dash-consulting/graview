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
  /**
   * Somebody, STANDING. Head, torso, arms, legs — a figure on the ground.
   *
   * It was a head and shoulders, and at chip size that read as a person the
   * way any shape does when it is four pixels tall. Standing a district on
   * it showed what it actually was: two crescents, one over an open arc,
   * because a head drawn as two arcs is a circle only while it is too small
   * to see. A figure has to be the thing at every size it is drawn.
   */
  person:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="11.6" cy="5.4" r="2.5"/>' +
    '<path d="M7.9 12.4c0-2.1 1.7-3.8 3.7-3.8s3.7 1.7 3.7 3.8v3.2H7.9z"/>' +
    '<path d="M8 12.6 6.4 17.2"/><path d="M15.2 12.6 16.8 17.2"/>' +
    '<path d="M9.8 15.6v5"/><path d="M13.4 15.6v5"/></svg>',
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
  /**
   * A rule: a set square STANDING on the ground, graduated up its upright.
   *
   * It was a ruler lying across the box on the diagonal, which is a flat
   * thing floating at an angle — fine as a glyph, nothing at all as a
   * building. A standard is an object you stand a thing against.
   */
  rule:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5.4 19.4V6.6l12 12.8z"/>' +
    '<path d="M5.4 6.6 7.6 5.5l12 12.8-2.2 1.1"/>' +
    '<path d="M5.4 19.4 7.6 18.3h12"/>' +
    '<path d="M5.4 10.1h1.7"/><path d="M5.4 13.3h1.7"/><path d="M5.4 16.5h1.7"/></svg>',
  /**
   * A note somebody left: a leaf of paper standing up, seen from three
   * quarters, its corner turned and two lines written on it.
   *
   * It was a flat document icon — the one figure in the set drawn square to
   * the page while everything around it stood in the city's own projection,
   * which is exactly the clip-art import the house style forbids.
   */
  note:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6.2 6.2 14.8 10.5v9L6.2 15.2z"/>' +
    '<path d="M12.4 9.3 14.8 10.5l-.6 2.3"/>' +
    '<path d="M8.2 10.6 12.8 12.9"/><path d="M8.2 13.2 11.4 14.8"/></svg>',
};

export const FIGURE_NAMES = Object.keys(FIGURES);

/** The SVG a figure names, or the figure itself when it is already one. */
export function figureSvg(figure: Figure | undefined): string | undefined {
  if (!figure) return undefined;
  return FIGURES[figure] ?? (figure.trimStart().startsWith("<svg") ? figure : undefined);
}

/**
 * A FIGURE IS LINE ART, and these are the only things line art is made of.
 *
 * Everything drawn here is declared in code the bundle already runs — until
 * a figure arrives from somewhere else. A model asked to draw a kind can
 * answer with an `<svg>` carrying a `<script>`, an `onload`, or a remote
 * `href`, and a drawing is inserted as markup wherever it is shown; a check
 * of the house style alone would have passed all three, because none of
 * them is a colour or a viewBox. So the vocabulary is closed: these
 * elements, these attributes, and anything else is a fault with a name.
 *
 * It is one judgement rather than a second sanitiser beside the first,
 * because the surfaces that draw a figure already ask this function's
 * caller — `graview check`, `graview figure`, the agent that draws one —
 * whether the drawing is any good.
 */
const DRAWING_ELEMENTS: ReadonlySet<string> = new Set([
  "svg", "g", "title", "desc", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
]);
const DRAWING_ATTRIBUTES: ReadonlySet<string> = new Set([
  "viewbox", "xmlns", "width", "height", "fill", "fill-rule", "clip-rule", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit",
  "opacity", "fill-opacity", "stroke-opacity", "vector-effect", "transform", "d", "cx", "cy", "r",
  "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "points", "role", "aria-hidden", "focusable",
]);

/**
 * What is wrong with a figure, in the words of somebody about to fix it.
 *
 * Art with no `viewBox` cannot be sized by anything that draws it, a
 * literal colour ignores the scheme and the kind's hue, a `fill` that is
 * not `none` turns a line drawing into a blob at chip size, a name that is
 * not in the shipped set is a silent blank — and anything in the markup
 * that is not a drawing is not a figure at all.
 */
/**
 * THE BRIEF A FIGURE IS DRAWN FROM — the rules, in the words somebody draws
 * to, with a shipped figure beside them as the style.
 *
 * The shipped set is nine, deliberately generic, and any domain that is not
 * an abstract tracker runs out of it immediately: an outdoors product needed
 * eleven figures and had to draw ten. Growing the set would move the wall
 * rather than remove it, so the authoring loop is the answer — and it works
 * through the door every app has, which is a prompt to copy and an answer to
 * paste. No key, no vendor, no seam the CLI has no business holding.
 */
export function figureBrief(kind: string, from: string): string {
  return [
    `Draw a figure for a node kind called "${kind}": ${from}.`,
    "",
    "It is line art of the THING, not an emblem for it — never a badge, never a",
    "rounded-square app icon, never a shape chosen because it filled the space.",
    "Draw it from a three-quarter isometric angle, the same angle as a city seen",
    "from above and to the side, so a dozen of them on one screen read as one",
    "drawing rather than as twelve clip-art imports.",
    "",
    "Answer with the SVG and nothing else. It must:",
    '  - be one <svg> with viewBox="0 0 24 24" and no width or height;',
    '  - stroke with currentColor, fill="none", stroke-width 1.4,',
    "    stroke-linecap and stroke-linejoin round;",
    "  - use only path, circle, ellipse, rect, line, polyline, polygon and g;",
    "  - carry no literal colour anywhere, no class, no style, no id;",
    "  - READ AT TWENTY PIXELS, because that is the size a chip gives it.",
    "",
    "This is the shipped figure for a person, as the style to match:",
    FIGURES["person"] ?? "",
    "",
    `Then: graview figure <entry> --kind ${kind} --judge <the file you saved it in>`,
  ].join("\n");
}

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
  /*
   * THE VOCABULARY IS CLOSED. Named rather than stripped: a drawing with a
   * script in it is not a drawing with a fixable blemish, and whoever is
   * about to keep it should be told what was in it.
   */
  for (const [, element] of figure.matchAll(/<\s*\/?\s*([a-zA-Z][\w:-]*)/g)) {
    const name = (element ?? "").toLowerCase();
    if (!DRAWING_ELEMENTS.has(name)) faults.push(`it contains <${element}>, which is not something a line drawing is made of.`);
  }
  for (const [, attribute] of figure.matchAll(/[\s"']([a-zA-Z][\w:-]*)\s*=/g)) {
    const name = (attribute ?? "").toLowerCase();
    if (!DRAWING_ATTRIBUTES.has(name)) faults.push(`it carries ${attribute}, which is not a drawing attribute.`);
  }
  return [...new Set(faults)];
}
