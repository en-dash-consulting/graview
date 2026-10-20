#!/usr/bin/env node
/**
 * THE PAGE `graview preview` SERVES, BUILT ONCE.
 *
 * `graview preview <document>` has to draw Graview's own faces for a
 * stranger who has a document and a snapshot and no product: from `npx
 * graview`, with no vite, no React in their tree and nothing to bundle. So
 * the page is bundled here, at `pnpm build`, the way Graview Cloud bundles
 * its shell (`lib/hosted-page.mjs`: esbuild, ESM, split, minified, React
 * inside, zod's locales cut to English, the studio stubbed out), from the
 * workspace's sources, into `packages/graview/dist/preview/` — inside the
 * `graview` package's `files`, so it rides with the tool a person runs and
 * never with a product's runtime dependencies. `@graview/ship/cli`'s
 * `preview` serves it; the dispatcher hands it the directory.
 *
 *   node scripts/build-preview-page.mjs
 */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { firstDrawChunks } from "../packages/embed/dist/first-draw.js";
import { doorsOpenAtOnce, englishOnly, noStudio, preloadLinks, workspaceSources } from "./lib/hosted-page.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(repo, "packages/graview/dist/preview");
const esbuild = createRequire(join(repo, "packages/embed/package.json"))("esbuild");

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Graview preview</title>
<!--preloads-->
<style>html,body{margin:0;height:100%}#graview-app{min-height:100dvh}</style>
</head>
<body>
<div id="graview-app"></div>
<script type="module" src="/page.js"></script>
</body>
</html>
`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const built = await esbuild.build({
  entryPoints: { page: join(repo, "packages/graview/preview/page.js") },
  bundle: true,
  format: "esm",
  splitting: true,
  platform: "browser",
  target: "es2022",
  minify: true,
  outdir: out,
  entryNames: "[name]",
  chunkNames: "chunk.[hash]",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [englishOnly, noStudio, workspaceSources(repo)],
  metafile: true,
  write: false,
  logLevel: "warning",
});
for (const file of doorsOpenAtOnce(built.outputFiles, built.metafile)) writeFileSync(file.path, file.text);
// The head names the pages face's chunks and what it opens as it first draws (FR-194), as a host names them from its own build.
const head = preloadLinks(built.metafile, { entry: "page.js", faces: ["pages"], fetches: ["/graview/document"], chunks: firstDrawChunks(built.metafile, "pages") });
writeFileSync(join(out, "index.html"), PAGE.replace("<!--preloads-->", head));

const bytes = readdirSync(out).reduce((sum, file) => sum + statSync(join(out, file)).size, 0);
process.stdout.write(`the preview page: ${readdirSync(out).length} files, ${Math.round(bytes / 1024)} KB, in packages/graview/dist/preview\n`);
