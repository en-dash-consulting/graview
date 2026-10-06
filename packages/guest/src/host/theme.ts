import type { GuestTheme } from "../protocol.js";

/*
 * THE APP'S LOOK, AS A GUEST IS HANDED IT (FR-86, FR-91): read off the
 * element a guest is drawn in, and watched, so a guest — a worker view, or
 * a frame — is pushed again when the app's own toggle changes the scheme,
 * whatever the system prefers. Small, and apart from the worker's host, so
 * a page that draws only frames carries this and nothing of the open kit.
 */

const TOKENS: readonly (readonly [keyof Omit<GuestTheme, "scheme">, string])[] = [
  ["accent", "--graview-accent"],
  ["ground", "--graview-ground"],
  ["panel", "--graview-panel"],
  ["ink", "--graview-ink"],
  ["inkMuted", "--graview-ink-muted"],
  ["edge", "--graview-edge"],
  ["fontBody", "--graview-font-body"],
  ["fontMono", "--graview-font-mono"],
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
  const theme = { scheme: said } as { -readonly [K in keyof GuestTheme]: GuestTheme[K] };
  for (const [key, variable] of TOKENS) theme[key] = style.getPropertyValue(variable).trim();
  return theme;
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
