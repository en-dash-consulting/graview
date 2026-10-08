/*
 * A BRAND'S MARKS — its logo and its page icon (FR-124) — as a document
 * holds them: an SVG written inline, or a path on the app's own host
 * (`/graview/assets/<sha256>.svg`, where Graview Cloud keeps what a chat
 * hands it). Drawn as given and never redrawn, so an SVG that could act —
 * run a script, answer an event, embed a page, load anything — is refused
 * with the reason rather than quietly rewritten.
 *
 * READ AS THE BROWSER READS IT. An inline mark reaches the page through
 * the HTML parser, which takes a handler after a slash, an unquoted link,
 * markup after the closing tag and a style written in escapes; rules that
 * search the string for what is forbidden miss each of those. So the SVG
 * is read whole, element by element, as both the HTML and the XML parser
 * will read it, and only what a picture needs is kept: the elements a
 * drawing is made of (no `a`, `style`, `script`, `foreignObject`,
 * animation or `feImage`), no prefixed element, every attribute quoted and
 * apart from the last, no handler, a link only within the picture (`#id`,
 * or a `data:image/` on an `<image>`), a paint or a style that reaches only
 * within it, no CDATA, no entity, and nothing after the root. These are
 * the rules Graview Cloud's `add_image` holds an image to.
 */

/** The most an inline SVG mark may be, in characters. */
export const MAX_INLINE_SVG = 64 * 1024;

/** Whether a mark is an SVG written inline, rather than a path to one. */
export function isInlineSvg(mark: string): boolean {
  return /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>/]/i.test(mark);
}

const SVG_NS = "http://www.w3.org/2000/svg";
const OTHER_MARKUP = ["http://www.w3.org/1999/xhtml", "http://www.w3.org/1998/Math/MathML", SVG_NS];

/** What a picture is made of, spelled as SVG spells it: the HTML parser maps its lower-case reading back to these. */
const ELEMENTS = new Set(
  (
    "svg g defs symbol use title desc path rect circle ellipse line polyline polygon text tspan textPath " +
    "linearGradient radialGradient stop pattern clipPath mask marker image filter feBlend feColorMatrix " +
    "feComponentTransfer feComposite feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur " +
    "feMerge feMergeNode feMorphology feOffset feTile feTurbulence"
  ).split(" "),
);
/** Elements whose content the HTML parser reads as HTML: text alone inside them. */
const TEXT_ONLY = new Set(["title", "desc"]);
const MEDIA = "it embeds a page or media";
/** A refused element a reader would look for by name, said as the checker has always said it. */
const REFUSED_SAID: Record<string, string> = {
  script: "it has a script in it",
  foreignobject: "it embeds HTML (foreignObject)",
  iframe: MEDIA,
  embed: MEDIA,
  object: MEDIA,
  audio: MEDIA,
  video: MEDIA,
  style: "it has a style sheet in it; a mark is styled by its attributes",
  a: "it links to something (an <a> element)",
};

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** An attribute's value as the parser hands it on: character references read; any other named entity is null. */
function decoded(value: string): string | null {
  let unknown = false;
  const out = value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);?/gi, (_, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "�";
    }
    const known = XML_ENTITIES[ref.toLowerCase()];
    if (known === undefined) unknown = true;
    return known ?? "";
  });
  return unknown ? null : out;
}

