// @vitest-environment jsdom
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { SPLASH_ID, SPLASH_SHADERS, SPLASH_STYLES, splashHtml, type SplashBrand } from "../../src/splash.js";

/**
 * AN OPENING SCREEN IS A STATUS, IN THE WORDS OF THE PAGE IT OPENS
 * (Roadmap splash-html-aria-label-without-role, splash-html-takes-where-it-opens,
 * splash-shader-light-through-water).
 *
 * Graview Cloud's axe pass found `aria-label` on the screen's `<div>`, which
 * has no role to be named by (aria-prohibited-attr). It is a status now —
 * what it says is that the app is opening — named by its title, and the
 * ascii title that types itself on is heard once, in that name. A host
 * hands a page's own words over the brand's; the screen fades unless the
 * host, a reader or automation says otherwise; and light through water is
 * a fourth shader by name.
 */
const BRAND: SplashBrand = { name: "Harbor Catering", accent: "#0f6e5c", splash: { style: "editorial", title: "Dinner, delivered", kicker: "Since 1998" } };

const mount = (html: string) => {
  document.body.innerHTML = `<main><h1>Harbor Catering</h1></main>${html}`;
  return document.getElementById(SPLASH_ID)!;
};

describe("the opening screen, as a reader meets it", () => {
  it("is a status named by its title, and axe finds nothing on it in any style", async () => {
    for (const style of SPLASH_STYLES) {
      const screen = mount(splashHtml({ ...BRAND, splash: { style, kicker: "Since 1998" } }).html);
      expect(screen.getAttribute("role")).toBe("status");
      expect(screen.getAttribute("aria-label")).toBe("Harbor Catering");
      const result = await axe.run(document.body, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }, rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      expect(result.violations.map((violation) => `${style}: ${violation.id}`)).toEqual([]);
    }
  });

  it("hears the ascii title once, in the screen's name, rather than letter by letter as it types on", () => {
    const screen = mount(splashHtml({ ...BRAND, splash: { style: "ascii" } }).html);
    expect(screen.querySelector(".graview-splash-title")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAttribute("aria-label")).toBe("Harbor Catering");
  });
});

describe("the opening screen's words", () => {
  it("are the brand's unless the host says this page's own title and kicker", () => {
    const brand = splashHtml(BRAND).html;
    expect(brand).toContain(">Dinner, delivered</p>");
    expect(brand).toContain(">Since 1998</p>");
    const page = splashHtml(BRAND, { title: "This week's menu", kicker: "Menus" }).html;
    expect(page).toContain(">This week's menu</p>");
    expect(page).toContain('aria-label="This week\'s menu"');
    expect(page).toContain(">Menus</p>");
    expect(page).not.toContain("Dinner, delivered");
    // An empty kicker says none; a title alone keeps the brand's kicker.
    expect(splashHtml(BRAND, { title: "Menus", kicker: "" }).html).not.toContain("graview-splash-kicker");
    expect(splashHtml(BRAND, { title: "Menus" }).html).toContain(">Since 1998</p>");
    expect(splashHtml(BRAND, { title: "<b>Menus</b>" }).html).toContain("&lt;b&gt;Menus&lt;/b&gt;");
  });
});

describe("the opening screen's going", () => {
  it("fades unless the host says `fade: false`, and goes at once under automation or for a reader who asks for less motion", () => {
    expect(splashHtml(BRAND).html).not.toContain("data-fade");
    expect(splashHtml(BRAND, { fade: false }).html).toContain('data-fade="off"');
    const { script } = splashHtml(BRAND);
    expect(script).toContain("navigator.webdriver===true");
    expect(script).toContain('s.getAttribute("data-fade")==="off"');
    expect(script).toMatch(/if\(quick\)\{if\(s\.parentNode\)s\.parentNode\.removeChild\(s\);return\}/);
  });
});

describe("light through water", () => {
  it("is a shader by name, drawn by the same loop as the others, still for a reader who asks for less motion", () => {
    expect(SPLASH_SHADERS).toContain("caustics");
    const drawn = splashHtml({ ...BRAND, splash: { style: "shader", shader: "caustics" } });
    expect(drawn.html).toContain('data-shader="caustics"');
    expect(drawn.script).toContain('caustics:"');
    // Its loop is bounded, as WebGL 1 needs, and it reads the image, the tint and the scheme's light as the others do.
    expect(drawn.script).toMatch(/caustics:"[^"]*for\(int n=0;n<4;n\+\+\)[^"]*pic\(uv[^"]*u_tint[^"]*u_light/);
    expect(drawn.script).toContain("function loop(frame){if(still){frame(0);return}");
  });
});
