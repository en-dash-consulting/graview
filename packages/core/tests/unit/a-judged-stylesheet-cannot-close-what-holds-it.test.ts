import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { LEAVING, ORDINARY, STAYING } from "../../../../scripts/fixtures/sheets-that-try-to-leave-their-layer.mjs";
import { sanitizeStylesheet, tokenize } from "../../src/css.js";
import { brandFindings } from "../../src/document/brand-check.js";

/**
 * A JUDGED STYLESHEET CANNOT CLOSE WHAT HOLDS IT. A stray `}` in a prelude is
 * junk at the top of a sheet, so nothing fetched on the page, and the judges
 * let it through: `@media }div{background-image:url("…");z{}}` was kept with
 * nothing refused, its block judged as rules with a long selector. Anything
 * that puts that output inside a block — a cascade layer, a host's own
 * `@media` — has the `}` close its block and the rest read as CSS nobody
 * judged, a fetch of any address among it. What a judge passes must read the
 * same wherever it is put, so a condition and a selector hold no `}`, `;`,
 * at-keyword, `<!--`, `-->`, lone backslash, or unmatched bracket.
 */
const IN_A_BLOCK = (css: string) => `@layer held {\n${css}\n}`;

/** The tokens' brackets, in order: every one must close what is open, and the last close must end the text. */
function closesEarly(text: string): boolean {
  const open: string[] = [];
  const tokens = tokenize(text).filter((one) => one.type !== "whitespace");
  for (const [at, token] of tokens.entries()) {
    if (token.type === "{" || token.type === "(" || token.type === "[" || token.type === "function") open.push(token.type === "function" ? "(" : token.type);
    if (token.type === "}" || token.type === ")" || token.type === "]") {
      const wanted = { "}": "{", ")": "(", "]": "[" }[token.type];
      if (open.pop() !== wanted) return true;
      if (open.length === 0 && at !== tokens.length - 1) return true;
    }
  }
  return open.length !== 0;
}

describe("a stylesheet's judges", () => {
  for (const { name, css } of LEAVING as { name: string; css: string }[]) {
    it(`refuse it, and what is kept stays inside a block: ${name}`, () => {
      const judged = sanitizeStylesheet(css);
      expect(judged.refused.length, judged.css).toBeGreaterThan(0);
      expect(closesEarly(IN_A_BLOCK(judged.css)), judged.css).toBe(false);
      expect(judged.css).not.toContain("evil.test");
      expect(judged.css).not.toMatch(/@layer/);
    });
  }

  for (const { name, css } of STAYING as { name: string; css: string }[]) {
    it(`keep what only looks like one, written so it stays inside a block: ${name}`, () => {
      expect(closesEarly(IN_A_BLOCK(sanitizeStylesheet(css).css)), sanitizeStylesheet(css).css).toBe(false);
    });
  }

  for (const css of ORDINARY as string[]) {
    it(`refuse nothing of an ordinary sheet: ${css}`, () => {
      const judged = sanitizeStylesheet(css);
      expect(judged.refused).toEqual([]);
      expect(closesEarly(IN_A_BLOCK(judged.css))).toBe(false);
    });
  }

  it("say so of the app's own stylesheet for its views: graview check warns where it said nothing", () => {
    const findings = brandFindings({ views: { css: '@media }div{background-image:url("https://evil.test/a");z{}}' } });
    expect(findings.map((one) => one.code)).toEqual(["brand-views-css"]);
  });
});
