#!/usr/bin/env node
/**
 * The chat experience, held to its own claims in a real browser.
 *
 * The seat promises specific things: it answers from the graph before any
 * model, a change it proposes travels the same validated path as a click
 * and really can be undone, a refusal is a result in the thread (never a
 * "Done" over a change the store refused), a broken model rung degrades to
 * the graph with a note rather than an error, and a saved key survives
 * visiting another rung. Every one of those is driven here, end to end —
 * The refusal half runs in a product's own repository, against its policy.
 *
 *   node scripts/verify-chat.mjs [--engine=chromium|webkit|firefox]
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

/**
 * The app this harness drives — borrowed if a dev server is already holding
 * the port, started and owned otherwise. See `lib/serve.mjs`: spawning a
 * second vite blindly meant every harness died with "vite did not start"
 * whenever anyone had the app open.
 */
function startVite(app, port) {
  return serving(app, port, repoRoot);
}

const stopVite = (child) => {
  child.stop();
};

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
let browser;
let vite;

/** Sends one message and returns the seat's reply row. */
async function send(page, text) {
  await page.fill('[aria-label="Message the seat"]', text);
  await page.press('[aria-label="Message the seat"]', "Enter");
  await page.waitForFunction(
    (asked) => {
      const rows = [...document.querySelectorAll('[data-testid="chat-panel"] ol li')];
      const mine = rows.findIndex((row) => (row.textContent ?? "").includes(asked));
      return mine >= 0 && rows.length > mine + 1;
    },
    text.slice(0, 40),
    { timeout: 20_000 },
  );
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="chat-panel"] ol li')];
    const last = rows[rows.length - 1];
    return {
      text: last?.textContent ?? "",
      applies: last?.querySelectorAll('[data-testid="chat-apply"]').length ?? 0,
    };
  });
}

