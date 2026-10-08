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
 *   open    a worker view on the open kit (FR-90): HTML, SVG and CSS drawn
 *           into a shadow root on the app's own page, served with no CSP
 *           (`--policy=page`) so the open kit alone holds the network back,
 *           in Chromium, WebKit and Firefox; and inside Claude's widget
 *           (scripts/lib/guest-open-suite.mjs).
 *   place   a worker view as a place (FR-91): the embed, over the offers
 *           fixture, with the package lens registered by its manifest, on
 *           the Graview face and the pages face, in light and in dark
 *           (scripts/lib/guest-place-suite.mjs).
 *   record  a view of one record beside its editing (FR-149–FR-151): the
 *           skill's worked example over a deliverable with a long draft,
 *           drawn above the record's own editable fields on both faces
 *           unless it says `replaces: "page"`, and its "Edit draft" filled
 *           by the host for a seat that may write it, and for no other
 *           (scripts/lib/guest-record-suite.mjs).
 *   writes  writes that cannot leak (FR-92): views running for a member who
 *           may see what another may not try to write it where the other
 *           reads, every way but a person's press, and are refused; a
 *           person's press with what they typed applies
 *           (scripts/lib/guest-writes-suite.mjs).
 *   limits  a view past its limits (FR-94): one spins, one floods, one draws
 *           100 000 nodes, one is too long; each is stopped and the plain
 *           face drawn in its place (scripts/lib/guest-limits-suite.mjs).
 *   plain   a view with no build (FR-96): the graview-worker-view skill's
 *           two examples and the package lens, handed over as plain source
 *           (scripts/lib/guest-plain-suite.mjs).
 *   client  a frame guest of a few lines (FR-85–FR-88): the prebuilt client
 *           inlined under Graview Cloud's view policy, reading across
 *           kinds, painted from the app's theme, a place by its title, and
 *           the home's body (scripts/lib/guest-client-suite.mjs).
 *   brand   a worker view drawing the app's whole brand (FR-127): its
 *           name and display face beside the app's wordmark, its radius,
 *           its logo byte for byte, and all of it again after the host
 *           re-dresses the app — on the app's own page and inside Claude's
 *           and ChatGPT's widgets (scripts/lib/guest-brand-suite.mjs).
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
 *   node scripts/guest-sandbox.mjs --transport=open --policy=page --engine=firefox
 *
 * Needs `pnpm build` (it bundles packages/guest/dist and packages/core/dist).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { portFor } from "./lib/ports.mjs";
import { localize, POLICIES, proxyPage } from "./lib/widget-policies.mjs";
import { openSuite, viewScriptOf } from "./lib/guest-open-suite.mjs";
import { placeSuite } from "./lib/guest-place-suite.mjs";
import { writesSuite } from "./lib/guest-writes-suite.mjs";
import { recordSuite } from "./lib/guest-record-suite.mjs";
import { limitsSuite } from "./lib/guest-limits-suite.mjs";
import { plainSuite } from "./lib/guest-plain-suite.mjs";
import { clientSuite } from "./lib/guest-client-suite.mjs";
import { brandSuite } from "./lib/guest-brand-suite.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(repoRoot, "package.json"));
const { build } = require("esbuild");
const playwright = require("playwright");

const arg = (name) => process.argv.find((one) => one.startsWith(`--${name}=`))?.slice(name.length + 3);

