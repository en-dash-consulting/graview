/*
 * `@graview/core/head` — AN APP ON A HOME SCREEN (Roadmap f-app-icons-home-screen).
 *
 * What a page's head says so a phone or a desktop can keep the app as an
 * app: an icon typed by what it is, an `apple-touch-icon`, a
 * `<link rel="manifest">`, a `theme-color` for each scheme, and the web
 * manifest itself — all from the brand and the base the app is served
 * under, pure, with nothing fetched. A host writes `html` into the page it
 * serves and answers each of `files` at its path under the base;
 * `graview serve` and `graview preview` do.
 *
 * A PICTURE A PHONE TAKES IS A PNG. A brand's mark that is a PNG
 * (`/graview/assets/<sha>.png`) is the icon at every size as it is; one
 * that is SVG — inline, a path, or an emoji drawn as one — is a PNG only
 * through a rasterizer, which this has not got. So, unless the host says
 * it makes PNGs (`png: true`), an SVG mark is offered as an SVG — the
 * page's icon and the manifest's, `sizes: "any"` — and no
 * `apple-touch-icon` is written, since iOS takes none but a PNG. Said
 * `png: true`, the PNGs at 180, 192 and 512 (and a maskable 512) are named
 * at paths under the base, and each `file` says what to make it from.
 */

import { colorsIn } from "./theme/contrast.js";
import { assetSrc, emojiOf, emojiProblem, emojiSvg, isInlineSvg, logoOf, svgProblem } from "./theme/marks.js";
import type { BrandLogo, FaviconSpec, Scheme, ThemeTokens } from "./theme/types.js";

/** What of a brand the head reads. */
export interface HeadBrand {
  readonly name?: string;
  readonly favicon?: FaviconSpec;
  readonly logo?: string | BrandLogo;
  readonly scheme?: Scheme | "auto";
  readonly schemes?: Readonly<Record<Scheme, Pick<ThemeTokens, "ground">>>;
}

export interface HomeScreenOptions {
  /** The base the app is served under, without a trailing slash (`/a/jobs`); the host's root when unsaid. */
  readonly base?: string;
  /** Where the host serves an app's own image (`/graview/assets/<sha>.<ext>`), as the faces' `assetsAt`; `base + path` when unsaid. */
  readonly assetsAt?: (path: string) => string;
  /** The app's name where the brand names none. */
  readonly name?: string;
  /** Whether the host makes PNGs from an SVG or emoji mark (a rasterizer of its own). Unsaid, an SVG mark is offered as SVG alone. */
  readonly png?: boolean;
}

/** One tag of the head: a `<link>` or a `<meta>`, its attributes in order. */
export interface HeadTag {
  readonly tag: "link" | "meta";
  readonly attributes: Readonly<Record<string, string>>;
}

/** A file the tags or the manifest name, which the host answers at `path` under the base. */
export interface HomeScreenFile {
  /** Under the base: `/manifest.webmanifest`, `/icon.svg`, `/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png`. */
  readonly path: string;
  readonly type: string;
  /** The text to answer, where it is text: the manifest's JSON, an SVG mark. */
  readonly body?: string;
  /** For a PNG: its side in pixels, whether it is the maskable one, and what it is made from — the brand's PNG at its address (answered as it is, or resized), the SVG text a rasterizer draws, or another picture's address it fetches. */
  readonly size?: number;
  readonly maskable?: boolean;
  readonly from?: { readonly png: string } | { readonly svg: string } | { readonly href: string };
}

export interface WebManifest {
  readonly name: string;
  readonly short_name: string;
  readonly icons: readonly { readonly src: string; readonly type: string; readonly sizes?: string; readonly purpose?: string }[];
  readonly theme_color?: string;
  readonly background_color?: string;
  readonly display: "standalone";
  readonly start_url: string;
  readonly scope: string;
}

export interface HomeScreen {
  readonly tags: readonly HeadTag[];
  /** The tags as HTML, escaped, for a host to write into its head. */
  readonly html: string;
  readonly manifest: WebManifest;
  readonly files: readonly HomeScreenFile[];
}

/** Where a manifest is served, under the base. */
export const MANIFEST_PATH = "/manifest.webmanifest";

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/**
 * THE COLOR OF THE BROWSER'S OWN CHROME, for each scheme the app is drawn
 * in: its ground — the first color of it, where it is a gradient. One with
 * no `media` where the brand pins a scheme; one for each with
 * `(prefers-color-scheme: …)` where it follows the device.
 */
export function themeColorsOf(brand: Pick<HeadBrand, "scheme" | "schemes"> | undefined): readonly { readonly color: string; readonly media?: string }[] {
  const of = (scheme: Scheme): string | undefined => {
    const ground = brand?.schemes?.[scheme]?.ground;
    const color = ground ? colorsIn(ground)[0] : undefined;
    return color ? `#${hex(color.r)}${hex(color.g)}${hex(color.b)}` : undefined;
  };
  if (brand?.scheme === "light" || brand?.scheme === "dark") {
    const color = of(brand.scheme);
    return color ? [{ color }] : [];
  }
  return (["light", "dark"] as const).flatMap((scheme) => {
    const color = of(scheme);
    return color ? [{ color, media: `(prefers-color-scheme: ${scheme})` }] : [];
  });
}

