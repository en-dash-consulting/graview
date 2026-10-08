import { svgProblem } from "@graview/core";
import type { GuestTheme } from "../protocol.js";

/*
 * THE APP'S LOOK, AS A GUEST IS HANDED IT (FR-86, FR-91, FR-127): read off
 * the element a guest is drawn in, and watched, so a guest — a worker view,
 * or a frame — is pushed again when the app's own toggle changes the
 * scheme, whatever the system prefers; and the brand's name and logo, the
 * logo made into a URL the guest can show without loading anything. Small,
 * and apart from the worker's host, so a page that draws only frames
 * carries this and nothing of the open kit.
 */

const TOKENS: readonly (readonly [Exclude<keyof GuestTheme, "scheme" | "name" | "logo">, string])[] = [
  ["accent", "--graview-accent"],
  ["ground", "--graview-ground"],
  ["panel", "--graview-panel"],
  ["ink", "--graview-ink"],
  ["inkMuted", "--graview-ink-muted"],
  ["edge", "--graview-edge"],
  ["fontBody", "--graview-font-body"],
  ["fontDisplay", "--graview-font-display"],
  ["fontMono", "--graview-font-mono"],
  ["radius", "--graview-radius"],
];

/**
 * The app's look as an element inherits it: its `--graview-*` tokens, and
 * the app's scheme — the nearest `data-graview-scheme` (the embed's), else
 * its `color-scheme`, else the system's — the app's own toggle first.
 */
export function readTheme(region: Element): GuestTheme {
  const window = region.ownerDocument.defaultView!;
  const style = window.getComputedStyle(region);
  const stamped = region.closest("[data-graview-scheme]")?.getAttribute("data-graview-scheme");
  const said = stamped === "dark" || stamped === "light" ? stamped : /\bdark\b/.test(style.colorScheme ?? "") ? "dark" : /\blight\b/.test(style.colorScheme ?? "") ? "light" : window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const theme = { scheme: said } as Record<string, string>;
  for (const [key, variable] of TOKENS) theme[key] = style.getPropertyValue(variable).trim();
  return theme as unknown as GuestTheme;
}

/**
 * Call `moved` whenever the look a guest is handed may have changed: the
 * app's toggle (the embed stamps `data-graview-scheme`, a page `data-theme`)
 * or the system's preference. Returns the stop.
 */
export function watchTheme(document: Document, moved: () => void): () => void {
  const window = document.defaultView as (Window & typeof globalThis) | null;
  if (!window || typeof window.MutationObserver !== "function") return () => {};
  const watch = new window.MutationObserver(moved);
  watch.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["data-graview-scheme", "data-theme"] });
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", moved);
  return () => {
    watch.disconnect();
    media?.removeEventListener?.("change", moved);
  };
}

/** The app's brand as a guest is handed it (FR-127): `Brand`'s name and logo, as the app's wordmark draws them. */
export interface GuestBrand {
  readonly name?: string;
  /** An inline SVG string, a `data:` image, or an address on the page's own origin. */
  readonly logo?: string;
}

/**
 * The look and the brand together: the tokens read, then the brand's name
 * and its logo as `logo` hands it. What a host mounting a guest pushes.
 */
export function themeWithBrand(read: () => GuestTheme, brand: (() => GuestBrand | undefined) | undefined, logo: GuestLogo): GuestTheme {
  const given = brand?.();
  const url = logo.url(given?.logo);
  return { ...read(), ...(given?.name ? { name: given.name } : {}), ...(url ? { logo: url } : {}) };
}

/** The logo a guest is handed, kept up as the brand changes. */
export interface GuestLogo {
  /** The URL to hand for this logo: the last one made, until this one is ready and `moved` is called. */
  url(logo: string | undefined): string | undefined;
  /** Let go of what was made. */
  dispose(): void;
}

/**
 * THE BRAND'S LOGO, AS A GUEST CAN SHOW IT WITHOUT LOADING ANYTHING (FR-127).
 *
 * An inline SVG becomes a Blob; an address is fetched by the host, on the
 * page's own origin only — another origin's logo is not handed; a `data:`
 * image is handed as it is. `"blob"` hands a `blob:` URL of this page: a
 * worker view is drawn here, so it resolves, and the open kit draws a
 * `blob:` of the page's own. Where the page's policy refuses `blob:`
 * images (ChatGPT's `img-src` has no `blob:`), the probe fails and the
 * `data:` URL is handed instead. `"data"` always hands `data:`: a frame is
 * another origin, where this page's `blob:` does not resolve. A URL made
 * for the last logo is revoked once the next is ready, and at `dispose`.
 */
export function createGuestLogo(window: Window & typeof globalThis, moved: () => void, as: "blob" | "data"): GuestLogo {
  let asked: string | undefined;
  let shown: string | undefined;
  const release = (url: string | undefined) => {
    if (url?.startsWith("blob:")) window.URL.revokeObjectURL(url);
  };
  const blobOf = async (logo: string): Promise<Blob | undefined> => {
    // An SVG that could act is never made an image of this page's origin; a path that climbs (`..`, `%2e`) never reaches another page of it.
    if (logo.startsWith("<")) return svgProblem(logo) === null ? new window.Blob([logo], { type: "image/svg+xml" }) : undefined;
    if (/\\|%2e/i.test(logo) || logo.split(/[?#]/)[0]!.split("/").some((part) => part === "." || part === "..")) return undefined;
    const url = new window.URL(logo, window.document.baseURI);
    if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return undefined;
    const response = await window.fetch(url.href, { credentials: "same-origin" });
    const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim();
    return response.ok && type.startsWith("image/") ? new window.Blob([await response.arrayBuffer()], { type }) : undefined;
  };
  /* An image the page's policy refuses says `error`; a page that never answers is taken as a refusal. */
  const loads = (url: string) =>
    new Promise<boolean>((done) => {
      const image = new window.Image();
      image.onload = () => done(true);
      image.onerror = () => done(false);
      window.setTimeout(() => done(false), 2_000);
      image.src = url;
    });
  const dataOf = (blob: Blob) =>
    new Promise<string>((done, fail) => {
      const reader = new window.FileReader();
      reader.onload = () => done(String(reader.result));
      reader.onerror = fail;
      reader.readAsDataURL(blob);
    });
  const resolve = async (logo: string): Promise<string | undefined> => {
    if (/^data:image\//i.test(logo)) return logo;
    const blob = await blobOf(logo);
    if (!blob || asked !== logo) return undefined;
    if (as === "blob") {
      const url = window.URL.createObjectURL(blob);
      if (await loads(url)) return url;
      window.URL.revokeObjectURL(url);
    }
    return dataOf(blob);
  };
  const settle = (logo: string, url: string | undefined) => {
    if (asked !== logo) return release(url);
    if (url === shown) return;
    release(shown);
    shown = url;
    moved();
  };
  return {
    url(logo) {
      const given = logo?.trim() || undefined;
      if (given !== asked) {
        asked = given;
        if (given) void resolve(given).then((url) => settle(given, url), () => settle(given, undefined));
        else {
          release(shown);
          shown = undefined;
        }
      }
      return shown;
    },
    dispose() {
      asked = undefined;
      release(shown);
      shown = undefined;
    },
  };
}
