import { describe, expect, it } from "vitest";
import { themeCss } from "../../src/index.js";

/**
 * NO CONTROL THE FRAMEWORK DRAWS IS UNDER A FINGERTIP.
 *
 * `audit-ui` holds every control on every screen to 24px and is the real
 * measurement — but it needs a browser, three apps and a minute, so nothing
 * runs it on the way past. The scene's own district controls sat two pixels
 * under the floor in a product that measured them, and an app cannot fix
 * them without forking this package: they are drawn by the framework, styled
 * by the framework's own stylesheet, and nothing in the test suite was
 * looking at that stylesheet.
 *
 * This is the cheap half of the same question, asked of the sheet itself:
 * every rule that makes something clickable declares a height floor, and
 * every floor is at least a fingertip at the default text size.
 */
const css = themeCss();

/** Every rule in the sheet, as [selector, body]. */
function rules(sheet: string): readonly (readonly [string, string])[] {
  const out: (readonly [string, string])[] = [];
  const pattern = /([^{}]*)\{([^{}]*)\}/g;
  for (let m = pattern.exec(sheet); m !== null; m = pattern.exec(sheet)) {
    const selector = (m[1] ?? "").trim().split("\n").at(-1)?.trim() ?? "";
    out.push([selector, m[2] ?? ""] as const);
  }
  return out;
}

/**
 * A length in pixels at the default text size, or undefined when it is not a
 * shape this can judge. `max(1.5rem, 24px)` is the framework's own answer —
 * a fingertip that grows with the reader — so the floor is the largest of
 * the terms, which is what `max` means.
 */
function pixels(value: string): number | undefined {
  const terms = value.replace(/^max\(|\)$/g, "").split(",");
  const sizes = terms.map((term) => {
    const said = term.trim();
    if (said.endsWith("px")) return Number.parseFloat(said);
    if (said.endsWith("rem") || said.endsWith("em")) return Number.parseFloat(said) * 16;
    return Number.NaN;
  });
  if (sizes.some((size) => Number.isNaN(size))) return undefined;
  return Math.max(...sizes);
}

/** A rule that makes something pressable rather than merely colored. */
const pressable = ([, body]: readonly [string, string]) => /cursor:\s*pointer/.test(body);

describe("the chrome the framework draws", () => {
  it("finds the stylesheet's own controls to measure", () => {
    expect(rules(css).filter(pressable).length).toBeGreaterThan(0);
  });

  it("gives the district's disclosure and its past-horizon a full fingertip", () => {
    /* The rules that make them pressable — not the `display: none` that
       hides the disclosure inside the stack, nor the hover colors. */
    const controls = rules(css)
      .filter(pressable)
      .filter(
        ([selector]) =>
          selector.includes("graview-kind-open") || selector.includes("graview-kind-past"),
      );
    /* Both of them, in the one place an app cannot reach: the sheet. */
    expect(controls.length).toBe(2);
    for (const [selector, body] of controls) {
      const said = /min-height:\s*([^;]+);/.exec(body)?.[1]?.trim();
      expect(said, `${selector} declares no height floor`).toBeDefined();
      expect(pixels(said!), `${selector} floors at ${said}`).toBeGreaterThanOrEqual(24);
    }
  });

  it("gives the district's disclosure a fingertip's width as well as its height, now it is only a chevron at rest", () => {
    /*
     * FR-117 took the capsule off it and its sides from 9px to 6px: at rest
     * it is the chevron alone, and audit-ui measured "open ▾" at 21×24 on
     * every district — three pixels under the floor its own comment names.
     * A height floor alone does not hold a button whose words are hidden.
     */
    const [selector, body] = rules(css).filter(pressable).find(([selector]) => selector.includes("graview-kind-open")) ?? ["", ""];
    const said = /min-width:\s*([^;]+);/.exec(body)?.[1]?.trim();
    expect(said, `${selector} declares no width floor`).toBeDefined();
    expect(pixels(said!), `${selector} floors at ${said}`).toBeGreaterThanOrEqual(24);
  });

  it("floors every pressable rule that names one at a fingertip", () => {
    const under: string[] = [];
    for (const [selector, body] of rules(css).filter(pressable)) {
      const said = /min-height:\s*([^;]+);/.exec(body)?.[1]?.trim();
      if (said === undefined) continue;
      const floor = pixels(said);
      if (floor !== undefined && floor < 24) under.push(`${selector} → ${said}`);
    }
    expect(under).toEqual([]);
  });

  /*
   * AND EVERY PIECE OF CHROME DECLARES ONE.
   *
   * The rule above only judges a floor that is already there, so the next
   * control the framework draws could ship without one and pass — which is
   * exactly what happened: the district row's overflow card was written
   * after this test, and a product's own audit found its names at 21.7px
   * before anything here did. A chrome class that is pressable has to say
   * what its floor is.
   *
   * `[data-graview-pick]` and `[data-graview-view]` are excluded on purpose:
   * those are whole cards and whole views, sized by the layout, and a floor
   * on them would be a floor on the picture.
   */
  it("makes every pressable piece of chrome declare a floor at all", () => {
    const silent = rules(css)
      .filter(pressable)
      .filter(([selector]) => /\.graview-[a-z-]+/.test(selector))
      // The ground tile is a whole plot, sized by the layout like a card: the picture, not chrome.
      .filter(([selector]) => !selector.includes("graview-plot-tile"))
      .filter(([, body]) => !/min-height:/.test(body))
      .map(([selector]) => selector);
    expect(silent).toEqual([]);
  });

  /*
   * THE ONE CONTROL THAT IS JUDGED WHERE IT IS DRAWN.
   *
   * audit-ui divides by the plane's scale before measuring, because a
   * perfectly good 24px control at the back of the city measures 20 and that
   * is the depth model working rather than a defect. It holds for a control
   * that sits ON a large target — the chip's disclosure is small and the
   * card behind it is a card. The overflow card's names are not that: they
   * are the only way to the districts the row could not hold, so they are
   * designed big enough to be a fingertip at plane two's own 0.90.
   */
  it("designs the overflow card's names to survive the plane's own shrink", () => {
    const [, body] =
      rules(css)
        .filter(pressable)
        .find(([selector]) => selector.includes("graview-beyond-list")) ?? [];
    const said = /min-height:\s*([^;]+);/.exec(body ?? "")?.[1]?.trim();
    expect(said, "the overflow card's names declare no floor").toBeDefined();
    /* Plane two is drawn at 0.90, and 24 is the floor it has to meet there. */
    expect((pixels(said!) ?? 0) * 0.9).toBeGreaterThanOrEqual(24);
  });
});
