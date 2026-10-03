#!/usr/bin/env node
/**
 * A GUEST VIEW IN A REAL BROWSER (FR-04): what the sandbox, the origin
 * check and the nonce hold when the guest is hostile and the frame is real.
 *
 * Two origins on their own ports — the host page on one, the guests on the
 * other — so nothing here borrows a dev server. The host page mounts two
 * guest views for Bethan, a shopper who may see the cars and herself: an
 * honest card written with the SDK, and a hostile one written by hand that
 * reads the host's cookie and storage, reaches into the parent, navigates
 * the top window, opens a popup, fetches the host's API with credentials,
 * posts forged messages to the parent, sends acts with a wrong nonce and
 * floods acts with the right one. Then the host's store and the guests'
 * own records are read, and every claim is written to docs/guest-sandbox.json.
 *
 *   node scripts/guest-sandbox.mjs [--engine=chromium|webkit|firefox] [--port=5650]
 *
 * Needs `pnpm build` (it bundles packages/guest/dist and packages/core/dist).
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(repoRoot, "package.json"));
const { build } = require("esbuild");
const playwright = require("playwright");

const arg = (name, fallback) => process.argv.find((one) => one.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const ENGINE = arg("engine", "chromium");
const HOST_PORT = Number(arg("port", "5650"));
const GUEST_PORT = HOST_PORT + 1;
const HOST = `http://127.0.0.1:${HOST_PORT}`;
const GUEST = `http://localhost:${GUEST_PORT}`;

const bundle = async (contents) =>
  (
    await build({
      stdin: { contents, resolveDir: repoRoot, loader: "ts" },
      bundle: true,
      format: "esm",
      write: false,
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
      define: { "process.env.NODE_ENV": '"production"' },
    })
  ).outputFiles[0].text;

const hostJs = await bundle(`
import { mountGuestView } from "./packages/guest/dist/host/index.js";
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
const bethan = { kind: "human", id: "shopper:bethan", roles: ["shopper"] };
localStorage.setItem("host-secret", "sk-host-storage");
const all = () => ({ nodes: store.graph.allNodes().map(({ id }) => ({ id })), implicated: ["shopper:freya", "car:golf"] });
const went = [];
const frames = {
  card: mountGuestView(document.getElementById("card"), { url: "${GUEST}/card.html", view: "card", store, principal: bethan, input: all, onNavigate: (id) => went.push(id) }),
  hostile: mountGuestView(document.getElementById("hostile"), { url: "${GUEST}/hostile.html", view: "hostile", store, principal: bethan, input: all, limits: { acts: 5 }, onNavigate: (id) => went.push(id) }),
  bare: mountGuestView(document.getElementById("bare"), { url: "${GUEST}/bare.html", view: "bare", store, principal: bethan }),
};
window.__host = {
  log: () => store.log.all().map((op) => ({ author: op.author.id, via: op.via, intent: op.intent })),
  ids: () => store.graph.allNodes().map((node) => node.id).sort(),
  stats: () => ({ card: { ...frames.card.stats }, hostile: { ...frames.hostile.stats }, bare: { ...frames.bare.stats } }),
  sandbox: () => [...document.querySelectorAll("iframe")].map((frame) => frame.getAttribute("sandbox")),
  went,
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

const secretHits = [];
const servers = [
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

const report = { at: new Date().toISOString(), engine: ENGINE, claims: {}, pageErrors: [] };
const claim = (name, ok, detail) => {
  report.claims[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) };
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — ${JSON.stringify(detail)}`}\n`);
};

const browser = await playwright[ENGINE].launch();
try {
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
  const wire = JSON.stringify(seen) + JSON.stringify(await hostile.evaluate(() => window.__heard));
  const unseen = ["shopper:freya", "Freya Davies", "freya@mail.example", "enquiry:1", "Finance on the Golf", "sk-host"];
  claim("the card was shown the cars and Bethan, and nobody else", seen.length > 0 && JSON.stringify(seen[0].nodes.map((n) => n.id)) === JSON.stringify(["car:golf", "shopper:bethan"]), seen[0]?.nodes);
  claim("nothing a guest received names what Bethan may not see, or a secret of the host's", unseen.every((word) => !wire.includes(word)), unseen.filter((word) => wire.includes(word)));

  const answers = await card.evaluate(() => window.__answers);
  claim("the card's own act was applied", answers[0]?.ok === true, answers[0]);
  claim("an act on a record she may not see was refused in the policy's words", answers[1]?.ok === false && answers[1].reason === "refused" && /may not see/.test(answers[1].message), answers[1]);
  claim("an act her roles do not grant was refused", answers[2]?.ok === false && answers[2].reason === "refused", answers[2]);

  const log = await tab.evaluate(() => window.__host.log());
  claim("every applied act is Bethan's, through the view that asked", log.length > 0 && log.every((op) => op.author === "shopper:bethan" && (op.via === "view:card" || op.via === "view:hostile")), log);
  claim("the card's act is in the log as Bethan's, via view:card", log.some((op) => op.via === "view:card" && op.intent === "Ask Is the Golf still there?"), log);

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

  const hostileOps = log.filter((op) => op.via === "view:hostile");
  claim("a forged act, posted to the parent rather than the port, changed nothing", !log.some((op) => op.intent === "Ask Forged"), log);
  claim("an act with the wrong nonce changed nothing and was not answered", !log.some((op) => op.intent === "Ask Wrong nonce") && !(await hostile.evaluate(() => window.__heard)).some((one) => one.id === "wrong"));
  const heard = await hostile.evaluate(() => window.__heard.filter((one) => one.type === "answer"));
  const stats = await tab.evaluate(() => window.__host.stats());
  // Five acts in the allowance: the one refused for naming Freya spent one, so four of the flood landed.
  claim(
    "a flood of acts was applied no further than the frame's allowance of five",
    hostileOps.length === 4 && heard.some((one) => one.id === "unseen" && one.reason === "refused"),
    { applied: hostileOps.length, stats },
  );
  const limited = heard.filter((one) => !one.ok && one.reason === "rate-limited").length;
  claim(
    "the rest of the flood was answered rate-limited or dropped unread past the message allowance",
    limited > 0 && limited + stats.hostile.dropped >= 196,
    { limited, stats },
  );
  const went = await tab.evaluate(() => window.__host.went);
  claim("navigation went only to what Bethan may see", JSON.stringify(went) === JSON.stringify(["car:golf"]), went);
  /* What the hostile guest's own attempts make an engine say is theirs; the host page itself throws nothing. */
  const hosts = report.pageErrors.filter((error) => !/secret|navigat|Content Security Policy|access control/i.test(error));
  claim("the host page throws nothing", hosts.length === 0, report.pageErrors);
  report.stats = await tab.evaluate(() => window.__host.stats());
} finally {
  await browser.close();
  for (const server of servers) server.close();
}
report.passed = Object.values(report.claims).every((one) => one.ok);
writeFileSync(resolve(repoRoot, `docs/guest-sandbox${ENGINE === "chromium" ? "" : `-${ENGINE}`}.json`), `${JSON.stringify(report, null, 2)}\n`);
process.exit(report.passed ? 0 : 1);
