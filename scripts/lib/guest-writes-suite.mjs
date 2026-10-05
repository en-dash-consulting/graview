/**
 * WRITES THAT CANNOT LEAK, IN A REAL BROWSER (FR-92): the writes transport
 * of `scripts/guest-sandbox.mjs`.
 *
 * Erin, staff, may see the internal margin review and what it costs
 * (18 500); Lin, of the client, may see the packages but not that offer.
 * Worker views run for Erin over the offers fixture with its sights on, and
 * try to write the cost into the starter package's summary, which Lin
 * reads: from their own code with no press; from their own handler for a
 * press; with a field they filled themselves; by changing what Erin typed;
 * with the argument written on the button; as the value of a radio the
 * person picks under harmless words. A real person's click and
 * typing (Playwright's, which the browser marks trusted) on an honest
 * view's bound button applies, as Erin, through the view, and is undone.
 * Over the same app with no sights, a declared act applies from code.
 */
import { createServer } from "node:http";
import { resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

export const WRITES_MANIFEST = { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] }, acts: ["set-summary"] };
const SECRET = "18500";

export async function writesSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, viewScript }) {
  /* Each view finds the cost the same way: Erin may see it. */
  const reads = `const costOf = (props) => String((props.nodes.find((node) => node.id === "offer:margin") || {}).cost);`;
  const views = {
    /* From its own code, as soon as it is shown the cost: no press at all. */
    code: `${reads}
let asked = false;
const said = [];
graview.onProps((props) => {
  if (!asked) { asked = true; graview.act("set-summary", { packageId: "package:start", summary: "costs " + costOf(props) }).then((answer) => { said.push(answer); draw(); }); }
  draw();
});
graview.on("click", "button", () => graview.act("set-summary", { packageId: "package:start", summary: "pressed, costs " + costOf(graview.props) }).then((answer) => { said.push(answer); draw(); }));
const draw = () => graview.render(graview.html\`<button id="go">Go</button><pre id="said">\${JSON.stringify(said)}</pre>\`);`,
    /* A field it filled itself, and a bound button. */
    filled: `${reads}
graview.onProps((props) => graview.render(graview.html\`<fieldset><input name="summary" value="costs \${costOf(props)}"><button id="go" data-act="set-summary" data-record="package:start">Say it</button></fieldset>\`));`,
    /* It lets Erin type, then puts the cost in after her words. */
    rewrite: `${reads}
let words = "";
graview.on("input", "input", (event) => { words = event.value; draw(); });
const draw = () => graview.render(graview.html\`<fieldset><input name="summary" value="\${words ? words + " (" + costOf(graview.props) + ")" : ""}"><button id="go" data-act="set-summary" data-record="package:start">Say it</button></fieldset>\`);
graview.onProps(draw);`,
    /* The argument written on the button, where nothing reads it. */
    computed: `${reads}
graview.onProps((props) => graview.render(graview.html\`<button id="go" data-act="set-summary" data-record="package:start" data-summary="costs \${costOf(props)}" value="costs \${costOf(props)}">Say it</button>\`));`,
    /* A radio whose value is the cost, under words that ask nothing of it: Erin's pick, the view's words. */
    picked: `${reads}
graview.onProps((props) => graview.render(graview.html\`<fieldset><label><input type="radio" name="summary" value="costs \${costOf(props)}"> This package is right</label><button id="go" data-act="set-summary" data-record="package:start">Say it</button></fieldset>\`));`,
    /* An honest one: an empty field the viewer types in, and a bound button. */
    honest: `const said = [];
graview.on("click", "button", (event) => { said.push(event.pressed); draw(); });
const draw = () => graview.render(graview.html\`<fieldset><input name="summary" placeholder="What it is"><button id="go" data-act="set-summary" data-record="package:start">Say it</button></fieldset><pre id="said">\${JSON.stringify(said)}</pre>\`);
graview.onProps(draw);`,
    /* Over the app with no sights: an act from code. */
    open: `const said = [];
graview.onProps(() => { if (said.length === 0) { said.push("asking"); graview.act("set-summary", { packageId: "package:later", summary: "From the view's code" }).then((answer) => { said.push(answer); graview.render(graview.html\`<pre id="said">\${JSON.stringify(said)}</pre>\`); }); } });`,
  };
  const scripts = Object.fromEntries(await Promise.all(Object.entries(views).map(async ([name, code]) => [name, await viewScript(code)])));

  const pageJs = (
    await build({
      stdin: {
        contents: `
import { Store } from "@graview/core";
import { mountWorkerView } from "@graview/guest/host/worker";
import { erin, lin, offersApp, offersSeed, openOffersApp } from ${JSON.stringify(resolve(repoRoot, "scripts/fixtures/offers-app.ts"))};
const storeOf = (app) => new Store({ schema: app.schema, mutations: app.mutations, policy: app.policy, snapshot: structuredClone(offersSeed) });
const sighted = storeOf(offersApp);
const open = storeOf(openOffersApp);
const failures = [];
const mounted = {};
for (const [name, script] of Object.entries(window.VIEWS)) {
  const holder = document.createElement("section");
  holder.id = name;
  document.querySelector("main").appendChild(holder);
  mounted[name] = mountWorkerView(holder, { manifest: { ...${JSON.stringify(WRITES_MANIFEST)}, name }, worker: { script }, store: name === "open" ? open : sighted, principal: erin, onFailure: (reason, detail) => failures.push([name, reason, detail]) });
}
const summaries = (store) => store.seenBy(lin).graph.nodesOfKind("package").map((node) => node.summary);
window.__host = {
  failures,
  log: () => sighted.log.all().map((op) => ({ author: op.author.id, via: op.via, intent: op.intent, batch: op.batch })),
  openLog: () => open.log.all().map((op) => ({ author: op.author.id, via: op.via, intent: op.intent })),
  linReads: () => summaries(sighted),
  openSummaries: () => summaries(open),
  undoLast: () => { const op = sighted.log.all().at(-1); sighted.undo(op.batch, { author: erin }); return summaries(sighted); },
  stats: () => Object.fromEntries(Object.entries(mounted).map(([name, view]) => [name, { ...view.stats }])),
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
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Offers</title></head><body><main></main><script>window.VIEWS = ${JSON.stringify(scripts).replace(/<\/script/gi, "<\\/script")};</script><script>${pageJs.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
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
    const inView = (name, selector) => tab.locator(`#${name} [data-worker-view]`).locator(selector);
    const drawn = async (name, selector) => inView(name, selector).waitFor({ timeout: 15_000 });
    for (const name of Object.keys(views)) await drawn(name, name === "open" ? "#said" : "#go");
    await tab.waitForFunction(() => document.querySelector("#code [data-worker-view]")?.shadowRoot?.querySelector("#said")?.textContent?.includes("press-only"), null, { timeout: 10_000 }).catch(() => {});

    /* Sights on. */
    const code = JSON.parse(await inView("code", "#said").textContent());
    claim("with sights on, a view that reads a hidden field and calls act with it from its own code, with no press, is refused", code[0]?.ok === false && code[0]?.reason === "press-only", code);
    await inView("code", "#go").click();
    await tab.waitForTimeout(400);
    const codeAfter = JSON.parse(await inView("code", "#said").textContent());
    claim("the same act asked from the view's own handler for a person's press is refused too: only the host's handler acts", codeAfter.length === 2 && codeAfter[1]?.reason === "press-only", codeAfter);

    await inView("filled", "#go").click();
    await tab.waitForTimeout(300);
    claim("a press on a bound button that would carry a field the view filled itself is refused", !(await tab.evaluate(() => window.__host.log())).length, await tab.evaluate(() => window.__host.stats().filled));

    await inView("rewrite", "input").pressSequentially("A way in", { delay: 20 });
    await tab.waitForTimeout(300);
    const rewritten = await inView("rewrite", "input").inputValue();
    await inView("rewrite", "#go").click();
    await tab.waitForTimeout(300);
    claim("a press after the view changed what the viewer typed is refused", rewritten.includes(SECRET) && (await tab.evaluate(() => window.__host.log())).length === 0, { rewritten });

    await inView("computed", "#go").click();
    await tab.waitForTimeout(300);
    claim("a press whose argument the view wrote on the button carries none of it, and writes nothing", (await tab.evaluate(() => window.__host.log())).length === 0);

    await inView("picked", "input[type=radio]").check();
    await inView("picked", "#go").click();
    await tab.waitForTimeout(300);
    claim("a radio the viewer picked carries none of the view's words: its value, the cost, is refused, and nothing is written", (await tab.evaluate(() => window.__host.log())).length === 0, { log: await tab.evaluate(() => window.__host.log()), lin: await tab.evaluate(() => window.__host.linReads()) });

    const before = await tab.evaluate(() => window.__host.linReads());
    await inView("honest", "input").fill("Coaching and a sprint, to begin");
    await inView("honest", "#go").click();
    await tab.waitForFunction(() => window.__host.log().length === 1, null, { timeout: 5_000 }).catch(() => {});
    const log = await tab.evaluate(() => window.__host.log());
    const after = await tab.evaluate(() => window.__host.linReads());
    claim("a person's press on a bound button, with the words they typed, applies: as Erin, through the view", log.length === 1 && log[0].author === "person:erin" && log[0].via === "view:honest" && after.includes("Coaching and a sprint, to begin"), { log, after });
    const told = await tab.waitForFunction(() => document.querySelector("#honest [data-worker-view]")?.shadowRoot?.querySelector("#said")?.textContent?.includes('"ok":true'), null, { timeout: 5_000 }).then(() => true).catch(() => false);
    claim("the view heard its press applied, after the host applied it", told);
    const undone = await tab.evaluate(() => window.__host.undoLast());
    claim("the act a view's press applied is undone like any other", JSON.stringify(undone) === JSON.stringify(before), { undone, before });
    const all = await tab.evaluate(() => window.__host.linReads());
    claim("Lin never reads the cost, in any package's summary", [...before, ...after, ...all].every((summary) => !summary.includes(SECRET)), { before, after, all });

    /* Sights off. */
    await tab.waitForFunction(() => document.querySelector("#open [data-worker-view]")?.shadowRoot?.querySelector("#said")?.textContent?.includes('"ok"'), null, { timeout: 5_000 }).catch(() => {});
    const open = await tab.evaluate(() => ({ log: window.__host.openLog(), summaries: window.__host.openSummaries() }));
    claim("with sights off, a declared act applies from the view's code, through the view", open.log.length === 1 && open.log[0].via === "view:open" && open.summaries.includes("From the view's code"), open);
    claim("no view failed", (await tab.evaluate(() => window.__host.failures)).length === 0, await tab.evaluate(() => window.__host.failures));
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);
    await context.close();
  } finally {
    server.close();
  }
}
