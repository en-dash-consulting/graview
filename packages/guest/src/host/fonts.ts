import { brandFamilies, VIEW_FONT_MOST_BYTES, VIEW_FONTS_MOST, viewFaceRefusedWords, viewFamilyProblem, viewFontProblem, viewFontSource, type ViewFace, type ViewFont } from "@graview/core/css";
import { imageOriginsOf } from "./open-judge.js";
import { lentNamed } from "./own-faces.js";

/* A view's own face refused by the open kit, said as the page says it: fetched with the faces (view.ts). */
export { viewFaceRefusedWords } from "@graview/core/css";
import type { GuestFont } from "../protocol.js";

/*
 * THE FACES AN APP LENDS ITS VIEWS, LOADED (Roadmap
 * f-view-authoring-friction-2026-11): `brand.views.fonts`, each loaded into
 * the page as a `FontFace` — never by a view's stylesheet, which still loads
 * nothing — and named by a view's sheet and the app's sheet for views as any
 * face is. Loaded into the document, not the view's shadow root: a face a
 * page's document holds is drawn in every shadow tree, and one declared
 * inside a shadow root is not loaded by every engine. A face is fetched only
 * from where the host says faces come from — a file the app holds, by the
 * content address the host serves (`asset`), or an `https:` address on an
 * origin the host lists for faces (`fonts.origins`, read as an image's
 * origins are, and apart from them) — so an app names no server the host
 * did not choose. In the document it is the page's, so a face never takes a
 * name the page already draws in, and it goes again when the last view
 * holding it does. Fetched with the first view that is dressed in a brand
 * that lends one, and only then.
 *
 * BOUNDED (Roadmap f-lent-faces-bounded). A file the app holds is loaded
 * eagerly, so it has a size it may not pass, `VIEW_FONT_MOST_BYTES`.
 * `FontFace` given an address fetches all of it and has nothing to stop at a
 * size with, so the host fetches such a file itself — one that says it is
 * larger is not read, one that says nothing is counted as it streams and let
 * go once past the limit — and hands `FontFace` the bytes. A face on an
 * origin the host lists is loaded by its address, as a page loads any face:
 * what it may be is that origin's to bound.
 *
 * ONE FILE A NAME. Two brands on one page may lend one name (family, weight
 * and style) from two files; with both in the document, which drew was the
 * engine's. Now the page holds one of them at a time: of those lent, the one
 * lent last — lending a file again makes it the last — once it has loaded,
 * in every view on the page. The others are set aside, and the next drawn
 * again when it goes. Once the one that will draw has loaded, every view
 * lending under the name is told which it is.
 */

export interface ViewFontsOptions {
  /** Where a file the app holds is loaded from (MountWorkerViewOptions.asset). */
  readonly asset?: (path: string) => string | undefined;
  /** The `https:` origins a lent face may come from (MountWorkerViewOptions.fonts), apart from a view's images. */
  readonly origins?: readonly string[];
  /** The brand's own stacks: a face lent to a view never takes one of their names. */
  readonly typography?: { readonly body?: string; readonly display?: string; readonly mono?: string };
}

const named = (family: unknown) => `The app's face "${String(family)}" for its views`;
/** A face whose file answered as something else: not read as a font. */
const notAFont = (family: string, url: string, type: string) => `${named(family)} is not loaded: ${url} answered ${type || "no type"}, not a font.`;

/** Where the page loads a face from, or why it does not. */
export function viewFontAddress(font: ViewFont, options: ViewFontsOptions): { readonly url: string } | { readonly refused: string } {
  const not = `${named((font as { family?: unknown }).family)} is not loaded`;
  const problem = viewFontProblem(font, brandFamilies(options.typography));
  if (problem) return { refused: `${not}: ${problem}.` };
  const source = viewFontSource(font.src)!;
  if ("asset" in source) {
    const url = options.asset?.(source.asset);
    return url ? { url } : { refused: `${not}: this host says nowhere the app's own files are served (\`asset\`), so ${font.src} is not fetched.` };
  }
  return imageOriginsOf(options.origins).includes(new URL(source.https).origin) ? { url: source.https } : { refused: `${not}: ${source.origin} is no origin this host lists for the faces its views are lent (\`fonts.origins\`), so it is not fetched.` };
}

