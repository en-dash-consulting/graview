#!/usr/bin/env node
/**
 * LONG TEXT ON A RECORD'S PAGE (FR-146, FR-147, FR-148).
 *
 * Graview Cloud, on Nick's "Farm Bureau POM Workshop": a deliverable holds
 * an email drafted in full — a `text` field `draft` of about three
 * thousand characters, its paragraphs, a numbered list and two bulleted
 * lists written as `\n` and `\n\n` — and a `string` field `subject`. The
 * record drew the draft as one continuous block (the line breaks
 * collapsed), in a value column a third of the page wide under "Status",
 * "Summary" and "Due" in the same style, and its facts in the order the
 * record's keys happened to be written (Status, Summary, Due, Draft,
 * Subject line) rather than the order the kind declares them; nothing
 * could set that order.
 *
 * The app is a document mounted the way Cloud mounts one — the embed on a
 * host's page that is the app, built with esbuild from the workspace's
 * sources (`scripts/fixtures/long-text/workshop.gdd.json`): the
 * deliverable as Cloud's chat declared it (due, name, status, summary,
 * subject, draft), the email's record written in the order Cloud wrote it,
 * and a place, "Email to Todd", whose cards say `{draft}` in a text block.
 * On the routed record page (at 390 and 1280 wide) and the scene's record
 * (at 1280), in three engines and both schemes, it asks:
 *
 *   the draft keeps its paragraphs and its lists — ten paragraphs, a
 *   numbered list of four, bulleted lists of six — drawn as <p>, <ol> and
 *   <ul>; its value spans the record's width with its label above it;
 *   the facts follow the kind's declared order (Due, Status, Summary,
 *   Subject line, Draft); and, with `kinds.deliverable.page` set to put the
 *   subject and the draft first and the dates under "Schedule", they
 *   follow that, the rest under "Details";
 *
 *   editing the draft in place opens a text area that holds every line
 *   break, is as tall as the text, is named for the field; adding a
 *   paragraph and saving puts it in the store with the others intact,
 *   and the page draws eleven paragraphs;
 *
 *   a place's card that says `{draft}` in a text block keeps the
 *   paragraphs and lists too.
 *
 *   node scripts/verify-long-text.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>]
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, launchEngine } from "./lib/engine.mjs";
import { graviewSources } from "./lib/graview-sources.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const QUICK = process.argv.includes("--quick") || process.env["GRAVIEW_QUICK"] === "1";
const engines = asked ? [asked] : QUICK ? ["chromium"] : ENGINES;
const SCHEMES = QUICK ? ["light"] : ["light", "dark"];
/** `--shots=<dir>`: each screen, for a person to look at. */
const SHOTS = process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length);
const PROBE = process.argv.includes("--probe");
const WORKSHOP = resolve(repoRoot, "scripts/fixtures/long-text/workshop.gdd.json");
const WORKSHOP_SEED = resolve(repoRoot, "scripts/fixtures/long-text/workshop.seed.json");
const SEED = JSON.parse(readFileSync(WORKSHOP_SEED, "utf8"));
const EMAIL = SEED.nodes.find((node) => node.id === "email");
/** What the draft holds, counted from the text itself: blocks split on blank lines. */
const BLOCKS = EMAIL.draft.split(/\n{2,}/);
const LISTED = (marker) => BLOCKS.filter((block) => block.split("\n").every((line) => marker.test(line)));
const PARAGRAPHS = BLOCKS.length - LISTED(/^\d+\.\s/).length - LISTED(/^[-*]\s/).length;
const NUMBERED = LISTED(/^\d+\.\s/).reduce((count, block) => count + block.split("\n").length, 0);
const BULLETED = LISTED(/^[-*]\s/).reduce((count, block) => count + block.split("\n").length, 0);
/**
 * The facts in the kind's declared order. The scene's record leaves out the
 * name, which is its heading and the control that renames it; the routed
 * page lists it among the facts.
 */
const DECLARED = { pages: ["Due", "Name", "Status", "Summary", "Subject line", "Draft"], graview: ["Due", "Status", "Summary", "Subject line", "Draft"] };
/** The page the `page=1` variant declares: the subject and the draft first, the dates under "Schedule", the rest under "Details". */
const PAGE = { fields: ["subject", "draft"], groups: [{ title: "Schedule", fields: ["due", "status"] }] };
const PAGED = { pages: ["Subject line", "Draft", "Schedule", "Due", "Status", "Details", "Name", "Summary"], graview: ["Subject line", "Draft", "Schedule", "Due", "Status", "Details", "Summary"] };
const ADDED = "P.S. I will bring the drainage district's maps on the thirtieth.";

