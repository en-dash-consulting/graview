#!/usr/bin/env node
/**
 * THE HERO'S FIRST FRAME, DRAWN BEFORE ANY SCRIPT RUNS.
 *
 * The landing page's hero is the example garden, live — and live means a
 * 900 KB bundle has to arrive and mount before there is anything in the
 * frame. On a phone that was a box saying "loading" for the first second
 * or two, which is the moment a visitor decides whether the page answers
 * the question they came with.
 *
 * So the frame starts with a picture of the same city: `sceneThumbnail`
 * over the very chapter the hero mounts, its declaration and its seed, in
 * both lightings. It is geometry, not a photograph — each kind's plot on
 * the declaration's own map in its hue, a block per record — so it cannot
 * show anything the live scene does not, and the mount replaces it.
 *
 *   node scripts/site-poster.mjs            # write the poster into docs/site/index.html
 *   node scripts/site-poster.mjs --check    # fail if it is stale
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = resolve(repoRoot, "docs/site/index.html");
const START = "<!-- site-poster:start — written by scripts/site-poster.mjs. -->";
const END = "<!-- site-poster:end -->";

/** The chapter the hero mounts, read off the hero itself. */
const html = readFileSync(PAGE, "utf8");
const chapter = Number(/class="chapter-live hero-live" data-graview-chapter="(\d+)"/.exec(html)?.[1]);
if (!chapter) throw new Error("docs/site/index.html has no hero-live chapter to draw a poster of");

/* The chapters are TypeScript in apps/seedbed; bundle the two calls this needs for Node. */
const bundled = await build({
  stdin: {
    contents: `
      import { sceneThumbnail } from "@graview/core/scene";
      import { CHAPTERS } from "./domain/chapters.js";
      export function draw(n) {
        const chapter = CHAPTERS[n - 1];
        const counts = {};
        for (const node of Object.values(chapter.seed.nodes ?? {})) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
        const title = "The example garden from altitude: each kind a plot on its map, a block for each record.";
        return {
          light: sceneThumbnail(chapter.app, { width: 800, height: 600, counts, scheme: "light", background: false, title }),
          dark: sceneThumbnail(chapter.app, { width: 800, height: 600, counts, scheme: "dark", background: false, title }),
        };
      }`,
    resolveDir: resolve(repoRoot, "apps/seedbed/src"),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "error",
  external: ["react", "react-dom"],
});
const dir = mkdtempSync(join(tmpdir(), "graview-poster-"));
let drawn;
try {
  const file = join(dir, "poster.mjs");
  writeFileSync(file, bundled.outputFiles[0].text);
  drawn = (await import(pathToFileURL(file).href)).draw(chapter);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const poster =
  `${START}\n        <div class="poster" aria-hidden="true">` +
  `<div class="light">${drawn.light}</div><div class="dark">${drawn.dark}</div></div>\n        ${END}`;
const from = html.indexOf(START);
const to = html.indexOf(END);
if (from === -1 || to === -1) throw new Error("docs/site/index.html has no site-poster markers in its hero");
const next = `${html.slice(0, from)}${poster}${html.slice(to + END.length)}`;

if (process.argv.includes("--check")) {
  if (next !== html) {
    process.stderr.write("docs/site/index.html carries a stale poster of the hero — run `pnpm site:poster`.\n");
    process.exit(1);
  }
  process.stdout.write("the hero's poster is the chapter it mounts\n");
} else {
  if (next !== html) writeFileSync(PAGE, next);
  process.stdout.write(`drew chapter ${chapter} into the hero's poster\n`);
}
