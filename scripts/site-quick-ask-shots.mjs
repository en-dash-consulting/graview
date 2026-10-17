#!/usr/bin/env node
/**
 * THE SITE'S PICTURES OF THE QUICK ASK, TAKEN FROM A REAL APP.
 *
 * graview.dev shows the inline AI where it used to show the Ask box. The
 * picture is the todo example as it runs — its scene, a task selected, ⌘K's
 * bar asked a question, the answer on a card beside the task and the change
 * it proposes waiting as a ghost — in both lightings, at twice the pixels.
 * The model is the host's, as every model is: this script is the host, and
 * lends the app a Thinking slot (`window.__todoAi`) whose answer is written
 * here against the example's own seed on its day (Pay the deposit, due on
 * 28 August, opened on 1 September), so the words are true of what is drawn.
 *
 *   node scripts/site-quick-ask-shots.mjs     # writes docs/site/img/quick-ask-{light,dark}.png
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(repoRoot, "docs/site/img");
const ASKED = "What is left before this is done?";

/* The host's Thinking slot: the answer to the one question asked, picking the act that finishes the task. */
const LEND_A_MODEL = (asked) => {
  window.__todoAi = {
    name: "site",
    thinking: {
      model: "site",
      think: async ({ system, catalog }) => {
        if (!/"answer"/.test(system)) return { text: JSON.stringify({ pick: [] }) };
        const finish = catalog.candidates.find((candidate) => candidate.type === "act" && candidate.mutation === "finish");
        return {
          text: JSON.stringify({
            answer: asked === "What is left before this is done?" ? "It was due on 28 August, four days ago, and nothing else waits on it. Once it is paid, mark it done." : "",
            pick: finish ? [finish.id] : [],
          }),
        };
      },
    },
  };
};

const app = await serving("todo", portFor("todo"), repoRoot);
const browser = await launchEngine("chromium");
mkdirSync(OUT, { recursive: true });
try {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2, colorScheme: scheme });
    await context.addInitScript(LEND_A_MODEL, ASKED);
    const page = await context.newPage();
    await page.goto(`${at("todo")}/?today=2026-09-01&fresh=1&theme=${scheme}`, { waitUntil: "load", timeout: 90_000 });
    await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
    await page.waitForTimeout(1200);
    await page.click('[data-graview-pick="t-deposit"]');
    await page.waitForTimeout(1200);
    await page.keyboard.press("ControlOrMeta+K");
    await page.waitForSelector('[data-testid="quick-ask"]', { timeout: 30_000 });
    await page.fill('[data-testid="quick-ask-input"]', ASKED);
    await page.press('[data-testid="quick-ask-input"]', "Enter");
    await page.waitForSelector('[data-testid="quick-ask"] [data-testid="ai-ghost"]', { timeout: 30_000 });
    // Let the card settle beside the task, and take the pointer off it.
    await page.mouse.move(2, 400);
    await page.waitForTimeout(900);
    const file = resolve(OUT, `quick-ask-${scheme}.png`);
    await page.screenshot({ path: file });
    process.stdout.write(`wrote ${file.slice(repoRoot.length + 1)}\n`);
    await context.close();
  }
} finally {
  await browser.close();
  app.stop();
}
