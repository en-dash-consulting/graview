#!/usr/bin/env node
/**
 * A PRODUCT FACE OVER A RUNNING PREVIEW'S STORE: the architecture recipe's
 * face, run the way its page says to run it.
 *
 * The recipe on graview.dev is a declaration and a seed
 * (docs/site/recipes/architecture/), and a face of its own
 * (apps/site/faces/architecture/, quoted whole on the recipe's page):
 * `PagesApp` with its own shell, home, a route and a zone's record page, over
 * `openRemote` to a `graview preview` of that declaration, through a Vite
 * proxy that rewrites Origin for /graview so the preview's same-app doors
 * answer. This copies the face's files into a scratch project inside the
 * checkout (`.generated/face-recipe/`), its @graview/* the workspace's
 * built packages as a product installs them, starts the preview and the
 * face's own dev server with its own vite.config.ts, and asks a browser:
 *
 *   the face's files typecheck against the packages;
 *   the preview refuses a request whose Origin is the face's own page, and
 *   answers the same request through the face's proxy;
 *   the face draws its own shell and home over the preview's store: every
 *   zone with its modules counted and its owners;
 *   a zone's page is the face's own, says what the rules found, offers the
 *   repair, and links to that zone in the preview's own scene;
 *   a change another seat makes on the preview reaches the open face, live,
 *   over the proxied socket; and one made on the face is the preview's;
 *   and no page threw.
 *
 *   node scripts/verify-face-recipe.mjs [--engine=chromium|webkit|firefox]
 *
 * Writes docs/face-recipe.json. Needs `pnpm build`.
 */
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { vacant } from "./lib/serve.mjs";
import { seatHeaders } from "../packages/ship/dist/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const CLI = resolve(repoRoot, "packages/graview/dist/cli.js");
const RECIPE = "docs/site/recipes/architecture";
const scratch = resolve(repoRoot, ".generated/face-recipe");
const report = { at: new Date().toISOString(), engine: ENGINE, recipe: RECIPE, claims: {} };
const claim = (name, ok, detail) => {
  report.claims[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) };
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — ${JSON.stringify(detail)}`}\n`);
};

if (!existsSync(resolve(repoRoot, "packages/graview/dist/preview/index.html"))) {
  process.stderr.write("verify-face-recipe: packages/graview/dist/preview is not built. Run pnpm build first.\n");
  process.exit(1);
}

/* THE PRODUCT, AS A STRANGER HAS IT: the recipe's files, and in its node_modules the packages it names. */
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
cpSync(resolve(repoRoot, "apps/site/faces/architecture"), scratch, { recursive: true });
const manifest = JSON.parse(readFileSync(join(scratch, "package.json"), "utf8"));
const store = resolve(repoRoot, "node_modules/.pnpm");
const fromStore = (name) => {
  const folder = readdirSync(store).find((one) => one.startsWith(`${name.replace("/", "+")}@`));
  return folder ? join(store, folder, "node_modules", name) : undefined;
};
const sourceOf = (name) => {
  if (name.startsWith("@graview/")) return resolve(repoRoot, "packages", name.slice("@graview/".length));
  if (name === "graview") return resolve(repoRoot, "packages/graview");
  for (const one of [resolve(repoRoot, "node_modules", name), resolve(repoRoot, "apps/todo/node_modules", name)]) if (existsSync(one)) return one;
  return fromStore(name);
};
const missing = [];
for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
  const from = sourceOf(name);
  if (!from) {
    missing.push(name);
    continue;
  }
  mkdirSync(dirname(join(scratch, "node_modules", name)), { recursive: true });
  symlinkSync(from, join(scratch, "node_modules", name), "dir");
}

const typed = spawnSync(process.execPath, [resolve(repoRoot, "node_modules/typescript/bin/tsc"), "-p", scratch], { cwd: scratch, encoding: "utf8" });
claim("the face's files typecheck against the packages a product installs", missing.length === 0 && typed.status === 0, { missing, said: `${typed.stdout}${typed.stderr}`.trim().split("\n").slice(0, 20) });

const PREVIEW = at("face-recipe-preview");
const FACE = at("face-recipe");
await vacant(portFor("face-recipe-preview"), portFor("face-recipe"));
const children = [];
const start = (command, args, options) => {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
  let said = "";
  child.stdout.on("data", (chunk) => (said += chunk));
  child.stderr.on("data", (chunk) => (said += chunk));
  children.push(child);
  return { child, said: () => said };
};
const until = async (url, what, server) => {
  const began = Date.now();
  for (;;) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    if (Date.now() - began > 60_000 || server.child.exitCode !== null) throw new Error(`${what} did not start:\n${server.said()}`);
    await new Promise((ready) => setTimeout(ready, 250));
  }
};

