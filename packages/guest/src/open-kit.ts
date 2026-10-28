/**
 * THE OPEN KIT (FR-90): what a worker view may draw, declared once.
 *
 * Graview Cloud's ADR 0007 put it in one line: safety comes from what a
 * view can REACH, not from what it can DRAW. So the kit is broad — most of
 * HTML's sectioning, text, lists, tables, disclosure and form controls,
 * images, SVG's shapes, paths, text and gradients, and CSS for layout,
 * color, type, transitions, keyframes and media queries — and what is left
 * out is exactly what could fetch, escape the region, or speak for the app:
 *
 *   fetch     `<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`,
 *             `<base>`, `<style>` outside the view's own stylesheet, media and
 *             canvas, SVG `<image>`, `<feImage>`, `<foreignObject>`, an `href`
 *             on SVG's `<a>`, SMIL (which can rewrite an `href`), every `src`/`href`/`srcset`
 *             but an image's `data:` or same-origin `blob:` source and an SVG
 *             reference to `#id` in the view's own drawing, and in CSS every
 *             `url()` but `url(#id)` on a paint, `@import`, `@font-face`,
 *             `@namespace`, `@property` (a registration is the whole page's),
 *             and every function not on `CSS_FUNCTIONS`
 *             (`image-set()`, `cross-fade()`, `element()`, `paint()`,
 *             `attr()`, `expression()`, …).
 *   escape    `position: fixed`, `:host` and `::slotted`, the
 *             top layer (`popover`, `<dialog>`), `autofocus`, `accesskey`,
 *             and `<form>`, whose submission is a navigation.
 *   speak     `role="alert"`, the landmark roles the app's own chrome uses
 *             (a `region` is drawn only while it has a name, `NAMED_ROLES`)
 *             and the elements that carry them (`<nav>`, `<header>`,
 *             `<footer>`, `<aside>`, `<search>` are drawn as `<div>`, `<output>`
 *             as `<span>`, and a `<section>` is named only by its own heading),
 *             `aria-live="assertive"`, and password and file inputs.
 *
 * The host draws from this declaration (host/open-render.ts, with
 * `@graview/core/css` for every stylesheet, style attribute and SVG paint), and the
 * worker's runtime reads the same tables to tell an author at once what the
 * host will not draw (worker/view.ts). Adding an element or an attribute
 * here makes it drawable on both sides; nothing else changes.
 *
 * This module has no imports: a view's runtime carries it and nothing of
 * the framework.
 */

/**
 * What an attribute's value may be:
 *
 *   text      any string, as text (a title, a label, an id)
 *   number    a finite number
 *   boolean   present or absent
 *   oneOf     one of a closed list, compared without case
 *   css       a CSS value for the property of the attribute's own name (an
 *             SVG presentation attribute: `fill`, `stroke`, …), sanitized
 *             as a stylesheet's value is
 *   geometry  SVG geometry and transforms (`d`, `points`, `viewBox`,
 *             `transform`): numbers, letters, commas and brackets, never `url`
 *   image     an image's source: a `data:image/…` URL, or a `blob:` URL of
 *             the host page's own origin
 *   fragment  a reference to an element of the view's own drawing: `#id`
 *   style     a declaration list, sanitized as a stylesheet's declarations
 *   link      a link out's address: `https:`, `mailto:` or `tel:`, drawn only
 *             where the host allows it — an address a record the view was
 *             shown holds, or an `https:` address on an origin the host lists
 *             (host/external-links.ts)
 */
export type OpenAttribute = "text" | "number" | "boolean" | "css" | "geometry" | "image" | "fragment" | "style" | "link" | { readonly oneOf: readonly string[] };

export interface OpenElement {
  /** The attributes this element takes beyond its namespace's global ones, by canonical name. */
  readonly attributes?: Readonly<Record<string, OpenAttribute>>;
  /** It holds nothing (`img`, `input`, `br`). */
  readonly empty?: true;
}

const none: OpenElement = {};
const empty: OpenElement = { empty: true };

/** Attributes every HTML element takes. `aria-*` and `data-*` are read by pattern (`isAriaAttribute`, `isDataAttribute`). */
export const HTML_GLOBAL_ATTRIBUTES: Readonly<Record<string, OpenAttribute>> = {
  id: "text",
  class: "text",
  title: "text",
  lang: "text",
  dir: { oneOf: ["ltr", "rtl", "auto"] },
  hidden: "text",
  /* -1 or 0: a view orders its own controls by where it draws them, never ahead of the app's. */
  tabindex: { oneOf: ["-1", "0"] },
  role: "text",
  style: "style",
  translate: { oneOf: ["yes", "no"] },
  spellcheck: { oneOf: ["true", "false"] },
  draggable: { oneOf: ["true", "false"] },
  inert: "boolean",
};

