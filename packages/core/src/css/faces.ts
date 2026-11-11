/*
 * A VIEW'S OWN FACE (HQ f-view-font-face-data).
 *
 * A view's stylesheet loaded nothing, so it refused `@font-face`, and a
 * themed view that wanted a display face for a headline drew its words as
 * SVG outlines. Now a view's stylesheet may declare a face whose every
 * `src` is a `data:` URL of a font: the bytes are in the sheet, so nothing
 * is fetched. The sanitizer reads each such rule here — its family a plain
 * name, its sources decoded and counted, its descriptors the seven a face
 * has — and hands the face on apart from the CSS it writes, which still
 * holds no `@font-face` and no `url()`. The host loads it into the page as
 * a `FontFace` made from the bytes (guest's host/fonts.ts).
 *
 * A VIEW'S FACE IS THE VIEW'S ALONE. In the document a face is the page's
 * under its family, so a face loaded under the name a view wrote would
 * draw wherever the page, or another view, names that family. So each is
 * loaded under a name the host gives that view on its page
 * (`viewFaceFamily(scope, family)`), and the view's sheets, style
 * attributes and presentation attributes are written with every
 * `font-family` and `font` that names the face naming that instead: it
 * draws in the view that declared it and nowhere else, whatever it is
 * called. A family the app lends its views (`brand.views.fonts`) stays the
 * app's: a view's own face of that name is refused, and is not renamed, so
 * the view's text in it is drawn in the app's.
 *
 * Only a view's own sheets are read so (`{ faces }`): the app's stylesheet
 * for every view lends its faces by `brand.views.fonts`, and refuses
 * `@font-face` as before. No imports but types and the family rule: the
 * sanitizer brings this, and what is said of a refusal is faces-words.ts.
 */
import { familyNameProblem } from "./fonts.js";
import type { ComponentValue, CssRefusal, Declaration } from "./sanitize.js";

/**
 * The most bytes one face a view's stylesheet declares may be, decoded
 * (HQ f-view-font-face-data). A view's face rides in its stylesheet — in
 * every message the view sends with its sheets, and decoded on every page
 * that draws it — so it is a face cut to what a view draws: a display face
 * subset to Latin in WOFF2 is 15–40 KB. A whole family, or a face for a
 * script with thousands of glyphs, is a file the app holds and lends its
 * views (`brand.views.fonts`, up to `VIEW_FONT_MOST_BYTES`), fetched once.
 */
export const VIEW_FACE_MOST_BYTES = 50_000;

/**
 * The most bytes a view's faces may be together, decoded: four such faces —
 * a display face, its italic, a bold and a numeral set — which keeps the
 * sheets a view sends within a few hundred KB of text however many faces
 * it declares.
 */
export const VIEW_FACES_MOST_BYTES = 200_000;

/** The most faces a view's stylesheets may declare: the sixteen pieces a subset by unicode-range might be cut into. */
export const VIEW_FACES_MOST = 16;

/** The descriptors a view's face may say: anything else is left out of it, and said. */
export const VIEW_FACE_DESCRIPTORS: readonly string[] = ["font-family", "src", "font-weight", "font-style", "font-display", "unicode-range", "font-stretch"];

/**
 * How much more than their budget a view's sheets together may be read for
 * the faces in them: twice what the faces may be as base64, so a face a
 * little past its bounds is refused by name. One allowance for all of a
 * view's sheets, read before any is parsed, so what is parsed of them is
 * bounded however many there are; and of what is read, only the faces kept
 * are not counted toward the sheets' budget.
 */
export const VIEW_FACES_TEXT_ALLOWANCE = 2 * Math.ceil(VIEW_FACES_MOST_BYTES / 3) * 4;

/** The most stylesheets of a view's that are read where it may declare faces: more is said, and not read. */
export const VIEW_SHEETS_MOST = 64;

/** The name a view's face is loaded and drawn under on its page: the host's name for the view, then the family it wrote. */
export function viewFaceFamily(scope: string, family: string): string {
  return `${scope} ${family}`;
}

/** Each face's family, lowercased, to its name on the page (`viewFaceFamily`). */
export function facesRenamed(faces: readonly ViewFace[], scope: string): ReadonlyMap<string, string> {
  return new Map(faces.map((face) => [face.family.toLowerCase(), viewFaceFamily(scope, face.family)]));
}

