import { SCHEMES, type Brand } from "@graview/core";
import { HostAssetsContext } from "@graview/react/provider";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppMark } from "../../src/index.js";

/**
 * A LOGO UNDER AN APP'S BASE IS DRAWN THERE (Roadmap f-brand-marks-under-app-base).
 * Graview Cloud serves each app under `/a/<app>/`, and a document names its
 * logo at `/graview/assets/<sha>.<ext>` on the host's root, where a visitor
 * found nothing. With the host's `assetsAt` the mark is drawn where the
 * host serves it — each scheme's face alike — and an inline SVG or an
 * emoji is drawn as given.
 */
const brand = (more: Partial<Brand>): Brand => ({ name: "TECH N9NE", schemes: SCHEMES, ...more });
const LIGHT = "/graview/assets/0f3a.png";
const DARK = "/graview/assets/9b2c.png";
const INLINE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="currentColor"></rect></svg>';
const under = (path: string) => `/a/tech-n9ne-discography${path}`;
const drawn = (mark: Brand) => renderToStaticMarkup(<HostAssetsContext.Provider value={under}><AppMark brand={mark} /></HostAssetsContext.Provider>);

describe("the app's mark under the host's base", () => {
  it("draws a path under /graview/assets/ where the host serves it, each scheme's face alike", () => {
    expect(drawn(brand({ logo: LIGHT }))).toContain(`src="${under(LIGHT)}"`);
    const both = drawn(brand({ logo: { light: LIGHT, dark: DARK } }));
    expect(both).toContain(`src="${under(LIGHT)}"`);
    expect(both).toContain(`src="${under(DARK)}"`);
  });

  it("draws an inline SVG and an emoji as given, and every path as given with no assetsAt", () => {
    expect(drawn(brand({ logo: INLINE }))).toContain(INLINE);
    expect(drawn(brand({ favicon: { emoji: "🎤" } }))).toContain("🎤");
    expect(renderToStaticMarkup(<AppMark brand={brand({ logo: LIGHT })} />)).toContain(`src="${LIGHT}"`);
  });
});
