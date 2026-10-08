import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sceneCss, themeCss } from "../../src/scene-css.js";
import { themeBaseCss } from "../../src/theme.js";
import { viewsCss } from "../../src/views-css.js";

/*
 * FR-104. The theme sheet was one stylesheet, drawn by the frame of every
 * face, and a third of it named only what the scene draws: the districts
 * from altitude, the plots, the village, the roads, the billboards, the
 * bands. A page that opened on the pages face carried them up front. They
 * are `sceneCss` now, drawn by the scene face after the frame's
 * `themeBaseCss`; `themeCss` is the two together. This holds that nothing
 * was lost or doubled in the split, that the order the scene face draws
 * them in is `themeCss`'s, and that the scene's rules name nothing another
 * face draws. And the views' own blocks (FR-131) are `viewsCss`, drawn by
 * each face that draws a view, between the frame's sheet and the scene's.
 */
const rulesOf = (css: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) {
      out.push(css.slice(start, i + 1).replace(/\s+/g, " ").trim());
      start = i + 1;
    }
  }
  return out;
};

/* The modules only the scene face draws with; a name the scene's rules use must appear in one of these and in no other source. */
const SCENE_FILES = ["scene-root.tsx", "view-host.tsx", "plots.tsx", "scene-hand.ts", "scene-lines.tsx", "connectors.tsx", "scene.tsx", "resolved-view.tsx", "where-drawn.tsx"].map((file) => `react/src/${file}`);
const packages = resolve(import.meta.dirname, "../../..");
const sources: [string, string][] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.tsx?$/.test(name) && !path.endsWith("primitives/src/theme.ts") && !path.endsWith("primitives/src/scene-css.ts")) sources.push([path.slice(packages.length + 1), readFileSync(path, "utf8")]);
  }
};
for (const pkg of readdirSync(packages)) {
  try {
    walk(join(packages, pkg, "src"));
  } catch {
    /* a package with no sources */
  }
}
const onlyTheScenes = (name: string) => {
  const said = new RegExp(`${name}(?![a-z0-9-])`);
  const where = sources.filter(([, text]) => said.test(text)).map(([path]) => path);
  return where.length > 0 && where.every((path) => SCENE_FILES.includes(path));
};

describe("the scene's rules are the scene face's", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const scope of [undefined, ".graview-embed-7"]) {
      it(`themeCss is the frame's sheet, the views' and then the scene's, every rule once — ${scheme}${scope ? ", scoped" : ""}`, () => {
        const options = scope ? { scope } : {};
        const whole = rulesOf(themeCss(scheme, undefined, options));
        const base = rulesOf(themeBaseCss(scheme, undefined, options));
        const views = rulesOf(viewsCss(options));
        const scene = rulesOf(sceneCss(scheme, options));
        expect(whole).toEqual([...base, ...views, ...scene]);
        expect(views.filter((rule) => base.includes(rule))).toEqual([]);
        expect(scene.filter((rule) => base.includes(rule))).toEqual([]);
        // A third of the sheet, or near it: the cut is worth its seam.
        expect(scene.length).toBeGreaterThan(60);
      });
    }
  }

  it("names in every selector something only the scene draws", () => {
    const strays: string[] = [];
    for (const rule of rulesOf(sceneCss("light"))) {
      const prelude = rule.slice(0, rule.indexOf("{"));
      for (const selector of prelude.split(",")) {
        const names = selector.match(/(?:data-)?graview-[a-z0-9-]+/g) ?? [];
        if (!names.some(onlyTheScenes)) strays.push(selector.trim());
      }
    }
    expect(strays).toEqual([]);
  });

  it("keeps to the embed's box when it is scoped, as the frame's sheet does", () => {
    for (const rule of rulesOf(sceneCss("dark", { scope: ".graview-embed-7" }))) {
      const prelude = rule.slice(0, rule.indexOf("{"));
      if (prelude.startsWith("@")) continue;
      for (const selector of prelude.split(",")) expect(selector.trim().startsWith(":where(.graview-embed-7)"), selector).toBe(true);
    }
  });
});
