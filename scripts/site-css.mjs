#!/usr/bin/env node
/**
 * The stylesheet, written into every page that needs it.
 *
 * The landing page is published as a Claude artifact, whose host blocks an
 * external stylesheet and rejects a page that brings its own document. So
 * the styles have to be inline — and the moment there was a second page,
 * inline in ONE page stopped being an option.
 *
 * One source, `docs/site/site.css`, written between markers into each page.
 * Run it after editing the stylesheet; `--check` fails when a page is stale,
 * which is what the test calls.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(repoRoot, "docs/site/site.css"), "utf8").trimEnd();
const START = "/* site-css:start — written by scripts/site-css.mjs. Edit docs/site/site.css. */";
const END = "/* site-css:end */";
export const PAGES = ["docs/site/index.html", "docs/site/progression.html", "docs/site/404.html"];

const checking = process.argv.includes("--check");
let stale = 0;

for (const page of PAGES) {
  const path = resolve(repoRoot, page);
  let html;
  try {
    html = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  const from = html.indexOf(START);
  const to = html.indexOf(END);
  if (from === -1 || to === -1) {
    process.stderr.write(`${page} has no site-css markers.\n`);
    process.exit(1);
  }
  const next = `${html.slice(0, from)}${START}\n${css}\n${END}${html.slice(to + END.length)}`;
  if (next === html) continue;
  if (checking) {
    process.stderr.write(`${page} is out of date — run \`pnpm site:css\`.\n`);
    stale += 1;
  } else {
    writeFileSync(path, next);
    process.stdout.write(`wrote the stylesheet into ${page}\n`);
  }
}

if (checking && stale > 0) process.exit(1);
if (checking) process.stdout.write(`every page carries the current stylesheet\n`);
