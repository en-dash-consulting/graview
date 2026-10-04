import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { HOSTED_PAGE_BUDGET, measureHostedPage, packageOf } from "../scripts/lib/hosted-page.mjs";

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
beforeAll(async () => {
  measured = (await measureHostedPage(repo)) as Measured;
}, 60_000);

describe("a hosted page", () => {
  it("is measured as Cloud's shell is built: React, zod and the framework that draws the app are in what it loads up front", () => {
    for (const name of ["react-dom", "zod", "@graview/core", "@graview/embed", "@graview/ship"]) expect(Object.keys(measured.upFront.packages)).toContain(name);
  });

  it("carries at most 600 KB minified up front", () => {
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
    for (const face of Object.values(measured.beforeDrawn)) expect(face.minified).toBeLessThan(800 * 1024);
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

  it("holds its budget's numbers as Cloud's brief set them: 600 KB up front, 150 KB of it zod's", () => {
    expect(HOSTED_PAGE_BUDGET).toEqual({ minified: 600 * 1024, zod: 150 * 1024 });
  });
});
