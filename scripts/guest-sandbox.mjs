#!/usr/bin/env node
/**
 * A GUEST VIEW IN A REAL BROWSER (FR-04, FR-68): what the sandbox, the
 * origin check and the nonce hold when the guest is hostile and the place
 * it runs is real — a frame, or a worker inside a chat's widget.
 *
 * One suite, two transports. Bethan, a shopper who may see the cars and
 * herself, is shown two guest views: an honest card written with the SDK,
 * and a hostile one. The claims that are about the protocol — what she is
 * shown, whose act an act is, the allowance, the nonce, where navigation
 * goes — are the same for both, by the same names. Each transport adds
 * what is its own:
 *
 *   frame   an iframe sandboxed to scripts alone, on its own origin; the
 *           hostile guest reads the host's cookie and storage, reaches into
 *           the parent, navigates the top window, opens a popup and fetches
 *           the host's API.
 *   worker  a classic worker the host starts from a blob: URL, inside a
 *           chat's widget framed the way Claude or ChatGPT frames one
 *           (scripts/lib/widget-policies.mjs, from Graview Cloud's spike);
 *           the guest draws the component kit, and the viewer's press on
 *           what it drew is what asks for the act.
 *
 * Two origins — the host on one, the guests or the widget's sandbox on the
 * other — on ports `scripts/lib/ports.mjs` names, so nothing here borrows a
 * dev server. Every claim is written to docs/guest-sandbox[-worker-<policy>][-<engine>].json.
 *
 *   node scripts/guest-sandbox.mjs                       every transport, policy and engine, one after another
 *   node scripts/guest-sandbox.mjs --transport=frame --engine=webkit
 *   node scripts/guest-sandbox.mjs --transport=worker --policy=claude --engine=chromium
 *
 * Needs `pnpm build` (it bundles packages/guest/dist and packages/core/dist).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { portFor } from "./lib/ports.mjs";
import { localize, POLICIES, proxyPage } from "./lib/widget-policies.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(repoRoot, "package.json"));
const { build } = require("esbuild");
const playwright = require("playwright");

const arg = (name) => process.argv.find((one) => one.startsWith(`--${name}=`))?.slice(name.length + 3);

/* Every transport, policy and engine, each in its own process: they share the two ports. */
if (!arg("transport") && !arg("engine") && !arg("policy")) {
  /* `--quick` (GRAVIEW_QUICK): one engine per transport and policy, crossed so both engines still run. */
  const runs = process.env.GRAVIEW_QUICK
    ? [["--transport=frame", "--engine=chromium"], ["--transport=worker", "--policy=claude", "--engine=chromium"], ["--transport=worker", "--policy=chatgpt", "--engine=webkit"]]
    : [
        ...["chromium", "webkit", "firefox"].map((engine) => ["--transport=frame", `--engine=${engine}`]),
        ...["claude", "chatgpt"].flatMap((policy) => ["chromium", "webkit"].map((engine) => ["--transport=worker", `--policy=${policy}`, `--engine=${engine}`])),
      ];
  let failed = 0;
  for (const run of runs) {
    process.stdout.write(`\n— ${run.join(" ")}\n`);
    const { status } = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...run], { stdio: "inherit", cwd: repoRoot });
    if (status !== 0) failed += 1;
  }
  process.stdout.write(`\n${failed === 0 ? "ok  " : "FAIL"} ${runs.length - failed} of ${runs.length} runs hold\n`);
  process.exit(failed === 0 ? 0 : 1);
}

const TRANSPORT = arg("transport") ?? "frame";
const ENGINE = arg("engine") ?? "chromium";
const POLICY = arg("policy") ?? "claude";
if (!["frame", "worker"].includes(TRANSPORT)) throw new Error(`--transport is frame or worker, not ${TRANSPORT}`);
if (TRANSPORT === "worker" && !POLICIES[POLICY]) throw new Error(`--policy is one of ${Object.keys(POLICIES).join(", ")}, not ${POLICY}`);
const HOST_PORT = portFor("guest-host");
const GUEST_PORT = portFor("guest-sandbox");
const HOST = `http://127.0.0.1:${HOST_PORT}`;
const GUEST = `http://localhost:${GUEST_PORT}`;
const VERDICT = `docs/guest-sandbox${TRANSPORT === "worker" ? `-worker-${POLICY}` : ""}${ENGINE === "chromium" ? "" : `-${ENGINE}`}.json`;

