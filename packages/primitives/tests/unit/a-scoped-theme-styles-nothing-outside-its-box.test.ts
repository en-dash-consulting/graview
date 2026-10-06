import { describe, expect, it } from "vitest";
import { GRAVIEW_BRAND } from "../../src/theme.js";
import { themeCss } from "../../src/scene-css.js";

/*
 * FR-64. The embed renders `themeCss(…, { scope })` into its own <style>, and
 * a scoped stylesheet that still says `button { … }` restyles every button on
 * the host's page. So this reads the stylesheet the way a browser would —
 * every selector of every rule, inside @media and @supports too — rather
 * than grepping for the rules that leaked once, and a bare rule added
 * tomorrow fails here.
 */

interface Rule {
  readonly at: readonly string[];
  readonly selectors: readonly string[];
}

/** Splits on commas that are not inside parentheses, brackets or strings. */
function splitList(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (const ch of prelude) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Every style rule in a stylesheet, with the at-rules it sits inside. */
function rulesOf(css: string, at: readonly string[] = []): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    const semi = text.indexOf(";", i);
    if (open === -1) break;
    if (semi !== -1 && semi < open && text.slice(i, semi).trim().startsWith("@")) {
      i = semi + 1;
      continue;
    }
    const prelude = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    let quote: string | null = null;
    for (; j < text.length && depth > 0; j++) {
      const ch = text[j]!;
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    const body = text.slice(open + 1, j - 1);
    if (prelude.startsWith("@")) {
      const name = prelude.split(/[\s(]/)[0]!;
      if (name === "@media" || name === "@supports" || name === "@container" || name === "@layer") {
        rules.push(...rulesOf(body, [...at, prelude]));
      } else {
        rules.push({ at: [...at, prelude], selectors: [] });
      }
    } else {
      rules.push({ at, selectors: splitList(prelude) });
    }
    i = j;
  }
  return rules;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether a selector can only ever match the box or something inside it. */
function inside(selector: string, scope: string): boolean {
  const s = escape(scope);
  return (
    // The box itself, or something under it.
    new RegExp(`^${s}(?![\\w-])`).test(selector) ||
    new RegExp(`^:where\\(${s}\\)\\s`).test(selector) ||
    // The reader's motion answer, asked of the document and applied within the box.
    new RegExp(`^:root(?:\\[data-graview-motion=[^\\]]+\\]|:not\\(\\[data-graview-motion=[^\\]]+\\]\\))\\s+${s}\\s`).test(selector)
  );
}

describe("a scoped theme styles nothing outside its box (FR-64)", () => {
  const SCOPE = ".graview-embed-7";
  const brands = [GRAVIEW_BRAND, { ...GRAVIEW_BRAND, shape: { radius: 4, density: 0.9 }, typography: { display: "Georgia, serif", body: "system-ui", mono: "Menlo" } }];

  for (const scheme of ["dark", "light"] as const) {
    for (const [n, brand] of brands.entries()) {
      it(`every selector of every rule is the box or inside it — ${scheme}, brand ${n + 1}`, () => {
        const rules = rulesOf(themeCss(scheme, brand as never, { scope: SCOPE }));
        expect(rules.length).toBeGreaterThan(100);
        const outside = rules.flatMap((rule) => rule.selectors.filter((sel) => !inside(sel, SCOPE)).map((sel) => [...rule.at, sel].join(" › ")));
        expect(outside).toEqual([]);
        /*
         * What is not a style rule names no element: a registered custom
         * property and the keyframes the rules inside the box animate by.
         */
        const others = rules.filter((rule) => rule.selectors.length === 0).map((rule) => rule.at.at(-1)!.split(/\s/)[0]);
        expect(new Set(others)).toEqual(new Set(["@property", "@keyframes"]));
      });
    }
  }

  it("rules inside @media are held to the box as well", () => {
    const rules = rulesOf(themeCss("dark", GRAVIEW_BRAND, { scope: SCOPE }));
    const nested = rules.filter((rule) => rule.at.some((a) => a.startsWith("@media")) && rule.selectors.length > 0);
    expect(nested.length).toBeGreaterThan(0);
    for (const rule of nested) for (const sel of rule.selectors) expect(inside(sel, SCOPE), sel).toBe(true);
  });

  it("the host's buttons, headings and code are named by no rule of the embed's", () => {
    const selectors = rulesOf(themeCss("dark", GRAVIEW_BRAND, { scope: SCOPE })).flatMap((rule) => rule.selectors);
    for (const bare of ["button", "button:hover:not(:disabled)", "button:focus-visible", "button:disabled", "code", "h1", "h2", "code", "kbd", "samp"]) {
      expect(selectors).not.toContain(bare);
    }
  });

  it("the whole page's stylesheet, with no scope, still themes the whole page", () => {
    const selectors = rulesOf(themeCss("dark")).flatMap((rule) => rule.selectors);
    for (const page of [":root", "html", "body", "h1", "button", "button:focus-visible", "code", ".graview-ground", "[data-graview-view]"]) {
      expect(selectors).toContain(page);
    }
    expect(selectors.some((sel) => sel.includes(":where("))).toBe(false);
  });
});
