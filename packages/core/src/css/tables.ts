/*
 * THE CSS A VIEW MAY WRITE, AND WHAT EVERY VIEW OF AN APP IS DRESSED IN
 * (FR-90, Roadmap f-app-wide-view-theme): the allowlists the sanitizer
 * (sanitize.ts) holds a stylesheet to. They lived in `@graview/guest`'s
 * open kit; they are the framework's here because a document's own
 * stylesheet for its views (`brand.views.css`) is judged by `graview check`
 * and `editDocument` with the same code a page draws with, and the checker
 * reaches nothing of the guest. The guest's open kit keeps the HTML and
 * SVG it draws, and its host imports these from here.
 *
 * No imports: the tables and the sanitizer run wherever a script runs.
 */

/**
 * The elements the host draws as another, which a selector names as the
 * author wrote them (sanitize.ts): the guest's `HTML_DRAWN_AS`, which a
 * guest test holds equal to this, since the open kit a view's runtime
 * carries imports nothing of the framework.
 */
export const CSS_DRAWN_AS: Readonly<Record<string, string>> = { nav: "div", header: "div", footer: "div", aside: "div", search: "div", output: "span" };

/**
 * THE CSS A VIEW MAY WRITE: an allowlist of properties, so a property a
 * browser ships tomorrow that takes an image is refused until somebody adds
 * it here, rather than drawn until somebody notices.
 */
export const CSS_PROPERTIES: readonly string[] = [
  // box and layout; `all` takes only the keywords every property does (`all: unset` resets a button's chrome)
  "all", "display", "position", "top", "right", "bottom", "left", "inset", "inset-block", "inset-inline", "inset-block-start", "inset-block-end", "inset-inline-start", "inset-inline-end",
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
  // color and surface
  "color", "background", "background-color", "background-image", "background-position", "background-position-x", "background-position-y", "background-size", "background-repeat",
  "background-origin", "background-clip", "background-attachment", "background-blend-mode",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-block", "border-inline", "border-block-start", "border-block-end", "border-inline-start", "border-inline-end",
  "border-width", "border-style", "border-color", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "border-start-start-radius", "border-start-end-radius", "border-end-start-radius", "border-end-end-radius", "border-collapse", "border-spacing",
  "outline", "outline-width", "outline-style", "outline-color", "outline-offset", "box-shadow", "opacity", "visibility", "mix-blend-mode", "filter", "backdrop-filter",
  "clip-path", "accent-color", "caret-color", "color-scheme", "appearance", "-webkit-appearance",
  /* A mask takes a gradient (2026-10-23): every url() and image-set() in it is refused as anywhere else. */
  "mask-image", "mask-size", "mask-position", "mask-repeat", "mask-origin", "mask-clip", "mask-composite", "mask-mode", "mask-type",
  "-webkit-mask", "-webkit-mask-image", "-webkit-mask-size", "-webkit-mask-position", "-webkit-mask-repeat", "-webkit-mask-origin", "-webkit-mask-clip", "-webkit-mask-composite",
  // type
  "font", "font-family", "font-size", "font-weight", "font-style", "font-stretch", "font-variant", "font-variant-numeric", "font-variant-caps", "font-variant-ligatures",
  "font-feature-settings", "font-variation-settings", "font-kerning", "font-optical-sizing", "font-size-adjust", "font-synthesis",
  "line-height", "letter-spacing", "word-spacing", "text-align", "text-align-last", "text-indent", "text-transform", "text-decoration", "text-decoration-line",
  "text-decoration-color", "text-decoration-style", "text-decoration-thickness", "text-underline-offset", "text-underline-position", "text-shadow", "text-overflow",
  "text-wrap", "text-wrap-mode", "text-wrap-style", "white-space", "white-space-collapse", "word-break", "line-break", "hyphens", "tab-size", "direction", "unicode-bidi", "writing-mode",
  "text-orientation", "text-rendering", "-webkit-font-smoothing", "-webkit-line-clamp", "-webkit-box-orient", "line-clamp", "-webkit-text-fill-color", "-webkit-background-clip",
  "-webkit-text-stroke", "-webkit-text-stroke-width", "-webkit-text-stroke-color",
  "list-style", "list-style-type", "list-style-position", "content", "quotes", "counter-reset", "counter-increment", "counter-set",
  "table-layout", "caption-side", "empty-cells",
  // motion
  "transform", "transform-origin", "transform-box", "transform-style", "translate", "rotate", "scale", "perspective", "perspective-origin", "backface-visibility",
  "transition", "transition-property", "transition-duration", "transition-timing-function", "transition-delay", "transition-behavior",
  "animation", "animation-name", "animation-duration", "animation-timing-function", "animation-delay", "animation-iteration-count", "animation-direction",
  "animation-fill-mode", "animation-play-state", "animation-composition", "will-change",
  /* Scroll-driven (2026-10-23): a view's motion tied to a scroll, held still where a person asks for less motion (host/open-draw.ts). */
  "animation-timeline", "animation-range", "animation-range-start", "animation-range-end", "scroll-timeline", "scroll-timeline-name", "scroll-timeline-axis",
  "view-timeline", "view-timeline-name", "view-timeline-axis", "view-timeline-inset", "timeline-scope",
  // interaction
  "cursor", "pointer-events", "user-select", "-webkit-user-select", "touch-action", "resize", "scroll-behavior", "overscroll-behavior", "overscroll-behavior-x", "overscroll-behavior-y",
  "scroll-snap-type", "scroll-snap-align", "scroll-snap-stop", "scroll-margin", "scroll-padding", "scrollbar-width", "scrollbar-color", "scrollbar-gutter",
  // SVG
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "stroke-miterlimit",
  "stop-color", "stop-opacity", "clip-rule", "marker", "marker-start", "marker-mid", "marker-end", "paint-order", "vector-effect", "shape-rendering", "text-anchor",
  "dominant-baseline", "alignment-baseline", "r", "cx", "cy", "rx", "ry", "x", "y", "d", "mask", "flood-color", "flood-opacity", "lighting-color", "color-interpolation-filters",
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
  "scroll", "view",
];

