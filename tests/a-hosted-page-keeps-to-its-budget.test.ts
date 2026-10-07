import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { COMPILER_MODULES, HOSTED_PAGE_BUDGET, HOSTED_PAGE_COMPILED_BUDGET, HOSTED_PAGE_COMPILED_ENTRY, measureHostedPage, packageOf } from "../scripts/lib/hosted-page.mjs";
// @ts-expect-error — a plain .mjs module, without types.
import { hostedPageMarkdown } from "../scripts/lib/hosted-page-notes.mjs";

/**
 * A HOSTED PAGE KEEPS TO ITS BUDGET (FR-57). Graview Cloud's shell —
 * `openRemote` plus the embed over a document-compiled app — carried
 * 1.11 MB of framework before the app drew. Built the way Cloud builds it,
 * over the vendors document, it is measured from esbuild's metafile
 * (`pnpm hosted` writes the same as docs/hosted-page.json).
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
type Measured = {
  upFront: { minified: number; zod: number; packages: Record<string, number>; modules: Record<string, number> };
  whenAsked: { minified: number; packages: Record<string, number>; doors: { module: string; minified: number }[] };
  beforeDrawn: Record<"scene" | "pages", { minified: number; fetched: number; packages: Record<string, number> }>;
  over: boolean;
};

let measured: Measured;
let handed: Measured;
beforeAll(async () => {
  [measured, handed] = (await Promise.all([measureHostedPage(repo), measureHostedPage(repo, HOSTED_PAGE_COMPILED_ENTRY)])) as [Measured, Measured];
}, 120_000);

describe("a hosted page", () => {
  it("is measured as Cloud's shell is built: React, zod and the framework that draws the app are in what it loads up front", () => {
    for (const name of ["react-dom", "zod", "@graview/core", "@graview/embed", "@graview/ship"]) expect(Object.keys(measured.upFront.packages)).toContain(name);
  });

  it("carries at most 567 KB minified up front: 565 KB with the whole brand in the document, until the one app bar brings it back to 563, so Cloud's shell keeps room for its own under its 595", () => {
    expect(measured.upFront.minified, `${Math.round(measured.upFront.minified / 1024)} KB`).toBeLessThanOrEqual(HOSTED_PAGE_BUDGET.minified);
    expect(measured.over).toBe(false);
  });

  it("carries at most 150 KB of zod up front", () => {
    expect(measured.upFront.zod, `${Math.round(measured.upFront.zod / 1024)} KB`).toBeLessThanOrEqual(HOSTED_PAGE_BUDGET.zod);
  });

  it("draws either face without loading the other: the scene carries no routed face, the pages no scene", () => {
    const scene = Object.keys(measured.beforeDrawn.scene.packages);
    const pages = Object.keys(measured.beforeDrawn.pages.packages);
    expect(scene).not.toContain("@graview/pages");
    expect(scene).not.toContain("react-router");
    // The scene itself is @graview/react's; the pages draw with its provider alone.
    expect(measured.beforeDrawn.pages.packages["@graview/react"] ?? 0).toBeLessThan(measured.beforeDrawn.scene.packages["@graview/react"]! / 2);
    expect(pages).toContain("@graview/pages");
  });

  it("is smaller before either face draws than it was up front before the faces were fetched as drawn", () => {
    // 1,075 KB up front, measured this way before FR-57: the face fetched as it is drawn does not hide the bytes, it leaves them out.
    // Raised from 800 KB when the home and a view came to be written from blocks (FR-81, FR-82): the scene before it draws measured
    // 817_424 bytes before them and 836_810 with them (the pages 785_745 and 804_522) — the blocks' renderer, their vocabulary and the landing.
    // 860 KB since FR-110–FR-116 together: the scene face measured 870_479 B before it draws (it was 860_295 at 850).
    for (const face of Object.values(measured.beforeDrawn)) expect(face.minified).toBeLessThan(860 * 1024);
  });

  it("carries no studio, up front or when asked: the shell stubs it out", () => {
    expect(Object.keys(measured.upFront.packages)).not.toContain("@graview/studio");
    expect(Object.keys(measured.whenAsked.packages)).not.toContain("@graview/studio");
  });

  it("loads no classic zod: the framework builds a document's schemas in zod/mini", () => {
    const modules = Object.keys(measured.upFront.modules);
    expect(modules.filter((module) => module.startsWith("zod/v4/classic/"))).toEqual([]);
  });

  it("carries no checker: the page compiles with compileDocumentWithoutCheck, and graview check stays in Node", () => {
    expect(Object.keys(measured.upFront.modules).filter((module) => module.startsWith("core/src/cli/"))).toEqual([]);
  });

  it("names the package each input of the metafile belongs to", () => {
    expect(packageOf("packages/core/src/store.ts")).toBe("@graview/core");
    expect(packageOf("../../node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/schemas.js")).toBe("zod");
    expect(packageOf("zod-locales:/x/zod/v4/locales/index.js")).toBe("zod");
    expect(packageOf("../../node_modules/.pnpm/react-dom@19.2.0/node_modules/react-dom/cjs/react-dom-client.production.js")).toBe("react-dom");
    expect(packageOf("<stdin>")).toBe("(the page)");
  });

  it("holds its budget's numbers: 567 KB up front, under the 595 Cloud's shell holds itself to, and 150 KB of it zod's", () => {
    expect(HOSTED_PAGE_BUDGET).toEqual({ minified: 567 * 1024, zod: 150 * 1024 });
  });

  /*
   * WHAT ONLY A FETCHED FACE USES IS NOT REACHABLE FROM WHAT THE PAGE
   * IMPORTS UP FRONT. esbuild places a whole module in every chunk that can
   * reach it, so a name exported from a barrel the page imports (`@graview/core`,
   * `@graview/core/document`) rides in the first chunk as soon as anything
   * lazy uses it. These left for subpaths of their own; none may come back.
   */
  it("carries no block resolver, city, figure or checker up front: they are @graview/core/blocks, /scene, /figures and /check, reached only by what is fetched", () => {
    const modules = Object.keys(measured.upFront.modules);
    for (const module of ["core/src/document/blocks.ts", "core/src/document/computed-values.ts", "core/src/city.ts", "core/src/scene-districts.ts", "core/src/document/thumbnail.ts", "core/src/schema/figures.ts"]) {
      expect(modules).not.toContain(module);
    }
    expect(modules.filter((module) => module.startsWith("core/src/cli/"))).toEqual([]);
  });

  it("carries nothing up front that only a drawn view uses: those are @graview/react/drawing, /tools/edit and /core/arrange, reached only by what is fetched", () => {
    const modules = Object.keys(measured.upFront.modules);
    for (const module of [
      "react/src/drawn.ts",
      "react/src/kit.ts",
      "react/src/view-boundary.tsx",
      "react/src/emphasis.ts",
      "react/src/editable-fields.ts",
      "react/src/placement.ts",
      "react/src/attention.ts",
      "react/src/picking.ts",
      "tools/src/edit.ts",
      "tools/src/pins.ts",
      "layout/src/label-fit.ts",
      "core/src/arranging.ts",
    ]) {
      expect(modules).not.toContain(module);
    }
    expect(Object.keys(measured.upFront.packages)).not.toContain("@graview/render");
  });

  it("fetches the describer when a place is first asked about, not with the assistant's seat", () => {
    expect(Object.keys(measured.upFront.modules)).not.toContain("core/src/document/describe-place.ts");
    expect(measured.whenAsked.doors.map((door) => door.module)).toContain("core/src/describe.ts");
  });

  it("carries none of the scene's own rules up front: the scene face draws them, and fetches them as it is drawn (FR-104)", () => {
    expect(Object.keys(measured.upFront.modules)).not.toContain("primitives/src/scene-css.ts");
    expect(measured.beforeDrawn.scene.packages["@graview/primitives"]).toBeGreaterThan(measured.upFront.packages["@graview/primitives"]!);
  });

  it("carries the frame's measures without the primitives' index, and its descent without the scene's way back (FR-104)", () => {
    const modules = Object.keys(measured.upFront.modules);
    expect(modules).toContain("primitives/src/primitives/measure.ts");
    expect(modules).not.toContain("primitives/src/primitives/index.tsx");
    expect(modules).not.toContain("primitives/src/workbench/back-out.tsx");
  });

  it("says its weight by package as the release notes carry it: a table that sums to the page, and the headroom (FR-104)", () => {
    const notes = hostedPageMarkdown(measured) as string;
    const rows = [...notes.matchAll(/^\| (?!Package|---|\*\*Total)([^|]+) \| ([\d.]+) \|$/gm)];
    expect(rows.map((row) => row[1])).toEqual(Object.keys(measured.upFront.packages));
    expect(notes).toContain(`**Total** | **${(measured.upFront.minified / 1024).toFixed(1)}**`);
    expect(notes).toContain(`**${((HOSTED_PAGE_BUDGET.minified - measured.upFront.minified) / 1024).toFixed(1)} KB of headroom**`);
  });
});

