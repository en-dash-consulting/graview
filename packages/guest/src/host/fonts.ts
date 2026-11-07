import { viewFontProblem, viewFontSource, type ViewFont } from "@graview/core/css";

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
 * an origin the host lists (`images.origins`) — so an app names no server
 * the host did not choose. Fetched with the first view that is dressed in the
 * brand, and only then.
 */

export interface ViewFontsOptions {
  /** Where a file the app holds is loaded from (MountWorkerViewOptions.asset). */
  readonly asset?: (path: string) => string | undefined;
  /** The `https:` origins a view's images may come from (MountWorkerViewOptions.images). */
  readonly origins?: readonly string[];
}

/** Where the page loads a face from, or why it does not. */
export function viewFontAddress(font: ViewFont, options: ViewFontsOptions): { readonly url: string } | { readonly refused: string } {
  const named = `The app's face "${String((font as { family?: unknown }).family)}" for its views is not loaded`;
  const problem = viewFontProblem(font);
  if (problem) return { refused: `${named}: ${problem}.` };
  const source = viewFontSource(font.src)!;
  if ("asset" in source) {
    const url = options.asset?.(source.asset);
    return url ? { url } : { refused: `${named}: this host says nowhere the app's own files are served (\`asset\`), so ${font.src} is not fetched.` };
  }
  return (options.origins ?? []).includes(source.origin) ? { url: source.https } : { refused: `${named}: ${source.origin} is no origin this host lists for a view's images (\`images.origins\`), so it is not fetched.` };
}

/** The faces already added to a page, so a view drawn again adds none twice. */
const added = new WeakMap<Document, Set<string>>();

/** Add each face the page may load to its fonts; say each it may not, once. */
export function loadViewFonts(document: Document, fonts: readonly ViewFont[], options: ViewFontsOptions, say: (said: string) => void): void {
  const page = document.defaultView as (Window & { FontFace?: typeof FontFace }) | null;
  const had = added.get(document) ?? new Set<string>();
  added.set(document, had);
  for (const font of fonts) {
    const at = viewFontAddress(font, options);
    if ("refused" in at) {
      say(at.refused);
      continue;
    }
    const key = JSON.stringify([font.family, at.url, font.weight ?? "", font.style ?? ""]);
    if (had.has(key) || !page?.FontFace || !document.fonts) continue;
    had.add(key);
    const face = new page.FontFace(font.family, `url(${JSON.stringify(at.url)})`, { display: "swap", ...(font.weight !== undefined ? { weight: String(font.weight) } : {}), ...(font.style ? { style: font.style } : {}) });
    document.fonts.add(face);
    face.load().catch(() => say(`The app's face "${font.family}" for its views could not be loaded from ${at.url}.`));
  }
}
