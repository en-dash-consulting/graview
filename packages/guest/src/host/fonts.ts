import { brandFamilies, VIEW_FONT_MOST_BYTES, VIEW_FONTS_MOST, viewFontProblem, viewFontSource, type ViewFont } from "@graview/core/css";
import { imageOriginsOf } from "./open-judge.js";

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
 * BOUNDED (Roadmap f-lent-faces-bounded). A face is loaded eagerly, so it
 * has a size it may not pass, `VIEW_FONT_MOST_BYTES`. `FontFace` given an
 * address fetches all of it and has nothing to stop at a size with, so the
 * host fetches the file itself — a file that says it is larger is not read,
 * one that says nothing is counted as it streams and let go once past the
 * limit — and hands `FontFace` the bytes. The page's fonts take only what
 * was within it.
 *
 * ONE FILE A NAME. Two brands on one page may lend one family (with one
 * weight and style) from two files; both in the document, which drew was
 * the engine's. Now the page holds one of them at a time: the one lent
 * later, once it has loaded, in every view on the page; the earlier is set
 * aside and drawn again when the later goes. Each lender is told.
 */

export interface ViewFontsOptions {
  /** Where a file the app holds is loaded from (MountWorkerViewOptions.asset). */
  readonly asset?: (path: string) => string | undefined;
  /** The `https:` origins a lent face may come from (MountWorkerViewOptions.fonts), apart from a view's images. */
  readonly origins?: readonly string[];
  /** The brand's own stacks: a face lent to a view never takes one of their names. */
  readonly typography?: { readonly body?: string; readonly display?: string; readonly mono?: string };
}

const notOnList = (named: string, origin: string) => `${named}: ${origin} is no origin this host lists for the faces its views are lent (\`fonts.origins\`), so it is not fetched.`;
const named = (family: unknown) => `The app's face "${String(family)}" for its views`;

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
  return imageOriginsOf(options.origins).includes(new URL(source.https).origin) ? { url: source.https } : { refused: notOnList(not, source.origin) };
}

