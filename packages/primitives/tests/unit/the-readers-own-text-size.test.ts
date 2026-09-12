import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { themeCss } from "../../src/index.js";

/**
 * THE READER'S OWN TEXT SIZE REACHES THE APP.
 *
 * The theme pinned the base to `font: 14px/1.55` and every one of the 120
 * font sizes under it was an absolute pixel count, so somebody who sets a
 * larger default font in their browser — the setting WCAG 1.4.4 is about —
 * got a Graview that ignored them completely. Stage I of the walkthrough
 * asks for "text zoom to 200% — the root font size, not page zoom", and the
 * app passed it by not changing at all, which is a criterion that cannot
 * fail rather than a property that holds.
 *
 * 0.875rem is 14px at the default 16px root, so nothing moves for anyone who
 * has not asked for anything — which is why every screen of `audit-ui` and
 * `survey` is unchanged by this.
 */
const source = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at)) {
      const full = resolve(at, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
  };
  walk(dir);
  return out;
};

describe("text sized the way the reader asked for", () => {
  it("makes the base relative to the root, at the same default", () => {
    const css = themeCss("light");
    expect(css).toContain("font: 0.875rem/1.55");
    expect(css).not.toMatch(/font: \d+px\//);
  });

  it("sizes no text in absolute pixels anywhere a face is drawn", () => {
    const offenders: string[] = [];
    for (const pkg of ["primitives", "pages", "react"]) {
      const root = resolve(import.meta.dirname, "../../..", pkg, "src");
      for (const file of source(root)) {
        for (const [line] of readFileSync(file, "utf8").matchAll(/fontSize: [0-9][^,\n]*/g)) {
          offenders.push(`${pkg}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
