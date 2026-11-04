// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { SPLASH_ID, SPLASH_SETTLED, splashHtml, splashPage, type SplashBrand } from "../../src/splash.js";

/**
 * AN OPENING SCREEN IS PHOTOGRAPHED AT ITS SETTLED FRAME (Roadmap
 * f-framework-small-fixes-0-1-66). Every picture of an app's places was
 * taken after the screen had gone, so a host that pictures a place for a
 * person (Graview Cloud's describe_place, set_opening_screen) could not show
 * them the first second their readers see. `splashPage` is the screen alone,
 * held — never taken away, since no place will draw under it — and its
 * script marks it `data-settled` once it stops moving (`SPLASH_SETTLED`), at
 * once under reduced motion, which draws that frame and no other.
 */
const BRAND: SplashBrand = { name: "Harbor Catering", accent: "#0f6e5c", ground: { light: "#eef3f8", dark: "#101826" } };

/** The page's body and script run in this document, as a browser would. */
function open(html: string, script: string): HTMLElement {
  document.body.innerHTML = html;
  new Function(script)();
  return document.getElementById(SPLASH_ID)!;
}
const settled = () => new Function(`return ${SPLASH_SETTLED}`)() as boolean;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the opening screen as a page of its own", () => {
  it("is a whole page holding the screen, its style and its script, and nothing for a brand with none", () => {
    const page = splashPage({ ...BRAND, splash: { style: "editorial", kicker: "Since 1998" } });
    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toContain(`id="${SPLASH_ID}"`);
    expect(page).toContain("data-hold");
    expect(page).toContain("<title>Harbor Catering</title>");
    expect(page).toContain("Since 1998");
    expect(splashPage(BRAND)).toBe("");
    // The screen inlined before an app's root is never held.
    expect(splashHtml({ ...BRAND, splash: { style: "editorial" } }).html).not.toContain("data-hold");
  });

  it("is held when a place says it has drawn, where the screen before an app's root is taken away", () => {
    const held = splashHtml({ ...BRAND, splash: { style: "plain" } }, { hold: true });
    open(`${held.html}<div data-graview-drawn></div>`, held.script);
    expect(document.getElementById(SPLASH_ID)?.hasAttribute("data-gone")).toBe(false);
    const before = splashHtml({ ...BRAND, splash: { style: "plain" } });
    open(`${before.html}<div data-graview-drawn></div>`, before.script);
    // Going: faded out, then removed.
    expect(document.getElementById(SPLASH_ID)?.hasAttribute("data-gone") ?? true).toBe(true);
  });

  it("says it has settled once its frame stops moving: at once for a screen with no motion and no image", () => {
    for (const style of ["plain", "editorial"] as const) {
      const drawn = splashHtml({ ...BRAND, splash: { style } }, { hold: true });
      open(drawn.html, drawn.script);
      expect(settled(), style).toBe(true);
    }
  });

  it("says it has settled under reduced motion at once, its one still frame the settled one: the ascii field filled and its title whole", () => {
    const motion = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("reduced-motion"), media: query, addEventListener() {}, removeEventListener() {} })) as never;
    try {
      const drawn = splashHtml({ ...BRAND, splash: { style: "ascii", kicker: "Since 1998" } }, { hold: true });
      const screen = open(drawn.html, drawn.script);
      expect(settled()).toBe(true);
      expect(screen.querySelector(".graview-splash-title")!.textContent).toBe("Harbor Catering");
    } finally {
      window.matchMedia = motion;
    }
  });
});
