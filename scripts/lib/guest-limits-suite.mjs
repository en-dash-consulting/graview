/**
 * A WORKER VIEW PAST ITS LIMITS, IN A REAL BROWSER (FR-94): the limits
 * transport of `scripts/guest-sandbox.mjs`.
 *
 * Five views over the offers fixture, each past one limit: one spins in
 * its listener for a push, one spins later where no push is waiting, one
 * floods the host with messages, one draws 100 000 nodes, one sends few
 * messages that each hold thousands of long styles for the host to judge,
 * and one is longer than a view may be. Each is stopped within its limit and an interval of
 * it, its worker terminated, the plain face of what it was shown drawn in
 * its place, and the reason said — while the page's own timer keeps time.
 * A sixth view, well behaved, is kept.
 *
 * THE BUDGET FITS THE DEVICE (Roadmap f-view-budget-fits-device): the page
 * measures its first worker's start once and gives every view its time
 * budget times that pace, 1 for a fast start up to 4. The page above
 * starts fast (pace 1), so a spinner is stopped at the base 1 000 ms. A
 * second page's views come from a script the server answers slowly, so its
 * first start takes four times a fast one or more (pace 4): a view that
 * draws in 300 ms draws, one whose listener takes 1 500 ms — past the fixed
 * budget — draws, a spinner is stopped at 4 000 ms with the sentence naming
 * it, and a flood is still a flood. Under GRAVIEW_SLOW=4 every page's main
 * thread is throttled as the nightly's runner is (Chromium only; the engine
 * throttles no worker, so the start it measures is the page's own pace).
 */
import { createServer } from "node:http";
import { resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

const MANIFEST = { title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } };
const PUSH_MS = 1_000;
const SILENT_MS = 1_500;
/* How long the server holds the paced page's scripts: four times a fast start (60 ms) and some, so the page is at the ceiling. */
const PACED_START_MS = 300;

