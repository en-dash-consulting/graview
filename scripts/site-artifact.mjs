#!/usr/bin/env node
/**
 * The page, as an artifact body.
 *
 * `docs/site/index.html` is the source and a complete document: it opens by
 * double-clicking and deploys to any static host. Publishing it as a Claude
 * artifact needs the opposite shape — the host supplies the doctype, the head
 * and the body, and rejects a file that brings its own.
 *
 * So there is one source and this strips the wrapper off it, rather than two
 * files drifting apart.
 *
 *   node scripts/site-artifact.mjs [out-path]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(repoRoot, "docs/site/index.html"), "utf8");

const title = /<title>([\s\S]*?)<\/title>/.exec(source)?.[1] ?? "Graview";
const links = [...source.matchAll(/^<link rel="(?:preconnect|stylesheet)"[^>]*>$/gm)].map((m) => m[0]);
const open = source.indexOf("<body>");
const close = source.lastIndexOf("</body>");
if (open === -1 || close === -1) {
  process.stderr.write("docs/site/index.html has no <body> to strip.\n");
  process.exit(1);
}

/*
 * The chapter pictures live beside the page as files; the artifact host
 * blocks every external image, so they ride along inlined. The page's own
 * copy keeps the file references — one source, two renderings.
 */
const inlined = source.slice(open + "<body>".length, close).trim().replace(
  /src="\.\.\/progression\/([^"]+\.png)"/g,
  (_, file) => `src="data:image/png;base64,${readFileSync(resolve(repoRoot, "docs/progression", file)).toString("base64")}"`,
);
const body = [`<title>${title}</title>`, ...links, "", inlined, ""].join("\n");

const out = process.argv[2] ?? resolve(tmpdir(), "graview-artifact.html");
writeFileSync(out, body, "utf8");
process.stdout.write(`${out}\n`);
