#!/usr/bin/env node
/**
 * WHAT A HOSTED PAGE CARRIES BEFORE THE APP DRAWS (FR-57), as a verdict.
 *
 * Builds Graview Cloud's shell the way Cloud builds it — `openRemote` plus
 * the embed over the vendors document, esbuild ESM split and minified, zod's
 * locales cut to English, the studio stubbed out (lib/hosted-page.mjs) — and
 * writes docs/hosted-page.json: what the page loads up front, package by
 * package, what each door it opens only when asked costs, and two claims:
 * at most 600 KB minified up front, at most 150 KB of it zod's.
 *
 * No browser and no port: it reads esbuild's metafile, so it runs first.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HOSTED_PAGE_BUDGET, measureHostedPage } from "./lib/hosted-page.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kb = (bytes) => Math.round(bytes / 1024);
const inKb = (sums) => Object.fromEntries(Object.entries(sums).map(([name, bytes]) => [name, kb(bytes)]));

const measured = await measureHostedPage(repoRoot);
const { upFront, whenAsked } = measured;
const checks = {
  atMost600KbMinifiedUpFront: { kb: kb(upFront.minified), budgetKb: kb(HOSTED_PAGE_BUDGET.minified), ok: upFront.minified <= HOSTED_PAGE_BUDGET.minified },
  atMost150KbOfZodUpFront: { kb: kb(upFront.zod), budgetKb: kb(HOSTED_PAGE_BUDGET.zod), ok: upFront.zod <= HOSTED_PAGE_BUDGET.zod },
  theStudioIsNotCarried: { ok: !Object.keys(upFront.packages).includes("@graview/studio") && !Object.keys(whenAsked.packages).includes("@graview/studio") },
};
const passed = Object.values(checks).every((check) => check.ok);
const verdict = {
  at: new Date().toISOString(),
  page: "openRemote + mount(…, { studio: false }) over the vendors document, built as Graview Cloud's packages/client/bundles.mjs builds its shell",
  checks,
  upFront: { kb: kb(upFront.minified), chunks: upFront.chunks, packagesKb: inKb(upFront.packages) },
  whenAsked: {
    kb: kb(whenAsked.minified),
    chunks: whenAsked.chunks,
    packagesKb: inKb(whenAsked.packages),
    doors: whenAsked.doors.map((door) => ({ module: door.module, kb: kb(door.minified), packagesKb: inKb(door.packages) })),
  },
  passed,
};
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/hosted-page.json"), `${JSON.stringify(verdict, null, 2)}\n`, "utf8");

for (const [name, check] of Object.entries(checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}${check.kb !== undefined ? ` — ${check.kb} KB (at most ${check.budgetKb} KB)` : ""}\n`);
process.stdout.write(
  `up front ${kb(upFront.minified)} KB: ${Object.entries(upFront.packages)
    .map(([name, bytes]) => `${name} ${kb(bytes)}`)
    .join(", ")}\n`,
);
for (const door of whenAsked.doors) process.stdout.write(`when asked: ${door.module} +${kb(door.minified)} KB\n`);
process.stdout.write(`${passed ? "a hosted page holds to its budget" : "a hosted page is over its budget"}: ${kb(upFront.minified)} KB up front, ${kb(upFront.zod)} KB of it zod\n`);
process.exit(passed ? 0 : 1);
