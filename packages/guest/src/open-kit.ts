/**
 * THE OPEN KIT (FR-90): what a worker view may draw, declared once.
 *
 * Graview Cloud's ADR 0007 put it in one line: safety comes from what a
 * view can REACH, not from what it can DRAW. So the kit is broad — most of
 * HTML's sectioning, text, lists, tables, disclosure and form controls,
 * images, SVG's shapes, paths, text and gradients, and CSS for layout,
 * colour, type, transitions, keyframes and media queries — and what is left
 * out is exactly what could fetch, escape the region, or speak for the app:
 *
 *   fetch     `<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`,
 *             `<base>`, `<style>` outside the view's own stylesheet, media and
 *             canvas, SVG `<image>`, `<feImage>`, `<foreignObject>`, SVG `<a>`,
 *             SMIL (which can rewrite an `href`), every `src`/`href`/`srcset`
 *             but an image's `data:` or same-origin `blob:` source and an SVG
 *             reference to `#id` in the view's own drawing, and in CSS every
 *             `url()` but `url(#id)` on a paint, `@import`, `@font-face`,
 *             `@namespace`, and every function not on `CSS_FUNCTIONS`
 *             (`image-set()`, `cross-fade()`, `element()`, `paint()`,
 *             `attr()`, `expression()`, …).
 *   escape    `position: fixed` and `sticky`, `:host` and `::slotted`, the
 *             top layer (`popover`, `<dialog>`), `autofocus`, `accesskey`,
 *             and `<form>`, whose submission is a navigation.
 *   speak     `role="alert"`, the landmark roles the app's own chrome uses
 *             and the elements that carry them (`<nav>`, `<header>`,
 *             `<footer>`, `<aside>`, `<search>` are drawn as `<div>`, `<output>`
 *             as `<span>`, and a `<section>` is never named),
 *             `aria-live="assertive"`, and password and file inputs.
 *
 * The host draws from this declaration (host/open-render.ts, with
 * host/css.ts for every stylesheet, style attribute and SVG paint), and the
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
 *             SVG presentation attribute: `fill`, `stroke`, …), sanitised
 *             as a stylesheet's value is
 *   geometry  SVG geometry and transforms (`d`, `points`, `viewBox`,
 *             `transform`): numbers, letters, commas and brackets, never `url`
 *   image     an image's source: a `data:image/…` URL, or a `blob:` URL of
 *             the host page's own origin
 *   fragment  a reference to an element of the view's own drawing: `#id`
 *   style     a declaration list, sanitised as a stylesheet's declarations
 */
export type OpenAttribute = "text" | "number" | "boolean" | "css" | "geometry" | "image" | "fragment" | "style" | { readonly oneOf: readonly string[] };

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
  /* A link goes to a record or a place of this app, never to an address (FR-93): it has no `href` to give. */
  a: none,
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
};

/** SVG's presentation attributes: CSS properties, sanitised as a stylesheet's are. */
const PRESENTATION = [
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset",
  "stroke-opacity", "stroke-miterlimit", "opacity", "color", "display", "visibility", "transform-origin", "clip-path", "clip-rule",
  "marker-start", "marker-mid", "marker-end", "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline",
  "alignment-baseline", "letter-spacing", "text-decoration", "paint-order", "vector-effect", "shape-rendering", "pointer-events",
  "stop-color", "stop-opacity", "overflow", "mask",
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
};

/**
 * What is refused, and why, for an author and for the tests: none of these
 * is in the tables above, and a test holds them out. Not the allowlist —
 * anything not above is refused — but the names a reader looks for.
 */
export const NEVER_DRAWN = {
  html: ["script", "iframe", "frame", "frameset", "object", "embed", "applet", "portal", "link", "meta", "base", "style", "form", "template", "slot", "noscript", "audio", "video", "source", "track", "picture", "canvas", "dialog", "datalist", "main", "html", "head", "body", "title"],
  svg: ["image", "feImage", "filter", "foreignObject", "a", "script", "style", "animate", "animateMotion", "animateTransform", "set", "discard", "view", "switch", "cursor", "font-face"],
  attributes: ["src (outside img)", "href", "xlink:href (outside a #fragment)", "srcset", "sizes", "action", "formaction", "ping", "poster", "background", "on*", "popover", "popovertarget", "autofocus", "accesskey", "contenteditable", "is", "nonce", "autocomplete", "form", "list"],
} as const;