/** The HTML elements a view may draw, by name. */
export const HTML_ELEMENTS: Readonly<Record<string, OpenElement>> = {
  // sectioning and grouping
  div: none, section: none, article: none, aside: none, header: none, footer: none, nav: none, hgroup: none, search: none, address: none,
  figure: none, figcaption: none, blockquote: none, p: none, pre: none, hr: empty, br: empty, wbr: empty,
  h1: none, h2: none, h3: none, h4: none, h5: none, h6: none,
  // text
  span: none, strong: none, em: none, b: none, i: none, u: none, s: none, small: none, mark: none, abbr: none, cite: none, q: none,
  code: none, kbd: none, samp: none, var: none, sub: none, sup: none, dfn: none, bdi: none, bdo: none, ruby: none, rt: none, rp: none,
  time: { attributes: { datetime: "text" } },
  data: { attributes: { value: "text" } },
  del: { attributes: { datetime: "text" } },
  ins: { attributes: { datetime: "text" } },
  /*
   * A link goes to a record or a place of this app (FR-93, `data-record`,
   * `data-place`), or out to an address the view was handed (2026-10-21):
   * an `href` the host draws only where it is a record's own value, or on
   * an origin the host lists, opening in a new tab with no opener and no
   * referrer (host/external-links.ts).
   */
  a: { attributes: { href: "link" } },
  // lists
  ul: none, menu: none, dl: none, dt: none, dd: none,
  ol: { attributes: { start: "number", reversed: "boolean", type: { oneOf: ["1", "a", "A", "i", "I"] } } },
  li: { attributes: { value: "number" } },
  // tables
  table: none, caption: none, thead: none, tbody: none, tfoot: none, tr: none,
  colgroup: { attributes: { span: "number" } },
  col: { attributes: { span: "number" }, empty: true },
  th: { attributes: { colspan: "number", rowspan: "number", headers: "text", scope: { oneOf: ["row", "col", "rowgroup", "colgroup"] }, abbr: "text" } },
  td: { attributes: { colspan: "number", rowspan: "number", headers: "text" } },
  // disclosure
  details: { attributes: { open: "boolean", name: "text" } },
  summary: none,
  // controls: no form, so nothing is ever submitted
  button: { attributes: { type: { oneOf: ["button"] }, disabled: "boolean", name: "text", value: "text" } },
  input: {
    empty: true,
    attributes: {
      /*
       * Never password or file (a view does not ask for either), image (it has a src), hidden or submit.
       * No `list`: a suggestion the person picks from a view's `<datalist>` is typed by the browser, trusted,
       * and would pass the view's words off as theirs (FR-92).
       */
      type: { oneOf: ["text", "search", "number", "range", "checkbox", "radio", "date", "time", "datetime-local", "month", "week", "color", "email", "tel", "url"] },
      name: "text", value: "text", placeholder: "text", min: "text", max: "text", step: "text", checked: "boolean", disabled: "boolean",
      readonly: "boolean", required: "boolean", maxlength: "number", minlength: "number", size: "number", pattern: "text",
      multiple: "boolean", inputmode: "text", enterkeyhint: "text",
    },
  },
  select: { attributes: { name: "text", disabled: "boolean", multiple: "boolean", required: "boolean", size: "number" } },
  option: { attributes: { value: "text", selected: "boolean", disabled: "boolean", label: "text" } },
  optgroup: { attributes: { label: "text", disabled: "boolean" } },
  textarea: { attributes: { name: "text", placeholder: "text", rows: "number", cols: "number", disabled: "boolean", readonly: "boolean", required: "boolean", maxlength: "number", minlength: "number", wrap: { oneOf: ["soft", "hard", "off"] } } },
  label: { attributes: { for: "text" } },
  fieldset: { attributes: { disabled: "boolean", name: "text" } },
  legend: none,
  output: none,
  meter: { attributes: { value: "number", min: "number", max: "number", low: "number", high: "number", optimum: "number" } },
  progress: { attributes: { value: "number", max: "number" } },
  // images, held in the drawing: data: or the host's own blob:
  img: { empty: true, attributes: { src: "image", alt: "text", width: "number", height: "number", decoding: { oneOf: ["async", "sync", "auto"] } } },
  /*
   * A record's video, played by the host (0.1.37): `<graview-video
   * data-record="moment:x" data-field="clip">` (and `data-index` in a
   * list). It names a file and holds nothing; the host draws the player in
   * it, from the record the view was shown, for a view whose manifest asks
   * for pictures (host/media.ts). The view never holds a `<video>` or the
   * host's path to one. `autoplay` (Roadmap f-video-hero) is a background:
   * muted, looping, inline, with no controls — autoplay without muted never
   * plays, so the one word means all of it — held still at its poster under
   * `prefers-reduced-motion`; `cover` fills the box the view sized. The
   * poster is the value's: a view names no address.
   */
  "graview-video": { empty: true, attributes: { autoplay: "boolean", cover: "boolean" } },
};

