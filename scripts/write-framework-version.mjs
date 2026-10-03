#!/usr/bin/env node
/*
 * FRAMEWORK_VERSION, from the one fixed version every package shares.
 *
 * A host records which framework folded a store (for upgrade waves and
 * diagnosis), so core says its own version as a constant. It is written
 * here rather than read from package.json at run time, because core's
 * runtime entry reaches no `node:` builtin and a bundler need not resolve
 * JSON. `pnpm version-packages` runs this after `changeset version`, and
 * `the-framework-says-its-version.test.ts` fails if the two ever differ.
 */
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../packages/core/", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const file = new URL("src/version.ts", root);
const text = `/** The version of @graview/* that this build is — every package shares it. Written by scripts/write-framework-version.mjs. */\nexport const FRAMEWORK_VERSION = ${JSON.stringify(version)};\n`;
let before = "";
try { before = readFileSync(file, "utf8"); } catch {}
if (before !== text) writeFileSync(file, text);
console.log(`FRAMEWORK_VERSION ${version}`);
