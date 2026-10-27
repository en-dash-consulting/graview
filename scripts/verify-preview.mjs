#!/usr/bin/env node
/**
 * A DOCUMENT AND A SEED, LOOKED AT WITH NO PRODUCT (`graview preview`,
 * `graview shots`).
 *
 * `graview serve` was the store and drew nothing, so n-dx built a product
 * only to see its projection, and proved every change with hand-written
 * Playwright screenshots. This runs the built command line the way a
 * stranger runs it — `graview preview <document> --seed <snapshot>` over
 * Graview Cloud's org document, no product, no vite — and asks a browser:
 *
 *   the routed face draws the home, says the seed's records, and lists a
 *   kind's records at its own address;
 *   the scene draws the graph's districts at the overview's address, and a
 *   reload stays there;
 *   a change another seat makes on the served store reaches the open page,
 *   live, and the command's store holds it;
 *   `graview shots` writes a PNG for each named place, and refuses a place
 *   the app has not got, naming the ones it has;
 *   and a full-page picture of a place taller than the window is the whole
 *   place, its last row in it, though the place scrolls inside the embed;
 *   and pictures an app declared in code, a draft view's place named by its
 *   title;
 *   and pictures a declared lens's place with the lens drawn in it, not its
 *   page's head over nothing;
 *   and a visitor opens a form at /forms/rsvp (Roadmap f-public-forms),
 *   fills it and submits at 390 and 1440: the guest lands on the store as
 *   "a visitor via the RSVP form", a visitor minted per page, and nothing
 *   of the records already there is drawn or sent to the page;
 *   and the same RSVP declared on-publish: a visitor's answer lands, and a
 *   table the hosts add reaches a reader only once they publish;
 *   and the org given an opening screen (`brand.splash`, Roadmap
 *   f-splash-in-document) opens on it — in the first HTML, on the page
 *   before the app's code ran, gone once the place has drawn.
 *
 *   node scripts/verify-preview.mjs [--engine=chromium|webkit|firefox]
 *
 * Writes docs/preview.json.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
// The previews this starts answer only with the run's key: sent from here, and traded for each browser's cookie.
import { admit, keyedFetch as fetch, scrub } from "./lib/serve-key.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { vacant } from "./lib/serve.mjs";
import { seatHeaders } from "../packages/ship/dist/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const CLI = resolve(repoRoot, "packages/graview/dist/cli.js");
const DOCUMENT = "packages/core/tests/document/fixtures/org.gdd.json";
const SEED = "packages/core/tests/document/fixtures/org.seed.json";
const FORM_DOCUMENT = "packages/core/tests/document/fixtures/rsvp.gdd.json";
const FORM_SEED = "packages/core/tests/document/fixtures/rsvp.seed.json";
const LENS_DOCUMENT = "packages/core/tests/document/fixtures/threat-watch.gdd.json";
const LENS_SEED = "packages/core/tests/document/fixtures/threat-watch.seed.json";
const seed = JSON.parse(readFileSync(resolve(repoRoot, SEED), "utf8"));
const person = seed.nodes.find((node) => node.kind === "person");
const report = { at: new Date().toISOString(), engine: ENGINE, document: DOCUMENT, seed: SEED, checks: {} };

if (!existsSync(resolve(repoRoot, "packages/graview/dist/preview/index.html"))) {
  process.stderr.write("verify-preview: packages/graview/dist/preview is not built. Run pnpm build first.\n");
  process.exit(1);
}

await vacant(portFor("preview"), portFor("preview-shots"), portFor("preview-form"), portFor("preview-publishing"), portFor("preview-splash"));
const server = spawn(process.execPath, [CLI, "preview", DOCUMENT, "--seed", SEED, "--port", String(portFor("preview"))], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
let said = "";
server.stdout.on("data", (chunk) => (said += chunk));
server.stderr.on("data", (chunk) => (said += chunk));
const base = at("preview");
const started = Date.now();
for (;;) {
  try {
    if ((await fetch(`${base}/graview/health`)).ok) break;
  } catch {
    // not listening yet
  }
  if (Date.now() - started > 30_000 || server.exitCode !== null) {
    process.stderr.write(`verify-preview: graview preview did not start:\n${said}\n`);
    server.kill();
    process.exit(1);
  }
  await new Promise((ready) => setTimeout(ready, 200));
}
await admit(base);
report.said = scrub(said).trim().split("\n");

let browser;
const errors = [];
const shotsDir = mkdtempSync(join(tmpdir(), "graview-shots-"));
try {
  browser = await launchEngine(ENGINE);
  const open = async (path, viewport = { width: 1280, height: 900 }) => {
    const page = await browser.newPage({ viewport, colorScheme: "light" });
    page.on("pageerror", (error) => errors.push(`${path}: ${error.message}`));
    await page.goto(`${base}${path}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__graviewReady === true || typeof window.__graviewFailed === "string", null, { timeout: 60_000 });
    await page.waitForTimeout(800);
    return page;
  };

  /* ---- the routed face: the home, and a kind's list at its own address */
  {
    const page = await open("/");
    const home = await page.evaluate(() => ({
      failed: window.__graviewFailed ?? null,
      title: document.title,
      bar: document.querySelector('[data-testid="app-face-scene"]') !== null,
      text: document.body.innerText,
    }));
    await page.close();
    report.checks.thePagesFaceDrawsTheHome = { failed: home.failed, title: home.title, bar: home.bar, ok: !home.failed && home.title === "En Dash Org" && home.bar && home.text.includes(person.name) };
    const list = await open("/people");
    const listed = await list.evaluate(() => ({ heading: document.querySelector("[data-graview-page-title]")?.textContent?.trim() ?? null, text: document.body.innerText }));
    await list.close();
    report.checks.aKindsRecordsAreListedAtItsAddress = { heading: listed.heading, ok: listed.heading === "People" && listed.text.includes(person.name) };
  }

  /* ---- the scene: the overview's address draws the districts, and a reload stays */
  {
    const page = await open("/places/overview");
    const drawn = () =>
      page.evaluate(() => ({
        sceneOn: document.querySelector('[data-testid="app-face-scene"]')?.getAttribute("aria-pressed") === "true",
        districts: document.querySelectorAll(".graview-ground *").length,
        path: location.pathname,
      }));
    const first = await drawn();
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.__graviewReady === true, null, { timeout: 60_000 });
    await page.waitForTimeout(800);
    const again = await drawn();
    await page.close();
    report.checks.theSceneDrawsTheGraphAtTheOverviewsAddress = { first, again, ok: first.sceneOn && first.districts > 10 && again.sceneOn && again.path === "/places/overview" };
  }

  /* ---- the store is the served one: a change another seat makes on the served store reaches the open page, live */
  {
    const page = await open("/people");
    const { principal } = await (await fetch(`${base}/graview/document`)).json();
    const sent = await fetch(`${base}/graview/ops`, {
      method: "POST",
      headers: { "content-type": "application/json", ...seatHeaders({ ...principal, id: "someone-else" }) },
      body: JSON.stringify({ calls: [{ name: "add-person", args: { name: "Grace Hopper", role: "Visiting" } }] }),
    });
    const arrived = await page
      .waitForFunction(() => document.body.innerText.includes("Grace Hopper"), null, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    await page.close();
    const state = await (await fetch(`${base}/graview/state`, { headers: seatHeaders(principal) })).json();
    report.checks.aChangeOnTheServedStoreReachesThePage = { status: sent.status, arrived, nodes: state.snapshot?.nodes?.length, ok: sent.ok && arrived && state.snapshot?.nodes?.length === seed.nodes.length + 1 };
  }

  /* ---- graview shots: a PNG a place, and a place it has not got refused by name */
  {
    const run = (places) =>
      spawnSync(process.execPath, [CLI, "shots", DOCUMENT, "--seed", SEED, "--places", places, "--out", shotsDir, "--port", String(portFor("preview-shots"))], { cwd: repoRoot, encoding: "utf8", timeout: 180_000 });
    const taken = run("home,overview,people");
    const files = ["home", "overview", "people"].map((name) => join(shotsDir, `${name}-light-1280.png`));
    const pngs = files.map((file) => existsSync(file) && statSync(file).size > 10_000 && readFileSync(file).subarray(1, 4).toString() === "PNG");
    report.checks.shotsWritesAPngForEachNamedPlace = { status: taken.status, said: taken.stdout.trim().split("\n").at(-1), pngs, ok: taken.status === 0 && pngs.every(Boolean) };
    const refused = run("nowhere");
    report.checks.shotsRefusesAPlaceTheAppHasNot = { status: refused.status, said: refused.stderr.trim(), ok: refused.status === 2 && refused.stderr.includes('no place called "nowhere"') && refused.stderr.includes("people") };
  }

  /*
   * ---- graview shots of a place taller than the window: the whole place,
   * not the window's worth. The page scrolls inside the embed's box, which
   * Playwright's fullPage does not see; Threat Watch's By type (fourteen
   * threats in four groups) is about 1,400 pixels on a desk.
   */
  {
    const out = join(shotsDir, "long");
    const taken = spawnSync(
      process.execPath,
      [CLI, "shots", "packages/core/tests/document/fixtures/threat-watch.gdd.json", "--seed", "packages/core/tests/document/fixtures/threat-watch.seed.json", "--places", "By type", "--scheme", "light", "--width", "1280", "--out", out, "--port", String(portFor("preview-shots"))],
      { cwd: repoRoot, encoding: "utf8", timeout: 180_000 },
    );
    const file = join(out, "by-type-light-1280.png");
    let picture = null;
    if (existsSync(file)) {
      // The picture read back in the browser: its size, and the lowest row of pixels that is not the page's ground.
      const page = await browser.newPage();
      picture = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
        const ground = data.slice((200 * width + 8) * 4, (200 * width + 8) * 4 + 3);
        let lowestInk = -1;
        for (let y = height - 1; y >= 0 && lowestInk < 0; y--) {
          for (let x = 40; x < width - 40; x++) {
            const i = (y * width + x) * 4;
            if (Math.abs(data[i] - ground[0]) + Math.abs(data[i + 1] - ground[1]) + Math.abs(data[i + 2] - ground[2]) > 60) {
              lowestInk = y;
              break;
            }
          }
        }
        return { width, height, lowestInk };
      }, `data:image/png;base64,${readFileSync(file).toString("base64")}`);
      await page.close();
    }
    /*
     * Taller than the window (900 on a desk), and its last row drawn in it:
     * ink below the window's foot, with no more than the page's own bottom
     * margin under it — a picture cut at the window has ink to its edge.
     */
    report.checks.aFullPagePictureOfALongPlaceShowsTheWholePlace = {
      status: taken.status,
      said: (taken.stdout.trim().split("\n").at(-1) ?? "") + taken.stderr.trim(),
      picture,
      ok: taken.status === 0 && picture !== null && picture.height > 900 && picture.lowestInk > 900 && picture.height - picture.lowestInk > 24 && picture.height - picture.lowestInk < 240,
    };
  }

  /* ---- graview shots of an app declared in code (W-245), its draft view's place named by its title (W-243) */
  {
    const fixture = (name) => `packages/guest/tests/fixtures/survey/${name}`;
    const out = join(shotsDir, "in-code");
    const taken = spawnSync(
      process.execPath,
      [CLI, "shots", fixture("app.mjs"), "--seed", fixture("seed.json"), "--view", fixture("glance.js"), "--manifest", fixture("glance.manifest.json"), "--places", "Stations at a glance,Stations", "--out", out, "--port", String(portFor("preview-shots"))],
      { cwd: repoRoot, encoding: "utf8", timeout: 180_000 },
    );
    const files = ["stations-at-a-glance", "stations"].map((name) => join(out, `${name}-light-1280.png`));
    const pngs = files.map((file) => existsSync(file) && statSync(file).size > 10_000 && readFileSync(file).subarray(1, 4).toString() === "PNG");
    report.checks.shotsPicturesAnAppInCodeAndItsDraftByTitle = { status: taken.status, said: (taken.stdout.trim().split("\n").at(-1) ?? "") + taken.stderr.trim(), pngs, ok: taken.status === 0 && pngs.every(Boolean) };
  }

  /*
   * ---- graview shots of a declared lens's place: the picture shows the lens, not its page's head over nothing.
   * The page said data-graview-drawn while a blocks lens was still to be drawn (its module here, its reveal held
   * back by React a moment), and "What to do" was photographed as a title and a line. Read from the PNG itself:
   * how many rows of pixels under the head differ from the page's ground.
   */
  {
    const out = join(shotsDir, "lens");
    const taken = spawnSync(
      process.execPath,
      [CLI, "shots", LENS_DOCUMENT, "--seed", LENS_SEED, "--places", "What to do,Active now", "--out", out, "--port", String(portFor("preview-shots"))],
      { cwd: repoRoot, encoding: "utf8", timeout: 180_000 },
    );
    const pictures = {};
    const reader = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    for (const name of ["what-to-do", "active-now"]) {
      const file = join(out, `${name}-light-1280.png`);
      if (!existsSync(file)) {
        pictures[name] = { written: false, ok: false };
        continue;
      }
      const inked = await reader.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, image.width, image.height);
        const at = (x, y) => (y * image.width + x) * 4;
        const ground = at(image.width - 4, image.height - 4);
        let rows = 0;
        // Under the page's title, its line and "All … as a list": where the lens draws.
        for (let y = 220; y < image.height; y += 1) {
          for (let x = 0; x < image.width; x += 2) {
            const i = at(x, y);
            if (Math.abs(data[i] - data[ground]) + Math.abs(data[i + 1] - data[ground + 1]) + Math.abs(data[i + 2] - data[ground + 2]) > 60) {
              rows += 1;
              break;
            }
          }
        }
        return rows;
      }, `data:image/png;base64,${readFileSync(file).toString("base64")}`);
      pictures[name] = { written: true, inkedRowsUnderTheHead: inked, ok: inked >= 100 };
    }
    await reader.close();
    report.checks.aLensPlacesPictureShowsTheLensContent = { status: taken.status, said: (taken.stdout.trim().split("\n").at(-1) ?? "") + taken.stderr.trim(), pictures, ok: taken.status === 0 && Object.values(pictures).every((one) => one.ok) };
  }

  /* ---- a form for a visitor (Roadmap f-public-forms): /forms/rsvp drawn alone, answered, and nothing of the app shown or sent */
  {
    const formServer = spawn(process.execPath, [CLI, "preview", FORM_DOCUMENT, "--seed", FORM_SEED, "--port", String(portFor("preview-form"))], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let formSaid = "";
    formServer.stdout.on("data", (chunk) => (formSaid += chunk));
    formServer.stderr.on("data", (chunk) => (formSaid += chunk));
    const formBase = at("preview-form");
    try {
      const began = Date.now();
      for (;;) {
        try {
          if ((await fetch(`${formBase}/graview/health`)).ok) break;
        } catch {
          // not listening yet
        }
        if (Date.now() - began > 30_000 || formServer.exitCode !== null) throw new Error(`graview preview of the RSVP did not start:\n${formSaid}`);
        await new Promise((ready) => setTimeout(ready, 200));
      }
      await admit(formBase);
      // What the visitor must never be shown or sent: every record already there, by what it says.
      const others = ["Grace Hopper", "grace@example.com", "Arriving late", "Rose table", "guest-grace", "table-rose"];
      const { principal: host } = await (await fetch(`${formBase}/graview/document`)).json();
      const widths = {};
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: "light" });
        page.on("pageerror", (error) => errors.push(`/forms/rsvp at ${width}: ${error.message}`));
        // Every answer the page is sent from the server, read for a record it must not hold.
        const sent = [];
        page.on("response", (response) => {
          if (new URL(response.url()).pathname.startsWith("/graview/")) sent.push(response.text().catch(() => ""));
        });
        await page.goto(`${formBase}/forms/rsvp`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__graviewReady === true || typeof window.__graviewFailed === "string", null, { timeout: 60_000 });
        const drawn = await page.evaluate(() => ({
          failed: window.__graviewFailed ?? null,
          title: document.querySelector("h1")?.textContent ?? null,
          fields: [...document.querySelectorAll("form [name]")].map((el) => el.getAttribute("name")),
          bar: document.querySelectorAll('nav, [data-testid^="app-face"], [data-testid^="app-place"]').length,
          links: document.querySelectorAll("a[href]").length,
          sideways: document.documentElement.scrollWidth > window.innerWidth,
          text: document.body.innerText,
        }));
        const name = `Ada Lovelace ${width}`;
        await page.fill('input[name="name"]', name);
        await page.selectOption('select[name="coming"]', "maybe");
        await page.click('button[type="submit"]');
        const received = await page
          .waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("Received"), null, { timeout: 15_000 })
          .then(() => true)
          .catch(() => false);
        const after = await page.evaluate(() => ({ status: document.querySelector('[role="status"]')?.textContent ?? null, focused: document.activeElement?.getAttribute("role") ?? document.activeElement?.tagName ?? null, text: document.body.innerText }));
        await page.waitForTimeout(300);
        const bodies = (await Promise.all(sent)).join("\n");
        await page.close();
        const state = await (await fetch(`${formBase}/graview/state`, { headers: seatHeaders(host) })).json();
        const landed = (state.snapshot?.nodes ?? []).find((node) => node.name === name);
        const shown = others.filter((said) => drawn.text.includes(said) || after.text.includes(said));
        const leaked = others.filter((said) => bodies.includes(said));
        widths[width] = {
          failed: drawn.failed,
          title: drawn.title,
          fields: drawn.fields,
          bar: drawn.bar,
          links: drawn.links,
          sideways: drawn.sideways,
          received,
          status: after.status,
          focused: after.focused,
          landed: landed ? { kind: landed.kind, coming: landed.coming } : null,
          shown,
          leaked,
          ok:
            !drawn.failed &&
            drawn.title === "RSVP" &&
            drawn.fields.join() === "name,email,coming,note" &&
            drawn.bar === 0 &&
            drawn.links === 0 &&
            !drawn.sideways &&
            received &&
            after.status?.includes("the hosts will write to you") === true &&
            after.focused === "status" &&
            landed?.kind === "guest" &&
            landed?.coming === "maybe" &&
            shown.length === 0 &&
            leaked.length === 0,
        };
      }
      const log = await (await fetch(`${formBase}/graview/state`, { headers: seatHeaders(host) })).json();
      const authors = (log.log ?? log.ops ?? []).filter((op) => String(op.intent ?? "").includes("Ada Lovelace")).map((op) => op.author);
      const named = authors.length === 2 && authors.every((author) => author?.name === "a visitor via the RSVP form" && /^form:/.test(author.id ?? "") && author.roles?.join() === "visitor") && authors[0].id !== authors[1].id;
      report.checks.aVisitorAnswersAFormAndSeesNoOtherRecord = { widths, authors, ok: Object.values(widths).every((one) => one.ok) && named };
    } catch (error) {
      report.checks.aVisitorAnswersAFormAndSeesNoOtherRecord = { error: String(error?.stack ?? error), ok: false };
    } finally {
      formServer.kill();
    }
  }

  /*
   * ---- an app that publishes (Roadmap f-publishing-lifecycle): the RSVP declared `on-publish`, the hosts working on it and
   * everyone reading its tables. A visitor's form answer lands on the store; a table the hosts add is not served to a reader
   * until they publish, and then is, with `servedThrough` a new cursor (opaque: a client neither reads nor compares one).
   */
  {
    const dir = mkdtempSync(join(tmpdir(), "graview-publishing-"));
    const declared = JSON.parse(readFileSync(resolve(repoRoot, FORM_DOCUMENT), "utf8"));
    declared.publishing = { mode: "on-publish", working: ["host"] };
    declared.policy.sees = [...declared.policy.sees, { roles: "*", kinds: ["table"] }];
    const file = join(dir, "rsvp-published.gdd.json");
    writeFileSync(file, JSON.stringify(declared));
    const publishingServer = spawn(process.execPath, [CLI, "preview", file, "--seed", FORM_SEED, "--port", String(portFor("preview-publishing"))], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let publishingSaid = "";
    publishingServer.stdout.on("data", (chunk) => (publishingSaid += chunk));
    publishingServer.stderr.on("data", (chunk) => (publishingSaid += chunk));
    const publishingBase = at("preview-publishing");
    try {
      const began = Date.now();
      for (;;) {
        try {
          if ((await fetch(`${publishingBase}/graview/health`)).ok) break;
        } catch {
          // not listening yet
        }
        if (Date.now() - began > 30_000 || publishingServer.exitCode !== null) throw new Error(`graview preview of the RSVP that publishes did not start:\n${publishingSaid}`);
        await new Promise((ready) => setTimeout(ready, 200));
      }
      await admit(publishingBase);
      const { principal: host } = await (await fetch(`${publishingBase}/graview/document`)).json();
      const reader = { kind: "human", id: "reader", name: "A reader", roles: [] };
      const stateOf = async (seat) => (await fetch(`${publishingBase}/graview/state`, { headers: seatHeaders(seat) })).json();
      const post = async (body) => (await fetch(`${publishingBase}/graview/ops`, { method: "POST", headers: { ...seatHeaders(host), "content-type": "application/json" }, body: JSON.stringify(body) })).json();
      const tables = (state) => (state.snapshot?.nodes ?? []).filter((node) => node.kind === "table").map((node) => node.name);
      // A visitor answers the form on the page, and it lands on the store.
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, colorScheme: "light" });
      page.on("pageerror", (error) => errors.push(`/forms/rsvp that publishes: ${error.message}`));
      await page.goto(`${publishingBase}/forms/rsvp`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__graviewReady === true || typeof window.__graviewFailed === "string", null, { timeout: 60_000 });
      await page.fill('input[name="name"]', "Mary Somerville");
      await page.selectOption('select[name="coming"]', "yes");
      await page.click('button[type="submit"]');
      const received = await page
        .waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("Received"), null, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      await page.close();
      const answered = (await stateOf(host)).snapshot?.nodes?.some((node) => node.name === "Mary Somerville") === true;
      // The hosts add a table: their own state holds it, a reader's does not.
      await post({ calls: [{ name: "add-table", args: { name: "Unpublished table" } }] });
      const before = { host: tables(await stateOf(host)), reader: await stateOf(reader) };
      await post({ calls: [{ name: "publish", args: {} }] });
      const after = await stateOf(reader);
      const unpublishedHidden = before.host.includes("Unpublished table") && !tables(before.reader).includes("Unpublished table");
      const publishedShown = tables(after).includes("Unpublished table");
      report.checks.aReaderIsServedWhatWasPublished = {
        received,
        answered,
        hostTables: before.host,
        readerTablesBefore: tables(before.reader),
        readerTablesAfter: tables(after),
        servedThrough: { before: before.reader.servedThrough ?? null, after: after.servedThrough ?? null },
        ok: received && answered && unpublishedHidden && publishedShown && typeof after.servedThrough === "string" && after.servedThrough !== before.reader.servedThrough,
      };
    } catch (error) {
      report.checks.aReaderIsServedWhatWasPublished = { error: String(error?.stack ?? error), ok: false };
    } finally {
      publishingServer.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  }

  /*
   * ---- an app's opening screen (Roadmap f-splash-in-document): the org document given `brand.splash`, served by the
   * same command. The page's first HTML carries the screen before the app's root, it is on the page when the document
   * has parsed (before any of the app's code ran), and it is gone once the place says data-graview-drawn — for the
   * shader screen (its WebGL canvas, or the editorial look where the browser has none) and the ascii one alike.
   */
  {
    const dir = mkdtempSync(join(tmpdir(), "graview-splash-"));
    const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#0f6e5c"/><circle cx="12" cy="3" r="2" fill="#f7f7f2"/></svg>';
    const styles = {};
    for (const style of ["shader", "ascii"]) {
      const declared = JSON.parse(readFileSync(resolve(repoRoot, DOCUMENT), "utf8"));
      declared.brand = { ...(declared.brand ?? {}), splash: { style, image: SVG, kicker: "Who does what" } };
      const file = join(dir, `org-${style}.gdd.json`);
      writeFileSync(file, JSON.stringify(declared));
      await vacant(portFor("preview-splash"));
      const splashServer = spawn(process.execPath, [CLI, "preview", file, "--seed", SEED, "--port", String(portFor("preview-splash"))], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
      let splashSaid = "";
      splashServer.stdout.on("data", (chunk) => (splashSaid += chunk));
      splashServer.stderr.on("data", (chunk) => (splashSaid += chunk));
      const splashBase = at("preview-splash");
      const stopped = new Promise((done) => splashServer.on("exit", done));
      try {
        const began = Date.now();
        for (;;) {
          try {
            if ((await fetch(`${splashBase}/graview/health`)).ok) break;
          } catch {
            // not listening yet
          }
          if (Date.now() - began > 30_000 || splashServer.exitCode !== null) throw new Error(`graview preview of the org with a ${style} screen did not start:\n${splashSaid}`);
          await new Promise((ready) => setTimeout(ready, 200));
        }
        await admit(splashBase);
        const served = await (await fetch(`${splashBase}/`)).text();
        const inFirstHtml = served.indexOf('id="graview-splash"') > -1 && served.indexOf('id="graview-splash"') < served.indexOf('id="graview-app"') && served.includes(`data-style="${style}"`);
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
        page.on("pageerror", (error) => errors.push(`/ with a ${style} screen: ${error.message}`));
        // Whether the screen stood on the page the moment the document had parsed, before the app's module ran.
        await page.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => {
            const screen = document.getElementById("graview-splash");
            window.__splashAtStart = screen !== null && getComputedStyle(screen).display !== "none" && screen.matches(":popover-open");
          });
        });
        await page.goto(`${splashBase}/`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__graviewReady === true || typeof window.__graviewFailed === "string", null, { timeout: 60_000 });
        await page.waitForSelector("[data-graview-drawn]", { state: "attached", timeout: 60_000 });
        const gone = await page
          .waitForFunction(() => document.getElementById("graview-splash") === null, null, { timeout: 5_000 })
          .then(() => true)
          .catch(() => false);
        const seen = await page.evaluate(() => ({ atStart: window.__splashAtStart === true, failed: window.__graviewFailed ?? null, title: document.title }));
        await page.close();
        styles[style] = { inFirstHtml, ...seen, gone, ok: inFirstHtml && seen.atStart && gone && !seen.failed };
      } catch (error) {
        styles[style] = { error: String(error?.stack ?? error), ok: false };
      } finally {
        splashServer.kill();
        await stopped;
      }
    }
    rmSync(dir, { recursive: true, force: true });
    report.checks.anOpeningScreenCoversThePageUntilItsPlaceHasDrawn = { styles, ok: Object.values(styles).every((one) => one.ok) };
  }

  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  server.kill();
  rmSync(shotsDir, { recursive: true, force: true });
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/preview.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/preview.json\n");
process.exit(report.passed ? 0 : 1);
