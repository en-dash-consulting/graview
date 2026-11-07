import { brandFamilies, VIEW_FONTS_MOST, viewFontProblem, viewFontSource, type ViewFont } from "@graview/core/css";
import { imageOriginsOf } from "./open-judge.js";

/*
 * THE FACES AN APP LENDS ITS VIEWS, LOADED (Roadmap
 * f-view-authoring-friction-2026-11): `brand.views.fonts`, each loaded into
 * the page as a `FontFace` — never by a view's stylesheet, which still loads
 * nothing — and named by a view's sheet and the app's sheet for views as any
 * face is. Loaded into the document, not the view's shadow root: a face a
 * page's document holds is drawn in every shadow tree, and one declared
 * inside a shadow root is not loaded by every engine. A face is fetched only
 * from where the host lets a view's images come from — a file the app holds,
 * by the content address the host serves (`asset`), or an `https:` address on
 * an origin the host lists (`images.origins`, read as an image's are) — so an
 * app names no server the host did not choose. In the document it is the
 * page's, so a face never takes a name the page already draws in, and it goes
 * again when the last view holding it does. Fetched with the first view that
 * is dressed in a brand that lends one, and only then.
 */

export interface ViewFontsOptions {
  /** Where a file the app holds is loaded from (MountWorkerViewOptions.asset). */
  readonly asset?: (path: string) => string | undefined;
  /** The `https:` origins a view's images may come from (MountWorkerViewOptions.images). */
  readonly origins?: readonly string[];
  /** The brand's own stacks: a face lent to a view never takes one of their names. */
  readonly typography?: { readonly body?: string; readonly display?: string; readonly mono?: string };
}

/** Where the page loads a face from, or why it does not. */
export function viewFontAddress(font: ViewFont, options: ViewFontsOptions): { readonly url: string } | { readonly refused: string } {
  const named = `The app's face "${String((font as { family?: unknown }).family)}" for its views is not loaded`;
  const problem = viewFontProblem(font, brandFamilies(options.typography));
  if (problem) return { refused: `${named}: ${problem}.` };
  const source = viewFontSource(font.src)!;
  if ("asset" in source) {
    const url = options.asset?.(source.asset);
    return url ? { url } : { refused: `${named}: this host says nowhere the app's own files are served (\`asset\`), so ${font.src} is not fetched.` };
  }
  return imageOriginsOf(options.origins).includes(new URL(source.https).origin) ? { url: source.https } : { refused: `${named}: ${source.origin} is no origin this host lists for a view's images (\`images.origins\`), so it is not fetched.` };
}

/** The faces on a page, each with how many views hold it, so a view drawn again adds none twice and the last to go takes it. */
const held = new WeakMap<Document, Map<string, { readonly face: FontFace; holders: number }>>();

/** Add each face the page may load to its fonts, and say each it may not. What it answers gives them back. */
export function loadViewFonts(document: Document, fonts: readonly ViewFont[], options: ViewFontsOptions, say: (said: string) => void): () => void {
  const page = document.defaultView as (Window & { FontFace?: typeof FontFace }) | null;
  const faces = held.get(document) ?? new Map<string, { readonly face: FontFace; holders: number }>();
  held.set(document, faces);
  const mine: string[] = [];
  if (fonts.length > VIEW_FONTS_MOST) say(`The app lends its views ${fonts.length} faces and at most ${VIEW_FONTS_MOST} are loaded, so ${fonts.slice(VIEW_FONTS_MOST).map((font) => `"${font.family}"`).join(", ")} ${fonts.length - VIEW_FONTS_MOST === 1 ? "is" : "are"} not.`);
  for (const font of fonts.slice(0, VIEW_FONTS_MOST)) {
    const at = viewFontAddress(font, options);
    if ("refused" in at) {
      say(at.refused);
      continue;
    }
    const Face = page?.FontFace;
    if (!Face || !document.fonts) continue;
    const key = JSON.stringify([font.family, at.url, font.weight ?? "", font.style ?? ""]);
    mine.push(key);
    const had = faces.get(key);
    if (had) {
      had.holders += 1;
      continue;
    }
    const source = `url(${JSON.stringify(at.url)})`;
    const descriptors = { display: "swap" as const, ...(font.weight !== undefined ? { weight: String(font.weight) } : {}), ...(font.style ? { style: font.style } : {}) };
    /* A family that is not one identifier ("Baloo 2") is an error at once in Firefox unless quoted, and drawn by no name in the others if it is: quoted only where the engine refuses it plain. */
    let face = new Face(font.family, source, descriptors);
    if (face.status === "error") face = new Face(JSON.stringify(font.family), source, descriptors);
    document.fonts.add(face);
    faces.set(key, { face, holders: 1 });
    face.load().catch(() => say(`The app's face "${font.family}" for its views could not be loaded from ${at.url}.`));
  }
  let given = false;
  return () => {
    if (given) return;
    given = true;
    for (const key of mine) {
      const one = faces.get(key);
      if (!one) continue;
      one.holders -= 1;
      if (one.holders > 0) continue;
      faces.delete(key);
      document.fonts?.delete(one.face);
    }
  };
}