/** Roles that would make a view speak as the app's own chrome or notices. */
export const REFUSED_ROLES = ["alert", "alertdialog", "dialog", "banner", "main", "navigation", "contentinfo", "complementary", "search", "form", "region", "application", "status", "log", "marquee", "timer"] as const;

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

/** Attributes that would name an element: a named `<section>` is a region landmark, so a section is never named. */
export const UNNAMED_ELEMENTS: Readonly<Record<string, readonly string[]>> = { section: ["aria-label", "aria-labelledby", "title"] };

/** `aria-*`, by pattern. */
export function isAriaAttribute(name: string): boolean {
  return /^aria-[a-z]+$/.test(name);
}

/** `data-*`, by pattern. */
export function isDataAttribute(name: string): boolean {
  return /^data-[a-z0-9][a-z0-9_.-]*$/.test(name);
}

/**
 * THE CSS A VIEW MAY WRITE: an allowlist of properties, so a property a
 * browser ships tomorrow that takes an image is refused until somebody adds
 * it here, rather than drawn until somebody notices.
 */
export const CSS_PROPERTIES: readonly string[] = [
  // box and layout
  "display", "position", "top", "right", "bottom", "left", "inset", "inset-block", "inset-inline", "inset-block-start", "inset-block-end", "inset-inline-start", "inset-inline-end",
  "width", "height", "min-width", "min-height", "max-width", "max-height", "inline-size", "block-size", "min-inline-size", "min-block-size", "max-inline-size", "max-block-size",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "margin-block", "margin-inline", "margin-block-start", "margin-block-end", "margin-inline-start", "margin-inline-end",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "padding-block", "padding-inline", "padding-block-start", "padding-block-end", "padding-inline-start", "padding-inline-end",
  "box-sizing", "overflow", "overflow-x", "overflow-y", "overflow-wrap", "float", "clear", "z-index", "aspect-ratio", "object-fit", "object-position", "vertical-align",
  "isolation", "contain", "container", "container-type", "container-name", "content-visibility",
  // flex and grid
  "flex", "flex-direction", "flex-wrap", "flex-flow", "flex-grow", "flex-shrink", "flex-basis", "order",
  "grid", "grid-template", "grid-template-columns", "grid-template-rows", "grid-template-areas", "grid-auto-columns", "grid-auto-rows", "grid-auto-flow",
  "grid-area", "grid-column", "grid-row", "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end",
  "gap", "row-gap", "column-gap", "align-items", "align-content", "align-self", "justify-items", "justify-content", "justify-self", "place-items", "place-content", "place-self",
  "columns", "column-count", "column-width", "column-rule", "column-rule-color", "column-rule-style", "column-rule-width", "column-span", "column-fill",
  // colour and surface
  "color", "background", "background-color", "background-image", "background-position", "background-position-x", "background-position-y", "background-size", "background-repeat",
  "background-origin", "background-clip", "background-attachment", "background-blend-mode",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-block", "border-inline", "border-block-start", "border-block-end", "border-inline-start", "border-inline-end",
  "border-width", "border-style", "border-color", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "border-start-start-radius", "border-start-end-radius", "border-end-start-radius", "border-end-end-radius", "border-collapse", "border-spacing",
  "outline", "outline-width", "outline-style", "outline-color", "outline-offset", "box-shadow", "opacity", "visibility", "mix-blend-mode", "filter", "backdrop-filter",
  "clip-path", "accent-color", "caret-color", "color-scheme", "appearance", "-webkit-appearance",
  // type
  "font", "font-family", "font-size", "font-weight", "font-style", "font-stretch", "font-variant", "font-variant-numeric", "font-variant-caps", "font-variant-ligatures",
  "font-feature-settings", "font-variation-settings", "font-kerning", "font-optical-sizing", "font-size-adjust", "font-synthesis",
  "line-height", "letter-spacing", "word-spacing", "text-align", "text-align-last", "text-indent", "text-transform", "text-decoration", "text-decoration-line",
  "text-decoration-color", "text-decoration-style", "text-decoration-thickness", "text-underline-offset", "text-underline-position", "text-shadow", "text-overflow",
  "text-wrap", "text-wrap-mode", "text-wrap-style", "white-space", "white-space-collapse", "word-break", "line-break", "hyphens", "tab-size", "direction", "unicode-bidi", "writing-mode",
  "text-orientation", "text-rendering", "-webkit-font-smoothing", "-webkit-line-clamp", "-webkit-box-orient", "line-clamp", "-webkit-text-fill-color", "-webkit-background-clip",
  "list-style", "list-style-type", "list-style-position", "content", "quotes", "counter-reset", "counter-increment", "counter-set",
  "table-layout", "caption-side", "empty-cells",
  // motion
  "transform", "transform-origin", "transform-box", "transform-style", "translate", "rotate", "scale", "perspective", "perspective-origin", "backface-visibility",
  "transition", "transition-property", "transition-duration", "transition-timing-function", "transition-delay", "transition-behavior",
  "animation", "animation-name", "animation-duration", "animation-timing-function", "animation-delay", "animation-iteration-count", "animation-direction",
  "animation-fill-mode", "animation-play-state", "animation-composition", "will-change",
  // interaction
  "cursor", "pointer-events", "user-select", "-webkit-user-select", "touch-action", "resize", "scroll-behavior", "overscroll-behavior", "overscroll-behavior-x", "overscroll-behavior-y",
  "scroll-snap-type", "scroll-snap-align", "scroll-snap-stop", "scroll-margin", "scroll-padding", "scrollbar-width", "scrollbar-color", "scrollbar-gutter",
  // SVG
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "stroke-miterlimit",
  "stop-color", "stop-opacity", "clip-rule", "marker", "marker-start", "marker-mid", "marker-end", "paint-order", "vector-effect", "shape-rendering", "text-anchor",
  "dominant-baseline", "alignment-baseline", "r", "cx", "cy", "rx", "ry", "x", "y", "d", "mask",
];

