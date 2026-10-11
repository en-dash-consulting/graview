#!/usr/bin/env node
/**
 * Writes `dist/document.schema.json` — `@graview/core/document.schema.json`
 * — from the shape the compiler reads, after `tsc` has built it. Run by the
 * build (core's and the workspace's), so every tarball carries the schema of
 * its own version.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const core = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(resolve(core, "package.json"), "utf8"));
const { documentJsonSchema } = await import(pathToFileURL(resolve(core, "dist/cli/document-schema.js")).href);
writeFileSync(resolve(core, "dist/document.schema.json"), `${JSON.stringify(documentJsonSchema(version), null, 2)}\n`, "utf8");