/** SVG's presentation attributes: CSS properties, sanitized as a stylesheet's are. */
const PRESENTATION = [
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset",
  "stroke-opacity", "stroke-miterlimit", "opacity", "color", "display", "visibility", "transform-origin", "clip-path", "clip-rule",
  "marker-start", "marker-mid", "marker-end", "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline",
  "alignment-baseline", "letter-spacing", "text-decoration", "paint-order", "vector-effect", "shape-rendering", "pointer-events",
  "stop-color", "stop-opacity", "overflow", "mask", "filter", "flood-color", "flood-opacity", "lighting-color", "color-interpolation-filters",
] as const;

/** Attributes every SVG element takes. */
export const SVG_GLOBAL_ATTRIBUTES: Readonly<Record<string, OpenAttribute>> = {
  id: "text",
  class: "text",
  style: "style",
  lang: "text",
  role: "text",
  tabindex: { oneOf: ["-1", "0"] },
  transform: "geometry",
  ...Object.fromEntries(PRESENTATION.map((name) => [name, "css" as const])),
};

const box = { x: "geometry", y: "geometry", width: "geometry", height: "geometry" } as const;
const viewport = { viewBox: "geometry", preserveAspectRatio: "geometry" } as const;
const units = { oneOf: ["userSpaceOnUse", "objectBoundingBox"] } as const;
const channel = { oneOf: ["R", "G", "B", "A"] } as const;
const primitive = { ...box, in: "text", result: "text" } as const;
const gradient = { gradientUnits: { oneOf: ["userSpaceOnUse", "objectBoundingBox"] }, gradientTransform: "geometry", spreadMethod: { oneOf: ["pad", "reflect", "repeat"] }, href: "fragment" } as const;