/**
 * A `font-family` or `font` value with every family that names one of the
 * view's faces written as its name on the page: in each comma's part, the
 * family is its last string, or the idents it ends with (`700 2rem Shout
 * Display`). Anything else is left as it was.
 */
export function renameFamilies(values: readonly ComponentValue[], rename: ReadonlyMap<string, string>): ComponentValue[] {
  const out: ComponentValue[] = [];
  let part: ComponentValue[] = [];
  const flush = () => {
    let end = part.length;
    while (end > 0 && part[end - 1]!.type === "whitespace") end -= 1;
    let start = end;
    let name: string | undefined;
    const last = part[end - 1];
    if (last?.type === "string") {
      start = end - 1;
      name = last.value;
    } else {
      while (start > 0 && (part[start - 1]!.type === "ident" || part[start - 1]!.type === "whitespace")) start -= 1;
      while (start < end && part[start]!.type === "whitespace") start += 1;
      const words = part.slice(start, end).filter((one) => one.type === "ident") as { value: string }[];
      name = words.length > 0 ? words.map((one) => one.value).join(" ") : undefined;
    }
    const to = name === undefined ? undefined : rename.get(name.toLowerCase());
    out.push(...(to === undefined ? part : [...part.slice(0, start), { type: "string" as const, value: to }, ...part.slice(end)]));
    part = [];
  };
  for (const value of values) {
    if (value.type === ",") {
      flush();
      out.push(value);
    } else part.push(value);
  }
  flush();
  return out;
}

/** One source of a view's face: its bytes, decoded, and the type its URL said. */
export interface ViewFaceSource {
  readonly type: string;
  readonly bytes: Uint8Array;
}

/** A face a view's stylesheet declares, as the host loads it: its sources tried in order, and its descriptors as `FontFace` takes them. */
export interface ViewFace {
  readonly family: string;
  readonly sources: readonly ViewFaceSource[];
  /** Its sources' bytes together. */
  readonly size: number;
  readonly weight?: string;
  readonly style?: string;
  readonly stretch?: string;
  readonly display?: string;
  readonly unicodeRange?: string;
}

/** What was wrong with a face, as `CssRefusal.name` says it where its reason is `font-face`. */
export type ViewFaceProblem = "where" | "unreadable" | "family" | "src" | "address" | "local" | "type" | "encoding" | "bytes" | "size" | "total" | "count" | "descriptor" | "value" | "lent";

/** The types a font's `data:` URL may say: the four of `font/`, and the older names servers still give a font, as a lent face's file may be served. */
export function isFontType(type: string): boolean {
  return ["font/woff2", "font/woff", "font/ttf", "font/otf"].includes(type) || /^application\/(?:x-)?font-[a-z0-9.+-]+$/.test(type) || type === "application/octet-stream";
}

/** Whether bytes begin as a font file does: WOFF2, WOFF, TrueType (two signatures) or OpenType. Whatever its URL says, a face is read only from these. */
function isFontFile(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const tag = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  return tag === "wOF2" || tag === "wOFF" || tag === "OTTO" || tag === "true" || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0);
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** A `data:` URL's bytes, decoded and counted, or why not. `most`: past this many it is not decoded at all. */
function readData(url: string, most: number): { readonly type: string; readonly bytes: Uint8Array } | { readonly problem: "type" | "encoding" | "bytes"; readonly type?: string } | { readonly problem: "size"; readonly bytes: number } {
  const comma = url.indexOf(",");
  const head = comma < 0 ? url.slice(5) : url.slice(5, comma);
  const [given = "", ...parameters] = head.split(";");
  const type = given.trim().toLowerCase();
  if (!isFontType(type)) return { problem: "type", type: type || "no type" };
  if (comma < 0 || !parameters.some((one) => one.trim().toLowerCase() === "base64")) return { problem: "encoding" };
  const text = url.slice(comma + 1);
  if (!BASE64.test(text) || text.length % 4 === 1) return { problem: "encoding" };
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  if (padding > 0 && text.length % 4 !== 0) return { problem: "encoding" };
  /* What it would decode to, exactly, for base64 so read: past the most, not decoded. */
  const length = Math.floor(((text.length - padding) * 3) / 4);
  if (length > most) return { problem: "size", bytes: length };
  let binary: string;
  try {
    binary = atob(text);
  } catch {
    return { problem: "encoding" };
  }
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at);
  /* Counted again as decoded: the size held is the bytes', not the arithmetic's. */
  if (bytes.byteLength > most) return { problem: "size", bytes: bytes.byteLength };
  if (!isFontFile(bytes)) return { problem: "bytes" };
  return { type, bytes };
}