const SCREENS = [
  { face: "pages", width: 390, height: 844 },
  { face: "pages", width: 1280, height: 800 },
  { face: "graview", width: 1280, height: 800 },
];

const report = { at: new Date().toISOString(), engines, schemes: SCHEMES, screens: SCREENS, expected: { paragraphs: PARAGRAPHS, numbered: NUMBERED, bulleted: BULLETED, declared: DECLARED, paged: PAGED }, checks: {} };

const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The workshop</title>
<style>body{margin:0;font:16px/1.4 Georgia,serif;background:#faf8f2;color:#222}</style></head>
<body><div id="app"></div><script type="module" src="/entry.js"></script></body></html>`;

/** The host's page: the page IS the app, as Cloud's shell mounts it. */
async function buildHost() {
  const require = createRequire(import.meta.url);
  const esbuild = require("esbuild");
  const out = mkdtempSync(join(tmpdir(), "graview-long-text-host-"));
  await esbuild.build({
    stdin: {
      contents: `
        import { mount } from "@graview/embed";
        import { compileDocumentWithoutCheck } from "@graview/core/document";
        import workshop from ${JSON.stringify(WORKSHOP)};
        import seed from ${JSON.stringify(WORKSHOP_SEED)};
        const asked = new URLSearchParams(location.search);
        let document_ = workshop;
        /* "page": the kind's page says its own order and a group (FR-148). */
        if (asked.get("page") === "1") document_ = { ...document_, kinds: { ...document_.kinds, deliverable: { ...document_.kinds.deliverable, page: ${JSON.stringify(PAGE)} } } };
        const compiled = compileDocumentWithoutCheck(document_, { today: () => "2026-10-08" });
        if (!compiled.ok) {
          window.__failed = compiled.findings.map((finding) => finding.message).join("; ");
          window.__ready = true;
        } else {
          window.__handle = mount(document.getElementById("app"), {
            app: compiled.app,
            seed,
            face: asked.get("face") === "graview" ? "graview" : "pages",
            routing: "address",
            principal: { kind: "human", id: "u:owner", roles: ["owner"] },
            label: compiled.app.name,
            heading: 1,
            height: "100dvh",
            fonts: false,
            studio: false,
          });
          window.__handle.drawn().then(() => { window.__ready = true; });
        }`,
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
  await new Promise((ready) => host.listen(portFor("long-text-host"), ready));
  return { stop: () => (host.close(), rmSync(out, { recursive: true, force: true })) };
}

/**
 * The record's facts as drawn: where they are, the draft's value and its
 * label, what the value is made of, and the order the labels read in.
 * Runs in the page.
 */
function measure({ face, recordId }) {
  const shown = (element) => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return false;
    for (let at = element; at; at = at.parentElement) {
      const style = getComputedStyle(at);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  };
  const rect = (element) => {
    const box = element.getBoundingClientRect();
    return { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), width: Math.round(box.width) };
  };
  /* A label's words, less a control standing in it (an "Edit" beside the label). */
  const words = (element) => {
    const copy = element.cloneNode(true);
    for (const control of copy.querySelectorAll("button")) control.remove();
    return (copy.textContent ?? "").trim();
  };
  /* The record: the routed page's facts, or the scene's record of it. */
  const record =
    face === "pages"
      ? document.querySelector('[data-testid="record-fields"]')
      : document.querySelector(`[data-graview-view="${CSS.escape(recordId)}"] [data-graview-fields]`)?.closest("[data-graview-view]");
  /* The width the record has to give: the routed page's facts, or the scene's record's frame less its padding. */
  const room = (() => {
    if (!record) return null;
    if (face === "pages") return rect(record);
    const frame = [...record.children].find((child) => !child.classList.contains("graview-kind-tag") && shown(child)) ?? record;
    const style = getComputedStyle(frame);
    const box = rect(frame);
    const left = box.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
    const right = box.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
    return { left: Math.round(left), right: Math.round(right), width: Math.round(right - left) };
  })();
  const fields = face === "pages" ? record : record?.querySelector("[data-graview-fields]");
  /* The draft's value: what holds its words, whatever drew it. */
  const holders = fields ? [...fields.querySelectorAll("dd")].filter((dd) => (dd.textContent ?? "").includes("Thank you for two good days")) : [];
  const value = holders[holders.length - 1] ?? null;
  /* Its label: the term the value is the definition of. */
  const label = (() => {
    if (!value) return null;
    for (let at = value.previousElementSibling; at; at = at.previousElementSibling) if (at.tagName === "DT") return at;
    const row = value.parentElement;
    return row ? [...row.children].find((child) => child.tagName === "DT") ?? null : null;
  })();
  /* The order the facts read in: each term, and each heading over a group of them, as a person meets them. */
  const order = fields
    ? [...fields.querySelectorAll("dt, [data-graview-field-group]")].filter(shown).map((one) => (one.matches("[data-graview-field-group]") ? one.getAttribute("data-graview-field-group") : words(one)))
    : [];
  const valueBox = value ? rect(value) : null;
  const labelBox = label ? rect(label) : null;
  /* Lines the draft's first paragraph takes: a value that kept its breaks has more blocks than lines of one. */
  return {
    found: Boolean(record && value),
    order,
    room,
    valueBox,
    labelBox,
    label: label ? words(label) : null,
    paragraphs: value ? [...value.querySelectorAll("p")].filter(shown).length : 0,
    numbered: value ? [...value.querySelectorAll("ol > li")].filter(shown).length : 0,
    bulleted: value ? [...value.querySelectorAll("ul > li")].filter(shown).length : 0,
    /* The first item of the numbered list, as the reader sees it numbered. */
    olStart: value?.querySelector("ol")?.getAttribute("start") ?? null,
    whiteSpace: value ? getComputedStyle(value).whiteSpace : null,
    spans: Boolean(room && valueBox && valueBox.width >= room.width * 0.9),
    above: Boolean(labelBox && valueBox && labelBox.bottom <= valueBox.top + 1 && Math.abs(labelBox.left - valueBox.left) <= 2),
  };
}

/** The place's cards: a text block that says `{draft}`. Runs in the page. */
function measureCards() {
  const texts = [...document.querySelectorAll(".graview-spec-text")].filter((one) => (one.textContent ?? "").includes("Thank you for two good days"));
  const one = texts[0];
  return {
    found: Boolean(one),
    paragraphs: one ? one.querySelectorAll("p").length : 0,
    numbered: one ? one.querySelectorAll("ol > li").length : 0,
    bulleted: one ? one.querySelectorAll("ul > li").length : 0,
  };
}

const host = await buildHost();
const errors = [];
const seen = { record: [], paged: [], edited: [], cards: [] };
let browser;
try {
  for (const engine of engines) {
    browser = await launchEngine(engine, { headless: !process.argv.includes("--headed") });
    for (const scheme of SCHEMES) {
      const open = async (path, query, viewport) => {
        const context = await browser.newContext({ viewport, colorScheme: scheme });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${scheme} ${path}?${query}: ${error.message}`));
        await page.goto(`${at("long-text-host")}${path}?${query}`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
        const failed = await page.evaluate(() => window.__failed ?? null);
        if (failed) errors.push(`${engine} ${scheme} ${path}?${query}: the document did not compile: ${failed}`);
        await page.waitForTimeout(1500);
        return { page, failed, close: () => context.close() };
      };
      for (const screen of SCREENS) {
        const viewport = { width: screen.width, height: screen.height };
        const where = screen.face === "pages" ? "/deliverables/email" : `/places/overview#focus=email`;
        const shot = async (page, name) => {
          if (!SHOTS || engine !== engines[0]) return;
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: join(SHOTS, `${engine}-${scheme}-${screen.face}-${screen.width}-${name}.png`), fullPage: screen.face === "pages" });
        };
        {
          const { page, close } = await open(where.split("#")[0], `face=${screen.face}${where.includes("#") ? `#${where.split("#")[1]}` : ""}`, viewport);
          const measured = await page.evaluate(measure, { face: screen.face, recordId: EMAIL.id });
          if (PROBE) process.stdout.write(`${engine} ${scheme} ${screen.face} ${screen.width}: ${JSON.stringify(measured)}\n`);
          seen.record.push({ engine, scheme, face: screen.face, width: screen.width, ...measured });
          await shot(page, "record");
          /*
           * EDITED IN PLACE: the draft's own control opens a text area; a
           * paragraph is added at its end and saved with the keyboard.
           */
          const edit = { opened: false, named: null, kept: false, tall: false, stored: null, paragraphsAfter: 0 };
          try {
            const control = page.locator('[data-graview-long="draft"] [data-graview-editable], [data-graview-long="draft"] button').first();
            if ((await control.count()) > 0) {
              await control.click();
              const area = page.locator('textarea[data-graview-field="draft"]').first();
              await area.waitFor({ timeout: 5_000 });
              edit.opened = true;
              edit.named = await area.evaluate((element) => element.labels?.[0]?.textContent?.trim() ?? element.getAttribute("aria-label"));
              edit.kept = (await area.inputValue()) === EMAIL.draft;
              edit.tall = await area.evaluate((element) => element.getBoundingClientRect().height >= element.scrollHeight - 2 && element.getBoundingClientRect().height > 200);
              if (PROBE) process.stdout.write(`${engine} textarea: ${JSON.stringify(await area.evaluate((element) => ({ height: element.getBoundingClientRect().height, scroll: element.scrollHeight, client: element.clientHeight, style: element.style.height })))}\n`);
              await shot(page, "editing");
              await area.evaluate((element) => element.setSelectionRange(element.value.length, element.value.length));
              await area.press("Enter");
              await area.press("Enter");
              await area.pressSequentially(ADDED);
              await area.press("Control+Enter");
              await page.waitForTimeout(600);
              edit.stored = await page.evaluate((id) => window.__handle.store.graph.getNode(id)?.draft ?? null, EMAIL.id);
              edit.paragraphsAfter = (await page.evaluate(measure, { face: screen.face, recordId: EMAIL.id })).paragraphs;
              await shot(page, "edited");
            }
          } catch (error) {
            edit.error = String(error.message ?? error).split("\n")[0];
          }
          seen.edited.push({ engine, scheme, face: screen.face, width: screen.width, ...edit, storedRight: edit.stored === `${EMAIL.draft}\n\n${ADDED}` });
          await close();
        }
        {
          const { page, close } = await open(where.split("#")[0], `face=${screen.face}&page=1${where.includes("#") ? `#${where.split("#")[1]}` : ""}`, viewport);
          const measured = await page.evaluate(measure, { face: screen.face, recordId: EMAIL.id });
          seen.paged.push({ engine, scheme, face: screen.face, width: screen.width, order: measured.order, found: measured.found });
          await shot(page, "paged");
          await close();
        }
        if (screen.face === "pages") {
          const { page, close } = await open("/places/email-to-todd", "face=pages", viewport);
          seen.cards.push({ engine, scheme, width: screen.width, ...(await page.evaluate(measureCards)) });
          await shot(page, "cards");
          await close();
        }
      }
    }
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  host.stop();
}

