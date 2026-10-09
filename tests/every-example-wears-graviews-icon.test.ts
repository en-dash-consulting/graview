import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * EVERY EXAMPLE WEARS GRAVIEW'S ICON IN ITS TAB, and says whose example it is.
 *
 * The examples are Graview's own, so their tab carries the kit's micro mark
 * — the SVG that turns white in a dark scheme, the ICO, the touch icon —
 * from the app's own `public/`, and a title that names the app first and
 * Graview second. `pnpm verify desk` asks each served page for its icons;
 * this holds the same for the examples the desk does not serve.
 */
const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const EXAMPLES = ["todo", "rota", "seedbed", "gauntlet", "discography", "launcher"] as const;
const BRAND = ["favicon.svg", "favicon.ico", "apple-touch-icon.png"] as const;

describe("every example", () => {
  it.each(EXAMPLES)("%s links the micro mark, and every link is a file it serves", (app) => {
    const page = readFileSync(root(`apps/${app}/index.html`), "utf8");
    expect(page).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    expect(page).toContain('<link rel="icon" href="/favicon.ico" sizes="16x16 32x32" />');
    expect(page).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    for (const file of BRAND) {
      expect(existsSync(root(`apps/${app}/public/${file}`)), file).toBe(true);
      // The kit's own files, as the docs site carries them: one source for the mark.
      expect(readFileSync(root(`apps/${app}/public/${file}`)).equals(readFileSync(root(`docs/site/brand/${file}`))), file).toBe(true);
    }
  });

  it.each(EXAMPLES.filter((app) => app !== "launcher"))("%s's title names the app first and Graview second", (app) => {
    const title = /<title>([^<]*)<\/title>/.exec(readFileSync(root(`apps/${app}/index.html`), "utf8"))?.[1] ?? "";
    expect(title).toMatch(/^\S.* — a Graview example$/);
  });

  it("turns the mark white in a dark scheme", () => {
    expect(readFileSync(root("docs/site/brand/favicon.svg"), "utf8")).toMatch(/@media \(prefers-color-scheme:dark\)/);
  });
});
