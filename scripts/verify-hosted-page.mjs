#!/usr/bin/env node
/**
 * WHAT A HOSTED PAGE CARRIES BEFORE THE APP DRAWS (FR-57), as a verdict.
 *
 * Builds Graview Cloud's shell the way Cloud builds it — `openRemote` plus
 * the embed over the vendors document, esbuild ESM split and minified, zod's
 * locales cut to English, the studio stubbed out (lib/hosted-page.mjs) — and
 * writes docs/hosted-page.json: what the page loads up front, package by
 * package, what each door it opens only when asked costs, and its claims:
 * at most 567 KB minified up front, at most 150 KB of it zod's, and at most
 * 523 KB handed a compiled app (`HOSTED_PAGE_BUDGET`,
 * `HOSTED_PAGE_COMPILED_BUDGET`) — and docs/hosted-page.md, the same by
 * package as the release notes carry it.
 *
 * No browser and no port: it reads esbuild's metafile, so it runs first.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPILER_MODULES, HOSTED_PAGE_BUDGET, HOSTED_PAGE_COMPILED_BUDGET, HOSTED_PAGE_COMPILED_ENTRY, measureHostedPage } from "./lib/hosted-page.mjs";
import { hostedPageMarkdown } from "./lib/hosted-page-notes.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kb = (bytes) => Math.round(bytes / 1024);
const inKb = (sums) => Object.fromEntries(Object.entries(sums).map(([name, bytes]) => [name, kb(bytes)]));

const measured = await measureHostedPage(repoRoot);
const { upFront, whenAsked } = measured;
/*
 * WHAT THE FIRST CHUNK NEEDS FOR ITSELF: the page built with every door
 * left shut. The difference is code only a door uses that the bundler put
 * up front anyway — it gives a whole file to every chunk that can reach it,
 * and the page reaches every file of `@graview/core` through its index.
 */
const own = await measureHostedPage(repoRoot, undefined, { eagerOnly: true });
// The same shell handed the compiled app its server made (FR-123): no compiler up front.
const handed = await measureHostedPage(repoRoot, HOSTED_PAGE_COMPILED_ENTRY);
const compilerUpFront = COMPILER_MODULES.filter((module) => Object.keys(handed.upFront.modules).includes(module));
const checks = {
  atMostTheBudgetMinifiedUpFront: { kb: kb(upFront.minified), budgetKb: kb(HOSTED_PAGE_BUDGET.minified), ok: upFront.minified <= HOSTED_PAGE_BUDGET.minified },
  atMost150KbOfZodUpFront: { kb: kb(upFront.zod), budgetKb: kb(HOSTED_PAGE_BUDGET.zod), ok: upFront.zod <= HOSTED_PAGE_BUDGET.zod },
  theStudioIsNotCarried: { ok: !Object.keys(upFront.packages).includes("@graview/studio") && !Object.keys(whenAsked.packages).includes("@graview/studio") },
  handedACompiledAppAtMostItsBudgetUpFront: { kb: kb(handed.upFront.minified), budgetKb: kb(HOSTED_PAGE_COMPILED_BUDGET.minified), ok: handed.upFront.minified <= HOSTED_PAGE_COMPILED_BUDGET.minified },
  handedACompiledAppCarriesNoCompilerUpFront: { carried: compilerUpFront, ok: compilerUpFront.length === 0 && handed.whenAsked.doors.some((door) => door.module === "core/src/document/compile.ts") },
};
const passed = Object.values(checks).every((check) => check.ok);
const verdict = {
  at: new Date().toISOString(),
  page: "openRemote + mount(…, { studio: false }) over the vendors document, built as Graview Cloud's packages/client/bundles.mjs builds its shell",
  checks,
  upFront: { kb: kb(upFront.minified), chunks: upFront.chunks, packagesKb: inKb(upFront.packages), ownNeedKb: kb(own.upFront.minified) },
  whenAsked: {
    kb: kb(whenAsked.minified),
    chunks: whenAsked.chunks,
    packagesKb: inKb(whenAsked.packages),
    doors: whenAsked.doors.map((door) => ({ module: door.module, kb: kb(door.minified), packagesKb: inKb(door.packages) })),
  },
  handedACompiledApp: { kb: kb(handed.upFront.minified), savedKb: kb(upFront.minified - handed.upFront.minified), packagesKb: inKb(handed.upFront.packages) },
  // What each face fetches as it is first drawn, on top of what is up front: not one of the claims, said so a face moved out of the first chunk is not called smaller.
  beforeEachFaceDraws: {
    ...Object.fromEntries(Object.entries(measured.beforeDrawn).map(([face, one]) => [face, { kb: kb(one.minified), fetchedKb: kb(one.fetched) }])),
  },
  passed,
};
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/hosted-page.json"), `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
writeFileSync(resolve(repoRoot, "docs/hosted-page.md"), hostedPageMarkdown(measured, { heading: "#", handed }), "utf8");

for (const [name, check] of Object.entries(checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}${check.kb !== undefined ? ` — ${check.kb} KB (at most ${check.budgetKb} KB)` : ""}\n`);
process.stdout.write(
  `up front ${kb(upFront.minified)} KB: ${Object.entries(upFront.packages)
    .map(([name, bytes]) => `${name} ${kb(bytes)}`)
    .join(", ")}\n`,
);
process.stdout.write(`the first chunk's own need: ${kb(own.upFront.minified)} KB; the other ${kb(upFront.minified - own.upFront.minified)} KB up front is code only a door uses, reached through an index\n`);
process.stdout.write(`handed the compiled app (FR-123): ${kb(handed.upFront.minified)} KB up front, ${kb(upFront.minified - handed.upFront.minified)} KB less\n`);
for (const door of whenAsked.doors) process.stdout.write(`when asked: ${door.module} +${kb(door.minified)} KB\n`);
for (const [face, one] of Object.entries(measured.beforeDrawn)) process.stdout.write(`before the ${face} face draws: ${kb(one.minified)} KB (${kb(one.fetched)} KB of it fetched as it is drawn)\n`);
process.stdout.write(`${passed ? "a hosted page holds to its budget" : "a hosted page is over its budget"}: ${kb(upFront.minified)} KB up front, ${kb(upFront.zod)} KB of it zod\n`);
process.exit(passed ? 0 : 1);
