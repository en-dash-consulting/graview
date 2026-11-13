/**
 * THE RICH APP ON THE ONE FACE, SERVED (Graview HQ feature:f-one-face-city-reads-clean).
 *
 * Deep Time at its size (`scripts/fixtures/one-face-rich/deep-time.mjs`:
 * eleven kinds, 294 records, ten worker views) drawn by the routed pages
 * over the Scene's own city (`sceneUnderPages`), bundled from the
 * workspace's sources with esbuild and served from a port of its own —
 * `one-face-rich`, moved with `GRAVIEW_PORT_BASE` — at `/pages/…`.
 * `?theme=dark` draws it dark, as Nick saw it.
 */
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";
import { portFor } from "./ports.mjs";
import { vacant } from "./serve.mjs";

export const RICH_BASE = "/pages";

export async function serveRich(repoRoot) {
  const require = createRequire(resolve(repoRoot, "packages/embed/package.json"));
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-one-face-rich-"));
  const fixture = resolve(repoRoot, "scripts/fixtures/one-face-rich/deep-time.mjs");
  await esbuild.build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { createRoot } from "react-dom/client";
        import { PagesApp } from "@graview/pages";
        import { registerDefaultViews, themeCss } from "@graview/primitives";
        import { createViews } from "@graview/react";
        import { registerWorkerView } from "@graview/guest/host/views";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import { Store } from "@graview/core";
        import { document as deepTime, seed, workerViews } from ${JSON.stringify(fixture)};
        const asked = new URLSearchParams(location.search);
        const scheme = asked.get("theme") === "dark" ? "dark" : "light";
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(themeCss(scheme));
        document.adoptedStyleSheets = [sheet];
        document.documentElement.dataset.graviewScheme = scheme;
        const compiled = compileDocumentWithoutCheck(deepTime, { today: () => "2026-09-01" });
        if (!compiled.ok) throw new Error("Deep Time did not compile");
        const app = compiled.app;
        const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: seed });
        let views = registerDefaultViews(app.schema, createViews(app.schema));
        for (const one of workerViews) views = registerWorkerView(views, one);
        createRoot(document.getElementById("root")).render(createElement(PagesApp, {
          basename: ${JSON.stringify(RICH_BASE)},
          context: { store, views, sceneUnderPages: true, principal: { kind: "human", id: "p1", roles: ["owner"] }, settings: [] },
        }));
        window.__graviewReady = { scheme };
      `,
      resolveDir: resolve(repoRoot, "packages/embed"),
      loader: "js",
    },
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    outdir: out,
    entryNames: "entry",
    define: { "process.env.NODE_ENV": '"development"' },
    jsx: "automatic",
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Deep Time</title><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>`;
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
    const file = join(out, path.replace(/^\/+/, ""));
    if (path.endsWith(".js") && file.startsWith(out) && existsSync(file)) {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(readFileSync(file));
      return;
    }
    if (path === RICH_BASE || path.startsWith(`${RICH_BASE}/`)) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(page);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const port = portFor("one-face-rich");
  await vacant(port);
  await new Promise((ready) => server.listen(port, ready));
  return { url: `http://localhost:${port}${RICH_BASE}`, stop: () => (server.close(), rmSync(out, { recursive: true, force: true })) };
}