/** A face's file, read up to the limit: its bytes, `over` past it, or `failed`. Never sent on elsewhere. A file the app holds is asked for with the page's session, one on a listed origin with none. */
async function readHeld(fetcher: typeof fetch, url: string, signal: AbortSignal, credentials: RequestCredentials = "same-origin"): Promise<ArrayBuffer | "over" | "failed" | { readonly type: string }> {
  const response = await fetcher(url, { signal, credentials, redirect: "error" });
  if (!response.ok) {
    void response.body?.cancel();
    return "failed";
  }
  /* A font (or one of the older names servers still give it), bytes that say nothing more, or no type at all: anything else (a page, a sign-in) is not read as one. */
  const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (type !== "" && !type.startsWith("font/") && !type.startsWith("application/font-") && !type.startsWith("application/x-font-") && type !== "application/octet-stream") {
    void response.body?.cancel();
    return { type };
  }
  const declared = Number(response.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > VIEW_FONT_MOST_BYTES) {
    void response.body?.cancel();
    return "over";
  }
  /* No body to count as it comes: not read whole to find out. */
  const reader = response.body?.getReader();
  if (!reader) return "failed";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > VIEW_FONT_MOST_BYTES) {
      void reader.cancel();
      return "over";
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes.buffer as ArrayBuffer;
}

/** One view's lending: what it says to, and whether a newer lending of the same view is about to give it back. */
interface Lending {
  readonly say: (said: string) => void;
  going: boolean;
}
/** One file lent under a name: the lendings holding it (each with the face as it said it: `The app's face "X" for its views`), and its face once it has loaded. `shown`: the file as it is said. */
interface Lent {
  readonly url: string;
  readonly shown: string;
  readonly stop: AbortController;
  readonly holders: Map<Lending, string>;
  readonly settled: Promise<void>;
  readonly settle: () => void;
  face?: FontFace;
  drawn: boolean;
}
/** A name (family, weight, style) on a page: its files, the last lent last, and the file last said to draw. */
interface Name {
  readonly files: Lent[];
  told?: string;
}
const held = new WeakMap<Document, Map<string, Name>>();
const lendings = new WeakMap<() => void, Lending>();

/** A face's weight as the engine matches it: no weight is "normal", which is 400, as "bold" is 700. */
const weightOf = (font: ViewFont) => {
  const weight = String(font.weight ?? "normal").trim().replace(/\s+/g, " ").toLowerCase();
  return weight === "normal" ? "400" : weight === "bold" ? "700" : weight;
};
/** A face's name: its family, weight and style, as the engine matches them, without regard to case. */
const nameOf = (font: ViewFont) => JSON.stringify([font.family.toLowerCase(), weightOf(font), (font.style ?? "normal").toLowerCase()]);

/** Put in the page's fonts the one face a name draws, take out the others, and say which, once the one that will draw has loaded. */
function draw(document: Document, name: Name) {
  let drawing: Lent | undefined;
  for (let at = name.files.length - 1; at >= 0 && !drawing; at -= 1) if (name.files[at]!.face) drawing = name.files[at];
  for (const one of name.files) {
    if (one === drawing || !one.drawn) continue;
    document.fonts?.delete(one.face!);
    one.drawn = false;
  }
  if (drawing && !drawing.drawn) {
    document.fonts?.add(drawing.face!);
    drawing.drawn = true;
  }
  /* What a lending about to be given back holds is not counted: a brand changing one file for another is not two. */
  const staying = name.files.filter((one) => [...one.holders.keys()].some((lending) => !lending.going));
  if (staying.length < 2) {
    name.told = undefined;
    return;
  }
  if (!drawing || drawing !== staying.at(-1) || name.told === drawing.url) return;
  name.told = drawing.url;
  const told = new Set<Lending>();
  for (const one of staying) {
    for (const [lending, face] of one.holders) {
      if (lending.going || told.has(lending)) continue;
      told.add(lending);
      lending.say(`${face} is lent from ${staying.length} files on this page, and the one drawn in every view is ${drawing.shown}.`);
    }
  }
}

