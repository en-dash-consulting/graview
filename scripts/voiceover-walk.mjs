#!/usr/bin/env node
/**
 * THE SAME STOPS, LISTENED TO WITH REAL VOICEOVER — when somebody chooses to.
 *
 * `verify-screen-reader` reads the accessibility tree the browsers expose
 * and writes what a screen reader would say (`docs/screen-reader-walk.md`).
 * That is the tree, not the voice: VoiceOver decides for itself what to
 * say of a group, how to read "AREAS" set in capitals, whether it speaks a
 * "·" and when a polite announcement interrupts. This drives VoiceOver in
 * Playwright's WebKit (the engine Safari is) over the same stops and writes
 * what it actually said to `docs/voiceover-walk.md`.
 *
 * IT TAKES OVER THE MACHINE. VoiceOver speaks aloud, moves its own cursor
 * and captures the keyboard; a browser window comes to the front and keys
 * are pressed into it for several minutes. Run it on a Mac you are not
 * working on, with the sound where you want it. It is never run by
 * `pnpm verify`, by CI, or by an agent.
 *
 * WHAT IT NEEDS, once:
 *
 *   1. macOS, with VoiceOver's AppleScript control allowed: VoiceOver
 *      Utility → General → "Allow VoiceOver to be controlled with
 *      AppleScript". `npx @guidepup/setup` turns that on (and grants the
 *      terminal the Accessibility and Automation permissions it asks for).
 *   2. Guidepup, which is not a dependency of anything here — install it
 *      beside the checkout without touching the lockfile:
 *
 *        npm install --prefix ~/.graview-voiceover @guidepup/guidepup@0.24
 *        GUIDEPUP=~/.graview-voiceover node scripts/voiceover-walk.mjs
 *
 *      (`pnpm add -w -D @guidepup/guidepup` works too; don't commit it.)
 *      `@guidepup/playwright` is for `@playwright/test` fixtures and is not
 *      needed: this drives Playwright's WebKit itself.
 *   3. `pnpm build` and `npx playwright install webkit`, as for any harness.
 *
 *   node scripts/voiceover-walk.mjs [--stops=bar,list,record] [--steps=40]
 *
 * VoiceOver is stopped at the end, and on Ctrl-C. If it is ever left on,
 * Cmd-F5 turns it off.
 *
 * WITHOUT GUIDEPUP, the same walk by hand: turn VoiceOver on (Cmd-F5),
 * run `node scripts/verify-screen-reader.mjs --serve` (it prints the
 * addresses and waits), open them in Safari, and at each stop below move
 * with VO-Right, by heading with VO-Cmd-H, by landmark with the rotor
 * (VO-U), and press each named act; compare with
 * `docs/screen-reader-walk.md`.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { webkit } from "playwright";
import { at, portFor } from "./lib/ports.mjs";
import { buildRoadmapHost } from "./lib/screen-reader-host.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(repoRoot, "docs/voiceover-walk.md");
const STEPS = Number(process.argv.find((arg) => arg.startsWith("--steps="))?.slice("--steps=".length) ?? 40);
const ONLY = process.argv.find((arg) => arg.startsWith("--stops="))?.slice("--stops=".length).split(",");

/** Guidepup from where it was installed (`GUIDEPUP`, the `--prefix` it was installed with), else from the checkout. */
async function guidepup() {
  const from = process.env["GUIDEPUP"];
  try {
    if (!from) return await import("@guidepup/guidepup");
    const found = createRequire(resolve(from, "package.json")).resolve("@guidepup/guidepup");
    return await import(pathToFileURL(found).href);
  } catch {
    process.stderr.write("Guidepup is not installed. See the header of scripts/voiceover-walk.mjs: install it beside the checkout and point GUIDEPUP at it.\n");
    process.exit(2);
  }
}
if (process.platform !== "darwin") {
  process.stderr.write("VoiceOver is macOS's: this walk runs only on a Mac.\n");
  process.exit(2);
}

const roadmap = (path, as = "ada") => `${at("screen-reader-host")}${path}?as=${as}`;
const todo = (path) => `${at("todo")}${path}?today=2026-09-01`;

/**
 * The stops, as `verify-screen-reader` walks them. Each opens a page, may
 * do something with the keyboard, then listens: VoiceOver's cursor moved
 * item by item from where the page put it, and what it said kept.
 */