const bundle = async (contents, format = "esm") =>
  (
    await build({
      stdin: { contents, resolveDir: repoRoot, loader: "ts" },
      bundle: true,
      format,
      write: false,
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
      define: { "process.env.NODE_ENV": '"production"' },
    })
  ).outputFiles[0].text;

/** Bethan's showroom: anyone sees the cars, staff see everybody, a shopper sees herself and what is hers. */
const SHOWROOM = `
import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "./packages/core/dist/index.js";
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const shopper = defineNode("shopper", { fields: z.object({ label: z.string(), email: z.string() }), plural: "Shoppers" });
const enquiry = defineNode("enquiry", { fields: z.object({ label: z.string() }), plural: "Enquiries",
  edges: { from: { to: ["shopper"], cardinality: "one" }, about: { to: ["car"] } } });
const schema = createSchema([car, shopper, enquiry]);
const { defineMutation } = bindSchema(schema);
const ask = defineMutation("ask", { title: "Ask", subject: { kinds: ["shopper"], arg: "shopperId" }, creates: ["enquiry"],
  input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
  describe: (args) => "Ask " + args.label,
  apply(ctx, args) { const id = ctx.freshId(args.label, "enquiry"); ctx.addNode({ id, kind: "enquiry", label: args.label }); ctx.addEdge({ kind: "from", from: id, to: args.shopperId }); } });
const retire = defineMutation("retire-car", { title: "Retire a car", subject: { kinds: ["car"], arg: "carId" },
  input: z.object({ carId: nodeRef(["car"]) }), apply(ctx, args) { ctx.removeNode(args.carId); } });
const store = new Store({ schema, mutations: [ask, retire],
  policy: { grants: [{ roles: ["shopper"], mutations: ["ask"], self: true }, { roles: ["staff"], mutations: "*" }],
    sees: [{ roles: "*", kinds: ["car"] }, { roles: ["staff"], kinds: ["shopper", "enquiry"] }, { roles: ["shopper"], kinds: ["shopper", "enquiry"], own: true }] },
  snapshot: { nodes: [
    { id: "car:golf", kind: "car", label: "Golf" },
    { id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo", email: "bethan@mail.example" },
    { id: "shopper:freya", kind: "shopper", label: "Freya Davies", email: "freya@mail.example" },
    { id: "enquiry:1", kind: "enquiry", label: "Finance on the Golf" } ],
    edges: [{ kind: "from", from: "enquiry:1", to: "shopper:freya" }, { kind: "about", from: "enquiry:1", to: "car:golf" }] } });
const bethan = { kind: "human", id: "shopper:bethan", roles: ["shopper"], token: "sk-host-session" };
const all = () => ({ nodes: store.graph.allNodes().map(({ id }) => ({ id })), implicated: ["shopper:freya", "car:golf"] });
const went = [];
const host = {
  log: () => store.log.all().map((op) => ({ author: op.author.id, via: op.via, intent: op.intent })),
  ids: () => store.graph.allNodes().map((node) => node.id).sort(),
  went,
};
`;

const secretHits = [];
const report = { at: new Date().toISOString(), transport: TRANSPORT, engine: ENGINE, ...(TRANSPORT === "worker" ? { policy: POLICIES[POLICY].label } : {}), claims: {}, pageErrors: [] };
const claim = (name, ok, detail) => {
  report.claims[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) };
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — ${JSON.stringify(detail)}`}\n`);
};
const unseen = ["shopper:freya", "Freya Davies", "freya@mail.example", "enquiry:1", "Finance on the Golf", "sk-host"];