/** What a path's file is, by its extension. */
function typeOf(path: string): string | undefined {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  return ext === "png" ? "image/png" : ext === "svg" ? "image/svg+xml" : ext === "ico" ? "image/x-icon" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : ext === "avif" ? "image/avif" : undefined;
}

/** The mark the icon is made from: the page icon, else the logo's light face; as SVG text, or a path. */
function sourceOf(brand: HeadBrand | undefined): { readonly svg: string } | { readonly path: string } | undefined {
  const favicon = brand?.favicon;
  const emoji = emojiOf(favicon);
  if (emoji !== undefined) return emojiProblem(emoji) === null ? { svg: emojiSvg(emoji) } : undefined;
  const mark = typeof favicon === "string" && favicon !== "" ? favicon : logoOf(brand)?.light;
  if (!mark) return undefined;
  if (isInlineSvg(mark)) return svgProblem(mark) === null ? { svg: mark.trim() } : undefined;
  if (/^\s*</.test(mark) || /^[a-z][a-z0-9+.-]*:/i.test(mark) || mark.startsWith("//") || typeOf(mark) === undefined) return undefined;
  return { path: mark };
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The tags as HTML. */
export function headHtml(tags: readonly HeadTag[]): string {
  return tags.map(({ tag, attributes }) => `<${tag}${Object.entries(attributes).map(([name, value]) => ` ${name}="${escape(value)}"`).join("")}>`).join("");
}

/** The head tags, the manifest and the files a host serves, for an app on a home screen. */
export function homeScreenOf(brand: HeadBrand | undefined, options: HomeScreenOptions = {}): HomeScreen {
  const base = (options.base ?? "").replace(/\/+$/, "");
  const at = (path: string) => `${base}${path}`;
  const assetsAt = options.assetsAt ?? ((path: string) => at(path));
  const name = brand?.name ?? options.name ?? "Graview";
  const source = sourceOf(brand);
  const tags: HeadTag[] = [];
  const files: HomeScreenFile[] = [];
  const icons: WebManifest["icons"][number][] = [];
  if (source) {
    const svg = "svg" in source ? source.svg : undefined;
    const address = "path" in source ? (source.path.startsWith("/") ? assetSrc(assetsAt, source.path) : source.path) : undefined;
    const type = "path" in source ? typeOf(source.path)! : "image/svg+xml";
    // The page's icon, typed by what it is: an SVG written into the app at /icon.svg, a path at its own address.
    const icon = svg !== undefined ? at("/icon.svg") : address!;
    if (svg !== undefined) files.push({ path: "/icon.svg", type, body: svg });
    tags.push({ tag: "link", attributes: { rel: "icon", type, href: icon } });
    const pngs = type === "image/png" || options.png === true;
    if (pngs) {
      // The brand's PNG as it is, the SVG text to draw, or — an SVG or another picture at a path — the address a rasterizer fetches.
      const made = svg !== undefined ? { svg } : type === "image/png" ? { png: address! } : { href: address! };
      for (const [path, size, maskable] of [["/apple-touch-icon.png", 180, false], ["/icon-192.png", 192, false], ["/icon-512.png", 512, false], ["/icon-maskable-512.png", 512, true]] as const) {
        files.push({ path, type: "image/png", size, ...(maskable ? { maskable } : {}), from: made });
        if (path !== "/apple-touch-icon.png") icons.push({ src: at(path), type: "image/png", sizes: `${size}x${size}`, ...(maskable ? { purpose: "maskable" } : {}) });
      }
      tags.push({ tag: "link", attributes: { rel: "apple-touch-icon", sizes: "180x180", href: at("/apple-touch-icon.png") } });
    }
    if (type === "image/svg+xml") icons.push({ src: icon, type, sizes: "any" });
  }
  tags.push({ tag: "link", attributes: { rel: "manifest", href: at(MANIFEST_PATH) } });
  const colors = themeColorsOf(brand);
  for (const { color, media } of colors) tags.push({ tag: "meta", attributes: { name: "theme-color", content: color, ...(media ? { media } : {}) } });
  const first = colors[0]?.color;
  const manifest: WebManifest = {
    name,
    short_name: name.length <= 12 ? name : name.split(/\s+/)[0]!.slice(0, 12),
    icons,
    ...(first ? { theme_color: first, background_color: first } : {}),
    display: "standalone",
    start_url: at("/"),
    scope: at("/"),
  };
  files.unshift({ path: MANIFEST_PATH, type: "application/manifest+json", body: JSON.stringify(manifest) });
  return { tags, html: headHtml(tags), manifest, files };
}