const STOPS = [
  { name: "bar", title: "Roadmap: the bar", url: roadmap("/") },
  { name: "switch", title: "Roadmap: the Pages and Scene switch", url: roadmap("/"), act: async (page) => {
    await page.getByRole("group", { name: "Scene or Pages" }).getByRole("button", { name: "Scene" }).focus();
    await page.keyboard.press("Enter");
  } },
  { name: "list", title: "Roadmap: a list, reached from the bar", url: roadmap("/"), act: async (page) => {
    await page.getByRole("navigation").getByRole("link", { name: "Features", exact: true }).focus();
    await page.keyboard.press("Enter");
  } },
  { name: "record", title: "Roadmap: a record page", url: roadmap("/features/feature-0") },
  { name: "form", title: "Roadmap: an act's form", url: roadmap("/features/feature-0"), act: async (page) => {
    await page.getByRole("button", { name: /^Change the feature/ }).first().focus();
    await page.keyboard.press("Enter");
  } },
  { name: "columns", title: "Roadmap: a columns lens", url: roadmap("/places/roadmap") },
  { name: "blocks", title: "Roadmap: a blocks lens", url: roadmap("/places/up-next") },
  { name: "others", title: "Roadmap: a change from someone else", url: roadmap("/features/feature-0"), other: roadmap("/features/feature-0", "ben"), act: async (_page, other) => {
    await other.locator('dd button[data-graview-field="stage"]').first().click();
    const choice = other.locator("select").first();
    const now = await choice.inputValue();
    const options = await choice.locator("option").evaluateAll((all) => all.map((one) => one.value).filter(Boolean));
    await choice.selectOption(options.find((one) => one !== now) ?? options[0]);
    await choice.press("Enter").catch(() => undefined);
  } },
  { name: "todo-list", title: "Things (todo): a list", url: todo("/pages/tasks") },
  { name: "todo-record", title: "Things (todo): a record page", url: todo("/pages/tasks/t-deposit") },
  { name: "ask", title: "Things (todo): the quick ask", url: `${todo("/pages/tasks/t-deposit")}&ai=stub`, act: async (page) => {
    await page.keyboard.press("Meta+K");
    const box = page.getByRole("region", { name: /^Tell Graview about / }).getByRole("combobox").first();
    await box.fill("What is left?");
    await box.press("Enter");
  } },
].filter((stop) => !ONLY || ONLY.includes(stop.name));

const { voiceOver } = await guidepup();
const host = await buildRoadmapHost(repoRoot);
const todoServer = await serving("todo", portFor("todo"), repoRoot);
const browser = await webkit.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const lines = [
  "# What VoiceOver said",
  "",
  `Written by \`scripts/voiceover-walk.mjs\` on ${new Date().toISOString().slice(0, 10)}: VoiceOver in Playwright's WebKit, at the stops \`docs/screen-reader-walk.md\` reads from the tree. Each stop: what VoiceOver said after the page (and the act, where there is one), then ${STEPS} moves of its cursor (VO-Right).`,
  "",
];
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await voiceOver.stop().catch(() => undefined);
  await browser.close().catch(() => undefined);
  host.stop();
  todoServer.stop();
};
process.once("SIGINT", () => stop().then(() => process.exit(130)));

try {
  await voiceOver.start();
  for (const one of STOPS) {
    const page = await context.newPage();
    await page.goto(one.url, { waitUntil: "load" });
    await page.waitForFunction(() => window.__ready === true || Object.keys(window).some((key) => /^__\w*Ready$/.test(key)), undefined, { timeout: 60_000 });
    const other = one.other ? await context.newPage() : null;
    if (other) {
      await other.goto(one.other, { waitUntil: "load" });
      await other.waitForFunction(() => window.__ready === true, undefined, { timeout: 60_000 });
    }
    await page.bringToFront();
    await page.waitForTimeout(1500);
    await voiceOver.clearSpokenPhraseLog();
    if (one.act) {
      await one.act(page, other);
      await page.waitForTimeout(2500);
    }
    const afterAct = [...(await voiceOver.spokenPhraseLog())];
    await voiceOver.clearSpokenPhraseLog();
    for (let step = 0; step < STEPS; step++) await voiceOver.next();
    const walked = [...(await voiceOver.spokenPhraseLog())];
    lines.push(`## ${one.title}`, "", one.act ? "**Said after the act**" : "**Said as the page arrived**", "", "```text", ...(afterAct.length ? afterAct : ["(nothing)"]), "```", "", `**${STEPS} moves of the cursor**`, "", "```text", ...walked, "```", "");
    writeFileSync(OUT, `${lines.join("\n").trimEnd()}\n`);
    await other?.close();
    await page.close();
  }
} finally {
  await stop();
}
process.stdout.write(`wrote ${OUT}\n`);
