import { isInlineSvg, markHref, svgProblem, type Brand } from "@graview/core";
import { useEffect, type CSSProperties } from "react";
import { useMarkup } from "./markup.js";

/*
 * THE APP, SAID ONCE (FR-124, FR-125): its mark, its name, and the line
 * under the name — the one component every face draws its title with, so
 * the Graview face's bar, the embed's strip and the routed face's masthead
 * say the same app the same way, and a later bar moves one component.
 *
 * The mark is drawn as the brand gives it, never redrawn: an SVG written
 * inline is put in the page as it is (so `currentColor` takes the accent,
 * and nothing else is recoloured), and only when it could not act — an
 * SVG with a script, a handler or a load in it is not drawn at all. A path
 * is an `<img>`. Beside the name the mark is said only when its alt text
 * says more than the name does.
 */

/** The brand's mark alone, `size` pixels tall; nothing when there is none, or none that may be drawn. */
export function AppMark({ brand, size = 22 }: { readonly brand: Brand | undefined; readonly size?: number }) {
  const logo = brand?.logo;
  const inline = logo !== undefined && isInlineSvg(logo) && svgProblem(logo) === null ? logo : undefined;
  const markup = useMarkup(inline);
  if (!logo || !markHref(logo)) return null;
  const alt = brand?.logoAlt ?? brand?.name ?? "";
  const said = alt !== "" && alt !== brand?.name;
  const box: CSSProperties = { display: "inline-flex", flex: "0 0 auto", height: size, color: "var(--graview-accent)" };
  if (inline) return <span className="graview-logo" data-testid="app-mark" style={box} {...(said ? { role: "img", "aria-label": alt } : { "aria-hidden": true })} dangerouslySetInnerHTML={markup} />;
  return <img className="graview-logo" data-testid="app-mark" src={logo} alt={said ? alt : ""} style={{ ...box, width: "auto" }} />;
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
