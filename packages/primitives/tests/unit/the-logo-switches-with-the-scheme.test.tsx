import { SCHEMES, type Brand } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppMark, themeCss } from "../../src/index.js";

/**
 * THE LOGO SWITCHES WITH THE SCHEME. A brand's `logo: { light, dark }`
 * draws the light one in the light scheme and the dark one in the dark,
 * however the page chose its scheme — the theme's sheet, written for one
 * scheme, hides the other's — so a design's bar and the default shell need
 * no hook to keep it right. Only a light one, and `darkFallback: "invert"`,
 * is inverted and screened onto the ground in the dark scheme alone: a JPG
 * on white is no longer a white slab there, and a logo that never asked is
 * left as it was given.
 */
const brand = (more: Partial<Brand>): Brand => ({ name: "Recon", schemes: SCHEMES, ...more });
const LIGHT = "/graview/assets/0f3a.jpg";
const DARK = "/graview/assets/9b2c.png";
const INLINE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="currentColor"></rect></svg>';

describe("the app's mark with a logo for each scheme", () => {
  it("draws both, each marked for the scheme it is drawn in", () => {
    const html = renderToStaticMarkup(<AppMark brand={brand({ logo: { light: LIGHT, dark: DARK } })} />);
    expect(html).toMatch(new RegExp(`<img[^>]*data-graview-scheme-only="light"[^>]*src="${LIGHT}"|<img[^>]*src="${LIGHT}"[^>]*data-graview-scheme-only="light"`));
    expect(html).toMatch(new RegExp(`<img[^>]*data-graview-scheme-only="dark"[^>]*src="${DARK}"|<img[^>]*src="${DARK}"[^>]*data-graview-scheme-only="dark"`));
    expect(html.match(/data-testid="app-mark"/g)).toHaveLength(1);
  });

  it("draws inline marks for each scheme as given", () => {
    const html = renderToStaticMarkup(<AppMark brand={brand({ logo: { light: INLINE, dark: INLINE.replace("currentColor", "#fff") } })} />);
    expect(html).toContain(INLINE);
    expect(html).toContain('fill="#fff"');
    expect(html.match(/data-graview-scheme-only=/g)).toHaveLength(2);
  });

  it("asks for the inverted fallback only where there is no dark one and the brand said so", () => {
    expect(renderToStaticMarkup(<AppMark brand={brand({ logo: { light: LIGHT, darkFallback: "invert" } })} />)).toContain('data-graview-logo-fallback="invert"');
    expect(renderToStaticMarkup(<AppMark brand={brand({ logo: { light: LIGHT } })} />)).not.toContain("data-graview-logo-fallback");
    expect(renderToStaticMarkup(<AppMark brand={brand({ logo: LIGHT })} />)).not.toContain("data-graview-logo-fallback");
    expect(renderToStaticMarkup(<AppMark brand={brand({ logo: { light: LIGHT, dark: DARK, darkFallback: "invert" } })} />)).not.toContain("data-graview-logo-fallback");
  });

  it("is one image, as before, when there is one logo", () => {
    const html = renderToStaticMarkup(<AppMark brand={brand({ logo: { light: LIGHT } })} />);
    expect(html).toMatch(/<img class="graview-logo" data-testid="app-mark" src="\/graview\/assets\/0f3a.jpg"/);
    expect(html).not.toContain("data-graview-scheme-only");
  });
});

describe("the theme's sheet", () => {
  it("hides the other scheme's logo, and inverts a fallback in the dark alone", () => {
    const dark = themeCss("dark", brand({}));
    const light = themeCss("light", brand({}));
    expect(dark).toMatch(/\[data-graview-scheme-only="light"\]\s*\{\s*display:\s*none/);
    expect(light).toMatch(/\[data-graview-scheme-only="dark"\]\s*\{\s*display:\s*none/);
    expect(dark).toMatch(/\[data-graview-logo-fallback="invert"\]\s*\{[^}]*filter:\s*invert\(1\) hue-rotate\(180deg\)[^}]*mix-blend-mode:\s*screen/);
    expect(light).not.toContain("invert(1)");
  });

  it("scopes both to an embed's own box", () => {
    const scoped = themeCss("dark", brand({}), { scope: "#here" });
    expect(scoped).toContain('#here [data-graview-scheme-only="light"]');
    expect(scoped).toContain('#here [data-graview-logo-fallback="invert"]');
  });
});
