import { assetSrc, emojiMark, isInlineSvg, logoOf, markHref, svgProblem, type Brand } from "@graview/core";
import { themeColorsOf } from "@graview/core/head";
import { useHostAssets } from "@graview/react/provider";
import { useEffect, type CSSProperties } from "react";
import { useMarkup } from "./markup.js";

/*
 * THE APP, SAID ONCE (FR-124, FR-125): its mark, its name, and the line
 * under the name — the one component every face draws its title with, so
 * the whole-page Shell's wordmark and the one app bar (FR-131, with `AppMark`)
 * say the same app the same way.
 *
 * The mark is drawn as the brand gives it, never redrawn: an SVG written
 * inline is put in the page as it is (so `currentColor` takes the accent,
 * and nothing else is recolored), and only when it could not act — an
 * SVG with a script, a handler or a load in it is not drawn at all. A path
 * is an `<img>`. Beside the name the mark is said only when its alt text
 * says more than the name does.
 */

/** The brand's mark alone, `size` pixels tall — its logo, or with none its page icon's emoji; nothing when there is none, or none that may be drawn. */
export function AppMark({ brand, size = 22 }: { readonly brand: Brand | undefined; readonly size?: number }) {
  // A path under /graview/assets/ is drawn where the host serves the app's own images (its base, Roadmap f-brand-marks-under-app-base).
  const assetsAt = useHostAssets();
  const logo = logoOf(brand);
  const light = drawable(logo?.light);
  // A dark one only beside a light one that can be drawn: the light one is what every scheme without its own draws.
  const dark = light ? drawable(logo?.dark) : undefined;
  const lightMarkup = useMarkup(light !== undefined && isInlineSvg(light) ? light : undefined);
  const darkMarkup = useMarkup(dark !== undefined && isInlineSvg(dark) ? dark : undefined);
  const box: CSSProperties = { display: "inline-flex", flex: "0 0 auto", height: size, color: "var(--graview-accent)" };
  // No logo: the page icon's emoji stands in, drawn as text and said by the name beside it.
  const emoji = emojiMark(brand);
  if (emoji) return <span className="graview-logo graview-emoji-mark" data-testid="app-mark" aria-hidden style={{ ...box, alignItems: "center", fontSize: `${(size * 0.86) / 16}rem`, lineHeight: 1 }}>{emoji}</span>;
  if (!light) return null;
  const alt = brand?.logoAlt ?? brand?.name ?? "";
  const said = alt !== "" && alt !== brand?.name;
  const named = said ? { role: "img", "aria-label": alt } : { "aria-hidden": true };
  /*
   * ONE FOR EACH SCHEME: both are in the page, and the theme's sheet —
   * written for the scheme the page is in — hides the other's
   * (`[data-graview-scheme-only]`, theme.ts), so the mark is right however
   * the scheme was chosen and switches with it.
   */
  if (dark) {
    const face = (mark: string, markup: ReturnType<typeof useMarkup>, scheme: "light" | "dark") =>
      isInlineSvg(mark) ? <span className="graview-logo-face" data-graview-scheme-only={scheme} dangerouslySetInnerHTML={markup} /> : <img className="graview-logo-face" data-graview-scheme-only={scheme} src={assetSrc(assetsAt, mark)} alt="" />;
    return (
      <span className="graview-logo" data-testid="app-mark" style={box} {...named}>
        {face(light, lightMarkup, "light")}
        {face(dark, darkMarkup, "dark")}
      </span>
    );
  }
  // Only a light one, and the brand asked: in the dark scheme alone it is inverted and screened onto the ground (theme.ts).
  const fallback = logo?.darkFallback === "invert" ? { "data-graview-logo-fallback": "invert" } : {};
  if (isInlineSvg(light)) return <span className="graview-logo" data-testid="app-mark" style={box} {...fallback} {...named} dangerouslySetInnerHTML={lightMarkup} />;
  return <img className="graview-logo" data-testid="app-mark" src={assetSrc(assetsAt, light)} alt={said ? alt : ""} {...fallback} style={{ ...box, width: "auto" }} />;
}

