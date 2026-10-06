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
 */
import { createServer } from "node:http";
import { resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

const MANIFEST = { title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } };
const PUSH_MS = 1_000;
const SILENT_MS = 1_500;

export async function limitsSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, viewScript }) {
  const draw = `graview.render(graview.html\`<p>\${(props.nodes || []).length} records</p>\`);`;
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
    /* The 100 000 nodes take their builder longer than a push may: given time, so it is the node cap that stops it. */
    limits: name === "nodes" ? { pushMs: 30000, silentMs: 30000 } : { pushMs: ${PUSH_MS}, silentMs: ${SILENT_MS} },
    onFailure: (reason, detail) => (failures[name] = { reason, detail, at: performance.now() - began }),
  });
}
window.__host = {
  failures,
  pulse,
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
  const server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      return response.end(html);
    }
    response.writeHead(404);
    response.end();
  }).listen(HOST_PORT, "127.0.0.1");

  try {
    const context = await browser.newContext();
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await tab.goto(`${HOST}/`, { waitUntil: "load" });
    await tab.waitForFunction(() => ["spin", "later", "flood", "nodes", "long", "churn"].every((name) => window.__host.failures[name]), null, { timeout: 40_000, polling: 250 }).catch(() => {});
    await tab.waitForTimeout(500);
    /* A page a view has frozen answers nothing: given 15 s, its silence is the finding. */
    const silent = { failures: {}, running: {}, faces: {}, notes: {}, drawn: {}, pulse: { ticks: 0, longest: Infinity, frozen: true } };
    const host = await Promise.race([
      tab.evaluate(() => ({ failures: window.__host.failures, running: window.__host.running(), faces: window.__host.faces(), notes: window.__host.notes(), drawn: window.__host.drawn(), pulse: window.__host.pulse })),
      new Promise((done) => setTimeout(() => done(silent), 15_000)),
    ]);
    report.limits = host;
    const stopped = (name, reason, within) => {
      const failure = host.failures[name];
      const ok = failure?.reason === reason && failure.at <= within && host.running[name] === false && host.faces[name]?.includes("A way in") && host.faces[name]?.includes("Team coaching") && typeof failure.detail === "string" && host.notes[name]?.includes(failure.detail);
      return { ok, detail: { failure, running: host.running[name], face: host.faces[name], note: host.notes[name] } };
    };
    const spin = stopped("spin", "slow", 5_000 + PUSH_MS + 250);
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
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);
    await context.close();
  } finally {
    server.close();
  }
}
