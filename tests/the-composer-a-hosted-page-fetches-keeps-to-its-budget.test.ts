import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { COMPOSER_BUDGET, COMPOSER_CHECKS, COMPOSER_LACKS, measureComposerDoor } from "../scripts/lib/hosted-page.mjs";
// @ts-expect-error — a plain .mjs module, without types.
import { holdBytes } from "../scripts/lib/budget-mode.mjs";

/**
 * THE COMPOSER A HOSTED PAGE FETCHES KEEPS TO ITS BUDGET (Roadmap
 * f-light-composer). Cloud's shell, handed a compiled app, fetches
 * `@graview/core/composer` for an owner or an editor: built the way Cloud
 * builds it, what it costs behind its door, and what it adds to the first
 * load of every visitor, who never fetches it.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
type Door = { door: { minified: number; gzipped: number; chunks: number; modules: string[] }; upFront: { minified: number; gzipped: number; zod: number } };
let composer: Door;
beforeAll(async () => {
  composer = (await measureComposerDoor(repo)) as Door;
}, 180_000);

describe("the composer a hosted page fetches", () => {
  it("carries neither the whole checker, nor a reshape's traits, nor the checked composer: of the framework's checks, the routes and the lenses alone", () => {
    expect(COMPOSER_LACKS.filter((module: string) => composer.door.modules.includes(module))).toEqual([]);
    expect(composer.door.modules.filter((module) => module.includes("core/src/cli/check/") && !COMPOSER_CHECKS.includes(module))).toEqual([]);
  });

  it("carries no zod and no second copy of core: the page's own store, schema and compile are what it uses", () => {
    expect(composer.door.modules.filter((module) => module.startsWith("zod/"))).toEqual([]);
    for (const shared of ["core/src/store.ts", "core/src/schema/schema.ts", "core/src/graph/graph.ts"]) expect(composer.door.modules).not.toContain(shared);
  });

  it("costs at most 330 KB minified and 113 KB gzipped behind its door", () => {
    expect(holdBytes({ name: "the composer a hosted page fetches", minified: composer.door.minified, gzipped: composer.door.gzipped, budget: COMPOSER_BUDGET.door })).toEqual([]);
  });

  it("adds at most 10 KB to what every visitor loads first, at most 2 KB of it zod", () => {
    expect(composer.upFront.minified, `${composer.upFront.minified} bytes up front`).toBeLessThanOrEqual(COMPOSER_BUDGET.upFront.minified);
    expect(composer.upFront.gzipped).toBeLessThanOrEqual(COMPOSER_BUDGET.upFront.gzipped);
    expect(composer.upFront.zod, `${composer.upFront.zod} bytes of zod up front`).toBeLessThanOrEqual(COMPOSER_BUDGET.upFront.zod);
  });
});
