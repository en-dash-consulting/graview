import { DARK, LIGHT } from "@graview/core";
import { themeCss } from "@graview/primitives";
import { describe, expect, it } from "vitest";
import { familiesOf, fontsLink } from "../../src/index.js";

describe("an embed's theme and fonts", () => {
  it("scopes the theme to the element rather than the document", () => {
    const css = themeCss("dark", undefined, { scope: ".graview-embed-7" });
    expect(css).toContain(".graview-embed-7 {");
    expect(css).not.toContain(":root");
    expect(css).not.toMatch(/^html, body/m);
    // The document's own theme is untouched by default.
    expect(themeCss("dark")).toContain(":root {");
  });

  it("names the brand's families and nothing the browser already has", () => {
    const brand = {
      name: "Seedbed",
      typography: { body: '"Figtree", ui-sans-serif, system-ui', display: '"Fraunces", ui-serif, Georgia', mono: "ui-monospace, Menlo" },
      schemes: { dark: DARK, light: LIGHT },
    };
    expect(familiesOf(brand as never)).toEqual(["Figtree", "Fraunces"]);
    expect(fontsLink(brand as never)).toBe("https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:wght@400;500;600;700&display=swap");
    expect(fontsLink({ name: "Plain", schemes: { dark: DARK, light: LIGHT } } as never)).toBeNull();
  });
});
