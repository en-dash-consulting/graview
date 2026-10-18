import {
  HTML_DRAWN_AS,
  HTML_ELEMENTS,
  OPEN_MAX_ATTRIBUTE,
  OPEN_MAX_GEOMETRY,
  OPEN_MAX_IMAGE,
  REFUSED_ROLES,
  SVG_ELEMENTS,
  UNNAMED_ELEMENTS,
  openAttribute,
  svgElementName,
  type OpenAttribute,
} from "../open-kit.js";
import { sanitizeDeclarations, sanitizeValue, type CssRefusal } from "./css.js";

/*
 * WHAT A WORKER VIEW MAY DRAW, ONE ELEMENT AND ONE ATTRIBUTE AT A TIME
 * (FR-90): the open kit's tables (open-kit.ts) read as a judge. Pure — no
 * DOM — so a host can judge a view's drawing anywhere a script runs.
 */

export type OpenNamespace = "html" | "svg";

/** Why part of what a view drew was not drawn. */
export type OpenRefusalReason =
  /** An element outside the open kit, or in a place it may not stand (HTML inside SVG). */
  | "element"
  /** An attribute its element does not take (`src` outside `img`, `href`, `srcset`, `on*`, `formaction`, …). */
  | "attribute"
  /** A value of the wrong kind: not a number, not on the list, a role the app's chrome speaks with. */
  | "value"
  /** An address: an image not `data:` or the host's own `blob:`, a reference not `#id`. */
  | "url"
  /** CSS refused, in a `style` attribute, a presentation attribute or the stylesheet: `css` says what. */
  | "css"
  /** A child its element may not hold. */
  | "child"
  /** A record the format does not know, or one about a node that is not drawn. */
  | "record"
  /** More nodes than the view is allowed. */
  | "budget";

export interface OpenRefusal {
  readonly reason: OpenRefusalReason;
  readonly element?: string;
  readonly name?: string;
  readonly css?: CssRefusal;
  /** The address an image asked for and was refused, as far as 200 characters: said, so its author knows which. */
  readonly address?: string;
}

/** An element as the host draws it, or a refusal. */
export function judgeElement(name: string, parent: OpenNamespace): { readonly namespace: OpenNamespace; readonly name: string; readonly as?: string } | { readonly refused: OpenRefusal } {
  if (parent === "svg") {
    const canonical = svgElementName(name);
    return canonical ? { namespace: "svg", name: canonical } : { refused: { reason: "element", element: name } };
  }
  const lower = name.toLowerCase();
  if (lower === "svg") return { namespace: "svg", name: "svg" };
  if (!Object.prototype.hasOwnProperty.call(HTML_ELEMENTS, lower)) return { refused: { reason: "element", element: name } };
  /* A landmark's or a notice's element is drawn as one with no role of its own (HTML_DRAWN_AS), and says what it was asked to be (`data-graview-as`). */
  return Object.prototype.hasOwnProperty.call(HTML_DRAWN_AS, lower) ? { namespace: "html", name: HTML_DRAWN_AS[lower]!, as: lower } : { namespace: "html", name: lower };
}

/** Whether an element holds nothing (`img`, `input`, `br`). */
export function isEmptyElement(namespace: OpenNamespace, name: string): boolean {
  return (namespace === "html" ? HTML_ELEMENTS[name] : SVG_ELEMENTS[name])?.empty === true;
}

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
/* SVG geometry and transforms: numbers, path letters, commas, brackets and the transform words; never `url`. */
const GEOMETRY = /^[0-9A-Za-z\s.,+\-%()]*$/;
const FRAGMENT = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/;
const DATA_IMAGE = /^data:image\/(png|gif|jpeg|webp|avif|bmp|svg\+xml)(;[A-Za-z0-9=._+-]+)*,/i;
/* An image the app itself holds, by content address: what `add_image` answers, and nothing else under the app. */
const APP_IMAGE = /^\/graview\/assets\/[0-9a-f]{64}\.(png|gif|jpe?g|webp|avif|svg|ico)$/;
/* The same, at the end of a longer path: the app's base in front of it (`/a/<app>`), as a view that read the page's address writes it. */
const APP_IMAGE_AT_END = /\/graview\/assets\/[0-9a-f]{64}\.(png|gif|jpe?g|webp|avif|svg|ico)$/;
/* A path on the page's own host that names only itself: a slash, no second slash, nothing that climbs or hides a slash, no query or fragment. */
const PLAIN_PATH = /^\/(?!\/)(?!(?:.*\/)?\.\.?(?:\/|$))(?!.*%(?:2e|2f|5c))[^\\\s?#"'<>]*$/i;

/**
 * THE APP'S OWN IMAGE, IN THE FORMS A VIEW WRITES IT (2026-10-18): the path
 * `add_image` answered (`/graview/assets/<sha256>.<ext>`), that path under
 * the app's base (`/a/<app>/graview/assets/…`), or the page's own address
 * for it (`https://<the page's origin>/a/<app>/graview/assets/…`). Each is
 * the one image, said as the path the host's `asset` resolves; nothing
 * where it is none of these — another origin, a path that climbs, a query.
 */
export function appImagePath(value: string, origin: string): string | undefined {
  if (APP_IMAGE.test(value)) return value;
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (origin === "null" || parsed.origin !== origin || parsed.username !== "" || parsed.password !== "" || parsed.search !== "" || parsed.hash !== "") return undefined;
      /* The parser has already folded what climbed; the path as written must not have climbed at all. */
      path = value.slice(parsed.origin.length);
    } catch {
      return undefined;
    }
  }
  if (!PLAIN_PATH.test(path)) return undefined;
  return APP_IMAGE_AT_END.exec(path)?.[0];
}