/**
 * Add each face the page may load to its fonts, and say each it may not.
 * What it answers gives them back. `replacing`: what the same view's last
 * lending answered, given back once each face of this one has loaded or
 * failed, so the view is not left without a face meanwhile and a face both
 * lend is never let go between them.
 */
export function loadViewFonts(document: Document, fonts: readonly ViewFont[], options: ViewFontsOptions, say: (said: string) => void, replacing?: () => void): () => void {
  const asks: Ask[] = [];
  if (fonts.length > VIEW_FONTS_MOST) say(`The app lends its views ${fonts.length} faces and at most ${VIEW_FONTS_MOST} are loaded, so ${fonts.slice(VIEW_FONTS_MOST).map((font) => `"${font.family}"`).join(", ")} ${fonts.length - VIEW_FONTS_MOST === 1 ? "is" : "are"} not.`);
  for (const font of fonts.slice(0, VIEW_FONTS_MOST)) {
    const at = viewFontAddress(font, options);
    if ("refused" in at) {
      say(at.refused);
      continue;
    }
    const isHeld = "asset" in viewFontSource(font.src)!;
    asks.push({
      key: nameOf(font),
      family: font.family,
      face: named(font.family),
      url: at.url,
      shown: at.url,
      descriptors: { display: "swap", ...(font.weight !== undefined ? { weight: weightOf(font) } : {}), ...(font.style ? { style: font.style.toLowerCase() } : {}) },
      source: isHeld ? { held: at.url } : { address: at.url },
    });
  }
  return lend(document, asks, say, replacing);
}

/** A view's own face as said: the family as its stylesheet declares it. */
const own = (family: string) => `The view's own face "${family}"`;
/** Bytes as an identity a file is known by on the page: two views declaring one face from the same bytes hold one file. */
function digestOf(face: ViewFace): string {
  let hash = 0x811c9dc5;
  for (const source of face.sources) for (const byte of source.bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return `own:${face.size}:${hash.toString(16)}`;
}

/** Where a view's own faces are judged against what the page already has: the families the app lends its views, and its own stacks. */
export interface ViewFacesOptions {
  /** The families the app lends its views (`brand.views.fonts`): of one name, the app's face is drawn. */
  readonly lent?: readonly string[];
  readonly typography?: ViewFontsOptions["typography"];
}

/**
 * THE FACES A VIEW'S OWN STYLESHEET DECLARES, LOADED (HQ
 * f-view-font-face-data): each a `data:` font the open kit judged and
 * decoded (`@graview/core/css`), made a `FontFace` from its bytes here —
 * never from an address, so nothing is fetched and the page's policy for
 * fonts is not asked — and held as a lent face is: one file a name on the
 * page, the last lent drawn and the views lending it told which, and gone
 * when the last view holding it does. A face named as one the app lends its
 * views is not loaded (own-faces.ts), nor one the brand's own stacks name.
 * What it answers gives them back; `replacing` as for `loadViewFonts`.
 */
export function loadViewFaces(document: Document, faces: readonly ViewFace[], options: ViewFacesOptions, say: (said: string) => void, replacing?: () => void): () => void {
  const lentHere = new Set(lentNamed(faces, options.lent));
  const taken = brandFamilies(options.typography);
  const asks: Ask[] = [];
  for (const face of faces) {
    if (lentHere.has(face)) {
      say(viewFaceRefusedWords({ reason: "font-face", name: "lent", family: face.family }));
      continue;
    }
    const problem = viewFamilyProblem(face.family, taken);
    if (problem) {
      say(viewFaceRefusedWords({ reason: "font-face", name: "family", family: face.family, said: problem }));
      continue;
    }
    const weight = face.weight === undefined ? undefined : face.weight === "normal" ? "400" : face.weight === "bold" ? "700" : face.weight;
    asks.push({
      key: JSON.stringify([face.family.toLowerCase(), weight ?? "400", face.style ?? "normal", face.stretch ?? "normal", face.unicodeRange ?? ""]),
      family: face.family,
      face: own(face.family),
      url: digestOf(face),
      shown: `the ${(face.size / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} KB data: font a view's stylesheet declared last`,
      descriptors: { display: (face.display ?? "swap") as FontDisplay, ...(weight ? { weight } : {}), ...(face.style ? { style: face.style } : {}), ...(face.stretch ? { stretch: face.stretch } : {}), ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}) },
      source: { bytes: face.sources.map((one) => one.bytes.slice().buffer as ArrayBuffer) },
    });
  }
  return lend(document, asks, say, replacing);
}