/**
 * Where `url(#id)` stays: the paints and references an SVG drawing makes
 * to its own gradients, clip paths, masks and markers. A fragment of the
 * view's own drawing is resolved in the view's own tree and fetches
 * nothing; anything else in a `url()` is refused wherever it is written.
 */
export const CSS_FRAGMENT_PROPERTIES: readonly string[] = ["fill", "stroke", "clip-path", "mask", "marker", "marker-start", "marker-mid", "marker-end", "filter"];

/**
 * The at-rules a stylesheet may hold. `@import`, `@font-face`, `@namespace`,
 * `@property`, `@layer` and the rest are refused: `@property` registers a
 * custom property for the whole page, the app's own `--graview-*` too.
 */
export const CSS_AT_RULES: readonly string[] = ["media", "supports", "container", "keyframes"];

/**
 * The values a property may take when it may take only some: `position`
 * stays in the region (no `fixed`), and so does `var()` — a property held
 * to a list is held to a keyword, so a custom property cannot carry `fixed`
 * into it. `sticky` stays too (2026-10-15): it sticks within its own
 * parent's box, and the region is painted contained (`contain: paint`,
 * `overflow: clip`, its own stacking context), so a view's header held in
 * place never paints past the view or over the app. `all` takes the four
 * keywords alone, which reset and never load.
 */
export const CSS_KEYWORD_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  position: ["static", "relative", "absolute", "sticky"],
  all: [],
  /* Never `base-select`: a customizable select's picker is drawn in the top layer, over the whole page, styled by the view (Chrome 135+). */
  appearance: ["auto", "none", "menulist-button", "textfield"],
  "-webkit-appearance": ["auto", "none", "menulist-button", "textfield"],
};

/** Selectors a view's stylesheet may not write: each reaches past the view's own tree. */
export const CSS_REFUSED_SELECTORS: readonly string[] = ["host", "host-context", "slotted", "part", "backdrop", "picker", "view-transition", "view-transition-group", "view-transition-image-pair", "view-transition-old", "view-transition-new"];

/**
 * The prefixed pseudo-elements a view's stylesheet may write: every other
 * `-webkit-` or `-moz-` selector is refused, as a name the open kit cannot
 * read the reach of. `::-webkit-details-marker` is Safari's `summary::marker`
 * (FR-221): a disclosure's own triangle, drawn or hidden, in its own tree.
 */
export const CSS_PREFIXED_SELECTORS: readonly string[] = ["-webkit-details-marker"];

/** The largest stylesheet, in characters, a view may give. */
export const OPEN_MAX_STYLESHEET = 64_000;