export interface JudgeContext {
  /** The host page's origin, for a `blob:` image of its own. "null" in an opaque origin. */
  readonly origin: string;
  /**
   * Where an image the app holds is loaded from (`/graview/assets/<sha256>.<ext>`):
   * the host's address for it, or undefined to refuse it. Without it, a view
   * draws only `data:` images and the page's own `blob:`. The same image
   * under the app's base, or by the page's own address for it, is handed
   * to it as that path (`appImagePath`).
   */
  readonly asset?: (path: string) => string | undefined;
  /**
   * The origins an image may be loaded from by its `https:` address, as the
   * host lists them (`https://upload.wikimedia.org`): none by default.
   * Drawn with no referrer, so the page's own address goes nowhere.
   */
  readonly imageOrigins?: readonly string[];
}

/** What a host draws besides `data:` images, as a refusal says it: the origins it lists, and whether it says where the app's own images live. */
export interface ImageHost {
  readonly origins?: readonly string[];
  /** The host passes `asset`: the app's own images are drawn by their path. */
  readonly assets?: boolean;
}

/**
 * WHY AN IMAGE'S ADDRESS WAS NOT DRAWN, in a sentence for its author: the
 * address, why, and the ways a view may show an image on THIS host — the
 * app's own images only where it says where they live, `https:` ones only
 * from the origins it lists. It never offers what the host refuses.
 */