const screensPer = SCREENS.length * SCHEMES.length * engines.length;
const all = (list, count, held) => list.length === count && list.every(held);
const brief = (list, keys) => list.map((one) => Object.fromEntries([["engine", one.engine], ["scheme", one.scheme], ["face", one.face], ["width", one.width], ...keys.map((key) => [key, one[key]])]));
const sameList = (a, b) => a.length === b.length && a.every((one, index) => one === b[index]);

report.checks.theDraftKeepsItsParagraphsAndLists = {
  seen: brief(seen.record, ["found", "paragraphs", "numbered", "bulleted", "olStart"]),
  ok: all(seen.record, screensPer, (one) => one.found && one.paragraphs === PARAGRAPHS && one.numbered === NUMBERED && one.bulleted === BULLETED),
};
report.checks.theDraftSpansTheRecordsWidth = {
  seen: brief(seen.record, ["room", "valueBox", "spans"]),
  ok: all(seen.record, screensPer, (one) => one.spans),
};
report.checks.theDraftsLabelStandsAboveIt = {
  seen: brief(seen.record, ["label", "labelBox", "valueBox", "above"]),
  ok: all(seen.record, screensPer, (one) => one.label === "Draft" && one.above),
};
report.checks.theFactsFollowTheDeclaredOrder = {
  seen: brief(seen.record, ["order"]),
  ok: all(seen.record, screensPer, (one) => sameList(one.order, DECLARED[one.face])),
};
report.checks.theFactsFollowTheKindsPageWithTheRestUnderDetails = {
  seen: brief(seen.paged, ["found", "order"]),
  ok: all(seen.paged, screensPer, (one) => one.found && sameList(one.order, PAGED[one.face])),
};
report.checks.theDraftIsEditedInATextAreaThatKeepsItsLines = {
  seen: brief(seen.edited, ["opened", "named", "kept", "tall", "error"]),
  ok: all(seen.edited, screensPer, (one) => one.opened && one.kept && one.tall && one.named === "Draft"),
};
report.checks.aParagraphAddedInPlaceIsStoredWithTheOthers = {
  seen: brief(seen.edited, ["storedRight", "paragraphsAfter"]),
  ok: all(seen.edited, screensPer, (one) => one.storedRight && one.paragraphsAfter === PARAGRAPHS + 1),
};
report.checks.aCardsTextBlockKeepsTheParagraphsAndLists = {
  seen: seen.cards,
  ok: all(seen.cards, 2 * SCHEMES.length * engines.length, (one) => one.found && one.paragraphs === PARAGRAPHS && one.numbered === NUMBERED && one.bulleted === BULLETED),
};
report.checks.noPageErrors = { errors, ok: errors.length === 0 };

const failed = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name);
report.ok = failed.length === 0;
writeFileSync(resolve(repoRoot, "docs/long-text.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "✓" : "✗"} ${name}\n`);
process.stdout.write("wrote docs/long-text.json\n");
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