const lower = (value: string) => value.replace(/[A-Z]/g, (c) => c.toLowerCase());
const parts = (values: readonly ComponentValue[]) => values.filter((one) => one.type !== "whitespace");
/** A value cut at its top-level commas. */
function byComma(values: readonly ComponentValue[]): ComponentValue[][] {
  const out: ComponentValue[][] = [[]];
  for (const value of values) {
    if (value.type === ",") out.push([]);
    else out.at(-1)!.push(value);
  }
  return out.map(parts);
}
/** A value's words as written, for the descriptors held to a pattern: idents, numbers, dimensions, percentages and `?`. Undefined where it holds anything else. */
function wordsOf(values: readonly ComponentValue[]): string | undefined {
  let out = "";
  for (const value of values) {
    if (value.type === "whitespace") out += " ";
    else if (value.type === "ident") out += value.value;
    else if (value.type === "number" || value.type === "percentage") out += value.type === "percentage" ? `${value.repr}%` : value.repr;
    else if (value.type === "dimension") out += `${value.repr}${value.unit}`;
    else if (value.type === "delim" && (value.value === "?" || value.value === "+" || value.value === "-")) out += value.value;
    else if (value.type === ",") out += ",";
    else return undefined;
  }
  return out.trim().replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ");
}

const WEIGHT = /^(?:normal|bold|(?:[1-9]\d{0,2}|1000)(?: (?:[1-9]\d{0,2}|1000))?)$/;
const STYLE = /^(?:normal|italic|oblique)$/;
const STRETCH = /^(?:normal|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded|\d{1,3}(?:\.\d+)?%(?: \d{1,3}(?:\.\d+)?%)?)$/;
const DISPLAY = /^(?:auto|block|swap|fallback|optional)$/;
const RANGE = /^u\+[0-9a-f?]{1,6}(?:-[0-9a-f]{1,6})?(?:, u\+[0-9a-f?]{1,6}(?:-[0-9a-f]{1,6})?)*$/i;

/** A face's family as written: one string, or idents with spaces between. Undefined where it is anything else (a list, a function, nothing). */
function familyOf(values: readonly ComponentValue[]): string | undefined {
  const shown = parts(values);
  if (shown.length === 1 && shown[0]!.type === "string") return shown[0]!.value;
  if (shown.length > 0 && shown.every((one) => one.type === "ident")) return shown.map((one) => (one as { value: string }).value).join(" ");
  return undefined;
}

/** What is spent of a view's faces so far: across its sheets, in the order it gave them. */
export interface FaceBudget {
  bytes: number;
  count: number;
}

/**
 * One `@font-face` of a view's stylesheet, at its top, judged: the face, or
 * nothing, with every refusal said as `{ reason: "font-face", name: <the
 * problem> }`. `budget` is spent by a face kept.
 */