export function imageRefusedWords(address: string, host: ImageHost = {}): string {
  const shown = address.length > 120 ? `${address.slice(0, 119)}…` : address;
  const listed = imageOriginsOf(host.origins);
  const own = APP_IMAGE_AT_END.exec(address.split(/[?#]/)[0]!)?.[0];
  const why = own
    ? host.assets
      ? ` It is the app's own image only by its path, or under the app's base on this page's origin: write it as its path, ${own}.`
      : " This host has not said where the app's own images live (asset, on the view's definition), so a view here cannot draw one by its path."
    : /^https:\/\//i.test(address)
      ? listed.length > 0
        ? ` Its origin is not one the host lists for images (${listed.join(", ")}).`
        : " The host lists no origin a view's images may come from (images.origins, on the view's definition)."
      : "";
  const ways = [
    "a data: image",
    ...(host.assets ? ["the app's own image by the path add_image answered (/graview/assets/<sha256>.<ext>)"] : []),
    "a picture on a record (pictures in its manifest)",
    ...(listed.length > 0 ? [`an https: image from ${listed.join(", ")}`] : []),
  ];
  return `The image "${shown}" was not drawn.${why} A view here shows ${ways.slice(0, -1).join(", ")} or ${ways[ways.length - 1]}.`;
}

/** The origins of a host's list that are `https:` origins, as the URL parser says them; anything else in it is no origin. */
export function imageOriginsOf(listed: readonly string[] | undefined): readonly string[] {
  return (listed ?? []).flatMap((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol === "https:" && parsed.hostname !== "" && parsed.username === "" && parsed.password === "" ? [parsed.origin] : [];
    } catch {
      return [];
    }
  });
}

/** An image's `https:` address on an origin the host lists, as the URL parser says it; nothing where it is not one. */
function listedImage(value: string, origins: readonly string[] | undefined): string | undefined {
  if (!origins || origins.length === 0 || !/^https:\/\//i.test(value)) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") return undefined;
    return imageOriginsOf(origins).includes(parsed.origin) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * An attribute as the host draws it: its canonical name and value, `null`
 * to draw it removed, or a refusal. A value the view sets to `null` (Remote
 * DOM's removal) is always a removal.
 */
export function judgeAttribute(
  namespace: OpenNamespace,
  element: string,
  name: string,
  value: string | null,
  context: JudgeContext,
): { readonly name: string; readonly value: string | null; readonly dropped?: readonly OpenRefusal[] } | { readonly refused: OpenRefusal } {
  const found = openAttribute(namespace, element, name);
  if (!found) return { refused: { reason: "attribute", element, name } };
  /* A named section is a region landmark: a section is never named, so it stays a section. */
  if (namespace === "html" && UNNAMED_ELEMENTS[element]?.includes(found.name)) return { refused: { reason: "attribute", element, name } };
  if (value === null) return { name: found.name, value: null };
  const judged = judgeValue(found.name, found.kind, value, context);
  if ("refused" in judged) return { refused: { ...judged.refused, element, ...(found.kind === "image" && judged.refused.reason === "url" ? { address: value.slice(0, 200) } : {}) } };
  /* What the app's chrome and notices speak with stays the app's (ADR 0007: a view never uses the app's bar or notices). */
  if (found.name === "role" && judged.value.split(/\s+/).some((role) => (REFUSED_ROLES as readonly string[]).includes(role.toLowerCase()))) return { refused: { reason: "value", element, name } };
  if (found.name === "aria-live" && !["polite", "off"].includes(judged.value.toLowerCase())) return { refused: { reason: "value", element, name } };
  return { name: found.name, value: judged.value, ...(judged.dropped ? { dropped: judged.dropped.map((css) => ({ reason: css.reason === "url" ? ("url" as const) : ("css" as const), element, name: found.name, css })) } : {}) };
}

function judgeValue(name: string, kind: OpenAttribute, value: string, context: JudgeContext): { readonly value: string; readonly dropped?: readonly CssRefusal[] } | { readonly refused: OpenRefusal } {
  const refused = (reason: OpenRefusalReason, css?: CssRefusal) => ({ refused: { reason, name, ...(css ? { css } : {}) } });
  if (kind === "geometry") {
    if (value.length > OPEN_MAX_GEOMETRY || !GEOMETRY.test(value) || /url/i.test(value)) return refused("value");
    return { value };
  }
  if (kind === "image") {
    if (value.length > OPEN_MAX_IMAGE) return refused("url");
    if (DATA_IMAGE.test(value)) return { value };
    /* A blob: of the host's own page: it is in the page's memory already, and loading it asks nobody. */
    if (value.startsWith(`blob:${context.origin}/`) && /^blob:[^\s"'<>]+$/.test(value)) return { value };
    /* An image the app holds, where the host says it lives: its own host, by content address, so loading it asks nobody new — by its path, under the app's base or by the page's own address for it, each the one path. */
    const own = context.asset ? appImagePath(value, context.origin) : undefined;
    if (own !== undefined) {
      const address = context.asset!(own);
      if (address) return { value: address };
    }
    /* An https: address on an origin the host lists for images (2026-10-15): the host chose to let the page ask it, and asks with no referrer. */
    const listed = listedImage(value, context.imageOrigins);
    if (listed) return { value: listed };
    return refused("url");
  }
  if (value.length > OPEN_MAX_ATTRIBUTE) return refused("value");
  if (typeof kind === "object") {
    const one = kind.oneOf.find((option) => option.toLowerCase() === value.toLowerCase());
    return one === undefined ? refused("value") : { value: one };
  }
  switch (kind) {
    case "text":
      return { value };
    case "number":
      return NUMBER.test(value.trim()) && Number.isFinite(Number(value)) ? { value: value.trim() } : refused("value");
    case "boolean":
      return { value: "" };
    case "fragment":
      return FRAGMENT.test(value) ? { value } : refused("url");
    case "style": {
      const judged = sanitizeDeclarations(value, OPEN_MAX_ATTRIBUTE);
      if (judged.refused.length > 0 && judged.css === "") return refused(judged.refused[0]!.reason === "url" ? "url" : "css", judged.refused[0]);
      /* What was kept is drawn; what was not is written down beside it. */
      return { value: judged.css, ...(judged.refused.length > 0 ? { dropped: judged.refused } : {}) };
    }
    case "css": {
      const judged = sanitizeValue(name, value);
      return "refused" in judged ? refused(judged.refused.reason === "url" ? "url" : "css", judged.refused) : { value: judged.value };
    }
  }
}
