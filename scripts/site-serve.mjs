#!/usr/bin/env node
/**
 * graview.dev, served from this checkout: `pnpm site:serve`.
 *
 * `open docs/site/index.html` shows the pages, but a browser refuses a font
 * to a file:// page, so the site's Montserrat (docs/site/brand/) only loads
 * when the pages are served — as GitHub Pages serves them. This serves
 * docs/site as it is, nothing built and nothing published, on the port
 * `scripts/lib/ports.mjs` names (moved by GRAVIEW_PORT_BASE like every other).
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { at, portFor } from "./lib/ports.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/site");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml",
};

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? "/", "http://site").pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  const found = existsSync(file);
  if (!found) file = join(root, "404.html");
  response.writeHead(found ? 200 : 404, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(portFor("site-preview"), () => process.stdout.write(`graview.dev from this checkout: ${at("site-preview")}/\n`));
