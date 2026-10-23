#!/usr/bin/env node
/**
 * TWO PEOPLE TYPING INTO ONE TEXT (Roadmap f-collab-text, phase 4: the
 * live editor).
 *
 * `graview preview` of the Roadmap's briefs — a Markdown `body`, typed
 * together as the declaration says prose is — opened in two browsers sat
 * down as two people, Ada and Bo, each on the same brief's page, ten
 * thousand characters long. Each opens the body and types into it at once,
 * with real keystrokes, Ada near the top and Bo far below. It asks:
 *
 *   the body opens live: no Save, a Done, and the text area takes keys;
 *   the two pages converge — both text areas and the server's store hold
 *   the same text, with every word each of them typed in it whole;
 *   each page draws the other's caret, named for them, where they stand;
 *   Bo's own caret stays on the word he was typing while Ada's words land
 *   above it;
 *   and no page threw.
 *
 *   node scripts/verify-typed-together.mjs [--engine=chromium|webkit|firefox]
 *
 * Writes docs/typed-together.json. Needs `pnpm build`.
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { vacant } from "./lib/serve.mjs";
import { seatHeaders } from "../packages/ship/dist/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const CLI = resolve(repoRoot, "packages/graview/dist/cli.js");
const DOCUMENT = "scripts/fixtures/long-text/roadmap.gdd.json";
const SEED = "scripts/fixtures/long-text/roadmap.seed.json";
const BRIEF = "brief-0129";
const report = { at: new Date().toISOString(), engine: ENGINE, document: DOCUMENT, claims: {} };
const claim = (name, ok, detail) => {
  report.claims[name] = { ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) };
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — ${JSON.stringify(detail).slice(0, 600)}`}\n`);
};

if (!existsSync(resolve(repoRoot, "packages/graview/dist/preview/index.html"))) {
  process.stderr.write("verify-typed-together: packages/graview/dist/preview is not built. Run pnpm build first.\n");
  process.exit(1);
}

await vacant(portFor("typed-together"));
const server = spawn(process.execPath, [CLI, "preview", DOCUMENT, "--seed", SEED, "--port", String(portFor("typed-together"))], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
let said = "";
server.stdout.on("data", (chunk) => (said += chunk));
server.stderr.on("data", (chunk) => (said += chunk));
const base = at("typed-together");
const started = Date.now();
for (;;) {
  try {
    if ((await fetch(`${base}/graview/health`)).ok) break;
  } catch {
    // not listening yet
  }
  if (Date.now() - started > 30_000 || server.exitCode !== null) {
    process.stderr.write(`verify-typed-together: graview preview did not start:\n${said}\n`);
    server.kill();
    process.exit(1);
  }
  await new Promise((ready) => setTimeout(ready, 200));
}

const errors = [];
const browsers = [];
let seat;
try {
  /**
   * A page sat down as somebody: the preview's seat, under their own id and
   * name (the preview believes a loopback page's seat). Each in a browser of
   * its own, as two people are: a second page in one browser can be one the
   * engine counts as hidden, and a hidden page says nothing of where it is.
   */
  const sitDown = async (id, name) => {
    const browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
    browsers.push(browser);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    await context.route("**/graview/document", async (route) => {
      const answered = await route.fetch();
      const handed = await answered.json();
      seat = handed.principal;
      await route.fulfill({ response: answered, json: { ...handed, principal: { ...handed.principal, id, name } } });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
    await page.goto(`${base}/briefs/${BRIEF}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__graviewReady === true || typeof window.__graviewFailed === "string", null, { timeout: 60_000 });
    await page.locator('[data-graview-long="body"] dt button').first().click();
    await page.waitForSelector('[data-graview-live="body"] textarea:not([readonly])', { timeout: 20_000 });
    return page;
  };
  const ada = await sitDown("ada", "Ada");
  const bo = await sitDown("bo", "Bo");
  const area = '[data-graview-live="body"] textarea';

  const opened = await ada.evaluate(() => {
    const long = document.querySelector('[data-graview-long="body"]');
    const buttons = [...(long?.querySelectorAll("button") ?? [])].map((one) => one.textContent?.trim());
    return { live: long?.querySelector("[data-graview-live]") !== null, buttons };
  });
  claim("theBodyOpensLiveWithNoSave", opened.live && !opened.buttons.includes("Save") && opened.buttons.includes("Done"), opened);

  /* Each puts the caret where they will type: Ada after the first line, Bo deep in the brief, after a word. */
  const place = (page, where) =>
    page.evaluate(
      ([selector, at]) => {
        const element = document.querySelector(selector);
        element.focus();
        const text = element.value;
        // After the space that ends a word, so what is typed is a word of its own.
        const after = text.indexOf(" ", at) + 1;
        element.setSelectionRange(after, after);
        return after;
      },
      [area, where],
    );
  await place(ada, 40);
  await place(bo, 6000);
  const ADA_TYPES = "alpha beta gamma ";
  const BO_TYPES = "one two three ";
  await Promise.all([ada.keyboard.type(ADA_TYPES, { delay: 40 }), bo.keyboard.type(BO_TYPES, { delay: 40 })]);

  /* Converged: both areas and the store hold one text. */
  const valueOf = (page) => page.evaluate((selector) => document.querySelector(selector)?.value ?? null, area);
  const stored = async () => {
    const state = await (await fetch(`${base}/graview/state`, { headers: seatHeaders(seat) })).json();
    return state.snapshot?.nodes?.find((node) => node.id === BRIEF)?.body ?? null;
  };
  let one;
  let two;
  let held;
  for (let tries = 0; tries < 60; tries++) {
    [one, two, held] = await Promise.all([valueOf(ada), valueOf(bo), stored()]);
    if (one === two && two === held && one.includes(ADA_TYPES) && one.includes(BO_TYPES)) break;
    await new Promise((settle) => setTimeout(settle, 250));
  }
  claim("twoPagesTypingIntoOneLongFieldConverge", one === two && two === held && one.includes(ADA_TYPES) && one.includes(BO_TYPES) && one.length > 10_000, {
    length: one?.length,
    sameOnBoth: one === two,
    sameAsTheStore: two === held,
    adasWords: one?.includes(ADA_TYPES),
    bosWords: one?.includes(BO_TYPES),
  });

  /* Bo's caret, on his own page, stays after the words he typed though Ada's landed above. */
  const ownCaret = await bo.evaluate((selector) => {
    const element = document.querySelector(selector);
    return { before: element.value.slice(Math.max(0, element.selectionStart - 14), element.selectionStart), collapsed: element.selectionStart === element.selectionEnd };
  }, area);
  claim("aCaretStaysOnItsWordWhileTheOtherTypesAboveIt", ownCaret.collapsed && ownCaret.before === BO_TYPES, ownCaret);

  /* Each draws the other's caret, named, where they stand — once the last word of where it stands has arrived. */
  const caretOf = async (page, who, typed) => {
    let seen = null;
    for (let tries = 0; tries < 40; tries++) {
      seen = await page.evaluate((id) => {
        const caret = document.querySelector(`[data-graview-caret^="human:${id}:"]`);
        if (!caret) return null;
        let before = "";
        for (const node of caret.parentElement.childNodes) {
          if (node === caret) break;
          before += node.textContent ?? "";
        }
        const box = caret.getBoundingClientRect();
        const area = document.querySelector('[data-graview-live="body"] textarea').getBoundingClientRect();
        return { title: caret.title, before: before.slice(-20), color: getComputedStyle(caret).borderLeftColor, width: Math.round(box.width), inside: box.left >= area.left && box.right <= area.right + 1 };
      }, who);
      if (seen?.before.endsWith(typed)) break;
      await new Promise((settle) => setTimeout(settle, 250));
    }
    return seen;
  };
  const [bosOnAda, adasOnBo] = await Promise.all([caretOf(ada, "bo", BO_TYPES), caretOf(bo, "ada", ADA_TYPES)]);
  claim("eachSeesTheOthersCaretWhereTheyStand", bosOnAda?.title === "Bo is typing here" && bosOnAda.before?.endsWith(BO_TYPES) && adasOnBo?.title === "Ada is typing here" && adasOnBo.before?.endsWith(ADA_TYPES) && bosOnAda?.inside && adasOnBo?.inside, { bosOnAda, adasOnBo });

  claim("noPageThrew", errors.length === 0, errors);
} catch (error) {
  claim("theRunFinished", false, String(error).slice(0, 1200));
} finally {
  await Promise.all(browsers.map((one) => one.close()));
  server.kill();
}

report.passed = Object.values(report.claims).every((one) => one.ok);
writeFileSync(resolve(repoRoot, "docs/typed-together.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`\nwrote docs/typed-together.json\n`);
process.exit(report.passed ? 0 : 1);
