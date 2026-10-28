#!/usr/bin/env node
/**
 * A BLANK FACT AN ACT WRITES IS AN EMPTY SLOT ON THE RECORD'S PAGE (Roadmap
 * request:record-pages-draw-writable-but-blank-facts-as-empty-editable-slots).
 *
 * A placement made without its allocation or its role had nowhere on its own
 * page to be given them: a blank fact was not drawn, and the act that writes
 * it (`edit-placement`) surfaces only as the editor on a fact. The app is a
 * staffing firm's placements, mounted the way Cloud mounts one — the embed on
 * a host's page that is the app, built with esbuild from the workspace's
 * sources (`scripts/fixtures/blank-facts/staffing-app.ts`). At desk width, in
 * three engines, it asks:
 *
 *   sat down as staffing, a placement's blank allocation and role are each
 *   its label and a dim "add" named "Add Allocation", reached by Tab,
 *   opened by Enter into the same editor a value opens, and the allocation
 *   typed there is kept and said as the fact;
 *   a blank no act writes (`source`, fixed) is not said at all;
 *   sat down as a reader, the record is drawn with no slot to fill.
 *
 *   node scripts/verify-blank-facts.mjs [--engine=chromium|webkit|firefox] [--quick]
 */
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { vacant } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const STAFFING = resolve(repoRoot, "scripts/fixtures/blank-facts/staffing-app.ts");
const DESK = { width: 1280, height: 800 };
const RECORD = "/placements/placement-4";