/** A mark that may be drawn: inline SVG that could not act, or an address an image is drawn from. */
function drawable(mark: string | undefined): string | undefined {
  if (!mark || !markHref(mark)) return undefined;
  return isInlineSvg(mark) && svgProblem(mark) !== null ? undefined : mark;
}

/**
 * The mark, the name and — where `subtitle` asks and the brand has one —
 * the line under the name. Its type is the container's: the name takes
 * the font, size and case it is drawn in; the line under it is the body's,
 * quiet, and wraps rather than being cut.
 */
export function AppTitle({ brand, name, subtitle = false, size }: { readonly brand: Brand | undefined; readonly name?: string; readonly subtitle?: boolean; readonly size?: number }) {
  const line = subtitle ? brand?.subtitle : undefined;
  return (
    <span className="graview-app-title" style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <AppMark brand={brand} {...(size !== undefined ? { size } : {})} />
      <span style={{ display: "inline-flex", flexDirection: "column", minWidth: 0 }}>
        <span data-testid="app-name">{name ?? brand?.name ?? "Graview"}</span>
        {line ? (
          <span
            data-testid="app-subtitle"
            style={{ fontFamily: "var(--graview-font-body)", fontSize: "0.8125rem", fontWeight: 400, letterSpacing: "normal", textTransform: "none", lineHeight: 1.35, color: "var(--graview-ink-muted)", whiteSpace: "normal", overflowWrap: "anywhere" }}
          >
            {line}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * THE PAGE'S ICON (FR-124), for a face that owns the whole page — the
 * Shell, the routed face on its own, an embed its host told `favicon:
 * true`. Every `<link rel="icon">` the page has points at it while the face
 * is drawn, and back at what it pointed at after; a page with none gets
 * one. `undefined` touches nothing, which is what an embed on somebody
 * else's page passes.
 */
export function useFavicon(href: string | undefined): void {
  useEffect(() => {
    if (!href || typeof document === "undefined") return;
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    const was = links.map((link) => link.getAttribute("href"));
    let made: HTMLLinkElement | undefined;
    if (links.length === 0) {
      made = document.createElement("link");
      made.rel = "icon";
      made.setAttribute("data-graview-favicon", "");
      document.head.appendChild(made);
      links.push(made);
    }
    for (const link of links) link.href = href;
    return () => {
      if (made) made.remove();
      links.forEach((link, i) => {
        if (link !== made && was[i] !== null && was[i] !== undefined) link.setAttribute("href", was[i]!);
      });
    };
  }, [href]);
}

/**
 * THE BROWSER'S CHROME IN THE APP'S COLORS (Roadmap f-app-icons-home-screen),
 * for a face that owns the whole page as `useFavicon` is: a `<meta
 * name="theme-color">` for each scheme the app is drawn in — one where the
 * brand pins a scheme (`themeColorsOf`) — put in the head while the face is
 * drawn, and the page's own put back after. `undefined` touches nothing.
 */
export function useThemeColor(brand: Brand | undefined): void {
  const key = brand ? JSON.stringify(themeColorsOf(brand)) : "[]";
  useEffect(() => {
    const colors = JSON.parse(key) as ReturnType<typeof themeColorsOf>;
    if (colors.length === 0 || typeof document === "undefined") return;
    const own = [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]:not([data-graview-theme-color])')];
    // The page's own stand aside while the app's are in the head: the first that matches would win.
    own.forEach((meta) => meta.setAttribute("name", "graview-theme-color-held"));
    const made = colors.map(({ color, media }) => {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = color;
      if (media) meta.media = media;
      meta.setAttribute("data-graview-theme-color", "");
      document.head.appendChild(meta);
      return meta;
    });
    return () => {
      made.forEach((meta) => meta.remove());
      own.forEach((meta) => meta.setAttribute("name", "theme-color"));
    };
  }, [key]);
}
