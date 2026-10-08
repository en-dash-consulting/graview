import { describe, expect, it } from "vitest";
import { markHref, markProblem, svgProblem } from "../../src/index.js";

/**
 * A MARK IS JUDGED AS THE BROWSER WILL READ IT (FR-124). An inline SVG
 * logo is put in the page through the HTML parser, so a rule that reads
 * the string some other way is a rule the parser can be talked past: a
 * handler after a slash rather than a space, an unquoted link, markup
 * after the closing tag, an animation that sets a link, a style escaped
 * so the rule does not see `url(`. Each of these was taken by the rules
 * as first written, and each would run or load on Graview Cloud's page.
 * The SVG is now read whole, element by element, and only what a picture
 * needs is kept.
 */
const SVG = 'xmlns="http://www.w3.org/2000/svg"';
const REFUSED: readonly [string, string][] = [
  ["a handler after a slash", `<svg ${SVG}><animate/onbegin=alert(1) attributeName=x dur=1s></svg>`],
  ["a handler right after a quoted value", `<svg ${SVG}><animate attributeName="x"onbegin="alert(1)" dur="1s"/></svg>`],
  ["markup after the SVG ends", `<svg ${SVG}></svg><img/src/onerror=alert(1)>`],
  ["a frame after a slash", `<svg ${SVG}><iframe/srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></svg>`],
  ["an unquoted javascript: link", `<svg ${SVG}><a href=javascript:alert(1)><rect width="9" height="9"/></a></svg>`],
  ["an xlink javascript: link", `<svg ${SVG} xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(1)"><rect width="9" height="9"/></a></svg>`],
  ["an animation that sets a link", `<svg ${SVG}><a><set attributeName="href" to="javascript:alert(1)"/><rect width="9" height="9"/></a></svg>`],
  ["a base after the SVG", `<svg ${SVG}></svg><base href="//evil.example/">`],
  ["a refresh after the SVG", `<svg ${SVG}></svg><meta http-equiv="refresh" content="0;url=https://evil.example">`],
  ["an unquoted outside use", `<svg ${SVG}><use href=http://evil.example/x.svg#a /></svg>`],
  ["an escaped import", `<svg ${SVG}><style>@\\69mport "http://evil.example/x.css";</style></svg>`],
  ["an escaped url in a style", `<svg ${SVG}><rect style="fill:u\\72l(//evil.example/x)"/></svg>`],
  ["an entity-escaped url in a paint", `<svg ${SVG}><rect fill="u&#114;l(//evil.example/x)"/></svg>`],
  ["a style element at all", `<svg ${SVG}><style>rect { fill: red }</style></svg>`],
  ["a namespaced script", `<svg ${SVG}><x:script xmlns:x="http://www.w3.org/2000/svg">alert(1)</x:script></svg>`],
  ["a use of another document", `<svg ${SVG}><use href="data:image/svg+xml,&lt;svg/&gt;#a"/></svg>`],
  ["a filter image that loads", `<svg ${SVG}><filter id="f"><feImage href="https://evil.example/x.png"/></filter></svg>`],
  ["an HTML element inside a title", `<svg ${SVG}><title><img src="x" onerror="alert(1)"></title></svg>`],
  ["a comment the HTML parser ends early", `<svg ${SVG}><!-- --!><img src=x onerror=alert(1)> --></svg>`],
  ["a CDATA section", `<svg ${SVG}><![CDATA[<img src=x onerror=alert(1)>]]></svg>`],
  ["an XHTML namespace", `<svg ${SVG}><g xmlns="http://www.w3.org/1999/xhtml"><title>x</title></g></svg>`],
  ["an element that is left open", `<svg ${SVG}><g>`],
  ["an xml:base", `<svg ${SVG} xml:base="https://evil.example/"><use href="#a"/></svg>`],
];

describe("an inline mark is read element by element, as the browser reads it", () => {
  for (const [what, mark] of REFUSED) {
    it(`refuses ${what}, and never draws it`, () => {
      expect(svgProblem(mark)).not.toBeNull();
      expect(markProblem(mark)).not.toBeNull();
      expect(markHref(mark)).toBeUndefined();
    });
  }

  it("keeps a picture's own parts: shapes, groups, gradients, its own links, text, a title, a comment and a prolog", () => {
    const kept = [
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Made by hand -->\n<svg ${SVG} xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 48 24"><title>En Dash</title><defs><linearGradient id="g"><stop offset="0" stop-color="#0f6e5c"/></linearGradient><clipPath id="c"><rect width="48" height="24"/></clipPath></defs><g clip-path="url(#c)"><rect fill="url(#g)" width="48" height="24" rx="2"/><use xlink:href="#g"/><text x="4" y="16" font-family="Georgia, serif">E &amp; D</text></g></svg>`,
      `<svg ${SVG} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:version="1.3"><filter id="s"><feGaussianBlur stdDeviation="1"/></filter><g inkscape:label="Layer 1" style="fill:#123456;opacity:0.5"><path d="M0 0h4v4z"/></g></svg>`,
      `<svg ${SVG}><image href="data:image/png;base64,iVBORw0KGgo=" width="8" height="8"/></svg>`,
    ];
    for (const mark of kept) expect([mark.slice(0, 40), svgProblem(mark)]).toEqual([mark.slice(0, 40), null]);
  });

  it("says why, in the words the checker has always used for a script, a handler and a load", () => {
    expect(svgProblem(`<svg ${SVG}><script>alert(1)</script></svg>`)).toBe("it has a script in it");
    expect(svgProblem(`<svg ${SVG} onload="alert(1)"></svg>`)).toBe("it has an event handler (an on… attribute)");
    expect(svgProblem(`<svg ${SVG}><foreignObject><p>hi</p></foreignObject></svg>`)).toBe("it embeds HTML (foreignObject)");
    expect(svgProblem(`<svg ${SVG}><image href="https://example.com/a.png"></image></svg>`)).toBe("it loads or links to something outside itself");
    expect(svgProblem(`<svg ${SVG}><rect style="fill: url(https://example.com/x)"></rect></svg>`)).toBe("its style loads something outside itself");
  });
});

describe("a mark at a path stays on the app's own host", () => {
  it("refuses a path that climbs out of the assets, or out of the page", () => {
    for (const mark of ["/graview/assets/../api/secret", "/graview/assets/..", "../api/export", "./../x.svg", "/graview/assets/./x.svg"]) {
      expect([mark, markProblem(mark)]).toEqual([mark, expect.stringMatching(/climbs/)]);
    }
  });

  it("never hands a face a mark that names a script or another kind of address", () => {
    expect(markHref("javascript:alert(1)")).toBeUndefined();
    expect(markHref(" JavaScript:alert(1)")).toBeUndefined();
    expect(markHref("vbscript:x")).toBeUndefined();
    expect(markHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(markHref("/graview/assets/abc.svg")).toBe("/graview/assets/abc.svg");
    expect(markHref("https://cdn.example.com/logo.png")).toBe("https://cdn.example.com/logo.png");
    expect(markHref("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=");
  });
});
