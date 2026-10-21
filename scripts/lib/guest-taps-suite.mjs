/**
 * A PRESS AND A PHONE'S TAP ON A WORKER VIEW, IN A REAL BROWSER (0.1.45):
 * the taps transport of `scripts/guest-sandbox.mjs`.
 *
 * Graview Cloud's Threat Watch in miniature (scripts/fixtures/threat-app.ts):
 * the home is a worker view drawing each threat as a card,
 * `<div class="card" data-record="threat:…">` with a heading, badges and a
 * line inside and no `<a>` anywhere, and a "More" toggle on each card the
 * view binds itself with `graview.on("click")`. The embed is mounted the way
 * a host mounts it, on the pages face, at the home.
 *
 * The claims: the card is a link the host made, drawn as something to
 * press; a click on its heading opens the threat's page, and so does Enter
 * on the card; and on a phone (Chromium's and WebKit's mobile emulation,
 * a coarse pointer and touch; Firefox has none, so its run is the desk's
 * alone) a tap on the card's heading opens it, a tap on a badge inside it
 * opens it, and a tap on the view's own toggle inside the card toggles it
 * and opens nothing.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

const PHISHING = "threat:phishing";

export async function tapsSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, engine }) {
  const out = mkdtempSync(join(tmpdir(), "graview-guest-taps-"));
  await build({
    stdin: {
      contents: `
import { mount } from "@graview/embed";
import { registerWorkerView } from "@graview/guest/host/views";
import { sam, threatApp, threatSeed, WATCH_JS, WATCH_MANIFEST } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/threat-app.ts"))};
window.__failures = [];
window.__problems = [];
window.__handle = mount(document.getElementById("app"), {
  app: threatApp,
  seed: threatSeed,
  principal: sam,
  face: "pages",
  path: "/",
  scheme: "light",
  label: "Threat Watch",
  heading: false,
  height: "100%",
  fonts: false,
  studio: false,
  views: (schema, registry) => registerWorkerView(registry, { manifest: WATCH_MANIFEST, worker: { source: WATCH_JS }, onFailure: (reason, detail) => window.__failures.push([reason, detail]), onProblem: (said) => window.__problems.push(said) }),
});
window.__handle.drawn().then(() => { window.__ready = true; });
window.__view = () => document.querySelector("[data-worker-view]")?.shadowRoot ?? null;
window.__card = (id) => window.__view()?.querySelector('[data-record="' + id + '"]') ?? null;
window.__path = () => window.__handle.where().path;
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
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Threat Watch</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif}#app{position:relative;height:100vh}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;
  writeFileSync(join(out, "index.html"), page);
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    try {
      const body = readFileSync(join(out, path));
      response.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  }).listen(HOST_PORT, "127.0.0.1");

  const open = async (on) => {
    await on.goto(`${HOST}/`, { waitUntil: "load" });
    await on.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    await on.waitForFunction((id) => window.__card?.(id)?.querySelector("h3") != null, PHISHING, { timeout: 15_000 });
    await on.waitForTimeout(300);
  };
  /* Where the reader is once a press has had its chance to move them: the home's path, unless it did. */
  const settled = async (on) => {
    await on.waitForFunction(() => window.__path() !== "/", null, { timeout: 3_000 }).catch(() => {});
    return on.evaluate(() => window.__path());
  };
  /* The threat's own page: its path names it. */
  const opened = (path) => typeof path === "string" && path !== "/" && path.includes("phishing");
  const inView = (selector) => `[data-worker-view] >> ${selector}`;

  try {
    /* ON A DESK. */
    const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    const tab = await desk.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await open(tab);
    const drawn = await tab.evaluate((id) => {
      const card = window.__card(id);
      const style = getComputedStyle(card);
      return { link: card.hasAttribute("data-graview-link"), role: card.getAttribute("role"), tabindex: card.getAttribute("tabindex"), cursor: style.cursor, touchAction: style.touchAction };
    }, PHISHING);
    claim("a card the view bound to a record with data-record is a link the host made: a link to assistive technology, reached by the keyboard, drawn with a pointer and no double-tap zoom", drawn.link && drawn.role === "link" && drawn.tabindex === "0" && drawn.cursor === "pointer" && drawn.touchAction === "manipulation", drawn);
    await tab.locator(inView(`[data-record="${PHISHING}"] h3`)).click();
    const clicked = await settled(tab);
    claim("on a desk, a click on a threat card's heading opens the threat's page", opened(clicked), clicked);
    await open(tab);
    await tab.locator(inView(`[data-record="${PHISHING}"]`)).focus();
    await tab.keyboard.press("Enter");
    const entered = await settled(tab);
    claim("on a desk, Enter on a threat card opens the threat's page", opened(entered), entered);
    claim("the home view did not fail, and the host said nothing was wrong with it", (await tab.evaluate(() => [...window.__failures, ...window.__problems])).length === 0, await tab.evaluate(() => ({ failures: window.__failures, problems: window.__problems })));
    await desk.close();

    /* ON A PHONE: a coarse pointer and touch, where a tap is the press. Firefox has no mobile emulation. */
    if (engine !== "firefox") {
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: "light" });
      const hand = await phone.newPage();
      hand.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
      await open(hand);
      const coarse = await hand.evaluate(() => matchMedia("(pointer: coarse)").matches);
      await hand.locator(inView(`[data-record="${PHISHING}"] h3`)).tap();
      const tapped = await settled(hand);
      claim("on a phone, a tap on a threat card's heading opens the threat's page", coarse && opened(tapped), { coarse, path: tapped });
      await open(hand);
      await hand.locator(inView(`[data-record="${PHISHING}"] [data-badge]`)).tap();
      const badge = await settled(hand);
      claim("on a phone, a tap on a badge inside the card opens the threat's page too: the press is the card's, from whatever inside it the finger lands on", opened(badge), badge);
      await open(hand);
      await hand.locator(inView(`[data-more="${PHISHING}"]`)).tap();
      await hand.waitForFunction((id) => window.__card(id)?.querySelector("[data-summary]") != null, PHISHING, { timeout: 5_000 }).catch(() => {});
      const toggled = await hand.evaluate((id) => ({ summary: window.__card(id)?.querySelector("[data-summary]")?.textContent ?? null, path: window.__path() }), PHISHING);
      claim("on a phone, a tap on the view's own toggle inside the card toggles it and opens nothing", toggled.summary === "Forty mailboxes got the fake invoice this morning." && toggled.path === "/", toggled);
      await phone.close();
    }
    claim("the host page throws nothing", report.pageErrors.length === 0, report.pageErrors);
  } finally {
    server.close();
  }
}