/**
 * HANDED A COMPILED APP, THE PAGE CARRIES NO COMPILER (FR-123). Graview
 * Cloud compiles a document on its server at every change; its shell then
 * compiled it again in the page. Handed `serializeCompiled(compileDocument(doc))`
 * beside the document, the shell builds the app with `appFromOrCompile` from
 * `@graview/core/compiled`, and fetches the compiler only for a compiled app
 * it cannot read (one cached from another build).
 */
describe("a hosted page handed a compiled app", () => {
  it(`carries at most ${HOSTED_PAGE_COMPILED_BUDGET.minified / 1024} KB minified up front`, () => {
    expect(handed.upFront.minified, `${(handed.upFront.minified / 1024).toFixed(1)} KB`).toBeLessThanOrEqual(HOSTED_PAGE_COMPILED_BUDGET.minified);
  });

  it("carries no compiler up front: no reader, validator, expression or template parser, view checker or document schema", () => {
    const modules = Object.keys(handed.upFront.modules);
    expect(COMPILER_MODULES.filter((module: string) => modules.includes(module))).toEqual([]);
    // What it does carry, to run the app: the builder, the evaluator and the renderer.
    for (const module of ["core/src/document/compiled.ts", "core/src/document/expr/evaluate.ts", "core/src/document/template.ts"]) expect(modules).toContain(module);
  });

  it("fetches the compiler only when it must compile after all", () => {
    expect(handed.whenAsked.doors.map((door) => door.module)).toContain("core/src/document/compile.ts");
  });

  it("is at least 40 KB lighter up front than the page that compiles the document itself", () => {
    expect(measured.upFront.minified - handed.upFront.minified, `${((measured.upFront.minified - handed.upFront.minified) / 1024).toFixed(1)} KB`).toBeGreaterThanOrEqual(40 * 1024);
  });
});