/**
 * The CSS functions a value may call. Every one makes a value of its own
 * arguments; none names a resource. `url()` is not here: it is read apart,
 * and kept only as `url(#id)` on a property in `CSS_FRAGMENT_PROPERTIES`.
 */
export const CSS_FUNCTIONS: readonly string[] = [
  "var", "env", "calc", "min", "max", "clamp", "round", "mod", "rem", "abs", "sign", "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "pow", "sqrt", "hypot", "log", "exp",
  "rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color", "color-mix", "light-dark",
  "linear-gradient", "radial-gradient", "conic-gradient", "repeating-linear-gradient", "repeating-radial-gradient", "repeating-conic-gradient",
  "translate", "translatex", "translatey", "translatez", "translate3d", "rotate", "rotatex", "rotatey", "rotatez", "rotate3d", "scale", "scalex", "scaley", "scalez", "scale3d",
  "skew", "skewx", "skewy", "matrix", "matrix3d", "perspective",
  "cubic-bezier", "steps", "linear",
  "repeat", "minmax", "fit-content",
  "blur", "brightness", "contrast", "drop-shadow", "grayscale", "hue-rotate", "invert", "saturate", "sepia", "opacity",
  "circle", "ellipse", "inset", "polygon", "path", "xywh", "rect",
  "counter", "counters",
];

/**
 * Where `url(#id)` stays: the paints and references an SVG drawing makes
 * to its own gradients, clip paths, masks and markers. A fragment of the
 * view's own drawing is resolved in the view's own tree and fetches
 * nothing; anything else in a `url()` is refused wherever it is written.
 */
export const CSS_FRAGMENT_PROPERTIES: readonly string[] = ["fill", "stroke", "clip-path", "mask", "marker", "marker-start", "marker-mid", "marker-end"];

/** The at-rules a stylesheet may hold. `@import`, `@font-face`, `@namespace`, `@property`, `@layer` and the rest are refused. */
export const CSS_AT_RULES: readonly string[] = ["media", "supports", "container", "keyframes"];

/**
 * The values a property may take when it may take only some: `position`
 * stays in the region (no `fixed`, no `sticky`), and so does `var()` — a
 * property held to a list is held to a keyword, so a custom property
 * cannot carry `fixed` into it.
 */
export const CSS_KEYWORD_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  position: ["static", "relative", "absolute"],
  /* Never `base-select`: a customizable select's picker is drawn in the top layer, over the whole page, styled by the view (Chrome 135+). */
  appearance: ["auto", "none", "menulist-button", "textfield"],
  "-webkit-appearance": ["auto", "none", "menulist-button", "textfield"],
};

/** Selectors a view's stylesheet may not write: each reaches past the view's own tree. */
export const CSS_REFUSED_SELECTORS: readonly string[] = ["host", "host-context", "slotted", "part", "backdrop", "picker", "view-transition", "view-transition-group", "view-transition-image-pair", "view-transition-old", "view-transition-new"];

/** The largest stylesheet, in characters, a view may give. */
export const OPEN_MAX_STYLESHEET = 64_000;
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