/** One face asked of the page: its name's key, how it is said, its file's identity and how that is said, its descriptors, and where its bytes come from. */
interface Ask {
  readonly key: string;
  readonly family: string;
  readonly face: string;
  readonly url: string;
  readonly shown: string;
  readonly descriptors: FontFaceDescriptors;
  /** An address the engine loads; a file the app holds, read here to its bound; or the bytes themselves, tried in order. */
  readonly source: { readonly address: string } | { readonly held: string } | { readonly bytes: readonly ArrayBuffer[] };
}

/** Lend the page each face asked: one file a name, the last lent drawn (`draw`). What it answers gives them back. */
function lend(document: Document, asks: readonly Ask[], say: (said: string) => void, replacing?: () => void): () => void {
  const page = document.defaultView as (Window & { FontFace?: typeof FontFace; fetch?: typeof fetch }) | null;
  const names = held.get(document) ?? new Map<string, Name>();
  held.set(document, names);
  const lending: Lending = { say, going: false };
  const replaced = replacing ? lendings.get(replacing) : undefined;
  if (replaced) replaced.going = true;
  const mine: { readonly name: Name; readonly one: Lent }[] = [];
  for (const ask of asks) {
    const Face = page?.FontFace;
    const fetcher = page?.fetch?.bind(page);
    if (!Face || !document.fonts || ("held" in ask.source && !fetcher)) continue;
    const key = ask.key;
    const name = names.get(key) ?? { files: [] };
    names.set(key, name);
    const had = name.files.find((one) => one.url === ask.url);
    if (had) {
      /* Lent again, it is the last lent. */
      had.holders.set(lending, ask.face);
      name.files.splice(name.files.indexOf(had), 1);
      name.files.push(had);
      mine.push({ name, one: had });
      draw(document, name);
      continue;
    }
    let settle = () => {};
    const settled = new Promise<void>((resolve) => (settle = resolve));
    const one: Lent = { url: ask.url, shown: ask.shown, stop: new AbortController(), holders: new Map([[lending, ask.face]]), settled, settle, drawn: false };
    name.files.push(one);
    mine.push({ name, one });
    /* Said to every view holding it, and let go, so a view that lends it again tries again. */
    const fail = (words: (face: string) => string) => {
      one.settle();
      if (one.stop.signal.aborted) return;
      const index = name.files.indexOf(one);
      if (index >= 0) name.files.splice(index, 1);
      /* Not to a lending about to be given back: the view lending it again hears it once, there. */
      for (const [lending, face] of one.holders) if (!lending.going) lending.say(words(face));
      draw(document, name);
      if (name.files.length === 0 && names.get(key) === name) names.delete(key);
    };
    const couldNot = () => fail((face) => ("bytes" in ask.source ? `${face} could not be loaded: this browser reads none of its sources as a font.` : `${face} could not be loaded from ${ask.url}.`));
    /* Each source in turn, as CSS tries a src list: the next where the engine reads this one as no font. */
    const load = (sources: readonly (string | ArrayBuffer)[]) => {
      const [source, ...rest] = sources;
      if (source === undefined) return couldNot();
      /* A family that is not one identifier ("Baloo 2") is an error at once in Firefox unless quoted, and drawn by no name in the others if it is: quoted only where the engine refuses it plain. */
      let face = new Face(ask.family, source, ask.descriptors);
      if (face.status === "error") face = new Face(JSON.stringify(ask.family), source, ask.descriptors);
      face.load().then(
        () => {
          one.settle();
          if (one.stop.signal.aborted || !name.files.includes(one)) return;
          one.face = face;
          draw(document, name);
        },
        () => (rest.length > 0 ? load(rest) : couldNot()),
      );
    };
    if ("address" in ask.source) load([`url(${JSON.stringify(ask.source.address)})`]);
    else if ("bytes" in ask.source) load(ask.source.bytes);
    else
      readHeld(fetcher!, ask.source.held, one.stop.signal).then((read) => {
        if (one.stop.signal.aborted) return one.settle();
        if (read === "failed") return couldNot();
        if (typeof read === "object" && "type" in read) return fail(() => notAFont(ask.family, ask.url, read.type));
        if (read === "over") return fail((face) => `${face} is not loaded: its file, ${ask.url}, is more than ${VIEW_FONT_MOST_BYTES / 1_000_000} MB, the most a file the app holds may be as a face for its views.`);
        load([read]);
      }, couldNot);
  }
  let given = false;
  const giveBack = () => {
    if (given) return;
    given = true;
    replacing?.();
    for (const { name, one } of mine) {
      one.holders.delete(lending);
      if (one.holders.size > 0) continue;
      one.stop.abort();
      one.settle();
      const index = name.files.indexOf(one);
      if (index >= 0) name.files.splice(index, 1);
      if (one.drawn) document.fonts?.delete(one.face!);
      one.drawn = false;
      draw(document, name);
    }
    for (const [key, name] of names) if (name.files.length === 0) names.delete(key);
  };
  lendings.set(giveBack, lending);
  if (replacing) void Promise.all(mine.map(({ one }) => one.settled)).then(() => replacing());
  return giveBack;
}