export async function limitsSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, viewScript, engine }) {
  /* GRAVIEW_SLOW=4: every page as slow as the nightly's runner, as scripts/lib/watch.mjs does it. */
  const slow = Number(process.env["GRAVIEW_SLOW"] ?? 0);
  const slowed = async (page) => {
    if (slow > 1 && engine === "chromium") await page.context().newCDPSession(page).then((cdp) => cdp.send("Emulation.setCPUThrottlingRate", { rate: slow })).catch(() => {});
  };
  const draw = `graview.render(graview.html\`<p>\${(props.nodes || []).length} records</p>\`);`;
  /* Busy in its listener for a time, then draws: what a view that draws in that long on a fast page looks like to the host (a hardened worker keeps Date and not performance). */
  const busy = (ms) => `graview.onProps((props) => { const until = Date.now() + ${ms}; while (Date.now() < until) {} ${draw} });`;
  const views = {
    /* Spins inside its listener for a push: it never says it drew. */
    spin: `graview.onProps((props) => { ${draw} for (;;) {} });`,
    /* Draws, then spins where no push is waiting: only the heartbeat can tell. */
    later: `let once = false; graview.onProps((props) => { ${draw} if (!once) { once = true; setTimeout(() => { for (;;) {} }, 50); } });`,
    /* Draws, then sends message after message. */
    flood: `let once = false; graview.onProps((props) => { ${draw} if (!once) { once = true; let i = 0; setInterval(() => { for (let j = 0; j < 40; j += 1) graview.style(".x" + (i += 1) + " { color: red }"); }, 0); } });`,
    /* 100 000 nodes in one render. */
    /* A hundred lists of a thousand: the polyfill appends in time proportional to a parent's children, so one list of 100 000 would test the polyfill, not the host. */
    nodes: `graview.onProps(() => { const lists = []; for (let l = 0; l < 100; l += 1) { const list = document.createElement("ul"); for (let i = 0; i < 1000; i += 1) list.appendChild(document.createElement("li")); lists.push(list); } graview.render(lists); });`,
    /* Few messages and few nodes, but each message thousands of records the host must judge: a long style, set again and again on one element. */
    churn: `let once = false; graview.onProps((props) => { ${draw} if (!once) { once = true; const el = document.createElement("div"); graview.render([el]); const long = "margin: 1px; color: red; ".repeat(150); let n = 0; setInterval(() => { for (let i = 0; i < 2000; i += 1) el.setAttribute("style", long + "padding: " + (n += 1) % 50 + "px"); }, 20); } });`,
    /* Longer than a view may be. */
    long: `const padding = "${"padding ".repeat(40_000)}"; graview.onProps((props) => { ${draw} graview.style(padding.slice(0, 0)); });`,
    /* Well behaved, for the control. */
    good: `graview.onProps((props) => { ${draw} });`,
  };
  const scripts = Object.fromEntries(await Promise.all(Object.entries(views).map(async ([name, code]) => [name, await viewScript(code)])));
  /* The paced page's views, served slowly: two that draw in time on a slow device, and the spinner and the flood again. */
  const pacedViews = { steady: busy(300), heavy: busy(1_500), spin: views.spin, flood: views.flood };
  const pacedScripts = Object.fromEntries(await Promise.all(Object.entries(pacedViews).map(async ([name, code]) => [name, await viewScript(code)])));
  const pacedJs = (
    await build({
      stdin: {
        contents: `
import { Store } from "@graview/core";
import { mountWorkerView } from "@graview/guest/host/worker";
import { lin, offersApp, offersSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/offers-app.ts"))};
const store = new Store({ schema: offersApp.schema, mutations: offersApp.mutations, policy: offersApp.policy, snapshot: structuredClone(offersSeed) });
const failures = {};
const mounted = {};
const began = performance.now();
for (const name of ${JSON.stringify(Object.keys(pacedViews))}) {
  const holder = document.createElement("section");
  holder.id = name;
  document.querySelector("main").appendChild(holder);
  mounted[name] = mountWorkerView(holder, {
    manifest: { ...${JSON.stringify(MANIFEST)}, name },
    worker: { url: "/views/paced/" + name + ".js" },
    store,
    principal: lin,
    limits: { pushMs: ${PUSH_MS} },
    onFailure: (reason, detail) => (failures[name] = { reason, detail, at: performance.now() - began }),
  });
}
window.__host = {
  failures,
  pace: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.pace ?? null])),
  running: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.worker !== undefined])),
  faces: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, [...view.shadow.querySelectorAll("[data-graview-fallback] li")].map((item) => item.textContent)])),
  notes: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.shadow.querySelector("[data-graview-fallback] p")?.textContent ?? null])),
  drawn: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.shadow.querySelector("[data-graview-view-root] p")?.textContent ?? null])),
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
  const pacedHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Paced</title></head><body><main></main><script>${pacedJs.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;

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
const began = performance.now();
/* The page's own timer, every 50 ms: the longest it went between ticks while views spun. */
const pulse = { last: performance.now(), longest: 0, ticks: 0 };
setInterval(() => { const at = performance.now(); pulse.longest = Math.max(pulse.longest, at - pulse.last); pulse.last = at; pulse.ticks += 1; }, 50);
for (const [name, script] of Object.entries(window.VIEWS)) {
  const holder = document.createElement("section");
  holder.id = name;
  document.querySelector("main").appendChild(holder);
  mounted[name] = mountWorkerView(holder, {
    manifest: { ...${JSON.stringify(MANIFEST)}, name },
    worker: { script },
    store,
    principal: lin,
    /* The 100 000 nodes take their builder longer than a push may: given time, so it is the node cap that stops it. The spinner blocks its heartbeat too: given the heartbeat's default, so it is the push's time — fitted to the device, up to four times the base — that stops it. */
    limits: name === "nodes" ? { pushMs: 30000, silentMs: 30000 } : name === "spin" ? { pushMs: ${PUSH_MS} } : { pushMs: ${PUSH_MS}, silentMs: ${SILENT_MS} },
    onFailure: (reason, detail) => (failures[name] = { reason, detail, at: performance.now() - began }),
  });
}
window.__host = {
  failures,
  pulse,
  pace: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.pace ?? null])),
  running: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.worker !== undefined])),
  faces: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, [...view.shadow.querySelectorAll("[data-graview-fallback] li")].map((item) => item.textContent)])),
  notes: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.shadow.querySelector("[data-graview-fallback] p")?.textContent ?? null])),
  drawn: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.shadow.querySelector("[data-graview-view-root] p")?.textContent ?? null])),
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
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Limits</title></head><body><main></main><script>window.VIEWS = ${JSON.stringify(scripts).replace(/<\/script/gi, "<\\/script")};</script><script>${pageJs.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  /*
   * WHAT THE HOST PAGE ALLOWS (FR-102). Two good views on three pages, each
   * served with a Content-Security-Policy: one with exactly what the guest
   * README asks (`worker-src blob:`, `style-src 'unsafe-inline'`), one with
   * no `worker-src` and a `script-src` without `blob:` (Graview Cloud's page
   * before it said `worker-src blob:`), and one that allows no `blob:`
   * worker, whose host serves each view's whole script (`viewScript`) from
   * its own origin under `worker-src 'self'`. Inline scripts are this
   * harness's own; the policy under test is the worker's and the style's.
   */
  const policyJs = (
    await build({
      stdin: {
        contents: `
import { Store } from "@graview/core";
import { mountWorkerView } from "@graview/guest/host/worker";
import { lin, offersApp, offersSeed } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/offers-app.ts"))};
const store = new Store({ schema: offersApp.schema, mutations: offersApp.mutations, policy: offersApp.policy, snapshot: structuredClone(offersSeed) });
const warned = [];
const warn = console.warn.bind(console);
console.warn = (...args) => { warned.push(String(args[0])); warn(...args); };
const failures = {};
const mounted = {};
for (const name of ["first", "second"]) {
  const holder = document.createElement("section");
  document.querySelector("main").appendChild(holder);
  failures[name] = [];
  mounted[name] = mountWorkerView(holder, {
    manifest: { ...${JSON.stringify(MANIFEST)}, name },
    worker: window.SERVED ? { url: "/views/good.js" } : { script: window.GOOD },
    store,
    principal: lin,
    onFailure: (reason, detail) => failures[name].push({ reason, detail }),
  });
}
window.__host = {
  failures,
  warned: () => warned.filter((line) => line.includes("worker-src")),
  running: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.worker !== undefined])),
  drawn: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.shadow.querySelector("[data-graview-view-root] p")?.textContent ?? null])),
  styled: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => { const p = view.shadow.querySelector("[data-graview-view-root] p"); return [name, p ? getComputedStyle(p).letterSpacing : null]; })),
  faces: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, [...view.shadow.querySelectorAll("[data-graview-fallback] li")].map((item) => item.textContent)])),
  notes: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, view.shadow.querySelector("[data-graview-fallback] p")?.textContent ?? null])),
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
  const styledView = await viewScript(`graview.style("p { letter-spacing: 3px }"); graview.onProps((props) => { ${draw} });`);
  const POLICIES = {
    "/allowed": { csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; worker-src blob:", served: false },
    "/strict": { csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'", served: false },
    "/served": { csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; worker-src 'self'", served: true },
  };
  const policyHtml = (served) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Policy</title></head><body><main></main><script>window.SERVED = ${served}; window.GOOD = ${JSON.stringify(styledView).replace(/<\/script/gi, "<\\/script")};</script><script>${policyJs.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;

  const server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      return response.end(html);
    }
    const policy = POLICIES[request.url];
    if (policy) {
      response.writeHead(200, { "content-type": "text/html", "content-security-policy": policy.csp });
      return response.end(policyHtml(policy.served));
    }
    if (request.url === "/views/good.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      return response.end(styledView);
    }
    if (request.url === "/paced") {
      response.writeHead(200, { "content-type": "text/html" });
      return response.end(pacedHtml);
    }
    /* The paced page's scripts, held so the page's first worker starts as a slow device's would. */
    const paced = /^\/views\/paced\/([a-z]+)\.js$/.exec(request.url ?? "");
    if (paced && pacedScripts[paced[1]]) {
      return void setTimeout(() => {
        response.writeHead(200, { "content-type": "text/javascript" });
        response.end(pacedScripts[paced[1]]);
      }, PACED_START_MS);
    }
    response.writeHead(404);
    response.end();
  }).listen(HOST_PORT, "127.0.0.1");

  try {
    const context = await browser.newContext();
    const tab = await context.newPage();
    await slowed(tab);
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await tab.goto(`${HOST}/`, { waitUntil: "load" });
    await tab.waitForFunction(() => ["spin", "later", "flood", "nodes", "long", "churn"].every((name) => window.__host.failures[name]), null, { timeout: 40_000, polling: 250 }).catch(() => {});
    await tab.waitForTimeout(500);
    /* A page a view has frozen answers nothing: given 15 s, its silence is the finding. */
    const silent = { failures: {}, running: {}, faces: {}, notes: {}, drawn: {}, pace: {}, pulse: { ticks: 0, longest: Infinity, frozen: true } };
    const host = await Promise.race([
      tab.evaluate(() => ({ failures: window.__host.failures, running: window.__host.running(), faces: window.__host.faces(), notes: window.__host.notes(), drawn: window.__host.drawn(), pace: window.__host.pace(), pulse: window.__host.pulse })),
      new Promise((done) => setTimeout(() => done(silent), 15_000)),
    ]);
    report.limits = host;
    const stopped = (name, reason, within) => {
      const failure = host.failures[name];
      const ok = failure?.reason === reason && failure.at <= within && host.running[name] === false && host.faces[name]?.includes("A way in") && host.faces[name]?.includes("Team coaching") && typeof failure.detail === "string" && host.notes[name]?.includes(failure.detail);
      return { ok, detail: { failure, running: host.running[name], face: host.faces[name], note: host.notes[name] } };
    };
    /* Within its push's time as fitted to the device: up to four times the base. */
    const spin = stopped("spin", "slow", 5_000 + PUSH_MS * 4 + 250);
    claim(`a view that spins in its listener is stopped as slow, its plain face drawn and the reason said`, spin.ok, spin.detail);
    const later = stopped("later", "silent", 5_000 + SILENT_MS + SILENT_MS / 4 + 250);
    claim(`a view that spins where no push waits is stopped as silent within silentMs (${SILENT_MS} ms), its plain face drawn and the reason said`, later.ok, later.detail);
    const flood = stopped("flood", "flood", 5_000);
    claim("a view that floods the host with messages is stopped, its plain face drawn and the reason said", flood.ok, flood.detail);
    const nodes = stopped("nodes", "nodes", 5_000);
    claim("a view that draws 100 000 nodes is stopped at 5 000, its plain face drawn and the reason said (its time per push raised, so the node cap is what stops it)", nodes.ok, nodes.detail);
    const long = stopped("long", "source", 1_000);
    claim("a view longer than a view may be is never started, its plain face drawn and the reason said", long.ok, long.detail);
    const churn = stopped("churn", "slow", 5_000);
    claim("a view that sends, in few messages, more to draw than the host may draw in its time is stopped as slow, its plain face drawn and the reason said", churn.ok, { ...churn.detail, pulse: host.pulse });
    claim("a view within its limits is kept, and draws", host.running.good === true && !host.failures.good && host.drawn.good === "6 records", { running: host.running.good, failure: host.failures.good, drawn: host.drawn.good });
    claim("the page's own timer kept time while views spun, never more than 250 ms between 50 ms ticks", host.pulse.ticks > 20 && host.pulse.longest < 250, host.pulse);
    /*
     * The budget fits the device: the page measured its first worker's start
     * once, so every view that started (the long one never did) is at the
     * one pace it kept — 1 on a laptop at rest; more on a busy runner or
     * under GRAVIEW_SLOW, where the throttled main thread is the device being
     * slow — and the spinner was held to the base times that pace, its
     * sentence naming the budget. The pace itself is reported, not fixed:
     * three harnesses side by side can make a first start slow.
     */
    const paces = Object.entries(host.pace).filter(([name]) => name !== "long").map(([, pace]) => pace);
    const pace = host.pace.good;
    const fittedBase = typeof pace === "number" ? Math.round(PUSH_MS * pace) : NaN;
    claim(
      `a page is at one pace, measured once from its first worker's start — 1 where it started fast — every view on it alike, and a view that spins is stopped as slow at that pace times the base ${PUSH_MS.toLocaleString("en-US")} ms, the sentence naming the budget it was held to`,
      paces.length >= 6 && paces.every((one) => one === pace) && pace >= 1 && pace <= 4 && host.failures.spin?.reason === "slow" && host.failures.spin.detail === `It took longer than ${fittedBase.toLocaleString("en-US")} ms to draw what it was shown.`,
      { pace: host.pace, fitted: fittedBase, spin: host.failures.spin, slow },
    );
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);
    await context.close();

    /* What the host page allows (FR-102). */
    const visit = async (path, done) => {
      const visiting = await browser.newContext();
      const page = await visiting.newPage();
      await slowed(page);
      page.on("pageerror", (error) => report.pageErrors.push(`${path}: ${String(error).slice(0, 200)}`));
      await page.goto(`${HOST}${path}`, { waitUntil: "load" });
      /* Polled from here: Firefox runs a polled waitForFunction as eval, which the page's own policy refuses. */
      for (let tries = 0; tries < 100 && !(await page.evaluate(done).catch(() => false)); tries += 1) await page.waitForTimeout(100);
      /* Long enough that a second report, or the ready timeout's, would have come. */
      await page.waitForTimeout(800);
      const seen = await page.evaluate(() => ({ failures: window.__host.failures, warned: window.__host.warned(), running: window.__host.running(), drawn: window.__host.drawn(), styled: window.__host.styled(), faces: window.__host.faces(), notes: window.__host.notes() }));
      await visiting.close();
      return seen;
    };
    const bothDrawn = () => Object.values(window.__host?.drawn() ?? {}).every((text) => text === "6 records") && Object.keys(window.__host.drawn()).length === 2;
    const allowed = await visit("/allowed", bothDrawn);
    report.policy = { allowed };
    claim("a page whose policy is the README's (worker-src blob:, style-src 'unsafe-inline') starts both views, and draws them with their stylesheet", Object.values(allowed.drawn).every((text) => text === "6 records") && Object.values(allowed.styled).every((spacing) => spacing === "3px") && Object.values(allowed.failures).every((list) => list.length === 0) && allowed.warned.length === 0, allowed);
    const strict = await visit("/strict", () => Object.values(window.__host?.failures ?? {}).every((list) => list.length > 0));
    report.policy.strict = strict;
    const reported = Object.values(strict.failures);
    claim(
      "a page whose policy has no worker-src, and whose script-src allows no blob:, reports start once for each view, naming worker-src blob:",
      reported.length === 2 && reported.every((list) => list.length === 1 && list[0].reason === "start" && /worker-src blob:/.test(list[0].detail ?? "")),
      strict.failures,
    );
    claim(
      "on that page each view's plain face is drawn, its note naming worker-src blob:, and no worker is left running",
      Object.values(strict.faces).every((face) => face.includes("A way in") && face.includes("Team coaching")) && Object.values(strict.notes).every((note) => /worker-src blob:/.test(note ?? "")) && Object.values(strict.running).every((running) => running === false),
      { faces: strict.faces, notes: strict.notes, running: strict.running },
    );
    claim("on that page the console is told what the policy lacks once, for both views", strict.warned.length === 1 && strict.warned[0].includes("worker: { url }"), strict.warned);
    const served = await visit("/served", bothDrawn);
    report.policy.served = served;
    claim("a page that allows no blob: worker draws both views from a script its host serves from its own origin (worker-src 'self', worker: { url })", Object.values(served.drawn).every((text) => text === "6 records") && Object.values(served.failures).every((list) => list.length === 0), served);
    claim("the policy pages throw nothing", !report.pageErrors.some((error) => error.startsWith("/")), report.pageErrors);

    /*
     * THE BUDGET FITS THE DEVICE (Roadmap f-view-budget-fits-device): the
     * paced page's first worker takes four times a fast start or longer, so
     * every view on it is given four times its time — and no more messages.
     */
    const pacing = await browser.newContext();
    const pacedPage = await pacing.newPage();
    await slowed(pacedPage);
    pacedPage.on("pageerror", (error) => report.pageErrors.push(`/paced: ${String(error).slice(0, 200)}`));
    await pacedPage.goto(`${HOST}/paced`, { waitUntil: "load" });
    const pacedDone = () => window.__host?.failures.spin && window.__host.failures.flood && window.__host.drawn().steady === "6 records" && window.__host.drawn().heavy === "6 records";
    for (let tries = 0; tries < 150 && !(await pacedPage.evaluate(pacedDone).catch(() => false)); tries += 1) await pacedPage.waitForTimeout(100);
    await pacedPage.waitForTimeout(500);
    const paced = await pacedPage.evaluate(() => ({ failures: window.__host.failures, pace: window.__host.pace(), running: window.__host.running(), drawn: window.__host.drawn(), faces: window.__host.faces(), notes: window.__host.notes() }));
    await pacing.close();
    report.paced = paced;
    const fitted = PUSH_MS * 4;
    claim(
      `a page whose first worker took four times a fast start or longer is at pace 4, every view on it alike, and a view that draws in 300 ms draws, not falls back`,
      Object.values(paced.pace).every((pace) => pace === 4) && paced.drawn.steady === "6 records" && !paced.failures.steady && paced.running.steady === true,
      { pace: paced.pace, steady: { drawn: paced.drawn.steady, failure: paced.failures.steady, running: paced.running.steady } },
    );
    claim(
      `on that page a view whose listener takes 1 500 ms a push — past the fixed ${PUSH_MS.toLocaleString("en-US")} ms — draws, within the four times it was given`,
      paced.drawn.heavy === "6 records" && !paced.failures.heavy && paced.running.heavy === true,
      { drawn: paced.drawn.heavy, failure: paced.failures.heavy, running: paced.running.heavy },
    );
    claim(
      `on that page a view that spins is stopped as slow at ${fitted.toLocaleString("en-US")} ms, not ${PUSH_MS.toLocaleString("en-US")}, the sentence naming the budget it was held to, its plain face drawn`,
      paced.failures.spin?.reason === "slow" && paced.failures.spin.detail === `It took longer than ${fitted.toLocaleString("en-US")} ms to draw what it was shown.` && paced.failures.spin.at >= fitted && paced.running.spin === false && paced.faces.spin?.includes("A way in") && paced.notes.spin?.includes(paced.failures.spin.detail),
      { spin: paced.failures.spin, running: paced.running.spin, face: paced.faces.spin, note: paced.notes.spin },
    );
    claim(
      "on that page a flood is still a flood: a view that floods the host is stopped at the same allowance of 120 messages in 1,000 ms",
      paced.failures.flood?.reason === "flood" && paced.failures.flood.detail === "It sent more than 120 messages in 1,000 ms." && paced.running.flood === false,
      { flood: paced.failures.flood, running: paced.running.flood },
    );
    claim("the paced page throws nothing", !report.pageErrors.some((error) => error.startsWith("/paced")), report.pageErrors);
  } finally {
    server.close();
  }
}