/** Whether a value reaches only within the picture: no escape, no at-rule, no image function, and every `url(` a fragment of it. */
function staysWithin(value: string): boolean {
  if (/\\|@|expression\s*\(|(?:image-set|cross-fade|image|element|src)\s*\(/i.test(value)) return false;
  for (const [, target] of value.matchAll(/url\s*\(\s*["']?\s*([^)]*)/gi)) if (!target!.startsWith("#")) return false;
  return true;
}

/** Why one attribute may not stand on this element, or null. */
function attributeProblem(element: string, name: string, raw: string): string | null {
  const value = decoded(raw);
  if (value === null) return "it declares XML entities";
  const local = (name.includes(":") ? name.slice(name.indexOf(":") + 1) : name).toLowerCase();
  if (local.startsWith("on")) return "it has an event handler (an on… attribute)";
  if (name === "xml:base") return "it loads or links to something outside itself";
  if (name === "xmlns") return value === SVG_NS ? null : "it changes what its elements are (another xmlns)";
  if (name.startsWith("xmlns:")) return OTHER_MARKUP.includes(value) ? "it changes what its elements are (another xmlns)" : null;
  if (local === "href" || local === "src") {
    const link = value.replace(/[\u0000- ]+/g, "");
    if (link.startsWith("#")) return null;
    if (element === "image" && /^data:image\/(png|jpe?g|gif|webp|avif);/i.test(link)) return null;
    return "it loads or links to something outside itself";
  }
  if (!staysWithin(value)) return local === "style" ? "its style loads something outside itself" : "it loads or links to something outside itself";
  return null;
}

const ATTRIBUTE = /^\s+([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/;

/** Why an SVG may not be drawn as it is: anything that could run, or reach outside the image. Null when it may. */
export function svgProblem(text: string): string | null {
  if (/<!ENTITY/i.test(text)) return "it declares XML entities";
  if (/<!\[CDATA\[/i.test(text)) return "it has a CDATA section, which the page and the picture read differently";
  const open: string[] = [];
  let ended = false;
  let at = /^\s*(<\?xml\s[^?<>]*\?>)?/.exec(text)![0].length;
  while (at < text.length) {
    const rest = text.slice(at);
    const words = /^[^<]+/.exec(rest);
    if (words) {
      if (open.length === 0 && words[0].trim() !== "") return "it is not one SVG: there is text outside it";
      at += words[0].length;
      continue;
    }
    if (rest.startsWith("<!--")) {
      const close = rest.indexOf("-->", 4);
      if (close < 0) return "it has a comment that never ends";
      const body = rest.slice(4, close);
      if (/^-?>/.test(body) || body.includes("--") || body.includes("<!") || body.endsWith("-")) return "it has a comment the page and the picture read differently";
      at += close + 3;
      continue;
    }
    if (/^<!DOCTYPE/i.test(rest)) {
      const doctype = /^<!DOCTYPE\s+svg\b[^<>[\]]*>/i.exec(rest);
      if (!doctype || open.length > 0 || ended) return "it declares XML entities";
      at += doctype[0].length;
      continue;
    }
    const close = /^<\/([A-Za-z][A-Za-z0-9_.:-]*)\s*>/.exec(rest);
    if (close) {
      if (open.pop() !== close[1]) return `it is not one SVG: </${close[1]}> closes what is not open`;
      if (open.length === 0) ended = true;
      at += close[0].length;
      continue;
    }
    const start = /^<([A-Za-z][A-Za-z0-9_.:-]*)/.exec(rest);
    if (!start) return "it is not one SVG: it has markup a picture cannot hold";
    const name = start[1]!;
    const refused = REFUSED_SAID[name.toLowerCase()];
    if (refused) return refused;
    if (ended) return `it is not one SVG: <${name}> comes after it ends`;
    if (open.length === 0 && name !== "svg") return "it is not one SVG";
    if (name.includes(":")) return `it has an element of another kind (<${name}>)`;
    if (!ELEMENTS.has(name)) return `it has a <${name}> element, which a picture does not need`;
    const parent = open[open.length - 1];
    if (parent && TEXT_ONLY.has(parent)) return `it has an element inside a <${parent}>, which the page reads as HTML`;
    let tag = start[0].length;
    for (let attribute = ATTRIBUTE.exec(rest.slice(tag)); attribute; attribute = ATTRIBUTE.exec(rest.slice(tag))) {
      const problem = attributeProblem(name, attribute[1]!, attribute[2] ?? attribute[3] ?? "");
      if (problem) return problem;
      tag += attribute[0].length;
    }
    const end = /^\s*(\/?)>/.exec(rest.slice(tag));
    if (!end) {
      if (/(?:^|[\s/"'])on[a-z]+\s*=/i.test(rest.slice(tag, tag + 400))) return "it has an event handler (an on… attribute)";
      return `it is not one SVG: <${name}>'s attributes are not each quoted and apart`;
    }
    if (end[1] !== "/") open.push(name);
    else if (open.length === 0) ended = true;
    at += tag + end[0].length;
  }
  if (open.length > 0) return `it is not one SVG: <${open[open.length - 1]}> is never closed`;
  return ended ? null : "it is not one SVG";
}

/**
 * Why a mark may not be drawn, or null: an inline SVG under the rules
 * above, or a path on the app's own host — under `/graview/assets/`, or
 * relative to the page, never climbing out of either — and never another
 * origin.
 */
export function markProblem(mark: string): string | null {
  if (isInlineSvg(mark)) {
    if (mark.length > MAX_INLINE_SVG) return `it is over ${MAX_INLINE_SVG / 1024} KB, the most an inline SVG may be`;
    return svgProblem(mark);
  }
  if (/^\s*</.test(mark)) return "it is markup, and not an SVG";
  if (/^[a-z][a-z0-9+.-]*:/i.test(mark) || mark.startsWith("//")) return "it names another origin; a mark is inline SVG or a path on the app's own host, like /graview/assets/<sha256>.svg";
  if (!/^[A-Za-z0-9._~/-]+$/.test(mark)) return "a path is letters, digits and . _ ~ / - only";
  if (mark.split("/").some((part) => part === "." || part === "..")) return "the path climbs out of where it is (a . or .. in it); name the file itself, like /graview/assets/<sha256>.svg";
  if (mark.startsWith("/") && !mark.startsWith("/graview/assets/")) return "a path on the app's own host is under /graview/assets/, or relative to the page";
  return null;
}

/**
 * A mark as an address an `<img>` or a `<link rel="icon">` can take: an
 * inline SVG as a `data:` URI, a path, a web address or a `data:` image as
 * given. Undefined for an inline SVG that could act, and for an address of
 * any other scheme (`javascript:` among them). Which origins a mark may
 * name is the checker's to judge (a document's only its own host; a
 * TypeScript brand's wherever its author serves it); a face draws what it
 * is given.
 */
export function markHref(mark: string | undefined): string | undefined {
  if (!mark) return undefined;
  if (!isInlineSvg(mark)) {
    if (/^\s*</.test(mark)) return undefined;
    const scheme = /^\s*([a-z][a-z0-9+.-]*):/i.exec(mark)?.[1]?.toLowerCase();
    if (scheme === undefined || scheme === "http" || scheme === "https") return mark;
    return scheme === "data" && /^\s*data:image\//i.test(mark) ? mark : undefined;
  }
  return svgProblem(mark) === null ? `data:image/svg+xml,${encodeURIComponent(mark.trim())}` : undefined;
}

/** The page icon a brand asks for, as an address (FR-124), or undefined. */
export function faviconHref(brand: { readonly favicon?: string } | undefined): string | undefined {
  return markHref(brand?.favicon);
}