/** A font file's type, by its extension, as a `data:` font says it. */
const fontType = (url: string) => `font/${/\.(woff2|woff|ttf|otf)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ?? "woff2"}`;

/** Bytes as base64, a piece at a time: a face is up to two million of them, more than one call takes as arguments. */
function base64Of(bytes: ArrayBuffer): string {
  const all = new Uint8Array(bytes);
  let text = "";
  for (let at = 0; at < all.length; at += 0x8000) text += String.fromCharCode(...all.subarray(at, at + 0x8000));
  return btoa(text);
}

/**
 * THE FACES AN APP LENDS A FRAME (Roadmap f-faces-lent-to-frames), read by
 * the host and handed as `data:` fonts (`GuestFont`). A frame is another
 * origin: the app's own files are not served to it, and a font origin the
 * host lists for its views is none the frame's policy names — that allows
 * `font-src data:`, and nothing more is asked of it. So the host reads each
 * file where it would load one for a worker view (`viewFontAddress`: a file
 * the app holds where `asset` serves it, or an `https:` address on an origin
 * `fonts.origins` lists), held to the same bound, `VIEW_FONT_MOST_BYTES`,
 * however it is served: a file on a listed origin is counted too, since it
 * goes into a message rather than to the engine.
 *
 * ONE FILE A NAME, THE LAST LENT. Of the files the brand lends under one
 * name (family, weight and style), the last that reads within the bound is
 * the one the frame is handed, and where there were several the host is told
 * which. What is refused, too large or unreadable is said, naming the face,
 * as it is for a worker view.
 */