/** The SVG elements a view may draw, by canonical (camel-cased) name. */
export const SVG_ELEMENTS: Readonly<Record<string, OpenElement>> = {
  svg: { attributes: { ...box, ...viewport } },
  g: none,
  defs: none,
  symbol: { attributes: { ...box, ...viewport, refX: "geometry", refY: "geometry" } },
  /* `use` within the drawing only: `#id`, never a document of its own. */
  use: { attributes: { ...box, href: "fragment" } },
  title: none,
  desc: none,
  path: { attributes: { d: "geometry", pathLength: "number" } },
  rect: { attributes: { ...box, rx: "geometry", ry: "geometry", pathLength: "number" } },
  circle: { attributes: { cx: "geometry", cy: "geometry", r: "geometry", pathLength: "number" } },
  ellipse: { attributes: { cx: "geometry", cy: "geometry", rx: "geometry", ry: "geometry", pathLength: "number" } },
  line: { attributes: { x1: "geometry", y1: "geometry", x2: "geometry", y2: "geometry", pathLength: "number" } },
  polyline: { attributes: { points: "geometry", pathLength: "number" } },
  polygon: { attributes: { points: "geometry", pathLength: "number" } },
  text: { attributes: { x: "geometry", y: "geometry", dx: "geometry", dy: "geometry", rotate: "geometry", textLength: "geometry", lengthAdjust: { oneOf: ["spacing", "spacingAndGlyphs"] } } },
  tspan: { attributes: { x: "geometry", y: "geometry", dx: "geometry", dy: "geometry", rotate: "geometry", textLength: "geometry" } },
  textPath: { attributes: { href: "fragment", startOffset: "geometry", method: { oneOf: ["align", "stretch"] }, spacing: { oneOf: ["auto", "exact"] }, side: { oneOf: ["left", "right"] } } },
  linearGradient: { attributes: { x1: "geometry", y1: "geometry", x2: "geometry", y2: "geometry", ...gradient } },
  radialGradient: { attributes: { cx: "geometry", cy: "geometry", r: "geometry", fx: "geometry", fy: "geometry", fr: "geometry", ...gradient } },
  stop: { attributes: { offset: "geometry" } },
  clipPath: { attributes: { clipPathUnits: { oneOf: ["userSpaceOnUse", "objectBoundingBox"] } } },
  mask: { attributes: { ...box, maskUnits: { oneOf: ["userSpaceOnUse", "objectBoundingBox"] }, maskContentUnits: { oneOf: ["userSpaceOnUse", "objectBoundingBox"] } } },
  pattern: { attributes: { ...box, ...viewport, patternUnits: { oneOf: ["userSpaceOnUse", "objectBoundingBox"] }, patternContentUnits: { oneOf: ["userSpaceOnUse", "objectBoundingBox"] }, patternTransform: "geometry", href: "fragment" } },
  marker: { attributes: { ...viewport, markerWidth: "geometry", markerHeight: "geometry", refX: "geometry", refY: "geometry", orient: "geometry", markerUnits: { oneOf: ["strokeWidth", "userSpaceOnUse"] } } },
  /*
   * A link in a drawing (2026-10-23): `<a data-record>` or `<a data-place>`,
   * which the host makes a link as it does an HTML one — its address, the
   * keyboard, Enter (host/links.ts). No `href` of the view's: a link out is
   * an HTML `<a href>`, which the host opens with no opener and no referrer.
   */
  a: none,
  /*
   * SVG FILTERS (2026-10-23): grain, glow, duotone, a shadow. Each primitive
   * makes pixels of the drawing's own; none names a resource (`<feImage>`,
   * which loads one, stays out), and a filter is reached by `url(#id)`.
   */
  filter: { attributes: { ...box, filterUnits: units, primitiveUnits: units } },
  feBlend: { attributes: { ...primitive, in2: "text", mode: "text" } },
  feColorMatrix: { attributes: { ...primitive, type: { oneOf: ["matrix", "saturate", "hueRotate", "luminanceToAlpha"] }, values: "geometry" } },
  feComponentTransfer: { attributes: primitive },
  ...Object.fromEntries(["feFuncR", "feFuncG", "feFuncB", "feFuncA"].map((name) => [name, { attributes: { type: { oneOf: ["identity", "table", "discrete", "linear", "gamma"] }, tableValues: "geometry", slope: "number", intercept: "number", amplitude: "number", exponent: "number", offset: "number" } }])),
  feComposite: { attributes: { ...primitive, in2: "text", operator: { oneOf: ["over", "in", "out", "atop", "xor", "lighter", "arithmetic"] }, k1: "number", k2: "number", k3: "number", k4: "number" } },
  feDisplacementMap: { attributes: { ...primitive, in2: "text", scale: "number", xChannelSelector: channel, yChannelSelector: channel } },
  feDropShadow: { attributes: { ...primitive, dx: "number", dy: "number", stdDeviation: "geometry" } },
  feFlood: { attributes: primitive },
  feGaussianBlur: { attributes: { ...primitive, stdDeviation: "geometry", edgeMode: { oneOf: ["duplicate", "wrap", "none"] } } },
  feMerge: { attributes: primitive },
  feMergeNode: { attributes: { in: "text" } },
  feMorphology: { attributes: { ...primitive, operator: { oneOf: ["erode", "dilate"] }, radius: "geometry" } },
  feOffset: { attributes: { ...primitive, dx: "number", dy: "number" } },
  feTurbulence: { attributes: { ...box, result: "text", type: { oneOf: ["fractalNoise", "turbulence"] }, baseFrequency: "geometry", numOctaves: "number", seed: "number", stitchTiles: { oneOf: ["stitch", "noStitch"] } } },
};

/**
 * What is refused, and why, for an author and for the tests: none of these
 * is in the tables above, and a test holds them out. Not the allowlist —
 * anything not above is refused — but the names a reader looks for.
 */
export const NEVER_DRAWN = {
  html: ["script", "iframe", "frame", "frameset", "object", "embed", "applet", "portal", "link", "meta", "base", "style", "form", "template", "slot", "noscript", "audio", "video", "source", "track", "picture", "canvas", "dialog", "datalist", "main", "html", "head", "body", "title"],
  svg: ["image", "feImage", "foreignObject", "script", "style", "animate", "animateMotion", "animateTransform", "set", "discard", "view", "switch", "cursor", "font-face"],
  attributes: ["src (outside img)", "href (outside a, on SVG's a, and on a any address the view was not handed)", "target", "rel", "download", "xlink:href (outside a #fragment)", "srcset", "sizes", "action", "formaction", "ping", "poster", "background", "on*", "popover", "popovertarget", "autofocus", "accesskey", "contenteditable", "is", "nonce", "autocomplete", "form", "list"],
} as const;