let browser;
const errors = [];
try {
  const preview = start(process.execPath, [CLI, "preview", `${RECIPE}/app.json`, "--seed", `${RECIPE}/seed.json`, "--port", String(portFor("face-recipe-preview"))], { cwd: repoRoot });
  await until(`${PREVIEW}/graview/health`, "graview preview", preview);
  const face = start(process.execPath, [join(scratch, "node_modules/vite/bin/vite.js")], { cwd: scratch, env: { ...process.env, PORT: String(portFor("face-recipe")), GRAVIEW_PREVIEW: PREVIEW } });
  await until(`${FACE}/`, "the face's dev server", face);

  /* THE DOORS: the preview answers its own page, not another one, and the proxy says the face's request is its own. */
  const { principal } = await (await fetch(`${PREVIEW}/graview/document`)).json();
  const state = (base, origin) => fetch(`${base}/graview/state`, { headers: { ...seatHeaders(principal), origin } }).then((answer) => answer.status);
  const doors = { direct: await state(PREVIEW, FACE), own: await state(PREVIEW, PREVIEW), proxied: await state(FACE, FACE) };
  claim("the preview refuses a request from the face's page as another site's, and answers the same request through the face's proxy", doors.direct >= 400 && doors.own === 200 && doors.proxied === 200, doors);

  browser = await launchEngine(ENGINE);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
  page.on("pageerror", (error) => errors.push(error.message));
  /* The sockets the face holds, and whether each is still open: the live wire goes through the proxy, or it does not go. */
  const sockets = [];
  page.on("websocket", (socket) => {
    const one = { url: socket.url(), open: true, frames: 0 };
    sockets.push(one);
    socket.on("framereceived", () => (one.frames += 1));
    socket.on("close", () => (one.open = false));
  });
  await page.goto(`${FACE}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__faceReady === true && document.querySelector('[data-testid="face-home"]') !== null, null, { timeout: 60_000 });
  await page.waitForTimeout(500);
  const home = await page.evaluate(() => ({
    shell: document.querySelector('[data-testid="face-shell"]')?.textContent ?? null,
    zones: [...document.querySelectorAll("[data-zone]")].map((one) => one.textContent),
    scheme: document.documentElement.dataset.graviewScheme ?? null,
    themed: getComputedStyle(document.documentElement).getPropertyValue("--graview-accent").trim() !== "",
  }));
  const booking = home.zones.find((one) => one.startsWith("Booking")) ?? "";
  claim(
    "the face draws its own shell and home over the preview's store: every zone, its modules counted and its owners, in the app's theme",
    /Larkspur architecture/.test(home.shell ?? "") && /Problems \(\d+\)/.test(home.shell ?? "") && home.zones.length === 7 && /3 modules · maya-r/.test(booking) && home.zones.some((one) => /Tooling.*no owner/.test(one)) && home.themed,
    home,
  );

  await page.click('[data-zone="zone-tooling"] a');
  await page.waitForSelector('[data-testid="zone-page"]', { timeout: 15_000 });
  const zone = await page.evaluate(() => ({
    path: location.pathname,
    heading: document.querySelector('[data-testid="zone-page"] h1')?.textContent ?? null,
    problem: document.querySelector('[data-testid="zone-problem"]')?.textContent ?? null,
    repair: [...document.querySelectorAll('[data-testid="zone-problem"] button, [data-testid="zone-problem"] a')].map((one) => one.textContent?.trim()),
    modules: [...document.querySelectorAll('[data-testid="zone-modules"] li')].map((one) => one.textContent),
    map: document.querySelector('[data-testid="spatial-link"]')?.getAttribute("href") ?? null,
  }));
  claim(
    "a zone's page is the face's own: what the rules found and the repair, its modules, and a link to the zone in the preview's own scene",
    zone.heading === "Tooling" && /No one owns Tooling/.test(zone.problem ?? "") && zone.repair.length > 0 && zone.modules.join() === "tools/migrate" && zone.map === `${PREVIEW}/places/overview#focus=zone-tooling`,
    zone,
  );

  /* LIVE BOTH WAYS: another seat's change on the preview reaches the face over the proxied socket; the face's own change is the preview's. */
  await page.goto(`${FACE}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__faceReady === true && document.querySelectorAll("[data-zone]").length === 7, null, { timeout: 30_000 });
  const sent = await fetch(`${PREVIEW}/graview/ops`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: PREVIEW, ...seatHeaders({ ...principal, id: "someone-else" }) },
    body: JSON.stringify({ calls: [{ name: "add-zone", args: { name: "Search", summary: "Clinic and practitioner search." } }] }),
  });
  const arrived = await page
    .waitForFunction(() => [...document.querySelectorAll("[data-zone]")].some((one) => one.textContent?.startsWith("Search")), null, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  const made = await page.evaluate(async () => {
    const store = window.__graview.store;
    const answer = store.apply({ name: "add-person", args: { handle: "lee-c" } }, { author: window.__graview.principal });
    return { ok: answer.ok !== false, error: answer.error ? String(answer.error.message ?? answer.error) : null };
  });
  let kept = false;
  for (let tries = 0; tries < 40 && !kept; tries += 1) {
    const now = await (await fetch(`${PREVIEW}/graview/state`, { headers: { ...seatHeaders(principal), origin: PREVIEW } })).json();
    kept = (now.snapshot?.nodes ?? []).some((node) => node.kind === "person" && node.handle === "lee-c");
    if (!kept) await new Promise((ready) => setTimeout(ready, 250));
  }
  const wire = sockets.filter((one) => one.url.startsWith(FACE.replace(/^http/, "ws") + "/graview/"));
  claim("a change another seat makes on the preview reaches the open face live, over the socket the proxy carries, and a change made on the face is kept by the preview's store", sent.ok && arrived && made.ok && kept && wire.some((one) => one.open && one.frames > 0), { status: sent.status, arrived, made, kept, sockets });
  await page.close();
  claim("no page threw", errors.length === 0, errors);
} catch (error) {
  report.error = String(error?.stack ?? error);
} finally {
  await browser?.close();
  for (const child of children) child.kill();
}

report.passed = !report.error && Object.values(report.claims).every((one) => one.ok);
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/face-recipe.json"), `${JSON.stringify(report, null, 2)}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/face-recipe.json\n");
process.exit(report.passed ? 0 : 1);
