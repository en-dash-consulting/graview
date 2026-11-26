#!/usr/bin/env node
/**
 * THE ONE HEAD, HEADER AND FOOTER, written into every hand-designed page.
 *
 * The docs pages are rendered whole by `apps/site/design.mjs`, which calls
 * `apps/site/chrome.mjs` itself. The home, the tour, the long version and the
 * page for a missing address are designed by hand, so they carry the same
 * parts between markers, and this writes them there. Run it after changing
 * the chrome; `--check` fails when a page is stale, which is what the test
 * calls.
 *
 *   node scripts/site-chrome.mjs            # write the chrome into apps/site/pages/*.html
 *   node scripts/site-chrome.mjs --check    # fail if a page's chrome is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MARKERS, sharedHead, siteFooter, siteHeader } from "../apps/site/chrome.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Each hand page, and how it reaches the root, which section it is, and the face its first headline is set in. */
export const PAGES = [
  { page: "apps/site/pages/index.html", base: "", here: "", preload: "Merriweather" },
  { page: "apps/site/pages/tour.html", base: "", here: "tour" },
  { page: "apps/site/pages/progression.html", base: "", here: "" },
  { page: "apps/site/pages/404.html", base: "/", here: "" },
];

/** A page with each part written between its markers. */
export function withChrome(html, { base, here, preload }, page = "a page") {
  const parts = { head: sharedHead({ base, preload }), header: siteHeader({ base, here }), footer: siteFooter({ base }) };
  let next = html;
  for (const [name, [start, end]] of Object.entries(MARKERS)) {
    const from = next.indexOf(start);
    const to = next.indexOf(end);
    if (from === -1 || to === -1) throw new Error(`${page} has no site-${name} markers`);
    next = `${next.slice(0, from)}${start}\n${parts[name]}\n${end}${next.slice(to + end.length)}`;
  }
  return next;
}

const main = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (main) {
  const checking = process.argv.includes("--check");
  let stale = 0;
  for (const entry of PAGES) {
    const path = resolve(repoRoot, entry.page);
    const html = readFileSync(path, "utf8");
    const next = withChrome(html, entry, entry.page);
    if (next === html) continue;
    if (checking) {
      process.stderr.write(`${entry.page} carries a stale head, header or footer — run \`pnpm site:chrome\`.\n`);
      stale += 1;
    } else {
      writeFileSync(path, next);
      process.stdout.write(`wrote the head, header and footer into ${entry.page}\n`);
    }
  }
  if (checking) {
    if (stale > 0) process.exit(1);
    process.stdout.write("every page wears the one head, header and footer\n");
  }
}