/**
 * THE CLAIMS BOTH TRANSPORTS HOLD, by the same names: what the card was
 * shown, whose its acts were, what the hostile guest's forgeries and flood
 * came to, and where navigation went.
 */
function protocolClaims({ seen, answers, wire, log, heard, stats, went }) {
  claim("the card was shown the cars and Bethan, and nobody else", seen.length > 0 && JSON.stringify(seen[0].nodes.map((n) => n.id)) === JSON.stringify(["car:golf", "shopper:bethan"]), seen[0]?.nodes);
  claim("nothing a guest received names what Bethan may not see, or a secret of the host's", unseen.every((word) => !wire.includes(word)), unseen.filter((word) => wire.includes(word)));
  claim("the card's own act was applied", answers[0]?.ok === true, answers[0]);
  /*
   * Refused as the policy refuses anybody: in words that name only what she
   * may see (FR-55), so the refusal does not tell her Freya is there.
   */
  claim("an act on a record she may not see was refused, in words that do not name it", answers[1]?.ok === false && answers[1].reason === "refused" && !/freya/i.test(answers[1].message), answers[1]);
  claim("an act her roles do not grant was refused", answers[2]?.ok === false && answers[2].reason === "refused", answers[2]);
  claim("every applied act is Bethan's, through the view that asked", log.length > 0 && log.every((op) => op.author === "shopper:bethan" && (op.via === "view:card" || op.via === "view:hostile")), log);
  claim("the card's act is in the log as Bethan's, via view:card", log.some((op) => op.via === "view:card" && op.intent === "Ask Is the Golf still there?"), log);
  claim("a forged act, posted outside the port, changed nothing", !log.some((op) => op.intent === "Ask Forged"), log);
  const hostileOps = log.filter((op) => op.via === "view:hostile");
  // Five acts in the allowance: the one refused for naming Freya spent one, so four of the flood landed.
  claim("a flood of acts was applied no further than the frame's allowance of five", hostileOps.length === 4 && heard.some((one) => one.id === "unseen" && one.reason === "refused"), { applied: hostileOps.length, stats });
  const limited = heard.filter((one) => !one.ok && one.reason === "rate-limited").length;
  claim("the rest of the flood was answered rate-limited or dropped unread past the message allowance", limited > 0 && limited + stats.hostile.dropped >= 196, { limited, stats });
  claim("navigation went only to what Bethan may see", JSON.stringify(went) === JSON.stringify(["car:golf"]), went);
}

const browser = await playwright[ENGINE].launch();
let servers = [];
try {
  if (TRANSPORT === "frame") await frameSuite();
  else await workerSuite();
} finally {
  await browser.close();
  for (const server of servers) server.close();
}
report.passed = Object.values(report.claims).every((one) => one.ok);
writeFileSync(resolve(repoRoot, VERDICT), `${JSON.stringify(report, null, 2)}\n`);
process.exit(report.passed ? 0 : 1);

// ── the frame ────────────────────────────────────────────────────────────────

