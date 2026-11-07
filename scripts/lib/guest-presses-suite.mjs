/**
 * EVERY CONTROL DOES WHAT IT SAYS, AND A LONG VIEW READS LIKE A PAGE, IN A
 * REAL BROWSER (Roadmap f-views-work-end-to-end, f-views-scroll-and-anchors):
 * the presses transport of `scripts/guest-sandbox.mjs`.
 *
 * Kit, a recruiter, over the Staffing Placement fixture
 * (scripts/fixtures/placement-app.ts), where some members see only their
 * own placements, so a view's act applies only from a press.
 *
 *   · The check (headless, in a worker thread): a view with a broken
 *     button fails with the finding that names it; the honest view passes.
 *   · Omar's economics: the person empties the fixed fee the host filled,
 *     types a rate and presses "Save economics" — the blank number is left
 *     out and the press lands; a view's own `value="0"` lands too.
 *   · A Save that sends words where a number is asked is refused, and the
 *     host says why beside the button, unasked; a view that hears `acted`
 *     says it itself, and the host draws nothing.
 *   · Rhea's contract: View opens it in a tab of its own, Download downloads
 *     it under its own name, from the address the page serves it at.
 *   · An agenda of five sections under a host's sticky bar: a jump lands its
 *     section below the bar, the address unchanged and the keyboard on it;
 *     scrolling changes the section in sight, which the view hears and its
 *     jump says (`aria-current`).
 *   · And on the pages face, a titled view that says `heading: "own"` has
 *     nothing drawn above it: no title to see, no count, no list link.
 *   · A view's controls already in their state — an "All" chip pressed
 *     while nothing is filtered, the open tab — pass the press check run in
 *     the page's own worker, and one that shows no state and changes
 *     nothing still fails; and a view's cards laid in CSS columns are kept
 *     whole in one (Roadmap f-view-authoring-friction-2026-11).
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { graviewSources } from "./graview-sources.mjs";

const AGENDA = `
graview.style(\`
.agenda { font: 16px/1.5 var(--graview-font-body); }
.rail { position: sticky; top: 0; z-index: 1; display: flex; gap: 12px; padding: 8px 0; background: var(--graview-panel); border-bottom: 1px solid var(--graview-edge); }
.rail a { color: var(--graview-ink-muted); }
.rail a[aria-current] { color: var(--graview-accent); font-weight: 700; }
section { min-height: 720px; scroll-margin-top: 48px; border-top: 1px solid var(--graview-edge); }
\`);
let sight = "none";
graview.on("sight", "section", (event) => { sight = event.element.getAttribute("id"); draw(); });
const draw = () => graview.render(graview.html\`<div class="agenda">
  <h1>The workshop agenda</h1>
  <nav class="rail">\${[1, 2, 3, 4, 5].map((n) => graview.html\`<a href="#s\${n}" data-key="j\${n}">Part \${n}</a>\`)}</nav>
  <p id="said" data-key="said">In sight: \${sight}</p>
  \${[1, 2, 3, 4, 5].map((n) => graview.html\`<section id="s\${n}" data-key="s\${n}" aria-labelledby="h\${n}"><h2 id="h\${n}">Part \${n}</h2><p>What happens in part \${n}.</p></section>\`)}
</div>\`);
graview.onProps(draw);
`;

/* Chips already in their state (Roadmap f-view-authoring-friction-2026-11): "All" pressed while nothing is filtered leaves the view as it is. */
const CHIPS = `
let filter = "all";
const draw = () => graview.render(graview.html\`<div role="group" aria-label="Show">
  <button id="all" aria-pressed="\${filter === "all" ? "true" : "false"}">All</button>
  <button id="igneous" aria-pressed="\${filter === "igneous" ? "true" : "false"}">Igneous</button>
</div>
<button id="shuffle">Shuffle</button>\`);
graview.onProps(() => draw());
graview.on("click", "#all", () => { filter = "all"; draw(); });
graview.on("click", "#igneous", () => { filter = "igneous"; draw(); });
graview.on("click", "#shuffle", () => draw());
`;

/* Cards in CSS columns, each kept whole in one (Roadmap f-view-authoring-friction-2026-11). */
const COLUMNS = `
graview.style(\`
.shelf { columns: 3; column-gap: 16px; column-rule: 1px solid var(--graview-edge); }
.card { break-inside: avoid; margin: 0 0 12px; padding: 8px; border: 1px solid var(--graview-edge); }
.shelf h2 { column-span: all; break-after: avoid; }
\`);
graview.onProps(() => graview.render(graview.html\`<div class="shelf"><h2>Specimens</h2>\${["Granite", "Gneiss", "Basalt", "Obsidian", "Chalk", "Slate"].map((name) => graview.html\`<article class="card" data-key="\${name}"><h3>\${name}</h3><p>A rock a child can hold.</p></article>\`)}</div>\`));
`;