/** A face's file, read up to the limit: its bytes, `"over"` past it, or why it could not be read. */
async function readFace(fetcher: typeof fetch, url: string, origins: readonly string[] | undefined, signal: AbortSignal): Promise<{ readonly bytes: ArrayBuffer } | { readonly refused: string } | { readonly failed: true }> {
  const response = await fetcher(url, { signal, credentials: "same-origin" });
  if (!response.ok) return { failed: true };
  /* Sent on by an origin the host lists to one it does not: held to the list as the address was. */
  if (origins && response.redirected && !imageOriginsOf(origins).includes(new URL(response.url).origin)) {
    void response.body?.cancel();
    return { refused: new URL(response.url).origin };
  }
  const over = { refused: "over" } as const;
  const declared = Number(response.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > VIEW_FONT_MOST_BYTES) {
    void response.body?.cancel();
    return over;
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    return bytes.byteLength > VIEW_FONT_MOST_BYTES ? over : { bytes };
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > VIEW_FONT_MOST_BYTES) {
      void reader.cancel();
      return over;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return { bytes: bytes.buffer as ArrayBuffer };
}

/** One file lent under a name: how many views hold it, and its face once it has loaded. */
interface Lent {
  readonly url: string;
  readonly stop: AbortController;
  holders: number;
  face?: FontFace;
  drawn: boolean;
}
/** A name (family, weight, style) on a page: its files in the order they were lent, the last that has loaded the one drawn, and who to tell of it. */
interface Name {
  readonly files: Lent[];
  readonly lenders: { readonly say: (said: string) => void; readonly family: string }[];
}
const held = new WeakMap<Document, Map<string, Name>>();

/** Put in the page's fonts the one face a name draws, and take out the others. */
function draw(document: Document, files: readonly Lent[]) {
  let drawing: Lent | undefined;
  for (let at = files.length - 1; at >= 0 && !drawing; at -= 1) if (files[at]!.face) drawing = files[at];
  for (const one of files) {
    if (one === drawing || !one.drawn) continue;
    document.fonts?.delete(one.face!);
    one.drawn = false;
  }
  if (drawing && !drawing.drawn) {
    document.fonts?.add(drawing.face!);
    drawing.drawn = true;
  }
}

/**
 * Add each face the page may load to its fonts, and say each it may not.
 * What it answers gives them back. `replacing`: what the same view's last
 * lending answered, given back once this one holds its own, so a face both
 * lend is never let go between them and a file changed for another is never
 * two on the page.
 */
export function loadViewFonts(document: Document, fonts: readonly ViewFont[], options: ViewFontsOptions, say: (said: string) => void, replacing?: () => void): () => void {
  const page = document.defaultView as (Window & { FontFace?: typeof FontFace; fetch?: typeof fetch }) | null;
  const names = held.get(document) ?? new Map<string, Name>();
  held.set(document, names);
  const mine: { readonly name: Name; readonly one: Lent; readonly lender: Name["lenders"][number] }[] = [];
  if (fonts.length > VIEW_FONTS_MOST) say(`The app lends its views ${fonts.length} faces and at most ${VIEW_FONTS_MOST} are loaded, so ${fonts.slice(VIEW_FONTS_MOST).map((font) => `"${font.family}"`).join(", ")} ${fonts.length - VIEW_FONTS_MOST === 1 ? "is" : "are"} not.`);
  for (const font of fonts.slice(0, VIEW_FONTS_MOST)) {
    const at = viewFontAddress(font, options);
    if ("refused" in at) {
      say(at.refused);
      continue;
    }
    const Face = page?.FontFace;
    const fetcher = page?.fetch?.bind(page);
    if (!Face || !fetcher || !document.fonts) continue;
    /* A family is matched without regard to case, so "Rock Face" and "rock face" are one name. */
    const key = JSON.stringify([font.family.toLowerCase(), String(font.weight ?? ""), font.style ?? ""]);
    const name = names.get(key) ?? { files: [], lenders: [] };
    names.set(key, name);
    const lender = { say, family: font.family };
    name.lenders.push(lender);
    const had = name.files.find((one) => one.url === at.url);
    if (had) {
      had.holders += 1;
      mine.push({ name, one: had, lender });
      continue;
    }
    const one: Lent = { url: at.url, stop: new AbortController(), holders: 1, drawn: false };
    name.files.push(one);
    mine.push({ name, one, lender });
    const descriptors = { display: "swap" as const, ...(font.weight !== undefined ? { weight: String(font.weight) } : {}), ...(font.style ? { style: font.style } : {}) };
    const couldNot = () => {
      if (!one.stop.signal.aborted) say(`${named(font.family)} could not be loaded from ${at.url}.`);
    };
    const source = viewFontSource(font.src);
    readFace(fetcher, at.url, source && "https" in source ? options.origins : undefined, one.stop.signal).then((read) => {
      if (one.stop.signal.aborted) return;
      if ("failed" in read) return couldNot();
      if ("refused" in read) return say(read.refused === "over" ? `${named(font.family)} is not loaded: its file, ${at.url}, is more than ${VIEW_FONT_MOST_BYTES / 1_000_000} MB, the most a face lent to views may be.` : notOnList(`${named(font.family)} is not loaded`, read.refused));
      /* A family that is not one identifier ("Baloo 2") is an error at once in Firefox unless quoted, and drawn by no name in the others if it is: quoted only where the engine refuses it plain. */
      let face = new Face(font.family, read.bytes, descriptors);
      if (face.status === "error") face = new Face(JSON.stringify(font.family), read.bytes, descriptors);
      face.load().then(() => {
        if (one.stop.signal.aborted) return;
        one.face = face;
        draw(document, name.files);
      }, couldNot);
    }, couldNot);
  }
  replacing?.();
  /* Said once a name, to each view lending under it, where the page holds two files under it. */
  for (const name of new Set(mine.map((held) => held.name))) {
    if (name.files.length < 2) continue;
    const told = new Set<(said: string) => void>();
    for (const lender of name.lenders) {
      if (told.has(lender.say)) continue;
      told.add(lender.say);
      lender.say(`${named(lender.family)} is lent from ${name.files.length} files on this page, and the one lent last, ${name.files.at(-1)!.url}, is drawn in every view.`);
    }
  }
  let given = false;
  return () => {
    if (given) return;
    given = true;
    for (const { name, one, lender } of mine) {
      name.lenders.splice(name.lenders.indexOf(lender), 1);
      one.holders -= 1;
      if (one.holders > 0) continue;
      one.stop.abort();
      name.files.splice(name.files.indexOf(one), 1);
      if (one.drawn) document.fonts?.delete(one.face!);
      one.drawn = false;
      draw(document, name.files);
    }
    for (const [key, name] of names) if (name.files.length === 0) names.delete(key);
  };
}