export async function frameFonts(fonts: readonly ViewFont[], options: ViewFontsOptions & { readonly fetch: typeof fetch; readonly signal?: AbortSignal; readonly settled?: (family: string) => void }, say: (said: string) => void): Promise<readonly GuestFont[]> {
  if (fonts.length > VIEW_FONTS_MOST) say(`The app lends its views ${fonts.length} faces and at most ${VIEW_FONTS_MOST} are loaded, so ${fonts.slice(VIEW_FONTS_MOST).map((font) => `"${font.family}"`).join(", ")} ${fonts.length - VIEW_FONTS_MOST === 1 ? "is" : "are"} not.`);
  /* Each name's files in the order they were lent, a file lent twice counted where it was lent last. */
  const names = new Map<string, { readonly font: ViewFont; readonly url: string }[]>();
  for (const font of fonts.slice(0, VIEW_FONTS_MOST)) {
    const at = viewFontAddress(font, options);
    if ("refused" in at) {
      say(at.refused);
      continue;
    }
    const key = nameOf(font);
    const files = (names.get(key) ?? []).filter((one) => one.url !== at.url);
    files.push({ font, url: at.url });
    names.set(key, files);
  }
  const signal = options.signal ?? new AbortController().signal;
  const lent = await Promise.all(
    [...names.values()].map(async (files): Promise<GuestFont | undefined> => {
      try {
        for (let at = files.length - 1; at >= 0; at -= 1) {
          const { font, url } = files[at]!;
          const isHeld = "asset" in viewFontSource(font.src)!;
          const read = await readHeld(options.fetch, url, signal, isHeld ? "same-origin" : "omit").catch(() => "failed" as const);
          if (signal.aborted) return undefined;
          if (read === "failed") {
            say(`${named(font.family)} could not be loaded from ${url}.`);
            continue;
          }
          if (read === "over") {
            say(`${named(font.family)} is not loaded: its file, ${url}, is more than ${VIEW_FONT_MOST_BYTES / 1_000_000} MB, the most a file may be as a face for the app's views.`);
            continue;
          }
          if (!(read instanceof ArrayBuffer)) {
            say(notAFont(font.family, url, read.type));
            continue;
          }
          if (files.length > 1) say(`${named(font.family)} is lent from ${files.length} files, and the one drawn in the frame is ${url}.`);
          return { family: font.family, ...(font.weight !== undefined ? { weight: weightOf(font) } : {}), ...(font.style ? { style: font.style.toLowerCase() } : {}), src: `data:${fontType(url)};base64,${base64Of(read)}` };
        }
        return undefined;
      } finally {
        options.settled?.(files[0]!.font.family);
      }
    }),
  );
  return lent.filter((one): one is GuestFont => one !== undefined);
}

/** One reading of a brand's faces, shared by every frame on a page lent them. */
export interface FrameFontsReading {
  /** The faces as frames are handed them, and what was said of them, once all are read. */
  readonly read: Promise<{ readonly fonts: readonly GuestFont[]; readonly said: readonly string[] }>;
  /** The families still being read. */
  waiting(): readonly string[];
}
const readings = new WeakMap<object, Map<string, FrameFontsReading>>();
/** The most brands' readings a page keeps at once: an older one is read again if it is lent again. */
const READINGS_KEPT = 8;

/**
 * THE FACES A BRAND LENDS, READ ONCE A PAGE (Roadmap f-faces-lent-to-frames):
 * every frame dressed in the same brand, its files served from the same
 * place, is handed the same reading — fetched and encoded once, and what was
 * said of it said to each frame's host.
 */
export function readFrameFonts(window: Window & typeof globalThis, fonts: readonly ViewFont[], options: ViewFontsOptions): FrameFontsReading {
  const served = fonts.map((font) => {
    const source = viewFontSource(font.src);
    return source && "asset" in source ? (options.asset?.(source.asset) ?? null) : null;
  });
  const key = JSON.stringify([fonts, options.typography ?? null, options.origins ?? [], served]);
  const page = readings.get(window) ?? new Map<string, FrameFontsReading>();
  readings.set(window, page);
  const had = page.get(key);
  if (had) return had;
  const said: string[] = [];
  const waiting = new Set<string>();
  for (const font of fonts.slice(0, VIEW_FONTS_MOST)) if (!("refused" in viewFontAddress(font, options))) waiting.add(font.family);
  const read = frameFonts(fonts, { ...options, fetch: window.fetch.bind(window), settled: (family) => waiting.delete(family) }, (one) => said.push(one)).then((lent) => ({ fonts: lent, said }));
  const reading: FrameFontsReading = { read, waiting: () => [...waiting] };
  page.set(key, reading);
  if (page.size > READINGS_KEPT) page.delete(page.keys().next().value!);
  // A reading in which a face could not be had (a network fault, a host's 5xx) is not kept: the next frame asks again.
  read.then(
    (got) => {
      if (got.said.length > 0 && page.get(key) === reading) page.delete(key);
    },
    () => page.delete(key),
  );
  return reading;
}