async function frameSuite() {
  const hostJs = await bundle(`
import { mountGuestView } from "./packages/guest/dist/host/index.js";
${SHOWROOM}
localStorage.setItem("host-secret", "sk-host-storage");
const frames = {
  card: mountGuestView(document.getElementById("card"), { url: "${GUEST}/card.html", view: "card", store, principal: bethan, input: all, onNavigate: (id) => went.push(id) }),
  hostile: mountGuestView(document.getElementById("hostile"), { url: "${GUEST}/hostile.html", view: "hostile", store, principal: bethan, input: all, limits: { acts: 5 }, onNavigate: (id) => went.push(id) }),
  bare: mountGuestView(document.getElementById("bare"), { url: "${GUEST}/bare.html", view: "bare", store, principal: bethan }),
};
window.__host = {
  ...host,
  stats: () => ({ card: { ...frames.card.stats }, hostile: { ...frames.hostile.stats }, bare: { ...frames.bare.stats } }),
  sandbox: () => [...document.querySelectorAll("iframe")].map((frame) => frame.getAttribute("sandbox")),
};
`);
  const sdkJs = await bundle(`export * from "./packages/guest/dist/index.js";`);

  /* The honest card: the SDK, the props, one act of hers and one that is not. */
  const cardJs = `
import { connectGuest } from "./sdk.js";
const guest = connectGuest();
window.__seen = [];
window.__answers = [];
guest.subscribe((props) => {
  window.__seen.push(props);
  document.body.textContent = (props.nodes || []).map((n) => n.label).join(", ");
});
await new Promise((r) => guest.subscribe(r));
window.__answers.push(await guest.act("ask", { shopperId: "shopper:bethan", label: "Is the Golf still there?" }));
window.__answers.push(await guest.act("ask", { shopperId: "shopper:freya", label: "Sneak" }));
window.__answers.push(await guest.act("retire-car", { carId: "car:golf" }));
guest.navigate("shopper:freya");
guest.navigate("car:golf");
window.__done = true;
`;

  /* The hostile one, by hand: everything a guest should not be able to do. */
  const hostileJs = `
const tried = {};
const attempt = async (name, fn) => { try { tried[name] = { ok: true, value: String(await fn()) }; } catch (e) { tried[name] = { ok: false, error: String(e && e.name || e) }; } };
window.__tried = tried;
window.__heard = [];
await attempt("origin", () => self.origin);
await attempt("cookie", () => document.cookie);
await attempt("localStorage", () => localStorage.getItem("host-secret"));
await attempt("parentDocument", () => parent.document.cookie);
await attempt("parentHost", () => JSON.stringify(parent.__host.ids()));
await attempt("popup", () => { const w = window.open("${HOST}/popup"); return w === null ? "null" : "opened"; });
await attempt("fetch", async () => (await fetch("${HOST}/secret?from=hostile", { credentials: "include" })).text());
await attempt("topNavigation", () => { top.location.href = "${HOST}/pwned"; return "assigned"; });
// Forged: an act straight to the parent window, and a ready flood.
parent.postMessage({ type: "act", nonce: "guess", id: 1, name: "ask", args: { shopperId: "shopper:bethan", label: "Forged" } }, "*");
const port = await new Promise((resolve) => {
  addEventListener("message", (e) => { if (e.data && e.data.graview === "host-hello") resolve({ port: e.ports[0], nonce: e.data.nonce }); });
  parent.postMessage({ graview: "guest-ready", protocol: 1 }, "*");
});
port.port.onmessage = (e) => window.__heard.push(e.data);
port.port.postMessage({ type: "act", nonce: "not-the-nonce", id: "wrong", name: "ask", args: { shopperId: "shopper:bethan", label: "Wrong nonce" } });
port.port.postMessage({ type: "act", nonce: port.nonce, id: "unseen", name: "ask", args: { shopperId: "shopper:freya", label: "Unseen" } });
for (let i = 0; i < 200; i += 1) port.port.postMessage({ type: "act", nonce: port.nonce, id: i, name: "ask", args: { shopperId: "shopper:bethan", label: "Flood " + i } });
await new Promise((r) => setTimeout(r, 1500));
window.__done = true;
`;

  /* No CSP on this one: only the sandbox stands between it and the host's API. */
  const bareJs = `
window.__tried = {};
try { window.__tried.fetch = { ok: true, value: await (await fetch("${HOST}/secret?from=bare", { credentials: "include" })).text() }; }
catch (e) { window.__tried.fetch = { ok: false, error: String(e && e.name || e) }; }
window.__done = true;
`;

  const page = (body, script) => `<!doctype html><html><head><meta charset="utf-8"><title>${body}</title></head><body>${body}<script type="module">${script}</script></body></html>`;
  const hostHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Host</title></head><body><main><div id="card"></div><div id="hostile"></div><div id="bare"></div></main><script type="module" src="/host.js"></script></body></html>`;

  servers = [
    createServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "content-type": "text/html", "set-cookie": "session=sk-host-cookie; Path=/" });
        return res.end(hostHtml);
      }
      if (req.url === "/host.js") {
        res.writeHead(200, { "content-type": "text/javascript" });
        return res.end(hostJs);
      }
      if (req.url.startsWith("/secret")) {
        secretHits.push({ from: new URL(req.url, HOST).searchParams.get("from"), cookie: req.headers.cookie ?? null, origin: req.headers.origin ?? null });
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end("sk-host-api-secret");
      }
      res.writeHead(404);
      res.end();
    }).listen(HOST_PORT, "127.0.0.1"),
    createServer((req, res) => {
      /*
       * The card and the hostile guest are served as the protocol assumes, with
       * connect-src 'none'. The bare one has no CSP at all, so what holds there
       * is the sandbox's alone.
       */
      const type = req.url.endsWith(".js") ? "text/javascript" : "text/html";
      const body = { "/card.html": page("card", cardJs), "/hostile.html": page("hostile", hostileJs), "/bare.html": page("bare", bareJs), "/sdk.js": sdkJs }[req.url];
      if (!body) {
        res.writeHead(404);
        return res.end();
      }
      const csp = req.url === "/bare.html" ? {} : { "content-security-policy": "connect-src 'none'" };
      res.writeHead(200, { "content-type": type, "access-control-allow-origin": "*", ...csp });
      res.end(body);
    }).listen(GUEST_PORT, "localhost"),
  ];

  const context = await browser.newContext();
  const tab = await context.newPage();
  tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  const popups = [];
  context.on("page", (opened) => opened !== tab && popups.push(opened.url()));
  await tab.goto(`${HOST}/`, { waitUntil: "load" });
  const guestFrame = async (name) => {
    for (let i = 0; i < 100; i += 1) {
      const found = tab.frames().find((one) => one.url().endsWith(`/${name}.html`));
      if (found && (await found.evaluate(() => window.__done === true).catch(() => false))) return found;
      await tab.waitForTimeout(100);
    }
    throw new Error(`${name} never finished`);
  };
  const card = await guestFrame("card");
  const hostile = await guestFrame("hostile");
  const bare = await guestFrame("bare");
  await tab.waitForTimeout(300);

  const sandbox = await tab.evaluate(() => window.__host.sandbox());
  claim("every guest frame is sandboxed to scripts alone", sandbox.length === 3 && sandbox.every((one) => one === "allow-scripts"), sandbox);

  const seen = await card.evaluate(() => window.__seen);
  const heardAll = await hostile.evaluate(() => window.__heard);
  const log = await tab.evaluate(() => window.__host.log());
  const stats = await tab.evaluate(() => window.__host.stats());
  protocolClaims({
    seen,
    answers: await card.evaluate(() => window.__answers),
    wire: JSON.stringify(seen) + JSON.stringify(heardAll),
    log,
    heard: heardAll.filter((one) => one.type === "answer"),
    stats,
    went: await tab.evaluate(() => window.__host.went),
  });

  const tried = await hostile.evaluate(() => window.__tried);
  claim("the guest's origin is opaque", tried.origin.ok && tried.origin.value === "null", tried.origin);
  claim("the guest cannot read a cookie", !tried.cookie.ok || !tried.cookie.value.includes("sk-host"), tried.cookie);
  claim("the guest cannot read the host's storage", !tried.localStorage.ok || tried.localStorage.value !== "sk-host-storage", tried.localStorage);
  claim("the guest cannot reach into the parent's document", !tried.parentDocument.ok, tried.parentDocument);
  claim("the guest cannot reach the parent's store", !tried.parentHost.ok, tried.parentHost);
  claim("the guest cannot open a popup", popups.length === 0 && (!tried.popup.ok || tried.popup.value === "null"), { tried: tried.popup, popups });
  claim("the guest cannot navigate the top window", tab.url() === `${HOST}/` && !tried.topNavigation.ok, { url: tab.url(), tried: tried.topNavigation });
  claim("a guest served with connect-src 'none' never reaches the host's API", !tried.fetch.ok && !secretHits.some((hit) => hit.from === "hostile"), { tried: tried.fetch, hits: secretHits });
  const bareTried = await bare.evaluate(() => window.__tried.fetch);
  claim("a guest served with no CSP at all still reads nothing from the host's API", !bareTried.ok, bareTried);
  /*
   * Not a claim, a finding: whether that request carried the host's
   * SameSite-less cookie. A host whose session rides a cookie sets it
   * SameSite=Lax or Strict, or serves guests with connect-src 'none'.
   */
  report.findings = { cookieOnAFetchWithNoCsp: secretHits.filter((hit) => hit.from === "bare").map((hit) => hit.cookie !== null) };
  claim("an act with the wrong nonce changed nothing and was not answered", !log.some((op) => op.intent === "Ask Wrong nonce") && !heardAll.some((one) => one.id === "wrong"));
  /* What the hostile guest's own attempts make an engine say is theirs; the host page itself throws nothing. */
  const hosts = report.pageErrors.filter((error) => !/secret|navigat|Content Security Policy|access control/i.test(error));
  claim("the host page throws nothing", hosts.length === 0, report.pageErrors);
  report.stats = stats;
}

// ── the worker, in a chat's widget ───────────────────────────────────────────

async function workerSuite() {
  const policy = POLICIES[POLICY];
  /* A guest bundle as a classic script: the worker entry first, then the guest. */
  const guestBundle = (contents) =>
    build({
      stdin: { contents, resolveDir: repoRoot, loader: "js" },
      bundle: true,
      format: "iife",
      write: false,
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
      alias: { "@graview/guest/worker": resolve(repoRoot, "packages/guest/dist/worker/index.js") },
    }).then((out) => out.outputFiles[0].text);

  /* The honest card: its kit, the props, and a button whose press asks for one act of hers and two that are not. */
  const cardJs = await guestBundle(`
import { connectGuest } from "@graview/guest/worker";
const guest = connectGuest();
const seen = [];
const answers = [];
const draw = () => {
  const props = guest.props;
  const card = document.createElement("gv-card");
  for (const node of (props && props.nodes) || []) {
    const title = document.createElement("gv-title");
    title.textContent = node.label;
    card.append(title);
  }
  const ask = document.createElement("gv-button");
  ask.textContent = "Ask about the Golf";
  ask.addEventListener("press", async () => {
    answers.push(await guest.act("ask", { shopperId: "shopper:bethan", label: "Is the Golf still there?" }));
    answers.push(await guest.act("ask", { shopperId: "shopper:freya", label: "Sneak" }));
    answers.push(await guest.act("retire-car", { carId: "car:golf" }));
    guest.navigate("shopper:freya");
    guest.navigate("car:golf");
    draw();
  });
  card.append(ask);
  const said = document.createElement("gv-text");
  said.textContent = JSON.stringify({ seen, answers });
  card.append(said);
  guest.root.replaceChildren(card);
};
guest.subscribe((props) => { seen.push(props); draw(); });
`);

  /* The hostile one: forgeries outside the port, an act on what she may not see, a flood, and elements outside the kit. */
  const hostileJs = await guestBundle(`
import { connectGuest } from "@graview/guest/worker";
const guest = connectGuest();
const heard = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Each answer, short enough that two hundred of them are one line of the kit's text.
const tag = (id, answer) => ({ id, ok: answer.ok, ...(answer.ok ? {} : { reason: answer.reason }) });
(async () => {
await new Promise((r) => guest.subscribe(r));
// Forged: an act, and a second ready, straight to the worker's owner rather than over the port.
self.postMessage({ type: "act", nonce: "guess", id: 1, name: "ask", args: { shopperId: "shopper:bethan", label: "Forged" } });
self.postMessage({ graview: "guest-ready", protocol: 1 });
heard.push(tag("unseen", await guest.act("ask", { shopperId: "shopper:freya", label: "Unseen" })));
const flood = [];
for (let i = 0; i < 200; i += 1) guest.act("ask", { shopperId: "shopper:bethan", label: "Flood " + i }).then((answer) => flood.push(tag(i, answer)));
await wait(1500);
heard.push(...flood);
// Past the kit: elements a host must not draw.
const card = document.createElement("gv-card");
for (const name of ["script", "iframe", "img", "a", "gv-evil"]) {
  const evil = document.createElement(name);
  evil.setAttribute("src", "${HOST}/secret?from=element");
  evil.setAttribute("href", "${HOST}/secret?from=element");
  evil.textContent = "evil";
  card.append(evil);
}
// In the kit, with addresses no host may draw as a link (FR-69).
for (const href of ["javascript:alert(1)", "http://127.0.0.1/insecure", "data:text/html,hi"]) {
  const link = document.createElement("gv-link");
  link.setAttribute("href", href);
  link.textContent = "a link";
  card.append(link);
}
const said = document.createElement("gv-text");
said.textContent = JSON.stringify(heard);
card.append(said);
guest.root.replaceChildren(card);
})();
`);

  const widgetJs = await bundle(
    `
import { mountGuestWorker } from "./packages/guest/dist/host/index.js";
${SHOWROOM}
/* What the host asks of the page when it starts a worker, written down for the harness. */
const started = [];
const NativeWorker = window.Worker;
window.Worker = function Worker(url, options) {
  started.push({ url: String(url).slice(0, 5), type: (options && options.type) || "classic" });
  return new NativeWorker(url, options);
};
const failures = [];
const guests = {
  card: mountGuestWorker(document.getElementById("card"), { worker: { script: CARD }, view: "card", store, principal: bethan, input: all, onNavigate: (id) => went.push(id), onFailure: (reason) => failures.push(["card", reason]) }),
  hostile: mountGuestWorker(document.getElementById("hostile"), { worker: { script: HOSTILE }, view: "hostile", store, principal: bethan, input: all, limits: { acts: 5 }, onNavigate: (id) => went.push(id), onFailure: (reason) => failures.push(["hostile", reason]) }),
};
window.__host = {
  ...host,
  started,
  failures,
  origin: self.origin,
  stats: () => ({ card: { ...guests.card.stats }, hostile: { ...guests.hostile.stats } }),
  refused: () => ({ card: guests.card.refused, hostile: guests.hostile.refused }),
};
`,
    "iife",
  );
  const inline = `const CARD = ${JSON.stringify(cardJs)}; const HOSTILE = ${JSON.stringify(hostileJs)};\n${widgetJs}`.replace(/<\/script/gi, "<\\/script");
  const widgetHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Graview view</title></head><body><main><div id="card"></div><div id="hostile"></div></main><script>${inline}</script></body></html>`;

  const hostHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Chat</title></head><body><iframe id="proxy" title="Widget" style="width:720px;height:600px;border:0" src="${GUEST}/proxy/${POLICY}.html"></iframe></body></html>`;
  servers = [
    createServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(hostHtml);
      }
      // Anything else that reaches the chat's origin is a guest getting out.
      secretHits.push({ from: new URL(req.url, HOST).searchParams.get("from") ?? req.url, origin: req.headers.origin ?? null });
      res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
      res.end("sk-host-api-secret");
    }).listen(HOST_PORT, "127.0.0.1"),
    createServer((req, res) => {
      if (req.url === `/proxy/${POLICY}.html`) {
        res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store", "content-security-policy": localize(policy.proxyCsp, HOST) });
        return res.end(proxyPage(policy, widgetHtml, HOST));
      }
      res.writeHead(404);
      res.end();
    }).listen(GUEST_PORT, "localhost"),
  ];

  const context = await browser.newContext();
  const tab = await context.newPage();
  tab.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await tab.goto(`${HOST}/`, { waitUntil: "load" });
  let widget;
  for (let i = 0; i < 100 && !widget; i += 1) {
    for (const frame of tab.frames()) if (await frame.evaluate(() => typeof window.__host === "object").catch(() => false)) widget = frame;
    if (!widget) await tab.waitForTimeout(100);
  }
  if (!widget) throw new Error("the widget never mounted its guests");
  const drawn = async (selector, test, what) => {
    for (let i = 0; i < 100; i += 1) {
      const text = await widget.evaluate((at) => document.querySelector(at)?.textContent ?? null, selector).catch(() => null);
      if (text !== null && test(text)) return text;
      await tab.waitForTimeout(100);
    }
    throw new Error(`${what} never drawn: ${JSON.stringify(await widget.evaluate(() => ({ failures: window.__host.failures, html: document.body.innerHTML.slice(0, 400) })))}`);
  };
  const reportOf = (text) => JSON.parse(text);
  await drawn("#card [data-gv=text]", (text) => reportOf(text).seen.length > 0, "the card");
  await widget.click("#card button");
  const cardSaid = reportOf(await drawn("#card [data-gv=text]", (text) => reportOf(text).answers.length === 3, "the card's answers"));
  const hostileSaid = reportOf(await drawn("#hostile [data-gv=text]", () => true, "the hostile guest's report"));
  await tab.waitForTimeout(300);

  const host = await widget.evaluate(() => ({ started: window.__host.started, failures: window.__host.failures, origin: window.__host.origin, log: window.__host.log(), went: window.__host.went, stats: window.__host.stats(), refused: window.__host.refused() }));
  const html = await widget.evaluate(() => document.querySelector("main").innerHTML);
  report.policy = { name: POLICY, csp: localize(policy.proxyMetaCsp ?? policy.proxyCsp, HOST), sandbox: policy.innerSandbox, widgetOrigin: host.origin };

  claim("every guest was started as a classic worker from a blob: URL", host.started.length === 2 && host.started.every((one) => one.url === "blob:" && one.type === "classic"), host.started);
  claim("no guest failed to start", host.failures.length === 0, host.failures);
  claim("the card was drawn in the widget's page, from the kit", /<section[^>]*data-gv="card"/.test(html) && /<strong[^>]*>Golf<\/strong>/.test(html) && /<button[^>]*data-gv="button"/.test(html), html.slice(0, 300));
  protocolClaims({
    seen: cardSaid.seen,
    answers: cardSaid.answers,
    wire: JSON.stringify(cardSaid) + JSON.stringify(hostileSaid),
    log: host.log,
    heard: hostileSaid,
    stats: host.stats,
    went: host.went,
  });
  claim("the viewer's press on the card's button is what asked", host.log.filter((op) => op.via === "view:card").length === 1, host.log);
  const drawnTags = [...html.matchAll(/<([a-z][a-z0-9-]*)/g)].map((match) => match[1]);
  claim("nothing outside the kit was drawn", !drawnTags.some((tag) => ["script", "iframe", "img", "gv-evil"].includes(tag)) && !html.includes("/secret") && !html.includes("evil"), [...new Set(drawnTags)]);
  claim("what was not drawn was written down as refused", ["script", "iframe", "img", "a", "gv-evil"].every((name) => host.refused.hostile.some((one) => one.reason === "element" && one.element === name)), host.refused.hostile);
  const links = await widget.evaluate(() => [...document.querySelectorAll("#hostile a")].map((one) => one.getAttribute("href")));
  claim("a link the guest gave a javascript:, http: or data: address was drawn with none", links.length === 3 && links.every((href) => href === null) && host.refused.hostile.filter((one) => one.reason === "url").length === 3, { links, refused: host.refused.hostile.filter((one) => one.reason === "url") });
  claim("a second ready, and a forged act, were dropped unread", host.stats.hostile.dropped >= 2, host.stats);
  claim("no guest reached the chat's origin", secretHits.length === 0, secretHits);
  claim("the host page throws nothing", report.pageErrors.length === 0, report.pageErrors);
  report.stats = host.stats;
}
