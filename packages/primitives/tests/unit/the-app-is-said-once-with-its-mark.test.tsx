import { SCHEMES, type Brand } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppTitle } from "../../src/index.js";

/**
 * FR-124, FR-125: THE APP IS SAID ONCE, WITH ITS MARK. One component draws
 * the app's mark, its name and the line under it on every face, so a logo
 * given as SVG is put in the page as it was given — byte for byte — a
 * logo that could act is not drawn at all, a logo kept at a path is an
 * image, and the mark is said only when its alt text says more than the
 * name beside it.
 */
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24" width="48" height="24"><rect x="4" y="10" width="40" height="4" rx="2" fill="currentColor"></rect></svg>';
const brand = (more: Partial<Brand>): Brand => ({ name: "En Dash", schemes: SCHEMES, ...more });

describe("the app's title: its mark, its name, the line under it", () => {
  it("puts an inline SVG logo in the page exactly as it was given", () => {
    const html = renderToStaticMarkup(<AppTitle brand={brand({ logo: LOGO })} />);
    expect(html).toContain(`>${LOGO}</span>`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<span data-testid="app-name">En Dash</span>');
  });

  it("says the mark when its alt text says more than the name", () => {
    expect(renderToStaticMarkup(<AppTitle brand={brand({ logo: LOGO, logoAlt: "En Dash Consulting" })} />)).toContain('role="img" aria-label="En Dash Consulting"');
  });

  it("draws a logo kept at a path as an image", () => {
    const html = renderToStaticMarkup(<AppTitle brand={brand({ logo: "/graview/assets/abc.svg", logoAlt: "The En Dash mark" })} />);
    expect(html).toMatch(/<img class="graview-logo" data-testid="app-mark" src="\/graview\/assets\/abc.svg" alt="The En Dash mark"/);
  });

  it("does not draw a logo that could act", () => {
    const html = renderToStaticMarkup(<AppTitle brand={brand({ logo: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' })} />);
    expect(html).not.toContain("script");
    expect(html).not.toContain("app-mark");
  });

  it("does not draw a logo the HTML parser would read as more than a picture, nor a mark at a script's address", () => {
    const acting = [
      '<svg xmlns="http://www.w3.org/2000/svg"><animate/onbegin=alert(1) attributeName=x dur=1s></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"></svg><img/src/onerror=alert(1)>',
      '<svg xmlns="http://www.w3.org/2000/svg"></svg><base href="//evil.example/">',
      '<svg xmlns="http://www.w3.org/2000/svg"><a href=javascript:alert(1)><rect width="9" height="9"/></a></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><style>@\\69mport "http://evil.example/x.css";</style></svg>',
    ];
    for (const logo of acting) expect(renderToStaticMarkup(<AppTitle brand={brand({ logo })} />)).not.toContain("app-mark");
    expect(renderToStaticMarkup(<AppTitle brand={brand({ logo: "javascript:alert(1)" })} />)).not.toContain("app-mark");
  });

  it("draws the line under the name only where it is asked for", () => {
    const withLine = brand({ subtitle: "Workshops, who came, and what each one left behind." });
    expect(renderToStaticMarkup(<AppTitle brand={withLine} subtitle />)).toContain(">Workshops, who came, and what each one left behind.</span>");
    expect(renderToStaticMarkup(<AppTitle brand={withLine} />)).not.toContain("app-subtitle");
  });
});