/* Every transport, policy and engine, each in its own process: they share the two ports. */
if (!arg("transport") && !arg("engine") && !arg("policy")) {
  /* `--quick` (GRAVIEW_QUICK): one engine per transport and policy, crossed so both engines still run. */
  const runs = process.env.GRAVIEW_QUICK
    ? [["--transport=frame", "--engine=chromium"], ["--transport=worker", "--policy=claude", "--engine=chromium"], ["--transport=worker", "--policy=chatgpt", "--engine=webkit"], ["--transport=open", "--policy=page", "--engine=firefox"], ["--transport=place", "--engine=chromium"], ["--transport=record", "--engine=firefox"], ["--transport=writes", "--engine=webkit"], ["--transport=limits", "--engine=firefox"], ["--transport=plain", "--engine=chromium"], ["--transport=client", "--engine=webkit"], ["--transport=brand", "--policy=chatgpt", "--engine=firefox"]]
    : [
        ...["chromium", "webkit", "firefox"].map((engine) => ["--transport=frame", `--engine=${engine}`]),
        ...["claude", "chatgpt"].flatMap((policy) => ["chromium", "webkit"].map((engine) => ["--transport=worker", `--policy=${policy}`, `--engine=${engine}`])),
        ...["chromium", "webkit", "firefox"].map((engine) => ["--transport=open", "--policy=page", `--engine=${engine}`]),
        ["--transport=open", "--policy=claude", "--engine=chromium"],
        ...["chromium", "webkit", "firefox"].map((engine) => ["--transport=place", `--engine=${engine}`]),
        ...["chromium", "webkit", "firefox"].map((engine) => ["--transport=record", `--engine=${engine}`]),
        ...["chromium", "webkit", "firefox"].map((engine) => ["--transport=writes", `--engine=${engine}`]),
        ...["chromium", "webkit", "firefox"].map((engine) => ["--transport=limits", `--engine=${engine}`]),
        ...["chromium", "webkit", "firefox"].map((engine) => ["--transport=plain", `--engine=${engine}`]),
        ...["chromium", "webkit", "firefox"].map((engine) => ["--transport=client", `--engine=${engine}`]),
        ...["page", "claude", "chatgpt"].flatMap((policy) => ["chromium", "webkit", "firefox"].map((engine) => ["--transport=brand", `--policy=${policy}`, `--engine=${engine}`])),
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
const POLICY = arg("policy") ?? (TRANSPORT === "open" || TRANSPORT === "brand" ? "page" : "claude");
if (!["frame", "worker", "open", "place", "record", "writes", "limits", "plain", "client", "brand"].includes(TRANSPORT)) throw new Error(`--transport is frame, worker, open, place, record, writes, limits, plain, client or brand, not ${TRANSPORT}`);
if (TRANSPORT === "worker" && !POLICIES[POLICY]) throw new Error(`--policy is one of ${Object.keys(POLICIES).join(", ")}, not ${POLICY}`);
if ((TRANSPORT === "open" || TRANSPORT === "brand") && POLICY !== "page" && !POLICIES[POLICY]) throw new Error(`--policy is page or one of ${Object.keys(POLICIES).join(", ")}, not ${POLICY}`);
const HOST_PORT = portFor("guest-host");
/* The watchdog's limit for the spinner and the busy guest: short, so the run stays short. */
const SILENT_MS = 1_500;
const GUEST_PORT = portFor("guest-sandbox");
const HOST = `http://127.0.0.1:${HOST_PORT}`;
const GUEST = `http://localhost:${GUEST_PORT}`;
const VERDICT = `docs/guest-sandbox${TRANSPORT === "frame" ? "" : ["place", "record", "writes", "limits", "plain", "client"].includes(TRANSPORT) ? `-${TRANSPORT}` : `-${TRANSPORT}-${POLICY}`}${ENGINE === "chromium" ? "" : `-${ENGINE}`}.json`;

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
const report = { at: new Date().toISOString(), transport: TRANSPORT, engine: ENGINE, ...(TRANSPORT === "worker" || TRANSPORT === "open" || TRANSPORT === "brand" ? { policy: POLICIES[POLICY]?.label ?? "the app's own page, with no content security policy" } : {}), claims: {}, pageErrors: [] };
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
  /*
   * The card and the hostile guest run side by side, and every act of the
   * hostile guest's flood that lands is an enquiry Bethan made and so may
   * see (`own`). Which of those had landed when the card was first shown
   * is a race the claim does not judge: under load the card's first props
   * can arrive after some of them. What it judges is that every push held
   * the cars and Bethan, and beyond them only an enquiry the log says she
   * made.
   */
  const hers = new Set(log.filter((op) => op.author === "shopper:bethan").map((op) => op.intent));
  const strangers = seen.flatMap((props) => (props.nodes ?? []).filter((n) => n.id !== "car:golf" && n.id !== "shopper:bethan" && !(n.kind === "enquiry" && hers.has(`Ask ${n.label}`))));
  claim("the card was shown the cars and Bethan, and nobody else", seen.length > 0 && seen.every((props) => ["car:golf", "shopper:bethan"].every((id) => (props.nodes ?? []).some((n) => n.id === id))) && strangers.length === 0, { strangers, first: seen[0]?.nodes });
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

/** FR-70's list: every one of these must be absent from a guest's worker (`!(name in self)`), and `navigator.storage`. */
const BANNED = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "WebTransport", "importScripts", "indexedDB", "caches", "BroadcastChannel", "Worker", "SharedWorker"];

/** What the platform had before the runtime ran, by name, for the prober to look for afterwards. */
const NATIVES = `
const names = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "WebTransport", "importScripts", "indexedDB", "caches", "BroadcastChannel", "Worker", "SharedWorker", "MessageChannel", "MessagePort", "navigator", "location", "performance", "Blob", "URL", "FileReader", "WebAssembly", "eval", "Function", "Request", "Response", "Headers", "addEventListener", "removeEventListener", "close", "fonts", "FontFace", "OffscreenCanvas", "createImageBitmap", "Notification", "CacheStorage", "IDBFactory", "StorageManager", "Cache", "XMLHttpRequestEventTarget", "WorkerNavigator", "WorkerLocation"];
export const captured = new Map();
for (const name of names) {
  let value;
  try { value = self[name]; } catch { continue; }
  if (value === null || (typeof value !== "object" && typeof value !== "function")) continue;
  captured.set(value, name);
  if (typeof value === "function" && value.prototype && name !== "Function" && name !== "eval") captured.set(value.prototype, name + ".prototype");
}
for (const [path, read] of [["navigator.storage", () => self.navigator.storage], ["the async function constructor", () => (async function () {}).constructor], ["the generator function constructor", () => (function* () {}).constructor], ["crypto.subtle", () => self.crypto.subtle], ["crypto", () => self.crypto]]) {
  try { const value = read(); if (value) captured.set(value, path); } catch {}
}
`;

/** FR-70's claims, from what the prober drew. */
async function hardeningClaims(probed) {
  const { GUEST_GLOBALS, OBJECT_PROTOTYPE } = await import(resolve(repoRoot, "packages/guest/dist/worker/harden.js"));
  const present = Object.entries(probed.absent).filter(([, absent]) => !absent).map(([name]) => name);
  claim("inside the guest's worker, fetch, XMLHttpRequest, WebSocket, EventSource, WebTransport, importScripts, indexedDB, caches, navigator.storage, BroadcastChannel, Worker and SharedWorker are all absent", Object.keys(probed.absent).length === 12 && present.length === 0, present);
  const allowed = new Set([...GUEST_GLOBALS, "constructor", "Symbol(Symbol.toStringTag)"]);
  const outside = probed.levels.flatMap((level, depth) => level.names.filter((name) => !(level.objectPrototype ? OBJECT_PROTOTYPE.includes(name) : allowed.has(name))).map((name) => `${depth}:${name}`));
  claim("the worker's global, own and inherited, symbols included, names nothing outside the allowlist", probed.levels.length >= 3 && outside.length === 0, outside);
  claim("hardening removed every name it meant to, and the global takes no new one", probed.hardening.stuck.length === 0 && probed.hardening.removed > 0 && probed.hardening.sealed === true, probed.hardening);
  claim("self.constructor.prototype holds none of them", probed.constructorPrototype.length === 0, probed.constructorPrototype);
  claim("no prototype on the global's chain holds any of them", probed.chain.length === 0, probed.chain);
  claim("globalThis is the same hardened global", probed.globalThis.same && probed.globalThis.has.length === 0, probed.globalThis);
  const code = probed.code;
  claim("Function('return this')() and every function constructor make nothing", [code.functionThis, code.functionConstructor, code.asyncFunction, code.generatorFunction, code.asyncGeneratorFunction].every((one) => !one.ok && one.error === "EvalError"), code);
  claim("eval is gone, by name and indirectly", code.evalInSelf === false && !code.indirectEval.ok, { evalInSelf: code.evalInSelf, indirect: code.indirectEval });
  claim("a string handed to setTimeout or setInterval runs nothing", !code.timerString.ok && !code.intervalString.ok, { setTimeout: code.timerString, setInterval: code.intervalString });
  claim("navigator and location are gone, from the global and from the polyfill's window", Object.values(probed.navigator).every((one) => one === false), probed.navigator);
  claim("there is no nested context to post to, and no worker to start", probed.nested.length === 0, probed.nested);
  claim("nothing reachable from the polyfilled DOM, the global or the guest's API is a removed API", probed.reach.visited > 500 && probed.reach.leaks.length === 0, probed.reach);
  claim("an error's stack hands back no removed API and no port, and there is no onerror to listen on", probed.stack.leaks.length === 0 && Object.values(probed.errors).every((one) => one === false), { stack: probed.stack, errors: probed.errors });
  claim("there is no Blob to make a script of, nor importScripts to run one", Object.values(probed.moreCode).every((one) => one === false), probed.moreCode);
  const sticks = probed.sticks;
  claim("what hardening left stays: no name added to the global or a prototype, none kept replaced or deleted", !sticks.addGlobal.ok && !sticks.addToPrototype.ok && !sticks.replaceKept.ok && !sticks.deleteKept.ok && sticks.frozen, sticks);
  report.hardening = { removed: probed.hardening.removed, reached: probed.reach.visited, stackApi: probed.stack.api, stackHandedBack: probed.stack.handed };
}

async function workerSuite() {
  const policy = POLICIES[POLICY];
  /*
   * A guest bundle as a classic script: the worker entry first, then the
   * guest. `fixture:natives` is the prober's alone: a module evaluated
   * before the runtime, holding what the platform had, so the prober can
   * look for any of it after hardening.
   */
  const guestBundle = (contents) =>
    build({
      stdin: { contents, resolveDir: repoRoot, loader: "js" },
      bundle: true,
      format: "iife",
      banner: { js: '"use strict";' },
      write: false,
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
      alias: { "@graview/guest/worker": resolve(repoRoot, "packages/guest/dist/worker/index.js") },
      plugins: [
        {
          name: "fixture",
          setup(on) {
            on.onResolve({ filter: /^fixture:/ }, (args) => ({ path: args.path, namespace: "fixture" }));
            on.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: NATIVES, loader: "js" }));
          },
        },
      ],
    }).then((out) => out.outputFiles[0].text);

  /*
   * THE FRAMEWORK'S OWN BUILD (FR-71): the card and the hostile guest are
   * written as a guest author writes one, a module importing
   * `@graview/guest/worker`, and built by `buildGuestBundle` into one classic
   * script. (The prober is built by hand, to put its fixture first.)
   */
  const { buildGuestBundle, checkGuestBundle } = await import(resolve(repoRoot, "packages/guest/dist/build.js"));
  const sources = mkdtempSync(resolve(tmpdir(), "graview-guest-sandbox-"));
  const checked = {};
  const built = async (name, source) => {
    const entry = resolve(sources, `${name}.js`);
    writeFileSync(entry, source);
    const { script } = await buildGuestBundle({ entry });
    checked[name] = await checkGuestBundle(script);
    return script;
  };

  /* The honest card: its kit, the props, and a button whose press asks for one act of hers and two that are not. */
  const cardJs = await built("card", `
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
  // A link to the one origin the host lists, and one elsewhere (links.origins).
  for (const href of ["https://recipes.example/golf", "https://elsewhere.example/golf"]) {
    const link = document.createElement("gv-link");
    link.setAttribute("href", href);
    link.textContent = "the recipe";
    card.append(link);
  }
  const said = document.createElement("gv-text");
  said.textContent = JSON.stringify({ seen, answers });
  card.append(said);
  guest.root.replaceChildren(card);
};
guest.subscribe((props) => { seen.push(props); draw(); });
`);

  /* The hostile one: forgeries outside the port, an act on what she may not see, a flood, and elements outside the kit. */
  const hostileJs = await built("hostile", `
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

  /*
   * THE WATCHDOG'S TWO: a guest that blocks its own event loop once it has
   * drawn, which the host must stop as silent within the limit, and one
   * that works in 200 ms slices for three times the limit, yielding between
   * them, which the host must keep.
   */
  const spinnerJs = await built("spinner", `
import { connectGuest } from "@graview/guest/worker";
const guest = connectGuest();
let spun = false;
guest.subscribe(() => {
  if (spun) return;
  spun = true;
  const said = document.createElement("gv-text");
  said.textContent = "spinning";
  guest.root.replaceChildren(said);
  setTimeout(() => { for (;;) {} }, 50);
});
`);
  const busyJs = await built("busy", `
import { connectGuest } from "@graview/guest/worker";
const guest = connectGuest();
let started = false;
guest.subscribe(() => {
  if (started) return;
  started = true;
  const said = document.createElement("gv-text");
  said.textContent = "busy";
  guest.root.replaceChildren(said);
  const until = Date.now() + ${SILENT_MS * 3};
  const slice = () => {
    const end = Date.now() + 200;
    while (Date.now() < end) {}
    if (Date.now() < until) setTimeout(slice, 0);
    else said.textContent = "done";
  };
  setTimeout(slice, 0);
});
`);

  /*
   * THE BUILDER (FR-94's draw budget): under the node cap, it builds a group
   * of 1 000 badges, takes it away and builds it again, a hundred times a
   * message, every 20 ms. The page must stop it as slow, and keep time.
   */
  const builderJs = await built("builder", `
import { connectGuest } from "@graview/guest/worker";
const guest = connectGuest();
let started = false;
guest.subscribe(() => {
  if (started) return;
  started = true;
  const group = document.createElement("gv-group");
  for (let i = 0; i < 1000; i += 1) group.appendChild(document.createElement("gv-badge"));
  const said = document.createElement("gv-text");
  said.textContent = "building";
  guest.root.replaceChildren(said);
  setInterval(() => { for (let i = 0; i < 100; i += 1) { guest.root.appendChild(group); group.remove(); } }, 20);
});
`);

  /*
   * THE PROBER (FR-70): inside a hardened guest worker, everything a guest
   * might try to get back what hardening took. What it finds it draws, as
   * the kit's text; it has no other way out.
   */
  const proberJs = await guestBundle(`
import { captured } from "fixture:natives";
import { connectGuest, hardening } from "@graview/guest/worker";
const guest = connectGuest();
const BANNED = ${JSON.stringify(BANNED)};
const outcome = (fn) => { try { const value = fn(); return { ok: true, value: String(value) }; } catch (error) { return { ok: false, error: (error && error.name) || String(error) }; } };
const tagOf = (value) => Object.prototype.toString.call(value);
const owns = (at, name) => { try { return Object.prototype.hasOwnProperty.call(at, name); } catch { return false; } };
const chain = []; for (let at = self; at; at = Object.getPrototypeOf(at)) chain.push(at);
/* Each value the platform had, to the name it had it by. */
const found = captured;
const out = {};
out.absent = Object.fromEntries(BANNED.map((name) => [name, !(name in self)]));
out.absent["navigator.storage"] = !("navigator" in self) || !("storage" in self.navigator);
out.levels = chain.map((at) => ({ objectPrototype: at === Object.prototype, names: Reflect.ownKeys(at).map((key) => key.toString()) }));
out.constructorPrototype = BANNED.filter((name) => owns(self.constructor && self.constructor.prototype, name));
out.chain = chain.flatMap((at) => BANNED.filter((name) => owns(at, name)));
out.globalThis = { same: globalThis === self, has: BANNED.filter((name) => name in globalThis) };
out.code = {
  functionThis: outcome(() => Function("return this")()),
  functionConstructor: outcome(() => (function () {}).constructor("return typeof fetch")()),
  asyncFunction: outcome(() => (async function () {}).constructor("return 1")),
  generatorFunction: outcome(() => (function* () {}).constructor("yield 1")),
  asyncGeneratorFunction: outcome(() => (async function* () {}).constructor("yield 1")),
  evalInSelf: "eval" in self,
  indirectEval: outcome(() => (0, self.eval)("typeof fetch")),
  timerString: outcome(() => setTimeout("self.__ran = 1", 0)),
  intervalString: outcome(() => setInterval("self.__ran = 1", 1000)),
};
out.navigator = { self: "navigator" in self, window: "navigator" in window, defaultView: "navigator" in document.defaultView, location: "location" in self || "location" in window };
out.nested = ["Worker", "SharedWorker", "MessageChannel", "MessagePort", "BroadcastChannel", "ServiceWorker", "Notification", "importScripts"].filter((name) => name in self);
/* Everything reachable from what the guest is given, six steps deep: the global, the polyfill's window and document, a kit element, the guest's own API. */
const reach = () => {
  const roots = [[globalThis, "globalThis"], [window, "window"], [document, "document"], [document.defaultView, "document.defaultView"], [document.createElement("gv-card"), "a kit element"], [document.createElement("iframe"), "an iframe of the polyfill's"], [customElements, "customElements"], [new Event("x"), "an event"], [guest, "the guest"], [guest.root, "the guest's root"], [new Error("x"), "an error"], [hardening, "hardening"]];
  const queue = roots.map(([value, path]) => [value, path, 0]);
  const seen = new Set();
  const leaks = [];
  while (queue.length > 0 && seen.size < 60000) {
    const [value, path, depth] = queue.shift();
    if (seen.has(value)) continue;
    seen.add(value);
    if (found.has(value)) leaks.push(path + " is " + found.get(value));
    else if (/^\\[object (MessagePort|Worker|SharedWorker|IDBFactory|CacheStorage|StorageManager|WorkerNavigator|WorkerLocation|Blob|Performance|BroadcastChannel|WebSocket|XMLHttpRequest|EventSource)\\]$/.test(tagOf(value))) leaks.push(path + " is " + tagOf(value));
    if (depth >= 6) continue;
    let keys = [];
    try { keys = Reflect.ownKeys(value); } catch {}
    for (const key of keys) {
      let descriptor;
      try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { continue; }
      if (!descriptor) continue;
      const next = [];
      if ("value" in descriptor) next.push(descriptor.value);
      if (descriptor.get) { next.push(descriptor.get); try { next.push(descriptor.get.call(value)); } catch {} }
      if (descriptor.set) next.push(descriptor.set);
      for (const one of next) if (one && (typeof one === "object" || typeof one === "function")) queue.push([one, path + "." + key.toString(), depth + 1]);
    }
    let prototype = null;
    try { prototype = Object.getPrototypeOf(value); } catch {}
    if (prototype) queue.push([prototype, path + ".__proto__", depth + 1]);
  }
  return { visited: seen.size, leaks };
};
out.reach = reach();
out.errors = { onerror: "onerror" in self, onunhandledrejection: "onunhandledrejection" in self, addEventListener: "addEventListener" in self, onmessage: "onmessage" in self };
out.sticks = {
  addGlobal: outcome(() => { self.fetch = () => 1; return "fetch" in self; }),
  addToPrototype: outcome(() => { Object.getPrototypeOf(self).fetch = () => 1; return "fetch" in self; }),
  replaceKept: outcome(() => { self.postMessage = () => 1; return "replaced"; }),
  deleteKept: outcome(() => { delete self.document; return typeof document; }),
  frozen: chain.slice(1, -1).every((at) => Object.isFrozen(at)),
};
out.hardening = { removed: hardening.removed.length, stuck: hardening.stuck, sealed: hardening.sealed };
/* Code from a script made in the worker, and from a URL it can name: there is no Blob to make one from, nor importScripts to run it. */
out.moreCode = { blob: "Blob" in self, url: "URL" in self, importScripts: "importScripts" in self };
let drawnOnce = false;
guest.subscribe(() => {
  if (drawnOnce) return;
  drawnOnce = true;
  /* An error's stack, read with V8's CallSite API from inside a call the runtime made: what is on the stack, handed back? */
  if (typeof Error.captureStackTrace === "function") {
    const handed = [];
    const before = Error.prepareStackTrace;
    Error.prepareStackTrace = (error, sites) => { for (const site of sites) handed.push(site.getThis && site.getThis(), site.getFunction && site.getFunction()); return ""; };
    void new Error("probe").stack;
    Error.prepareStackTrace = before;
    const values = handed.filter((value) => value !== undefined && value !== null);
    out.stack = { api: true, handed: values.map((value) => (typeof value === "function" ? "function " + value.name : tagOf(value))), leaks: values.filter((value) => found.has(value) || /MessagePort/.test(tagOf(value))).map((value) => found.get(value) || tagOf(value)) };
  } else out.stack = { api: false, handed: [], leaks: [] };
  const said = JSON.stringify(out);
  const card = document.createElement("gv-card");
  for (let at = 0; at < said.length; at += 9000) {
    const part = document.createElement("gv-text");
    part.textContent = said.slice(at, at + 9000);
    card.append(part);
  }
  guest.root.replaceChildren(card);
});
`);

  const widgetJs = await bundle(
    `
import { mountGuestWorker } from "./packages/guest/dist/host/worker.js";
${SHOWROOM}
/* What the host asks of the page when it starts a worker, written down for the harness. */
const started = [];
const NativeWorker = window.Worker;
window.Worker = function Worker(url, options) {
  started.push({ url: String(url).slice(0, 5), type: (options && options.type) || "classic" });
  const worker = new NativeWorker(url, options);
  worker.addEventListener("error", (event) => errors.push(String(event.message)));
  return worker;
};
const errors = [];
const failures = [];
const failedAt = {};
const failed = (name) => (reason) => {
  failures.push([name, reason]);
  failedAt[name] = performance.now();
};
/* The widget's own timer, every 50 ms: the longest it went between ticks while a guest spun. */
const pulse = { last: performance.now(), longest: 0, ticks: 0 };
setInterval(() => {
  const at = performance.now();
  if (drewAt.spinner !== undefined && (failedAt.spinner === undefined || at - failedAt.spinner < 500)) {
    pulse.longest = Math.max(pulse.longest, at - pulse.last);
    pulse.ticks += 1;
  }
  pulse.last = at;
}, 50);
/* When the spinner first drew: it spins 50 ms after. */
const drewAt = {};
new MutationObserver(() => {
  if (document.querySelector("#spinner [data-gv]")) drewAt.spinner ??= performance.now();
}).observe(document.getElementById("spinner"), { childList: true, subtree: true });
/* The control: a module worker from a blob: URL, which Chromium refuses in Claude's opaque view frame. */
const control = { module: "pending" };
try {
  const module = new NativeWorker(URL.createObjectURL(new Blob(["postMessage('ran')"], { type: "text/javascript" })), { type: "module" });
  module.onmessage = () => (control.module = "ran");
  module.onerror = () => (control.module = "refused");
} catch (error) {
  control.module = "threw " + error.name;
}
const guests = {
  card: mountGuestWorker(document.getElementById("card"), { worker: { script: CARD }, view: "card", store, principal: bethan, input: all, links: { origins: ["https://recipes.example"] }, onNavigate: (id) => went.push(id), onFailure: (reason) => failures.push(["card", reason]) }),
  hostile: mountGuestWorker(document.getElementById("hostile"), { worker: { script: HOSTILE }, view: "hostile", store, principal: bethan, input: all, limits: { acts: 5 }, onNavigate: (id) => went.push(id), onFailure: (reason) => failures.push(["hostile", reason]) }),
  prober: mountGuestWorker(document.getElementById("prober"), { worker: { script: PROBER }, view: "prober", store, principal: bethan, input: all, onFailure: (reason) => failures.push(["prober", reason]) }),
  spinner: mountGuestWorker(document.getElementById("spinner"), { worker: { script: SPINNER }, view: "spinner", store, principal: bethan, input: all, limits: { silentMs: ${SILENT_MS} }, onFailure: failed("spinner") }),
  busy: mountGuestWorker(document.getElementById("busy"), { worker: { script: BUSY }, view: "busy", store, principal: bethan, input: all, limits: { silentMs: ${SILENT_MS} }, onFailure: failed("busy") }),
  builder: mountGuestWorker(document.getElementById("builder"), { worker: { script: BUILDER }, view: "builder", store, principal: bethan, input: all, onFailure: failed("builder") }),
};
/* The widget's own timer while the builder builds, from when it drew until half a second after it was stopped. */
const building = { last: performance.now(), longest: 0, ticks: 0 };
setInterval(() => {
  const at = performance.now();
  if (document.querySelector("#builder [data-gv]") && (failedAt.builder === undefined || at - failedAt.builder < 500)) {
    building.longest = Math.max(building.longest, at - building.last);
    building.ticks += 1;
  }
  building.last = at;
}, 50);
window.__host = {
  ...host,
  started,
  control,
  failures,
  errors,
  origin: self.origin,
  stats: () => ({ card: { ...guests.card.stats }, hostile: { ...guests.hostile.stats } }),
  watchdog: () => ({ failedAt, drewAt, pulse, spinnerStopped: guests.spinner.worker === undefined, busyRunning: guests.busy.worker !== undefined, building, builderStopped: guests.builder.worker === undefined }),
  refused: () => ({ card: guests.card.refused, hostile: guests.hostile.refused }),
};
`,
    "iife",
  );
  const inline = `const CARD = ${JSON.stringify(cardJs)}; const HOSTILE = ${JSON.stringify(hostileJs)}; const PROBER = ${JSON.stringify(proberJs)}; const SPINNER = ${JSON.stringify(spinnerJs)}; const BUSY = ${JSON.stringify(busyJs)}; const BUILDER = ${JSON.stringify(builderJs)};\n${widgetJs}`.replace(/<\/script/gi, "<\\/script");
  const widgetHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Graview view</title></head><body><main><div id="card"></div><div id="hostile"></div><div id="prober"></div><div id="spinner"></div><div id="busy"></div><div id="builder"></div></main><script>${inline}</script></body></html>`;

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
    throw new Error(`${what} never drawn: ${JSON.stringify(await widget.evaluate(() => ({ failures: window.__host.failures, errors: window.__host.errors, html: document.body.innerHTML.slice(0, 400) })))}`);
  };
  const reportOf = (text) => JSON.parse(text);
  await drawn("#card [data-gv=text]", (text) => reportOf(text).seen.length > 0, "the card");
  await widget.click("#card button");
  const cardSaid = reportOf(await drawn("#card [data-gv=text]", (text) => reportOf(text).answers.length === 3, "the card's answers"));
  const hostileSaid = reportOf(await drawn("#hostile [data-gv=text]", () => true, "the hostile guest's report"));
  await drawn("#prober [data-gv=text]", () => true, "the prober's report");
  const probed = JSON.parse((await widget.evaluate(() => [...document.querySelectorAll("#prober [data-gv=text]")].map((one) => one.textContent))).join(""));
  await drawn("#busy [data-gv=text]", (text) => text === "done", "the busy guest's end");
  await tab.waitForTimeout(300);

  const host = await widget.evaluate(() => ({ watchdog: window.__host.watchdog(), started: window.__host.started, failures: window.__host.failures, origin: window.__host.origin, log: window.__host.log(), went: window.__host.went, stats: window.__host.stats(), refused: window.__host.refused() }));
  const html = await widget.evaluate(() => document.querySelector("main").innerHTML);
  report.policy = { name: POLICY, csp: localize(policy.proxyMetaCsp ?? policy.proxyCsp, HOST), sandbox: policy.innerSandbox, widgetOrigin: host.origin };

  claim("the card and the hostile guest, built by buildGuestBundle, are classic scripts with nothing to load at run time", ["card", "hostile"].every((name) => checked[name]?.length === 0) && Object.values(checked).every((findings) => findings.length === 0), checked);
  const control = await widget.evaluate(() => window.__host.control.module);
  report.findings = { ...report.findings, moduleBlobWorker: control };
  /* The spinner is stopped on purpose, after it started; it is the watchdog's claim below. */
  const startFailures = host.failures.filter(([name]) => name !== "spinner" && name !== "builder");
  if (POLICY === "claude" && ENGINE === "chromium") claim("here a module worker from a blob: URL is refused, and the classic guests started", control !== "ran" && startFailures.length === 0, { module: control });
  claim("every guest was started as a classic worker from a blob: URL", host.started.length === 6 && host.started.every((one) => one.url === "blob:" && one.type === "classic"), host.started);
  claim("no guest failed to start", startFailures.length === 0, host.failures);
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
  const cardLinks = await widget.evaluate(() => [...document.querySelectorAll("#card a")].map((one) => ({ href: one.getAttribute("href"), rel: one.getAttribute("rel"), referrerpolicy: one.getAttribute("referrerpolicy"), target: one.getAttribute("target") })));
  claim("a link the card drew opens apart from the chat: noopener noreferrer, no referrer, a new tab", cardLinks.length === 2 && cardLinks.every((one) => one.rel === "noopener noreferrer" && one.referrerpolicy === "no-referrer" && one.target === "_blank"), cardLinks);
  claim("a link to an origin the host does not list was drawn with no href, and one it lists with its own", cardLinks[0]?.href === "https://recipes.example/golf" && cardLinks[1]?.href === null && host.refused.card.some((one) => one.reason === "url"), { cardLinks, refused: host.refused.card });
  claim("a second ready, and a forged act, were dropped unread", host.stats.hostile.dropped >= 2, host.stats);
  claim("no guest reached the chat's origin", secretHits.length === 0, secretHits);
  const watchdog = host.watchdog;
  const spun = watchdog.failedAt.spinner - watchdog.drewAt.spinner;
  /* It drew, spun 50 ms later, and was stopped once silentMs had passed since its last answer, checked every quarter of it. */
  claim(`a guest that spins after ready is stopped as silent within limits.silentMs (${SILENT_MS} ms) and one interval of it`, JSON.stringify(host.failures.filter(([name]) => name === "spinner")) === JSON.stringify([["spinner", "silent"]]) && watchdog.spinnerStopped && spun >= SILENT_MS - SILENT_MS / 4 && spun <= SILENT_MS + SILENT_MS / 4 + 250, { spun, ...watchdog });
  claim("the widget's page kept its own timer while a guest spun, never more than 250 ms between 50 ms ticks", watchdog.pulse.ticks > 20 && watchdog.pulse.longest < 250, watchdog.pulse);
  claim(`a guest that is busy but yields, for three times silentMs, is kept`, !host.failures.some(([name]) => name === "busy") && watchdog.busyRunning, { failures: host.failures, busyRunning: watchdog.busyRunning });
  claim(
    "a guest that builds and takes away a thousand badges a hundred times a message is stopped as slow, and the widget's timer kept time while it built, never more than 250 ms between 50 ms ticks",
    host.failures.some(([name, reason]) => name === "builder" && reason === "slow") && watchdog.builderStopped && watchdog.building.ticks > 0 && watchdog.building.longest < 250,
    { failures: host.failures.filter(([name]) => name === "builder"), building: watchdog.building, stopped: watchdog.builderStopped },
  );
  await hardeningClaims(probed);
  claim("the host page throws nothing", report.pageErrors.length === 0, report.pageErrors);
  report.stats = host.stats;
}

