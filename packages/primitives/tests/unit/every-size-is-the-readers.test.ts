import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { themeCss } from "../../src/index.js";

/**
 * A SIZE IN PIXELS IS A SIZE THE READER CANNOT CHANGE.
 *
 * The text-size setting works by one number on the root element, which is
 * why every size the framework draws is written in `rem` or `em`. A single
 * `font-size: 10px` opts one control out of it entirely — and that is
 * exactly what had happened: set to Largest, every name in the city
 * doubled and the district's own "open" stayed ten pixels tall, along with
 * the "+N past" tag, the altitude caption and every `<code>` span.
 *
 * Nothing found it because nothing was looking. A list in a commit message
 * is not a guard; this is, and it covers the packages a person installs
 * rather than only the ones somebody remembered to check.
 */
const here = dirname(fileURLToPath(import.meta.url));
const packages = resolve(here, "../../..");

/** Every source file in the packages a person installs. */
function sources(from: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(from)) {
    if (entry === "dist" || entry === "node_modules" || entry === "tests") continue;
    const path = join(from, entry);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

const files = readdirSync(packages)
  .map((name) => join(packages, name, "src"))
  .filter((path) => {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  })
  .flatMap(sources);

describe("every size is the reader's to change", () => {
  it("finds the framework's own source to read", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("writes no font size in pixels, anywhere a person installs", () => {
    const offenders: string[] = [];
    for (const path of files) {
      const text = readFileSync(path, "utf8");
      for (const [line, index] of text.split("\n").map((l, i) => [l, i] as const)) {
        /*
         * Both spellings: the stylesheet's `font-size: 10px` and a
         * component's `fontSize: 12.5`, which React writes as pixels.
         */
        if (/font-size:\s*[0-9.]+px/.test(line) || /fontSize:\s*[0-9]/.test(line)) {
          offenders.push(`${relative(packages, path)}:${index + 1} ${line.trim().slice(0, 70)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("holds the stylesheet it actually ships to the same rule", () => {
    for (const scheme of ["light", "dark"] as const) {
      const css = themeCss(scheme);
      expect(css.match(/font-size:\s*[0-9.]+px/g), scheme).toBeNull();
      // And it does size its text, rather than leaving it all to inherit.
      expect(css).toMatch(/font-size:\s*[0-9.]+rem/);
    }
  });
});
