/**
 * WHAT A VIEW KEEPS FOR WHOEVER IS LOOKING, IN A REAL BROWSER (Roadmap
 * f-viewer-state-and-me-framework): the mine transport of
 * `scripts/guest-sandbox.mjs`.
 *
 * A family's rocks, with two plain views in real workers. A host's
 * `ViewerState` — here a page's own, read by the harness — hands one a score
 * for its first draw with no round trip; what it keeps comes back when it is
 * drawn again; the other view, asking the same keys, reads nothing of it; a
 * value past 4 KB and a host's refusal each come back as a sentence; with no
 * host the values last the visit. And through `mount` with a seat that carries
 * a profile: `props.me` says Mia, a press on an act done as `$me` links her
 * person, made once, and history says "Mia (Nick)". Nothing a view keeps is
 * in the log or the snapshot.
 */
import { createServer } from "node:http";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { graviewSources } from "./graview-sources.mjs";

const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Rocks",
  roles: ["family"],
  kinds: {
    explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true } } },
    rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true } }, edges: { foundBy: { to: ["explorer"], description: "who found it", inverse: "what they found" } } },
  },
  acts: { "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] } },
  policy: { grants: [{ roles: ["family"], mutations: ["find-rock"] }] },
};
const SEED = {
  nodes: [
    { id: "user:nick", kind: "explorer", name: "Nick" },
    { id: "rock:quartz", kind: "rock", title: "Quartz" },
  ],
  edges: [],
};
const MANIFEST = (name) => ({ name, title: name === "quiz" ? "Quiz" : "Other", attach: "rock", cardinality: "many", acts: ["find-rock"] });

/* One view, whichever its name: it draws what it was handed, and its buttons ask. */
const VIEW = `
let said = "";
const draw = (props) => graview.render(graview.html\`<div data-root="">
  <p id="score">\${props.mine.score ?? "none"}</p>
  <p id="me">\${props.me?.name ?? "nobody"}</p>
  <p id="said">\${said}</p>
  <button id="keep">Keep</button>
  <button id="big">Big</button>
  <button id="read">Read</button>
  <button id="wipe">Wipe</button>
  <button id="found" data-act="find-rock" data-record="rock:quartz">Found</button>
</div>\`);
graview.onProps(draw);
const tell = (words) => { said = words; draw(graview.props); };
graview.on("click", "#keep", () => graview.mine.set("score", "9").then(() => tell("kept"), (refused) => tell(refused.message)));
graview.on("click", "#big", () => graview.mine.set("score", "x".repeat(5000)).then(() => tell("kept"), (refused) => tell(refused.message)));
graview.on("click", "#wipe", () => graview.mine.set("score", "wiped").then(() => tell("wiped"), (refused) => tell(refused.message)));
graview.on("click", "#read", () => graview.mine.get("score").then((value) => tell(String(value))));
`;

