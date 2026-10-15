/**
 * THE ROADMAP, MOUNTED AS GRAVIEW CLOUD MOUNTS A DOCUMENT, in tabs that
 * share one store.
 *
 * The embed over a compiled document (`scripts/fixtures/roadmap`, with a
 * blocks lens beside its own boards), inside a host page that brings its
 * own `<main>` and nothing else. Each tab is sat down as Ada or Ben, says
 * where it is over a BroadcastChannel (presence), and hands every op its
 * own seat makes to the other tabs, which land it through `store.receive`
 * as ops from a served store land: what somebody else's change sounds like.
 */
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";
import { portFor } from "./ports.mjs";

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>A Roadmap</title>
<style>html,body{margin:0}</style></head>
<body><main><div id="app"></div></main><script type="module" src="/entry.js"></script></body></html>`;

/**
 * Builds the Roadmap's host page and serves it on `screen-reader-host`:
 * the stops `verify-screen-reader` reads from the tree and
 * `voiceover-walk` listens to. `?as=ada|ben` sits the tab down as one of
 * two people; `?face=graview` opens the scene; `?presence=off` shows
 * nobody here, while ops still pass between the tabs.
 */
export async function buildRoadmapHost(repoRoot) {
  const ROADMAP = resolve(repoRoot, "scripts/fixtures/roadmap/roadmap.gdd.json");
  const ROADMAP_SEED = resolve(repoRoot, "scripts/fixtures/roadmap/roadmap.seed.json");
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-screen-reader-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import { createBroadcastPresence } from "@graview/ship/browser";
        import roadmap from ${JSON.stringify(ROADMAP)};
        import seed from ${JSON.stringify(ROADMAP_SEED)};
        const PEOPLE = [{ id: "u:ada", name: "Ada Lovelace" }, { id: "u:ben", name: "Ben Okafor" }];
        const asked = new URLSearchParams(location.search);
        const me = PEOPLE.find((one) => one.id === "u:" + (asked.get("as") ?? "ada")) ?? PEOPLE[0];
        // The roadmap's own lenses — two boards of columns among them — and a blocks lens beside them.
        const blocks = { name: "blocks", title: "Up next", on: "feature", options: { blocks: [
          { headline: "Being built" },
          { list: "all('feature') where stage == 'building'", as: "card", limit: 4 },
        ] } };
        const compiled = compileDocumentWithoutCheck({ ...roadmap, lenses: [...roadmap.lenses, blocks] }, { today: () => "2026-10-12" });
        if (!compiled.ok) throw new Error(compiled.findings.map((one) => one.message).join("; "));
        const handle = mount(document.getElementById("app"), {
          app: compiled.app,
          seed,
          face: asked.get("face") ?? "pages",
          routing: "address",
          principal: { kind: "human", id: me.id, name: me.name, roles: ["owner"] },
          people: PEOPLE,
          // ?presence=off: nobody is shown here, as a served store with presence off is (Roadmap f-changes-heard-without-presence).
          ...(asked.get("presence") === "off" ? {} : { presence: createBroadcastPresence("screen-reader") }),
          label: compiled.app.name,
          heading: 1,
          height: "100dvh",
          fonts: false,
          studio: false,
        });
        window.__handle = handle;
        /*
         * ANOTHER TAB SHARING THE STORE: each op this seat makes goes to the
         * others, and theirs land here through store.receive, as a served
         * store's ops from somebody else land.
         */
        const channel = new BroadcastChannel("screen-reader-ops");
        handle.store.subscribe((_diff, ops) => {
          const mine = ops.filter((op) => op.author?.id === me.id);
          if (mine.length > 0) channel.postMessage(JSON.parse(JSON.stringify(mine)));
        });
        channel.onmessage = (event) => handle.store.receive(event.data);
        handle.drawn().then(() => { window.__ready = true; });`,
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
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  writeFileSync(join(out, "index.html"), HOST_PAGE);
  const host = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = join(out, path);
    const script = path.endsWith(".js");
    if (!file.startsWith(out) || (script && !existsSync(file))) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": script ? "text/javascript" : "text/html" });
    response.end(readFileSync(script ? file : join(out, "index.html")));
  });
  await new Promise((ready) => host.listen(portFor("screen-reader-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}