export async function pressesSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, viewScript }) {
  const fixture = resolve(repoRoot, "scripts/fixtures/placement-app.ts");
  const out = mkdtempSync(join(tmpdir(), "graview-guest-presses-"));

  // ── the check, headless ──
  await build({
    stdin: {
      contents: `
import { Store } from "@graview/core";
import { runWorkerViewHeadless } from "@graview/guest/headless";
import { nodeIsolate } from "@graview/guest/headless/node";
import { checkPresses } from "@graview/guest/headless/presses";
import { BROKEN_JS, ECONOMICS_JS, ECONOMICS_MANIFEST, kit, placementApp, placementSeed } from ${JSON.stringify(fixture)};
export async function check(which) {
  const store = new Store({ schema: placementApp.schema, mutations: placementApp.mutations, policy: placementApp.policy, snapshot: structuredClone(placementSeed) });
  const source = which === "economics" ? ECONOMICS_JS : BROKEN_JS[which];
  const result = await runWorkerViewHeadless({ manifest: ECONOMICS_MANIFEST, source, store, principal: kit, run: nodeIsolate(), input: { node: { id: "placement:rhea" } }, presses: checkPresses });
  return result.ok ? { ok: result.presses.ok, problems: result.presses.problems.map((one) => one.says), controls: result.presses.controls.length } : { failed: result.reason, detail: result.detail };
}
`,
      resolveDir: repoRoot,
      loader: "js",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    outfile: join(out, "check.mjs"),
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  const { check } = await import(pathToFileURL(join(out, "check.mjs")).href);
  const nothing = await check("nothing");
  claim("the view check fails a view whose Save button is bound to nothing, and names it: “Save” does nothing", nothing.ok === false && nothing.problems[0] === "“Save” does nothing: it is bound to no act (data-act), goes nowhere (data-record, data-place), and the view hears no click on it.", nothing);
  const untyped = await check("untyped");
  claim("the view check fails a Save that sends words where its act takes a number: “Save economics” is refused: “fixedFee” expects a number", untyped.ok === false && untyped.problems[0] === "“Save economics” is refused: “fixedFee” expects a number.", untyped);
  const throws = await check("throws");
  claim("the view check fails a button whose own code throws when pressed, and says what it threw", throws.ok === false && /^“Recalculate” throws when pressed: Error: rate is undefined/.test(throws.problems[0] ?? ""), throws);
  const honest = await check("economics");
  claim("the view check passes the economics view, every control of it pressed", honest.ok === true && honest.controls === 3 && honest.problems.length === 0, honest);

  // ── the page: views mounted under a host's sticky bar ──
  const sources = await build({
    stdin: { contents: `import { BROKEN_JS, ECONOMICS_JS } from ${JSON.stringify(fixture)}; export const sources = { economics: ECONOMICS_JS, untyped: BROKEN_JS.untyped };`, resolveDir: repoRoot, loader: "js" },
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
    plugins: [graviewSources(repoRoot)],
  });
  writeFileSync(join(out, "sources.mjs"), sources.outputFiles[0].text);
  const { sources: fixtureSources } = await import(pathToFileURL(join(out, "sources.mjs")).href);
  const codes = {
    economics: fixtureSources.economics,
    contract: fixtureSources.economics,
    zero: `graview.onProps((props) => graview.render(graview.html\`<fieldset data-record="\${props.node.id}"><label>Margin <input type="number" name="margin" value="0"></label><button id="go" data-act="set-economics">Clear the margin</button></fieldset>\`));`,
    refused: fixtureSources.untyped,
    owned: `let said = "";
graview.on("acted", "button", (event) => { said = event.pressed.ok ? "Saved" : "The view says: " + event.pressed.message; draw(); });
const draw = () => graview.render(graview.html\`<fieldset data-record="\${graview.props.node.id}"><input name="fixedFee"><button id="go" data-act="set-economics">Save economics</button><p id="said" data-key="said">\${said}</p></fieldset>\`);
graview.onProps(draw);`,
    agenda: AGENDA,
    chips: CHIPS,
    columns: COLUMNS,
  };
  const records = { economics: "placement:omar", contract: "placement:rhea", zero: "placement:omar", refused: "placement:omar", owned: "placement:omar", agenda: "placement:rhea", chips: "placement:rhea", columns: "placement:rhea" };
  const scripts = Object.fromEntries(await Promise.all(Object.entries(codes).map(async ([name, code]) => [name, await viewScript(code)])));
  await build({
    stdin: {
      contents: `
import { Store } from "@graview/core";
import { mountWorkerView } from "@graview/guest/host/worker";
import { runWorkerViewHeadless } from "@graview/guest/headless";
import { checkPresses } from "@graview/guest/headless/presses";
import { browserIsolate } from ${JSON.stringify(resolve(repoRoot, "packages/guest/src/headless/browser.ts"))};
import { ECONOMICS_MANIFEST, kit, placementApp, placementSeed } from ${JSON.stringify(fixture)};
const store = new Store({ schema: placementApp.schema, mutations: placementApp.mutations, policy: placementApp.policy, snapshot: structuredClone(placementSeed) });
const records = ${JSON.stringify(records)};
const failures = [];
const problems = [];
for (const [name, script] of Object.entries(window.VIEWS)) {
  const holder = document.createElement("section");
  holder.id = name;
  document.querySelector("main").appendChild(holder);
  mountWorkerView(holder, { manifest: { ...ECONOMICS_MANIFEST, name }, worker: { script }, store, principal: kit, input: () => ({ node: { id: records[name] } }), onFailure: (reason, detail) => failures.push([name, reason, detail]), onProblem: (said) => problems.push([name, said]) });
}
window.__host = {
  failures,
  problems,
  log: () => store.log.all().map((op) => ({ author: op.author.id, via: op.via, intent: op.intent })),
  node: (id) => ({ ...store.graph.getNode(id) }),
  /* The press check, run in this page's own worker as Better UI's is: what each control did. */
  pressCheck: async (source) => {
    const checked = new Store({ schema: placementApp.schema, mutations: placementApp.mutations, policy: placementApp.policy, snapshot: structuredClone(placementSeed) });
    const result = await runWorkerViewHeadless({ manifest: ECONOMICS_MANIFEST, source, store: checked, principal: kit, run: browserIsolate(), input: { node: { id: "placement:rhea" } }, presses: checkPresses });
    return result.ok ? { ok: result.presses.ok, controls: result.presses.controls.map((one) => [one.control, one.ok, one.says]) } : { failed: result.reason, detail: result.detail };
  },
};
window.__sources = ${JSON.stringify({ chips: CHIPS })};
`,
      resolveDir: repoRoot,
      loader: "js",
    },
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    outdir: join(out, "views"),
    entryNames: "entry",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  const viewsPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Placements</title>
<style>body{margin:0;font:16px/1.4 system-ui}#bar{position:sticky;top:0;z-index:10;height:64px;background:#fff;border-bottom:1px solid #ccc;display:flex;align-items:center;padding:0 16px}main{display:grid;gap:24px;padding:16px;max-width:720px}</style></head>
<body><header id="bar">Staffing Placement</header><main></main><script>window.VIEWS = ${JSON.stringify(scripts).replace(/<\/script/gi, "<\\/script")};</script><script type="module" src="/views/entry.js"></script></body></html>`;
  writeFileSync(join(out, "views", "index.html"), viewsPage);

  // ── the pages face: a titled view that draws its own heading ──
  const AGENDA_MANIFEST = { name: "agenda", title: "Agenda", attach: "placement", cardinality: "many", heading: "own" };
  await build({
    stdin: {
      contents: `
import { mount } from "@graview/embed";
import { registerWorkerView } from "@graview/guest/host/views";
import { kit, placementApp, placementSeed } from ${JSON.stringify(fixture)};
window.__handle = mount(document.getElementById("app"), {
  app: placementApp,
  seed: placementSeed,
  principal: kit,
  face: "pages",
  path: "/places/agenda",
  scheme: "light",
  label: "Staffing Placement",
  heading: false,
  height: "100%",
  fonts: false,
  studio: false,
  views: (schema, registry) => registerWorkerView(registry, { manifest: ${JSON.stringify(AGENDA_MANIFEST)}, worker: { source: window.AGENDA } }),
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
    outdir: join(out, "pages"),
    entryNames: "entry",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [graviewSources(repoRoot)],
    logLevel: "silent",
  });
  const pagesPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Agenda</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif}#app{position:relative;height:100vh}</style></head>
<body><div id="app"></div><script>window.AGENDA = ${JSON.stringify(AGENDA).replace(/<\/script/gi, "<\\/script")};</script><script type="module" src="/pages/entry.js"></script></body></html>`;
  writeFileSync(join(out, "pages", "index.html"), pagesPage);

  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
    if (path === "/graview/files/rhea-contract.pdf") {
      response.writeHead(200, { "content-type": "application/pdf" });
      return response.end("%PDF-1.4\n% Rhea's contract\n");
    }
    const file = join(out, path.endsWith("/") ? `${path}index.html` : path);
    try {
      const body = readFileSync(file);
      response.writeHead(200, { "content-type": file.endsWith(".js") ? "text/javascript" : "text/html" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  }).listen(HOST_PORT, "127.0.0.1");

  try {
    const context = await browser.newContext({ viewport: { width: 1024, height: 800 }, colorScheme: "light", acceptDownloads: true });
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await tab.goto(`${HOST}/views/`, { waitUntil: "load" });
    const inView = (name, selector) => tab.locator(`#${name} [data-worker-view]`).locator(selector);
    for (const name of Object.keys(codes)) await inView(name, name === "agenda" ? "#s5" : name === "contract" ? "#view-contract" : name === "columns" ? ".card" : "button").first().waitFor({ timeout: 20_000 });

    // Controls already in their state, pressed by the check in this page's own worker (Roadmap f-view-authoring-friction-2026-11).
    const chips = await tab.evaluate(() => window.__host.pressCheck(window.__sources.chips));
    const chip = (name) => chips.controls?.find(([control]) => control === name);
    claim(
      "the press check, run in the page's own worker, passes an “All” chip pressed while nothing is filtered: it is already in the state it shows (aria-pressed=\"true\")",
      chip("“All”")?.[1] === true && /already in the state it shows \(aria-pressed="true"\)/.test(chip("“All”")?.[2] ?? "") && chip("“Igneous”")?.[1] === true,
      chips,
    );
    claim("and still fails a control that shows no state and changes nothing when pressed: “Shuffle” does nothing", chips.ok === false && chip("“Shuffle”")?.[1] === false && /does nothing when pressed/.test(chip("“Shuffle”")?.[2] ?? ""), chips);
    await inView("chips", "#all").click();
    await tab.waitForTimeout(300);
    claim("pressed on the page, “All” leaves the view as it is and nothing is said of it", (await tab.evaluate(() => window.__host.problems.filter(([name]) => name === "chips").length)) === 0 && (await inView("chips", "#all").getAttribute("aria-pressed")) === "true");

    // Cards in CSS columns (Roadmap f-view-authoring-friction-2026-11).
    const columns = await tab.evaluate(() => {
      const root = document.querySelector("#columns [data-worker-view]").shadowRoot;
      const shelf = root.querySelector(".shelf");
      const cards = [...root.querySelectorAll(".card")];
      const lefts = [...new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left)))];
      return {
        sheet: root.querySelector("style[data-graview-view-style]").textContent,
        columnCount: getComputedStyle(shelf).columnCount,
        breakInside: getComputedStyle(cards[0]).breakInside,
        columns: lefts.length,
        whole: cards.every((card) => card.getClientRects().length === 1),
      };
    });
    claim(
      "a view's cards laid in CSS columns are drawn in three columns, each card kept whole in one: columns, column-gap, column-rule, column-span and break-inside are the open kit's",
      columns.columnCount === "3" && columns.breakInside === "avoid" && columns.columns === 3 && columns.whole && /break-inside: avoid/.test(columns.sheet) && /column-span: all/.test(columns.sheet),
      { ...columns, sheet: columns.sheet.slice(0, 300) },
    );

    // A blank number left out, the press landing.
    await tab.waitForFunction(() => document.querySelector("#economics [data-worker-view]")?.shadowRoot?.querySelector('input[name="fixedFee"]')?.value === "4000", null, { timeout: 10_000 });
    await inView("economics", 'input[name="fixedFee"]').fill("");
    await inView("economics", 'input[name="rate"]').fill("90");
    await inView("economics", "#save").click();
    await tab.waitForFunction(() => window.__host.log().length >= 1, null, { timeout: 5_000 }).catch(() => {});
    const omar = await tab.evaluate(() => window.__host.node("placement:omar"));
    const log = await tab.evaluate(() => window.__host.log());
    claim("a number field the person emptied is left out of the call, and Save economics lands: the rate is 90 and the fixed fee still 4 000", log.length === 1 && log[0].via === "view:economics" && omar.rate === 90 && omar.fixedFee === 4000, { log, omar });
    const quietSave = await tab.evaluate(() => document.querySelector("#economics [data-worker-view]").shadowRoot.querySelector("[data-graview-refused-note]") === null);
    claim("a press that lands is said nothing of beside it", quietSave);

    await inView("zero", "#go").click();
    await tab.waitForFunction(() => window.__host.log().length >= 2, null, { timeout: 5_000 }).catch(() => {});
    const zeroed = await tab.evaluate(() => window.__host.node("placement:omar").margin);
    claim("a 0 the view wrote into a number field is sent as the default it is, and the press lands", zeroed === 0, { margin: zeroed, log: await tab.evaluate(() => window.__host.log()) });

    // A refused press, said beside its control.
    await inView("refused", 'input[name="fixedFee"]').fill("about four thousand");
    await inView("refused", "#go").click();
    const note = await tab
      .waitForFunction(() => {
        const root = document.querySelector("#refused [data-worker-view]").shadowRoot;
        const said = root.querySelector("[data-graview-refused-note]");
        if (!said) return null;
        const button = root.querySelector("#go").getBoundingClientRect();
        const box = said.getBoundingClientRect();
        return { text: said.textContent, role: said.getAttribute("role"), below: Math.round(box.top - button.bottom), left: Math.round(box.left - button.left), shown: box.width > 0 && box.height > 0 && getComputedStyle(said).visibility !== "hidden" };
      }, null, { timeout: 5_000 })
      .then((handle) => handle.jsonValue())
      .catch(() => null);
    claim("a refused press says why beside its control, unasked: “Not applied: “fixedFee” expects a number.” under the button", note?.text === "Not applied: “fixedFee” expects a number." && note.role === "status" && note.shown && note.below >= 0 && note.below <= 12 && Math.abs(note.left) <= 8, note);
    claim("and nothing was written", (await tab.evaluate(() => window.__host.log())).length === 2);

    await inView("owned", 'input[name="fixedFee"]').fill("about four thousand");
    await inView("owned", "#go").click();
    await tab.waitForFunction(() => document.querySelector("#owned [data-worker-view]")?.shadowRoot?.querySelector("#said")?.textContent?.startsWith("The view says"), null, { timeout: 5_000 }).catch(() => {});
    const owned = await tab.evaluate(() => {
      const root = document.querySelector("#owned [data-worker-view]").shadowRoot;
      return { said: root.querySelector("#said").textContent, note: root.querySelector("[data-graview-refused-note]") !== null };
    });
    claim("a view that hears acted says the refusal itself, and the host draws no note of its own there", owned.said === "The view says: Not applied: “fixedFee” expects a number." && owned.note === false, owned);

    // A record's file.
    const files = await tab.evaluate(() => {
      const root = document.querySelector("#contract [data-worker-view]").shadowRoot;
      const of = (id) => {
        const a = root.querySelector(`#${id}`);
        return { href: a.getAttribute("href"), target: a.getAttribute("target"), download: a.getAttribute("download"), rel: a.getAttribute("rel") };
      };
      return { view: of("view-contract"), download: of("download-contract") };
    });
    claim("View the contract opens the record's file in a tab of its own, from the address the page serves it at", files.view.href === "/graview/files/rhea-contract.pdf" && files.view.target === "_blank" && files.view.download === null && files.view.rel === "noopener noreferrer", files);
    const [download] = await Promise.all([tab.waitForEvent("download", { timeout: 5_000 }).catch(() => null), inView("contract", "#download-contract").click()]);
    claim("Download it downloads the file under its own name", files.download.href === "/graview/files/rhea-contract.pdf" && files.download.download === "Rhea — contract.pdf" && download?.suggestedFilename() === "Rhea — contract.pdf", { files, suggested: download?.suggestedFilename() ?? null });

    // A jump under the host's sticky bar, and the section in sight.
    const before = await tab.evaluate(() => location.href);
    await inView("agenda", 'a[href="#s4"]').click();
    await tab.waitForTimeout(400);
    const landed = await tab.evaluate(() => {
      const region = document.querySelector("#agenda [data-worker-view]");
      const root = region.shadowRoot;
      const section = root.querySelector("#s4");
      const box = section.getBoundingClientRect();
      const bar = document.querySelector("#bar").getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + 4, box.top + 4);
      return { top: Math.round(box.top), bar: Math.round(bar.bottom), uncovered: hit === region, focused: root.activeElement?.id ?? null, href: location.href };
    });
    claim("a jump lands its section under the host's sticky bar, by its own scroll-margin-top, uncovered, with the keyboard on it", landed.top >= landed.bar + 44 && landed.top <= landed.bar + 52 && landed.uncovered && landed.focused === "s4", landed);
    claim("a jump changes nothing of the page's address", landed.href === before, { before, after: landed.href });
    const sightOf = () =>
      tab.evaluate(() => {
        const root = document.querySelector("#agenda [data-worker-view]").shadowRoot;
        return { said: root.querySelector("#said").textContent, current: [...root.querySelectorAll("a[aria-current]")].map((one) => one.getAttribute("href")), marked: [...root.querySelectorAll("[data-in-sight]")].map((one) => one.id) };
      });
    await tab.waitForFunction(() => document.querySelector("#agenda [data-worker-view]")?.shadowRoot?.querySelector("#said")?.textContent === "In sight: s4", null, { timeout: 5_000 }).catch(() => {});
    const atFour = await sightOf();
    claim("the section jumped to is the one in sight: the view hears it, and its jump says so (aria-current)", atFour.said === "In sight: s4" && JSON.stringify(atFour.current) === '["#s4"]' && JSON.stringify(atFour.marked) === '["s4"]', atFour);
    await tab.evaluate(() => {
      const two = document.querySelector("#agenda [data-worker-view]").shadowRoot.querySelector("#s2");
      window.scrollBy(0, two.getBoundingClientRect().top - 120);
    });
    await tab.waitForFunction(() => document.querySelector("#agenda [data-worker-view]")?.shadowRoot?.querySelector("#said")?.textContent === "In sight: s2", null, { timeout: 5_000 }).catch(() => {});
    const atTwo = await sightOf();
    claim("scrolling back changes the section in sight, and the view hears it", atTwo.said === "In sight: s2" && JSON.stringify(atTwo.current) === '["#s2"]', atTwo);
    claim("no view failed", (await tab.evaluate(() => window.__host.failures)).length === 0, await tab.evaluate(() => window.__host.failures));

    // ── heading own on the pages face ──
    await tab.goto(`${HOST}/pages/`, { waitUntil: "load" });
    await tab.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    await tab.waitForFunction(() => Boolean(document.querySelector('[data-worker-view="agenda"]')?.shadowRoot?.querySelector("#s5")), null, { timeout: 20_000 });
    const above = await tab.evaluate(() => {
      const title = document.querySelector("[data-graview-page-title]");
      const box = title?.getBoundingClientRect();
      return {
        title: title?.textContent ?? null,
        seen: box ? box.width > 1 && box.height > 1 : false,
        lede: document.querySelector('[data-testid="place-lede"]') !== null,
        list: document.querySelector('[data-testid="place-as-list"]') !== null,
        words: document.body.textContent.includes("as a list"),
      };
    });
    claim('on the pages face a titled view that says heading: "own" has nothing drawn above it: no title to see, no count, no list link', above.title === "Agenda" && !above.seen && !above.lede && !above.list && !above.words, above);
    await tab.locator('[data-worker-view="agenda"]').locator('a[href="#s3"]').click();
    await tab.waitForTimeout(400);
    const facing = await tab.evaluate(() => {
      const region = document.querySelector('[data-worker-view="agenda"]');
      const section = region.shadowRoot.querySelector("#s3");
      const box = section.getBoundingClientRect();
      return { top: Math.round(box.top), uncovered: document.elementFromPoint(box.left + 4, box.top + 4) === region, shown: box.top >= 0 && box.top < innerHeight / 2 };
    });
    claim("on the pages face a jump lands its section where nothing of the face's covers it", facing.uncovered && facing.shown, facing);
    await tab.waitForFunction(() => document.querySelector('[data-worker-view="agenda"]')?.shadowRoot?.querySelector("#said")?.textContent === "In sight: s3", null, { timeout: 5_000 }).catch(() => {});
    const faceSight = await tab.evaluate(() => document.querySelector('[data-worker-view="agenda"]').shadowRoot.querySelector("#said").textContent);
    claim("on the pages face the section in sight is told to the view as it scrolls", faceSight === "In sight: s3", { faceSight });
    claim("the page throws nothing", report.pageErrors.length === 0, report.pageErrors);
    await context.close();
  } finally {
    server.close();
    rmSync(out, { recursive: true, force: true });
  }
}