const report = { at: new Date().toISOString(), engines, width: DESK.width, checks: {} };

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Staffing</title>
<style>body{margin:0;font:16px/1.4 system-ui,sans-serif;background:#f7f7f4;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the page IS the app, sat down as `?as=rui` (the reader) or staffing. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-blank-facts-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { staffingApp, staffingSeed, ana, rui } from ${JSON.stringify(STAFFING)};
        const query = new URLSearchParams(location.search);
        window.__handle = mount(document.getElementById("app"), {
          app: staffingApp,
          seed: staffingSeed,
          face: "pages",
          routing: "address",
          principal: query.get("as") === "rui" ? rui : ana,
          label: staffingApp.name,
          heading: 1,
          height: "100dvh",
          fonts: false,
          studio: false,
          locale: "en-US",
        });
        window.__handle.drawn().then(() => { window.__ready = true; });`,
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
  writeFileSync(join(out, "index.html"), HOST_PAGE);
  const host = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = join(out, path);
    const script = path.endsWith(".js");
    if (!file.startsWith(out) || (script && !existsSync(file))) {
      response.writeHead(404);
      response.end();
      return;
    }
    // Every address that is no script is the one page, as a host whose page is the app answers it.
    response.writeHead(200, { "content-type": script ? "text/javascript" : "text/html" });
    response.end(readFileSync(script ? file : join(out, "index.html")));
  });
  await vacant(portFor("blank-facts-host"));
  await new Promise((ready) => host.listen(portFor("blank-facts-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

async function until(page, check, timeout = 10_000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > end) return false;
    await page.waitForTimeout(100);
  }
}

const FACTS = '[data-testid="record-fields"]';
/** Every slot on the page: its field, its label, its words, its name and its size. */
const slotsOf = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-graview-blank-fact]")].map((slot) => {
      const button = slot.querySelector("button[data-graview-blank]");
      const box = button?.getBoundingClientRect();
      return {
        field: slot.getAttribute("data-graview-blank-fact"),
        label: slot.querySelector("dt")?.textContent ?? "",
        words: button?.textContent ?? null,
        name: button?.getAttribute("aria-label") ?? null,
        width: box ? Math.round(box.width) : 0,
        height: box ? Math.round(box.height) : 0,
      };
    }),
  );

const host = await buildHost();
const errors = [];
const seen = { slot: [], hidden: [], reader: [] };
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    const where = { engine, width: DESK.width };
    const open = async (query) => {
      const context = await browser.newContext({ viewport: DESK, locale: "en-US" });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${engine} ${RECORD}?${query}: ${error.message}`));
      await page.goto(`${at("blank-facts-host")}${RECORD}?${query}`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
      await until(page, () => page.evaluate(() => document.querySelector("[data-graview-page-title]") !== null));
      return { page, close: () => context.close() };
    };
    const attempt = async (list, query, run) => {
      const { page, close } = await open(query);
      try {
        list.push({ ...where, ...(await run(page)) });
      } catch (error) {
        list.push({ ...where, error: String(error.message ?? error).split("\n")[0] });
      }
      await close();
    };

    /* STAFFING: the blank allocation is a slot, reached by Tab, opened by Enter, filled. */
    await attempt(seen.slot, "as=ana", async (page) => {
      await until(page, () => page.evaluate(() => document.querySelector("[data-graview-blank-fact]") !== null));
      const slots = await slotsOf(page);
      // Tab from the top of the page until the keyboard stands on the allocation's slot.
      await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
      let reached = false;
      for (let step = 0; step < 80 && !reached; step++) {
        await page.keyboard.press("Tab");
        reached = await page.evaluate(() => document.activeElement?.closest('[data-graview-blank-fact="allocation"]') !== null && document.activeElement?.hasAttribute("data-graview-blank") === true);
      }
      let opened = false;
      let said = "";
      let stillASlot = true;
      if (reached) {
        await page.keyboard.press("Enter");
        opened = await until(page, () => page.evaluate(() => document.activeElement?.matches('[data-graview-blank-fact="allocation"] input') === true), 3000);
        if (opened) {
          await page.keyboard.type("60");
          await page.keyboard.press("Enter");
          await until(page, () => page.evaluate(() => document.querySelector('[data-graview-blank-fact="allocation"]') === null), 3000);
          stillASlot = await page.evaluate(() => document.querySelector('[data-graview-blank-fact="allocation"]') !== null);
          // Said from the store the page reads: the act ran and the fact holds what was typed.
          said = await page.evaluate(() => document.querySelector('[data-testid="record-fields"] [data-graview-field="allocation"]')?.textContent ?? "");
        }
      }
      return { slots, reached, opened, said, stillASlot };
    });

    /* STAFFING: a blank no act writes is not said. */
    await attempt(seen.hidden, "as=ana", async (page) => {
      await until(page, () => page.evaluate(() => document.querySelector("[data-graview-blank-fact]") !== null));
      const facts = await page.evaluate((scope) => document.querySelector(scope)?.textContent ?? "", FACTS);
      const slots = await slotsOf(page);
      return { slots: slots.map((slot) => slot.field), saysSource: /Source/.test(facts) };
    });

    /* A READER: the record, and no slot to fill. */
    await attempt(seen.reader, "as=rui", async (page) => {
      await page.waitForTimeout(500);
      const title = await page.evaluate(() => document.querySelector("[data-graview-page-title]")?.textContent ?? "");
      const slots = await slotsOf(page);
      return { title, slots: slots.map((slot) => slot.field) };
    });
    await browser.close();
    browser = undefined;
  }
} finally {
  if (browser) await browser.close();
  host.stop();
}

const all = (list, claim) => list.length === engines.length && list.every((one) => !one.error && claim(one));
report.checks.aBlankFieldAnActWritesIsAnEmptySlot = {
  seen: seen.slot,
  ok: all(seen.slot, (one) => {
    const allocation = one.slots.find((slot) => slot.field === "allocation");
    const role = one.slots.find((slot) => slot.field === "role");
    return (
      allocation?.label === "Allocation" && allocation.words === "add" && allocation.name === "Add Allocation" && allocation.width >= 24 && allocation.height >= 24 &&
      role?.name === "Add Role" &&
      one.reached && one.opened && one.said === "60" && !one.stillASlot
    );
  }),
};
report.checks.aBlankFieldNoActWritesStaysHidden = {
  seen: seen.hidden,
  ok: all(seen.hidden, (one) => !one.slots.includes("source") && !one.saysSource && one.slots.includes("allocation")),
};
report.checks.aReaderSeesNoEmptySlot = {
  seen: seen.reader,
  ok: all(seen.reader, (one) => one.title.includes("Placement 4") && one.slots.length === 0),
};
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/blank-facts.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/blank-facts.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
