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

/** A file the app holds, read up to the limit: its bytes, `over` past it, or `failed`. Never sent on elsewhere. */
async function readHeld(fetcher: typeof fetch, url: string, signal: AbortSignal): Promise<ArrayBuffer | "over" | "failed"> {
  const response = await fetcher(url, { signal, credentials: "same-origin", redirect: "error" });
  if (!response.ok) return "failed";
  const declared = Number(response.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > VIEW_FONT_MOST_BYTES) {
    void response.body?.cancel();
    return "over";
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    return bytes.byteLength > VIEW_FONT_MOST_BYTES ? "over" : bytes;
  }
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
/** One file lent under a name: the lendings holding it (each with the family as it lent it), and its face once it has loaded. */
interface Lent {
  readonly url: string;
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

/** A face's weight and style as the engine matches them: no weight is "normal", which is 400, as "bold" is 700. */
const nameOf = (font: ViewFont) => {
  const weight = String(font.weight ?? "normal").trim().replace(/\s+/g, " ").toLowerCase();
  return JSON.stringify([font.family.toLowerCase(), weight === "normal" ? "400" : weight === "bold" ? "700" : weight, font.style ?? "normal"]);
};

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
    for (const [lending, family] of one.holders) {
      if (lending.going || told.has(lending)) continue;
      told.add(lending);
      lending.say(`${named(family)} is lent from ${staying.length} files on this page, and the one drawn in every view is ${drawing.url}.`);
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
  const page = document.defaultView as (Window & { FontFace?: typeof FontFace; fetch?: typeof fetch }) | null;
  const names = held.get(document) ?? new Map<string, Name>();
  held.set(document, names);
  const lending: Lending = { say, going: false };
  const replaced = replacing ? lendings.get(replacing) : undefined;
  if (replaced) replaced.going = true;
  const mine: { readonly name: Name; readonly one: Lent }[] = [];
  if (fonts.length > VIEW_FONTS_MOST) say(`The app lends its views ${fonts.length} faces and at most ${VIEW_FONTS_MOST} are loaded, so ${fonts.slice(VIEW_FONTS_MOST).map((font) => `"${font.family}"`).join(", ")} ${fonts.length - VIEW_FONTS_MOST === 1 ? "is" : "are"} not.`);
  for (const font of fonts.slice(0, VIEW_FONTS_MOST)) {
    const at = viewFontAddress(font, options);
    if ("refused" in at) {
      say(at.refused);
      continue;
    }
    const isHeld = "asset" in viewFontSource(font.src)!;
    const Face = page?.FontFace;
    const fetcher = page?.fetch?.bind(page);
    if (!Face || !document.fonts || (isHeld && !fetcher)) continue;
    const key = nameOf(font);
    const name = names.get(key) ?? { files: [] };
    names.set(key, name);
    const had = name.files.find((one) => one.url === at.url);
    if (had) {
      /* Lent again, it is the last lent. */
      had.holders.set(lending, font.family);
      name.files.splice(name.files.indexOf(had), 1);
      name.files.push(had);
      mine.push({ name, one: had });
      draw(document, name);
      continue;
    }
    let settle = () => {};
    const settled = new Promise<void>((resolve) => (settle = resolve));
    const one: Lent = { url: at.url, stop: new AbortController(), holders: new Map([[lending, font.family]]), settled, settle, drawn: false };
    name.files.push(one);
    mine.push({ name, one });
    /* Said to every view holding it, and let go, so a view that lends it again tries again. */
    const fail = (words: (family: string) => string) => {
      one.settle();
      if (one.stop.signal.aborted) return;
      const index = name.files.indexOf(one);
      if (index >= 0) name.files.splice(index, 1);
      for (const [lending, family] of one.holders) lending.say(words(family));
      draw(document, name);
    };
    const couldNot = () => fail((family) => `${named(family)} could not be loaded from ${at.url}.`);
    const descriptors = { display: "swap" as const, ...(font.weight !== undefined ? { weight: String(font.weight) } : {}), ...(font.style ? { style: font.style } : {}) };
    const load = (source: string | ArrayBuffer) => {
      /* A family that is not one identifier ("Baloo 2") is an error at once in Firefox unless quoted, and drawn by no name in the others if it is: quoted only where the engine refuses it plain. */
      let face = new Face(font.family, source, descriptors);
      if (face.status === "error") face = new Face(JSON.stringify(font.family), source, descriptors);
      face.load().then(() => {
        one.settle();
        if (one.stop.signal.aborted || !name.files.includes(one)) return;
        one.face = face;
        draw(document, name);
      }, couldNot);
    };
    if (!isHeld) load(`url(${JSON.stringify(at.url)})`);
    else
      readHeld(fetcher!, at.url, one.stop.signal).then((read) => {
        if (one.stop.signal.aborted) return one.settle();
        if (read === "failed") return couldNot();
        if (read === "over") return fail((family) => `${named(family)} is not loaded: its file, ${at.url}, is more than ${VIEW_FONT_MOST_BYTES / 1_000_000} MB, the most a file the app holds may be as a face for its views.`);
        load(read);
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