export async function mineSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT }) {
  const out = mkdtempSync(join(tmpdir(), "graview-guest-mine-"));
  await build({
    stdin: {
      contents: `
import { mount } from "@graview/embed";
import { memoryViews, Store, withMemoryRevisions } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { ticksOf, makerWords } from "@graview/core/history";
import { mountWorkerView } from "@graview/guest/host/worker";
import { registerWorkerView } from "@graview/guest/host/views";
const asked = new URLSearchParams(location.search);
const compiled = compileDocument(${JSON.stringify(DOCUMENT)});
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app;
const seed = ${JSON.stringify(SEED)};
const nick = { kind: "human", id: "user:nick", name: "Nick", roles: ["family"] };
const mia = { ...nick, profile: { id: "prf_mia", name: "Mia" } };
/* The host's store of what views keep, seeded with a score for the quiz and a secret for another view. */
const kept = new Map([["quiz", new Map([["score", "3"]])], ["gradebook", new Map([["score", "A+"]])]]);
const calls = [];
const viewerState = {
  async read(view) {
    calls.push(["read", view]);
    return Object.fromEntries(kept.get(view) ?? []);
  },
  async write(view, key, value) {
    calls.push(["write", view, key]);
    if (window.__refuse) return { ok: false, sentence: window.__refuse };
    /* A host slow on the next write alone, and it writes what it was handed when it gets there. */
    const slow = window.__slowOnce;
    window.__slowOnce = 0;
    if (slow) await new Promise((resolve) => setTimeout(resolve, slow));
    const values = kept.get(view) ?? new Map();
    kept.set(view, values);
    if (value === null) values.delete(key);
    else values.set(key, value);
    return { ok: true };
  },
};
window.__kept = () => Object.fromEntries([...kept].map(([view, values]) => [view, Object.fromEntries(values)]));
window.__calls = calls;
window.__problems = [];
const source = window.VIEW;
if (asked.get("mode") === "fork") {
  /* A page's own view, proposed and not kept (Make this better on a built-in page): drawn in the page's place, as a host's views say it. */
  const store = new Store({ schema: app.schema, mutations: app.mutations, policy: app.policy, snapshot: structuredClone(seed) });
  kept.set("rock-page", new Map([["score", "3"]]));
  const views = withMemoryRevisions(memoryViews());
  const fork = { manifest: { name: "rock-page", title: "Rocks", attach: "rock", cardinality: "many", replaces: "page", acts: ["find-rock"] }, source, from: { page: "list", kind: "rock" }, said: "" };
  views.draftFork(fork);
  window.__keep = () => views.fork(fork);
  window.__handle = mount(document.getElementById("app"), {
    app, store, principal: nick, viewerState, keptViews: views,
    face: "pages", path: "/rocks", scheme: "light", label: "Rocks", heading: false, height: "100%", fonts: false, studio: false,
  });
  window.__handle.drawn().then(() => { window.__ready = true; });
} else if (asked.get("mode") === "embed") {
  const store = new Store({ schema: app.schema, mutations: app.mutations, policy: app.policy, snapshot: structuredClone(seed) });
  window.__store = store;
  window.__said = () => {
    const where = { graph: store.graph, schema: store.schema };
    return ticksOf(store, { me: nick }).map((tick) => makerWords(tick, where));
  };
  window.__handle = mount(document.getElementById("app"), {
    app, store, principal: mia, viewerState,
    face: "pages", path: "/places/quiz", scheme: "light", label: "Rocks", heading: false, height: "100%", fonts: false, studio: false,
    views: (schema, registry) => registerWorkerView(registry, { manifest: ${JSON.stringify(MANIFEST("quiz"))}, worker: { source } }),
  });
  window.__handle.drawn().then(() => { window.__ready = true; });
} else {
  const store = new Store({ schema: app.schema, mutations: app.mutations, policy: app.policy, snapshot: structuredClone(seed) });
  window.__store = store;
  const mounted = {};
  const hosted = asked.get("host") !== "none";
  window.__mount = (name, as = nick) => {
    mounted[name]?.dispose();
    const holder = document.getElementById(name) ?? Object.assign(document.createElement("section"), { id: name });
    document.querySelector("main").appendChild(holder);
    mounted[name] = mountWorkerView(holder, { manifest: { name, title: name, attach: "rock", cardinality: "many", acts: ["find-rock"] }, worker: { source }, store, principal: as, ...(hosted ? { viewerState: () => viewerState } : {}), onProblem: (said) => window.__problems.push(said) });
  };
  window.__mount("quiz");
  window.__mount("other");
  window.__draft = () => {
    const holder = document.getElementById("draft") ?? Object.assign(document.createElement("section"), { id: "draft" });
    document.querySelector("main").appendChild(holder);
    window.__drafted?.dispose();
    window.__drafted = mountWorkerView(holder, { manifest: { name: "quiz", title: "quiz", attach: "rock", cardinality: "many", acts: ["find-rock"] }, worker: { source }, store, principal: nick, draft: true });
  };
  window.__ready = true;
}
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
  const json = (value) => JSON.stringify(value).replace(/<\/script/gi, "<\\/script");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>What a view keeps</title></head><body><main></main><div id="app" style="height:90vh"></div><script>window.VIEW = ${json(VIEW)};</script><script type="module" src="/entry.js"></script></body></html>`;
  const server = createServer((request, response) => {
    const path = new URL(request.url, HOST).pathname;
    if (path === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      return response.end(html);
    }
    try {
      const body = readFileSync(join(out, path));
      response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" });
      return response.end(body);
    } catch {
      response.writeHead(404);
      return response.end();
    }
  }).listen(HOST_PORT, "127.0.0.1");

  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    const open = async (query) => {
      await tab.goto(`${HOST}/?${query}`, { waitUntil: "load" });
      await tab.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    };
    const view = (name) => tab.locator(`[data-worker-view="${name}"]`);
    const text = (name, id) => view(name).locator(`#${id}`).textContent({ timeout: 15_000 });
    const until = (name, id, wanted) =>
      tab
        .waitForFunction(([one, at, value]) => document.querySelector(`[data-worker-view="${one}"]`)?.shadowRoot?.querySelector(`#${at}`)?.textContent === value, [name, id, wanted], { timeout: 8_000 })
        .catch(() => {});

    /* ── a host's ViewerState ── */
    await open("mode=direct");
    const first = await text("quiz", "score");
    const asks = await tab.evaluate(() => window.__calls.map((one) => one.join(" ")));
    claim("a view's first draw has what it keeps, from one read of its own name and no ask of its own", first === "3" && asks.includes("read quiz") && !asks.some((one) => one.startsWith("write")), { first, asks });

    const elsewhere = await text("other", "score");
    await view("other").locator("#read").click();
    await until("other", "said", "null");
    const asked = await text("other", "said");
    const reads = await tab.evaluate(() => window.__calls.filter((one) => one[0] === "read").map((one) => one[1]));
    claim("a view reads only its own values: another view asking the same key reads nothing, and nobody reads the gradebook's", elsewhere === "none" && asked === "null" && !reads.includes("gradebook"), { elsewhere, asked, reads });

    await view("quiz").locator("#keep").click();
    await until("quiz", "said", "kept");
    const after = await tab.evaluate(() => window.__kept());
    await tab.evaluate(() => window.__mount("quiz"));
    await until("quiz", "score", "9");
    const again = await text("quiz", "score");
    claim("what a view keeps goes to the host by the view's name, and is there at draw time when it is drawn again", after.quiz?.score === "9" && after.other === undefined && after.gradebook?.score === "A+" && again === "9", { after, again });

    await view("quiz").locator("#big").click();
    await until("quiz", "said", "A kept value is at most 4 KB, and this one is longer, so it was not kept.");
    const big = await text("quiz", "said");
    const bigKept = await tab.evaluate(() => window.__kept().quiz.score);
    const problems = await tab.evaluate(() => window.__problems);
    claim("a value past 4 KB is refused in a sentence the view hears and the host's problems are told, and what stood stands", /4 KB/.test(big) && bigKept === "9" && problems.some((one) => /4 KB/.test(one)) && !problems.some((one) => one.includes("xxxx")), { big, bigKept, problems });

    /* ── drawn again with a write on its way ── */
    await tab.evaluate(() => (window.__slowOnce = 400));
    await view("quiz").locator("#wipe").click();
    await tab.evaluate(() => window.__mount("quiz"));
    await until("quiz", "keep", "Keep");
    const heardBefore = await text("quiz", "score");
    await until("quiz", "score", "wiped");
    const heard = await text("quiz", "score");
    claim("a view drawn again with a write on its way hears the value when it lands", heardBefore === "9" && heard === "wiped", { heardBefore, heard });
    await tab.evaluate(() => (window.__slowOnce = 400));
    await view("quiz").locator("#wipe").click();
    await tab.evaluate(() => window.__mount("quiz"));
    await until("quiz", "keep", "Keep");
    await view("quiz").locator("#keep").click();
    await until("quiz", "said", "kept");
    await tab.waitForTimeout(500);
    const held = await tab.evaluate(() => window.__kept().quiz.score);
    claim("a view drawn again with a write on its way cannot have it land over the next drawing's", held === "9" && (await text("quiz", "said")) === "kept", { held });
    await tab.evaluate(() => window.__mount("quiz"));
    await until("quiz", "score", "9");

    await tab.evaluate(() => (window.__refuse = "This app keeps 64 KB for you, and that is full."));
    await view("quiz").locator("#keep").click();
    await until("quiz", "said", "This app keeps 64 KB for you, and that is full.");
    claim("a host's refusal reaches the view as the host's own sentence", (await text("quiz", "said")) === "This app keeps 64 KB for you, and that is full.");

    const untouched = await tab.evaluate(() => ({ log: window.__store.log.length, snapshot: JSON.stringify(window.__store.snapshot()) }));
    claim("what a view keeps is in no op and no snapshot", untouched.log === 0 && !untouched.snapshot.includes('"score"'), untouched);

    /* ── no host: for the visit ── */
    await open("mode=direct&host=none");
    const fresh = await text("quiz", "score");
    await view("quiz").locator("#keep").click();
    await until("quiz", "said", "kept");
    await tab.evaluate(() => window.__mount("quiz"));
    await until("quiz", "score", "9");
    const visited = await text("quiz", "score");
    const other = await text("other", "score");
    await tab.evaluate(() => window.__draft());
    const inDraft = (id) => tab.evaluate((at) => document.querySelector("#draft [data-worker-view]")?.shadowRoot?.querySelector(`#${at}`)?.textContent, id);
    await tab.waitForFunction(() => document.querySelector("#draft [data-worker-view]")?.shadowRoot?.querySelector("#wipe"), null, { timeout: 15_000 });
    const draftSaw = await inDraft("score");
    await tab.locator("#draft [data-worker-view]").locator("#wipe").click();
    await tab.waitForFunction(() => document.querySelector("#draft [data-worker-view]")?.shadowRoot?.querySelector("#said")?.textContent === "wiped", null, { timeout: 8_000 }).catch(() => {});
    /* Gone before the real view is read: both are drawn under one name. */
    await tab.evaluate(() => {
      window.__drafted.dispose();
      window.__mount("quiz");
    });
    await until("quiz", "score", "9");
    const keptThrough = await text("quiz", "score");
    claim("a draft with no host reads nothing the real view keeps, and what it writes never reaches the real view", draftSaw === "none" && keptThrough === "9", { draftSaw, keptThrough });

    /* A seat whose id holds a `~` has no `$me`, and is still nobody else: it does not share a visit with a seat with no id. */
    await open("mode=direct&host=none");
    await tab.evaluate(() => window.__mount("quiz", { kind: "human", id: "user:a~b", roles: ["family"] }));
    await until("quiz", "said", "");
    await view("quiz").locator("#keep").click();
    await until("quiz", "said", "kept");
    await tab.evaluate(() => window.__mount("quiz", { kind: "human", roles: ["family"] }));
    await tab.waitForTimeout(400);
    await until("quiz", "score", "none");
    const noId = await text("quiz", "score");
    claim("a seat whose id holds a ~ does not share what it keeps with a seat that has no id", noId === "none", { noId });

    await open("mode=direct&host=none");
    const reloaded = await text("quiz", "score");
    const stored = await tab.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    claim("with no host, a view's values last the visit, per view, and are gone with the page, in no browser storage", fresh === "none" && visited === "9" && other === "none" && reloaded === "none" && !stored.includes("score"), { fresh, visited, other, reloaded, stored });

    /* ── a page's own view, drafted, with the host's ViewerState ── */
    await open("mode=fork");
    await until("rock-page", "wipe", "Wipe");
    const forkSaw = await text("rock-page", "score");
    await view("rock-page").locator("#wipe").click();
    await until("rock-page", "said", "wiped");
    const forkSaid = await text("rock-page", "said");
    const hostAfterFork = await tab.evaluate(() => window.__kept()["rock-page"]);
    const forkWrites = await tab.evaluate(() => window.__calls.filter((one) => one[1] === "rock-page"));
    claim("a page's own view, drafted and not kept, reads nothing the host keeps and writes nothing to it", forkSaw === "none" && forkSaid === "wiped" && hostAfterFork?.score === "3" && forkWrites.length === 0, { forkSaw, forkSaid, hostAfterFork, forkWrites });
    await tab.evaluate(() => window.__keep());
    await until("rock-page", "score", "3");
    claim("kept, the same view reads what the host keeps for it", (await text("rock-page", "score")) === "3", await tab.evaluate(() => window.__calls.filter((one) => one[1] === "rock-page")));

    /* ── a seat with a profile, through mount, with the host's ViewerState ── */
    await open("mode=embed");
    await until("quiz", "me", "Mia");
    const seat = { me: await text("quiz", "me"), score: await text("quiz", "score") };
    claim("through mount, a view drawn for a seat with a profile is told who is looking, and hands what it keeps from the host", seat.me === "Mia" && seat.score === "3", seat);

    const beforePress = await tab.evaluate(() => window.__store.graph.getNode("user:nick~prf_mia") !== undefined);
    await view("quiz").locator("#found").click();
    await tab.waitForFunction(() => window.__store.log.length > 0, null, { timeout: 8_000 }).catch(() => {});
    const made = await tab.evaluate(() => ({
      node: window.__store.graph.getNode("user:nick~prf_mia"),
      links: window.__store.graph.out("rock:quartz", "foundBy").map((one) => one.id),
      said: window.__said(),
      makes: window.__store.log.all().filter((op) => op.primitives.some((one) => one.op === "add-node")).length,
    }));
    claim("a press on an act done as $me links the profile's person, made once on that first use, and history says Mia (Nick)", !beforePress && made.node?.name === "Mia" && made.links.join() === "user:nick~prf_mia" && made.makes === 1 && made.said.join() === "Mia (Nick)", { beforePress, made });
    await context.close();
  } finally {
    server.close();
  }
}