const lastTurn = (page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="chat-panel"] ol li')];
    return rows[rows.length - 1]?.textContent ?? "";
  });

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });

  /* ============================================== todo: the conversation */
  vite = await startVite("todo", 5193);
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5193/?today=2026-09-01", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });

  /* -------------------------------------------- closed until asked for */
  report.checks.closedByDefault = {
    ok: await page.evaluate(
      () =>
        document.querySelector('[data-testid="chat-panel"]') === null &&
        document.querySelector('[data-testid="chat"]')?.getAttribute("aria-expanded") === "false",
    ),
  };

  /* -------------------------- opens, and every way out actually leads out */
  /*
   * ONE PRESS, ONE RUNG. With something selected underneath, Escape closes
   * the panel and nothing else: the product-wide ladder used to take the
   * same press and drop the selection with it. The ladder's own listener
   * now asks in the capture phase whether a popover is open — the panel's
   * document listener runs first in the bubble and React has committed its
   * closing by the time a bubble listener on the window looks — and only a
   * real browser dispatches in that order, so this is where it is held.
   */
  await page.click('[data-graview-pick="t-deposit"]');
  await page.waitForTimeout(300);
  const selectedBefore = await page.evaluate(() => location.hash.includes("sel="));
  await page.click('[data-testid="chat"]');
  const opened = (await page.$('[data-testid="chat-panel"]')) !== null;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const escaped = (await page.$('[data-testid="chat-panel"]')) === null;
  const escapeKeptTheSelection = selectedBefore && (await page.evaluate(() => location.hash.includes("sel=")));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.click('[data-testid="chat"]');
  await page.waitForSelector('[data-testid="chat-panel"]');
  await page.mouse.click(1450, 720); // empty ground, well away from the panel
  await page.waitForTimeout(150);
  const clickedAway = (await page.$('[data-testid="chat-panel"]')) === null;
  report.checks.opensAndCloses = {
    opened,
    escaped,
    escapeKeptTheSelection,
    clickedAway,
    ok: opened && escaped && escapeKeptTheSelection && clickedAway,
  };

  // The click-away may have selected whatever it landed near; a clean
  // conversation starts unselected, so "what is here?" means the graph.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);

  /* ------------------------------------ the header says what is answering */
  await page.click('[data-testid="chat"]');
  await page.waitForSelector('[data-testid="chat-panel"]');
  const source = await page.textContent('[data-testid="chat-source"]');
  report.checks.headerSaysGraphNative = { source, ok: source?.trim() === "graph-native" };

  /* ----------------------------- the graph answers its own shape, keyless */
  const overview = await send(page, "what is here?");
  report.checks.groundedOverview = {
    reply: overview.text.slice(0, 120),
    ok: overview.text.includes("This graph holds") && overview.applies === 0,
  };

  /* ----------------------- trouble arrives carrying the rules' own repairs */
  const wrong = await send(page, "what's wrong?");
  report.checks.problemsProposeRepairs = {
    reply: wrong.text.slice(0, 120),
    applies: wrong.applies,
    ok: /problem/.test(wrong.text) && wrong.applies >= 1,
  };

  /* --------------- a change said in words becomes one reviewable proposal */
  const proposed = await send(page, "Mark it done: Book the van");
  report.checks.sayAChangeProposesOne = {
    reply: proposed.text.slice(0, 140),
    applies: proposed.applies,
    ok: proposed.applies === 1 && proposed.text.includes("Review it below"),
  };

  /* -------------- the apply is real, attributed, and really can be undone */
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-testid="chat-apply"]')];
    buttons[buttons.length - 1].click();
  });
  await page
    .waitForFunction(
      () => {
        const rows = [...document.querySelectorAll('[data-testid="chat-panel"] ol li')];
        const text = rows[rows.length - 1]?.textContent ?? "";
        return text.startsWith("Done") || text.startsWith("Refused");
      },
      null,
      { timeout: 10_000 },
    )
    .catch(() => {});
  const applyOutcome = await lastTurn(page);
  const appliedInTheGraph = await page.evaluate(
    () => !(document.querySelector('[data-graview-pick="t-book"]')?.textContent ?? "").includes("09-01"),
  );
  // The turn shows in the activity rail like anyone's, and undo undoes it.
  await page.keyboard.press("Escape"); // put the chat away first
  await page.click('[data-testid="activity-button"]');
  await page.waitForSelector('[data-testid="activity"]');
  // The rail names the SEAT that did it — "chat", not a person, not some
  // other agent's name — beside the mutation's own intent.
  const attributed = await page.evaluate(() => {
    const rail = document.querySelector('[data-testid="activity"]')?.textContent ?? "";
    return rail.includes('Finish "Book the van"') && rail.includes("chat");
  });
  // Undo THAT turn — the rail holds every batch, so find the row that
  // carries the chat's own intent and press its undo.
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="activity"] *')].filter(
      (el) =>
        el.querySelector?.('[data-testid="undo-turn"]') &&
        (el.textContent ?? "").includes('Finish "Book the van"'),
    );
    const row = rows[rows.length - 1];
    row?.querySelector('[data-testid="undo-turn"]')?.click();
  });
  // The rail's own node chips also answer to t-book, with no due text on
  // them — scan every instance for the returned due date.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-graview-pick="t-book"]')].some((el) =>
        (el.textContent ?? "").includes("09-01"),
      ),
    null,
    { timeout: 10_000 },
  );
  report.checks.applyIsRealAndUndoWorks = {
    outcome: applyOutcome.slice(0, 120),
    appliedInTheGraph,
    attributed,
    undone: true,
    ok: applyOutcome.startsWith("Done") && appliedInTheGraph && attributed,
  };
  await page.close();

  /* ================== a broken model rung: the graph is always the floor */
  const remote = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  await remote.addInitScript(() => {
    localStorage.setItem(
      "graview:intelligence",
      JSON.stringify({
        source: "remote",
        remote: { preset: "custom", baseUrl: "http://127.0.0.1:9", apiKey: "k-test", model: "m-test" },
      }),
    );
  });
  await remote.goto("http://localhost:5193/?today=2026-09-01", { waitUntil: "load" });
  await remote.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  await remote.click('[data-testid="chat"]');
  await remote.waitForSelector('[data-testid="chat-panel"]');
  const remoteSource = await remote.textContent('[data-testid="chat-source"]');

  // A fact the graph holds is never replaced by a guess about it — the
  // model is not even consulted for a grounded question. (The bare
  // overview is deliberately UNgrounded — a model may answer it more
  // richly — so the probe is a standing question, which is a fact.)
  const grounded = await send(remote, "what's wrong?");
  // An ungrounded ask reaches the dead endpoint, which answers nothing;
  // the graph answers instead and SAYS SO.
  const floored = await send(remote, "should we repaint the hallway?");
  report.checks.brokenModelDegradesToTheFloor = {
    header: remoteSource,
    grounded: grounded.text.slice(-60),
    floored: floored.text.slice(-120),
    ok:
      remoteSource?.trim() === "m-test" &&
      grounded.text.includes("(from the graph)") &&
      floored.text.includes("The graph answered instead"),
  };

  /* ------------------------ a saved key survives visiting another rung */
  await remote.click('[data-testid="chat-settings"]');
  await remote.waitForSelector('[data-testid="chat-settings-form"]');
  await remote.check('input[name="intelligence-source"][value="graph"]');
  await remote.click('[data-testid="chat-settings-form"] button[type="submit"]');
  await remote.waitForFunction(
    () => document.querySelector('[data-testid="chat-source"]')?.textContent?.trim() === "graph-native",
    null,
    { timeout: 10_000 },
  );
  const kept = await remote.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("graview:intelligence") ?? "{}");
    return { source: stored.source, key: stored.remote?.apiKey };
  });
  report.checks.keySurvivesRungSwitch = {
    ...kept,
    ok: kept.source === "graph" && kept.key === "k-test",
  };
  await remote.close();
  stopVite(vite);
  vite = null;

  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  if (vite) stopVite(vite);
}

writeFileSync(resolve(repoRoot, "docs/chat.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/chat.json\n`);
process.exit(report.passed ? 0 : 1);