/** Roles that would make a view speak as the app's own chrome or notices. */
export const REFUSED_ROLES = ["alert", "alertdialog", "dialog", "banner", "main", "navigation", "contentinfo", "complementary", "search", "form", "application", "status", "log", "marquee", "timer"] as const;

/**
 * Roles drawn only while the element has a name (2026-10-23): a `region` is
 * a box a person can find by what it holds — a sideways scroller, a long
 * table — which is no chrome of the app's (the region a view is drawn in is
 * one too). Unnamed, it is a landmark that says nothing: its role is held
 * back until it has a name (`aria-label`, `aria-labelledby` or `title`).
 */
export const NAMED_ROLES = ["region"] as const;

/**
 * Elements whose own role is a landmark or a notice's, drawn as an element
 * with none: what they hold is drawn, but they speak as the app's chrome
 * (`<nav>` is a navigation landmark, `<header>` a banner, `<output>` a
 * status) to assistive technology. Setting a role on them cannot cover it:
 * `role="none"` on a focusable or named element is ignored, and the
 * landmark comes back. A view's stylesheet reaches them by class, not by
 * these names.
 */
export const HTML_DRAWN_AS: Readonly<Record<string, string>> = { nav: "div", header: "div", footer: "div", aside: "div", search: "div", output: "span" };

/**
 * Attributes that would name an element: a named `<section>` is a region
 * landmark, so a section is named only by its own heading (FR-219):
 * `aria-labelledby`, drawn while every id it names is an element of the
 * view's own drawing (`REFERENCE_ATTRIBUTES`). A label or a title in words
 * of its own stays refused.
 */
export const UNNAMED_ELEMENTS: Readonly<Record<string, readonly string[]>> = { section: ["aria-label", "title"] };

/**
 * Attributes that name other elements by id: drawn while every id they name
 * is an element of the view's own drawing, held back and said while one
 * names nothing there (FR-219). The view is drawn in a shadow root, so its
 * ids are its own and are drawn as the view wrote them.
 */
export const REFERENCE_ATTRIBUTES: readonly string[] = ["aria-labelledby", "aria-describedby"];

/** `aria-*`, by pattern. */
export function isAriaAttribute(name: string): boolean {
  return /^aria-[a-z]+$/.test(name);
}

/** `data-*`, by pattern. */
export function isDataAttribute(name: string): boolean {
  return /^data-[a-z0-9][a-z0-9_.-]*$/.test(name);
}

/** The longest attribute value, in characters; geometry (`d`, `points`) may be longer. */
export const OPEN_MAX_ATTRIBUTE = 4_000;
export const OPEN_MAX_GEOMETRY = 100_000;
/** The largest image a view may hold, as its `data:` URL's length. */
export const OPEN_MAX_IMAGE = 512_000;
/** The longest text a node may hold, in characters; longer is cut. */
export const OPEN_MAX_TEXT = 10_000;

export const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** An SVG element's canonical name from any casing of it (`lineargradient` → `linearGradient`). */
const SVG_NAMES = new Map(Object.keys(SVG_ELEMENTS).map((name) => [name.toLowerCase(), name]));
export function svgElementName(name: string): string | undefined {
  return SVG_NAMES.get(name.toLowerCase());
}

/** The canonical name of an attribute an element takes, from any casing (`viewbox` → `viewBox`), with what it may hold; or undefined. */
export function openAttribute(namespace: "html" | "svg", element: string, name: string): { readonly name: string; readonly kind: OpenAttribute } | undefined {
  const lower = name.toLowerCase();
  const tables = namespace === "html" ? [HTML_ELEMENTS[element]?.attributes, HTML_GLOBAL_ATTRIBUTES] : [SVG_ELEMENTS[element]?.attributes, SVG_GLOBAL_ATTRIBUTES];
  /* `xlink:href` is SVG 1's `href`; it is drawn as SVG 2's. */
  const asked = namespace === "svg" && lower === "xlink:href" ? "href" : lower;
  for (const table of tables) {
    if (!table) continue;
    for (const [canonical, kind] of Object.entries(table)) if (canonical.toLowerCase() === asked) return { name: canonical, kind };
  }
  if (isAriaAttribute(lower) || isDataAttribute(lower)) return { name: lower, kind: "text" };
  return undefined;
}