// ── run ──────────────────────────────────────────────────────────────────────

const browser = await playwright[ENGINE].launch();
let servers = [];
try {
  if (TRANSPORT === "frame") await frameSuite();
  else if (TRANSPORT === "plain") await plainSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT });
  else if (TRANSPORT === "client") await clientSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, GUEST, GUEST_PORT });
  else if (TRANSPORT === "limits") await limitsSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, viewScript: viewScriptOf(repoRoot, build) });
  else if (TRANSPORT === "writes") await writesSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, viewScript: viewScriptOf(repoRoot, build) });
  else if (TRANSPORT === "brand") await brandSuite({ repoRoot, build, browser, claim, report, POLICY, HOST, GUEST, HOST_PORT, GUEST_PORT });
  else if (TRANSPORT === "place") await placeSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT });
  else if (TRANSPORT === "record") await recordSuite({ repoRoot, build, browser, claim, report, HOST, HOST_PORT, engine: ENGINE });
  else if (TRANSPORT === "open") await openSuite({ repoRoot, build, browser, claim, report, POLICY, ENGINE, HOST, GUEST, HOST_PORT, GUEST_PORT, ATTACKER_PORT: portFor("guest-attacker"), SHOWROOM });
  else await workerSuite();
} finally {
  await browser.close();
  for (const server of servers) server.close();
}
report.passed = Object.values(report.claims).every((one) => one.ok);
writeFileSync(resolve(repoRoot, VERDICT), `${JSON.stringify(report, null, 2)}\n`);
process.exit(report.passed ? 0 : 1);
