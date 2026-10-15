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

export interface JudgeContext {
  /** The host page's origin, for a `blob:` image of its own. "null" in an opaque origin. */
  readonly origin: string;
  /**
   * Where an image the app holds is loaded from (`/graview/assets/<sha256>.<ext>`):
   * the host's address for it, or undefined to refuse it. Without it, a view
   * draws only `data:` images and the page's own `blob:`.
   */
  readonly asset?: (path: string) => string | undefined;
  /**
   * The origins an image may be loaded from by its `https:` address, as the
   * host lists them (`https://upload.wikimedia.org`): none by default.
   * Drawn with no referrer, so the page's own address goes nowhere.
   */
  readonly imageOrigins?: readonly string[];
}

/**
 * WHY AN IMAGE'S ADDRESS WAS NOT DRAWN, in a sentence for its author: the
 * address, and the ways a view may show an image — where an `https:` one
 * is on an origin the host does not list, which origins it does.
 */
export function imageRefusedWords(address: string, origins: readonly string[] = []): string {
  const shown = address.length > 120 ? `${address.slice(0, 119)}…` : address;
  const web = /^https:\/\//i.test(address);
  const listed = imageOriginsOf(origins);
  const why = web
    ? listed.length > 0
      ? ` Its origin is not one the host lists for images (${listed.join(", ")}).`
      : " The host lists no origin a view's images may come from."
    : "";
  return `The image "${shown}" was not drawn.${why} A view shows a data: image, the app's own image (/graview/assets/…), a picture on a record (pictures in its manifest), or an https: image on an origin the host lists (images.origins).`;
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
    /* An image the app holds, where the host says it lives: its own host, by content address, so loading it asks nobody new. */
    if (APP_IMAGE.test(value) && context.asset) {
      const address = context.asset(value);
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