export function judgeFace(prelude: readonly ComponentValue[], items: readonly (Declaration | { readonly type: "at-rule" | "qualified" })[], budget: FaceBudget, refuse: (refusal: CssRefusal) => void, lent: readonly string[] = []): { readonly face?: ViewFace; readonly data: number } {
  const declared = new Map<string, Declaration>();
  const stray: string[] = [];
  let data = 0;
  for (const item of items) {
    if (item.type !== "declaration") {
      stray.push("a rule");
      continue;
    }
    const name = item.name.startsWith("--") ? item.name : lower(item.name);
    if (name === "src") for (const value of item.value) data += dataLength(value);
    if (!VIEW_FACE_DESCRIPTORS.includes(name)) {
      stray.push(name);
      continue;
    }
    declared.set(name, item);
  }
  const familyDeclared = declared.get("font-family");
  const written = familyDeclared && !familyDeclared.important ? familyOf(familyDeclared.value) : undefined;
  const familyProblem = familyNameProblem(written);
  /* Named in what is said only where it is a plain name: one that is not is never written back, here or anywhere. */
  const plain = written !== undefined && familyProblem !== familyNameProblem(undefined) ? written : undefined;
  for (const descriptor of stray) refuse({ reason: "font-face", name: "descriptor", ...(plain !== undefined ? { family: plain } : {}), descriptor });
  const refuseFace = (name: ViewFaceProblem, more: Partial<CssRefusal> = {}) => {
    refuse({ reason: "font-face", name, ...(plain !== undefined ? { family: plain } : {}), ...more });
    return { data };
  };
  if (parts(prelude).length > 0) return refuseFace("unreadable");
  if (written === undefined || familyProblem) return refuseFace("family", { said: familyProblem ?? "its family is one name" });
  const family = written;
  /* A name the app lends its views is the app's: its face is drawn there, and the view's is not loaded. */
  if (lent.some((one) => one.toLowerCase() === family.toLowerCase())) return refuseFace("lent");
  const src = declared.get("src");
  if (!src) return refuseFace("src", { said: "no src" });
  const sources: ViewFaceSource[] = [];
  for (const entry of byComma(src.value)) {
    const [first, ...rest] = entry;
    const url = first?.type === "url" ? first.value : first?.type === "func" && lower(first.name) === "url" && parts(first.value).length === 1 && parts(first.value)[0]!.type === "string" ? (parts(first.value)[0] as { value: string }).value : undefined;
    if (first?.type === "func" && lower(first.name) === "local") return refuseFace("local");
    if (url === undefined) return refuseFace("src");
    if (!/^data:/i.test(url)) return refuseFace("address", { said: url.slice(0, 80) });
    /* After the url, its format() alone: a tech() or anything else is no source a view's face takes. */
    if (rest.length > 1 || (rest[0] && !(rest[0].type === "func" && lower(rest[0].name) === "format" && parts(rest[0].value).every((one) => one.type === "string" || one.type === "ident" || one.type === ",")))) return refuseFace("src");
    const read = readData(url, VIEW_FACE_MOST_BYTES);
    if ("problem" in read) {
      if (read.problem === "size") return refuseFace("size", { bytes: read.bytes });
      return refuseFace(read.problem, "type" in read && read.type ? { said: read.type } : {});
    }
    sources.push(read);
  }
  if (sources.length === 0) return refuseFace("src");
  const size = sources.reduce((sum, one) => sum + one.bytes.byteLength, 0);
  if (size > VIEW_FACE_MOST_BYTES) return refuseFace("size", { bytes: size });
  if (budget.count + 1 > VIEW_FACES_MOST) return refuseFace("count");
  if (budget.bytes + size > VIEW_FACES_MOST_BYTES) return refuseFace("total", { bytes: budget.bytes + size });
  const descriptor = (name: string, pattern: RegExp): string | undefined => {
    const given = declared.get(name);
    if (!given) return undefined;
    const said = given.important ? undefined : wordsOf(given.value);
    if (said === undefined || !pattern.test(said)) {
      refuse({ reason: "font-face", name: "value", family, descriptor: name });
      /* A descriptor said but refused is the face's as if it said none. */
      return undefined;
    }
    return name === "unicode-range" ? said.toUpperCase() : lower(said);
  };
  const weight = descriptor("font-weight", WEIGHT);
  const style = descriptor("font-style", STYLE);
  const stretch = descriptor("font-stretch", STRETCH);
  const display = descriptor("font-display", DISPLAY);
  const unicodeRange = descriptor("unicode-range", RANGE);
  budget.bytes += size;
  budget.count += 1;
  return { face: { family, sources, size, ...(weight ? { weight } : {}), ...(style ? { style } : {}), ...(stretch ? { stretch } : {}), ...(display ? { display } : {}), ...(unicodeRange ? { unicodeRange } : {}) }, data };
}

/** How many characters of a sheet a `data:` URL in a face's src holds: what the sheet's own budget does not count. */
function dataLength(value: ComponentValue): number {
  if (value.type === "url") return /^data:/i.test(value.value) ? value.value.length : 0;
  if (value.type === "func") return value.value.reduce((sum, one) => sum + (one.type === "string" && /^data:/i.test(one.value) ? one.value.length : dataLength(one)), 0);
  return 0;
}
