/**
 * A WORKER VIEW AS A PLACE, IN A REAL BROWSER (FR-91): the place transport
 * of `scripts/guest-sandbox.mjs`.
 *
 * The embed is mounted the way a host mounts it, over the offers fixture
 * (scripts/fixtures/offers-app.ts, LifeLogics Offers in miniature), with
 * the package lens registered as a worker view whose manifest attaches it
 * to `package`, reads `offer` and `includes`, and titles it "The packages".
 * Both views are plain scripts, run with no build (FR-96).
 * Lin, of the client, may see the packages and only the offers made to her
 * firm; Erin, staff, sees every offer. The claims: the lens is a place by
 * its title on the Graview face and on the pages face; it lists each
 * package's offers; the offer Lin may not see is not in what it was handed
 * or drew; it was handed no kind it did not ask to read; and the app's
 * toggle to dark restyles it and pushes it the dark theme, with the
 * system's preference still saying light.
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";
import { pressPlace, waitForPlace } from "./places.mjs";

export const PACKAGES_MANIFEST = { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } };
export const NOTES_MANIFEST = { name: "notes", title: "What we heard", attach: "signal", cardinality: "many" };

export async function placeSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT }) {
  /* Plain sources, as a chat writes them (FR-96): the host puts the runtime in front of each. */
  const packagesJs = readFileSync(resolve(repoRoot, "scripts/fixtures/views/packages.js"), "utf8");
  const notesJs = readFileSync(resolve(repoRoot, "scripts/fixtures/views/notes.js"), "utf8");
  const out = mkdtempSync(join(tmpdir(), "graview-guest-place-"));
  await build({
    stdin: {
      contents: `
import { mount } from "@graview/embed";
import { registerWorkerView } from "@graview/guest/host/views";
import { erin, lin, offersApp, offersSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/offers-app.ts"))};
const asked = new URLSearchParams(location.search);
window.__failures = [];
const definition = { manifest: ${JSON.stringify(PACKAGES_MANIFEST)}, worker: { source: window.PACKAGES }, author: "Made by Claude for Nick" };
const notes = { manifest: ${JSON.stringify(NOTES_MANIFEST)}, worker: { source: window.NOTES } };
window.__handle = mount(document.getElementById("app"), {
  app: offersApp,
  seed: offersSeed,
  principal: asked.get("seat") === "erin" ? erin : lin,
  face: asked.get("face") ?? "scene",
  ...(asked.get("path") ? { path: asked.get("path") } : {}),
  scheme: "light",
  label: "Offers",
  heading: false,
  height: "100%",
  fonts: false,
  studio: false,
  views: (schema, registry) => registerWorkerView(registerWorkerView(registry, definition), notes),
});
window.__handle.drawn().then(() => { window.__ready = true; });
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
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offers</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif}#app{position:relative;height:100vh}</style></head>
<body><div id="app"></div><script>window.PACKAGES = ${JSON.stringify(packagesJs).replace(/<\/script/gi, "<\\/script")}; window.NOTES = ${JSON.stringify(notesJs).replace(/<\/script/gi, "<\\/script")};</script><script type="module" src="/entry.js"></script></body></html>`;
  writeFileSync(join(out, "index.html"), page);
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = join(out, path);
    try {
      const body = readFileSync(file);
      response.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  }).listen(HOST_PORT, "127.0.0.1");

  try {
    /* The system says light throughout: the app's own toggle is what must win. */
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    const open = async (query) => {
      await tab.goto(`${HOST}/?${query}`, { waitUntil: "load" });
      await tab.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    };
    const lens = async () => {
      await tab.waitForFunction(() => Boolean(document.querySelector('[data-worker-view="packages"]')?.shadowRoot?.querySelector(".package")), null, { timeout: 20_000 });
      return tab.evaluate(() => {
        const region = document.querySelector('[data-worker-view="packages"]');
        const root = region.shadowRoot;
        return {
          label: region.getAttribute("aria-label"),
          author: document.querySelector('[data-worker-view-author="packages"]')?.textContent ?? null,
          heading: root.querySelector("h2")?.textContent ?? null,
          kinds: root.querySelector(".lens")?.getAttribute("data-kinds"),
          scheme: root.querySelector(".lens")?.getAttribute("data-scheme"),
          packages: [...root.querySelectorAll(".package")].map((one) => ({ id: one.getAttribute("data-key"), title: one.querySelector("h3").textContent, offers: [...one.querySelectorAll(".offers li a")].map((offer) => offer.textContent) })),
          background: getComputedStyle(root.querySelector(".package")).backgroundColor,
          text: root.querySelector("[data-graview-view-root]").textContent,
        };
      });
    };
    /* A token as a color, the way the browser computes one, read off the embed's own root. */
    const token = (name) =>
      tab.evaluate((variable) => {
        const value = getComputedStyle(document.querySelector("[data-graview-scheme]")).getPropertyValue(variable).trim();
        const probe = document.createElement("div");
        probe.style.backgroundColor = value;
        document.body.appendChild(probe);
        const said = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return said;
      }, name);

    // ── the pages face ──
    await open("face=pages&path=/places");
    await tab.waitForTimeout(500);
    const placesListed = await tab.evaluate(() => document.body.textContent.includes("The packages"));
    claim("the pages face lists the worker view among the app's places, by its title", placesListed);
    await open("face=pages&path=/places/the-packages");
    const pages = await lens();
    const start = pages.packages.find((one) => one.id === "package:start");
    claim('on the pages face the worker view is the place "The packages", labeled as its title and with its author said', /The packages$/.test(pages.label) && pages.heading === "The packages" && pages.author === "Made by Claude for Nick", pages);
    claim("it lists each package's offers, from the offers and the includes edges it reads", pages.packages.length === 3 && JSON.stringify(start?.offers) === JSON.stringify(["Team coaching", "AI strategy sprint"]) && pages.packages.find((one) => one.id === "package:later")?.offers.join() === "Copernicus build", pages.packages);
    claim("an offer Lin may not see is not in what the view was handed or drew", !pages.text.includes("Internal margin review"), pages.packages);
    claim("it was handed only the kind it attaches to and the kind it reads", pages.kinds === "offer package", pages.kinds);

    // ── the Graview face ──
    await open("face=scene");
    /* The strip's controls are fetched with the face: wait for the bar to hold the places before pressing one. */
    await waitForPlace(tab, "the-packages").catch(async () => {
      throw new Error(`no places on the bar: ${(await tab.evaluate(() => document.body.innerText)).slice(0, 600)}`);
    });
    /* The tab, as a person presses it; the embed names its landmarks after itself ("Offers · Places"), so the bar by its test id. */
    const how = await pressPlace(tab, "The packages");
    const scene = await lens();
    claim('on the Graview face "The packages" is a place on the bar, and pressing it draws the worker view', /The packages$/.test(scene.label) && scene.packages.length === 3, { how, packages: scene.packages.map((one) => one.title) });
    claim("on the Graview face too, the offer Lin may not see is nowhere", !scene.text.includes("Internal margin review") && JSON.stringify(scene.packages.find((one) => one.id === "package:start")?.offers) === JSON.stringify(["Team coaching", "AI strategy sprint"]), scene.packages);

    // ── Erin sees it, so it is sight and not the data ──
    await open("face=pages&path=/places/the-packages&seat=erin");
    const erin = await lens();
    claim("Erin, who may see every offer, is shown the margin review in the same package", erin.packages.find((one) => one.id === "package:start")?.offers.includes("Internal margin review"), erin.packages);

    // ── the app's toggle ──
    await open("face=pages&path=/places/the-packages");
    const light = await lens();
    const lightPanel = await token("--graview-panel");
    await tab.evaluate(() => window.__handle.setScheme("dark"));
    await tab.waitForFunction(() => document.querySelector('[data-worker-view="packages"]')?.shadowRoot?.querySelector(".lens")?.getAttribute("data-scheme") === "dark", null, { timeout: 10_000 }).catch(() => {});
    const dark = await lens();
    const darkPanel = await token("--graview-panel");
    const system = await tab.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
    claim("in light the packages take the app's light panel", light.scheme === "light" && light.background === lightPanel, { light: light.background, lightPanel });
    claim("toggling the app to dark restyles the view and pushes it the dark theme, though the system says light", !system && dark.scheme === "dark" && dark.background === darkPanel && darkPanel !== lightPanel, { dark: dark.background, darkPanel, system, scheme: dark.scheme });
    // ── links stay in the app (FR-93) ──
    const inRegion = (view, selector) => tab.locator(`[data-worker-view="${view}"]`).locator(selector);
    await open("face=pages&path=/places/the-packages");
    await lens();
    await inRegion("packages", 'a[data-record="offer:coaching"]').first().click();
    await tab.waitForFunction(() => /Team coaching/.test(document.querySelector("h1")?.textContent ?? ""), null, { timeout: 10_000 }).catch(() => {});
    const recordPage = await tab.evaluate(() => ({ heading: document.querySelector("h1")?.textContent ?? null, region: Boolean(document.querySelector('[data-worker-view="packages"]')) }));
    claim("on the pages face, a view's link to a record goes to that record's page", /Team coaching/.test(recordPage.heading ?? "") && !recordPage.region, recordPage);
    await open("face=pages&path=/places/what-we-heard");
    await inRegion("notes", "#to-packages").waitFor({ timeout: 15_000 });
    const out = await inRegion("notes", "#out").evaluate((anchor) => ({ href: anchor.getAttribute("href"), role: anchor.getAttribute("role"), text: anchor.textContent }));
    claim('a view\'s <a href="https://…"> is drawn as text: no href, not a link', out.href === null && out.role === null && out.text === "Somewhere else", out);
    await inRegion("notes", "#to-packages").focus();
    await tab.keyboard.press("Enter");
    await lens().catch(() => null);
    const placePage = await tab.evaluate(() => Boolean(document.querySelector('[data-worker-view="packages"]')?.shadowRoot?.querySelector(".package")));
    claim("on the pages face, a view's link to a place, followed with Enter, goes to that place", placePage);
    await open("face=scene");
    await waitForPlace(tab, "what-we-heard");
    await pressPlace(tab, "What we heard");
    await inRegion("notes", "#to-packages").waitFor({ timeout: 15_000 });
    await inRegion("notes", "#to-packages").click();
    const scenePlace = await lens().then((drawn) => drawn.packages.length === 3).catch(() => false);
    claim("on the Graview face, a view's link to a place goes to that place", scenePlace);
    await inRegion("packages", 'a[data-record="offer:strategy"]').first().click();
    await tab.waitForFunction(() => Boolean(document.querySelector('[data-graview-view="offer:strategy"][data-graview-selected]')), null, { timeout: 10_000 }).catch(() => {});
    const sceneRecord = await tab.evaluate(() => Boolean(document.querySelector('[data-graview-view="offer:strategy"][data-graview-selected]')));
    claim("on the Graview face, a view's link to a record goes to that record, chosen", sceneRecord);
    claim("no view failed", (await tab.evaluate(() => window.__failures)).length === 0);
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);
    await context.close();
  } finally {
    server.close();
    rmSync(out, { recursive: true, force: true });
  }
}
