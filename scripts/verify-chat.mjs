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
import { at, portFor } from "./lib/ports.mjs";

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

const SEAT = '[data-testid="seat"]';
const FIELD = '[data-testid="seat-field"]';
const ROWS = '[data-testid="seat-panel"] ol > li';

/** Opens the seat from its field at the picture's foot, if it is closed. */
async function openSeat(page) {
  if ((await page.getAttribute(SEAT, "data-graview-seat")) !== "open") await page.click(FIELD);
  await page.waitForSelector('[data-testid="seat-panel"]', { timeout: 30_000 });
}

/** What is answering, said under the seat's ⚙ and nowhere else. */
async function sourceOf(page) {
  await openSeat(page);
  await page.click('[data-testid="seat-settings"]');
  const said = (await page.textContent('[data-testid="seat-source"]').catch(() => null)) ?? "";
  await page.click('[data-testid="seat-settings"]');
  return said.replace(/^Answering now:\s*/, "").trim();
}

/** Waits until what is answering says `test` of itself. */
async function sourceComes(page, test) {
  for (let tries = 0; tries < 40; tries++) {
    const said = await sourceOf(page);
    if (test(said)) return said;
    await page.waitForTimeout(250);
  }
  return sourceOf(page);
}

/** Sends one message and returns the seat's reply row. */
async function send(page, text) {
  await openSeat(page);
  await page.fill(FIELD, text);
  await page.press(FIELD, "Enter");
  await page.waitForFunction(
    (asked) => {
      const rows = [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')];
      const mine = rows.findIndex((row) => (row.textContent ?? "").includes(asked));
      return mine >= 0 && rows.length > mine + 1;
    },
    text.slice(0, 40),
    { timeout: 20_000 },
  );
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')];
    const last = rows[rows.length - 1];
    return {
      text: last?.textContent ?? "",
      applies: last?.querySelectorAll('[data-testid="seat-apply"]').length ?? 0,
    };
  });
}

const lastTurn = (page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')];
    return rows[rows.length - 1]?.textContent ?? "";
  });

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });

  /* ============================================== todo: the conversation */
  vite = await startVite("todo", portFor("todo"));
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });

  /* ---------------- a quiet field at the picture's foot, with no pill of its own */
  /*
   * The conversation was a section of a rail down the scene's left edge;
   * before that, a popover behind a "◆ Ask" pill. It is one field at the
   * picture's foot now, that grows into the conversation when asked.
   */
  const closed = await page.evaluate(() => {
    const seat = document.querySelector('[data-testid="seat"]');
    const field = seat?.querySelector('[data-testid="seat-field"]');
    const box = seat?.getBoundingClientRect();
    return {
      state: seat?.getAttribute("data-graview-seat") ?? null,
      atTheFoot: box ? Math.round(innerHeight - box.bottom) : null,
      field: field?.getAttribute("aria-label") ?? null,
      noPill: document.querySelector('[data-testid="chat"]') === null,
    };
  });
  await openSeat(page);
  const opened = await page.evaluate(() => Math.round(document.querySelector('[data-testid="seat-panel"]')?.getBoundingClientRect().height ?? 0));
  report.checks.itFloatsAtTheFoot = {
    ...closed,
    opened,
    ok: closed.state === "closed" && closed.atTheFoot !== null && closed.atTheFoot < 40 && closed.field === "Ask Things" && closed.noPill && opened > 60,
  };

  /* ---------------- Escape puts the seat away, and the selection stays chosen */
  /*
   * The seat is not modal: choosing a thing in the picture while it is open
   * leaves it open, and Escape in it closes it — the seat's Escape, not the
   * scene's back-out, so what was chosen stays chosen.
   */
  await page.click('[data-graview-pick="t-deposit"]');
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => ({
    selected: location.hash.includes("sel="),
    seat: document.querySelector('[data-testid="seat"]')?.getAttribute("data-graview-seat") ?? null,
  }));
  await page.focus(FIELD);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    selected: location.hash.includes("sel="),
    seat: document.querySelector('[data-testid="seat"]')?.getAttribute("data-graview-seat") ?? null,
  }));
  report.checks.escapePutsTheSeatAwayAndKeepsTheChoice = {
    before,
    after,
    ok: before.selected && before.seat === "open" && after.seat === "closed" && after.selected,
  };

  /*
   * A clean conversation starts about nothing in particular, so "what is
   * here?" means the graph rather than the task still in hand: clicking the
   * bare ground puts the selection down, which is the gesture every canvas
   * teaches, and the seat's subject falls back to where you are.
   */
  await page.mouse.click(1450, 700);
  await page.waitForTimeout(400);

  /* ----------------------- under the ⚙, it says what is answering */
  const source = await sourceOf(page);
  report.checks.headerSaysGraphNative = { source, ok: source === "graph-native" };

  /* ----------------------------- the graph answers its own shape, keyless */
  const overview = await send(page, "what is here?");
  report.checks.groundedOverview = {
    reply: overview.text.slice(0, 120),
    ok: overview.text.includes("This graph holds") && overview.applies === 0,
  };

  /* ---------------- no act and no fact: the words' hits, each a press */
  /*
   * "Where is the van" names nothing by its whole name and asks for no
   * change. The Find box would have answered it, so the seat does: the
   * strip in prose, and each thing a press that goes there. Back returns,
   * so the claims after this one start where they always did.
   */
  const looked = await send(page, "where is the van?");
  const picks = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')].at(-1)?.querySelectorAll('[data-testid="seat-pick"]').length ?? 0,
  );
  const target = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')].at(-1)?.querySelector('[data-testid="seat-pick"]')?.getAttribute("data-chat-pick") ?? null,
  );
  let went = null;
  if (target) {
    await page.evaluate(() => [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')].at(-1)?.querySelector('[data-testid="seat-pick"]')?.click());
    await page.waitForTimeout(700);
    went = await page.evaluate(() => location.hash);
    await page.goBack();
    await page.waitForTimeout(700);
  }
  report.checks.noActAndNoFactAnswersWithWhatTheWordsFind = {
    reply: looked.text.slice(0, 160),
    picks,
    target,
    went,
    ok:
      /called “van”/.test(looked.text) &&
      looked.text.includes("Book the van") &&
      looked.applies === 0 &&
      picks >= 1 &&
      target === "t-book" &&
      (went ?? "").includes("sel=t-book"),
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
    const buttons = [...document.querySelectorAll('[data-testid="seat-apply"]')];
    buttons[buttons.length - 1].click();
  });
  await page
    .waitForFunction(
      // The press becomes its own outcome, in place.
      () => document.querySelector('[data-testid="seat-applied"], [data-testid="seat-refused"]') !== null,
      null,
      { timeout: 10_000 },
    )
    .catch(() => {});
  const applyOutcome = await page.evaluate(() =>
    document.querySelector('[data-testid="seat-applied"]')
      ? `Done — ${document.querySelector('[data-testid="seat-applied"]')?.textContent ?? ""}`
      : (document.querySelector('[data-testid="seat-refused"]')?.textContent ?? ""),
  );
  const appliedInTheGraph = await page.evaluate(
    () => !(document.querySelector('[data-graview-pick="t-book"]')?.textContent ?? "").includes("09-01"),
  );
  // The turn shows in the activity rail like anyone's, and undo undoes it.
  await page.focus(FIELD);
  await page.keyboard.press("Escape"); // put the seat away first
  await page.click('[data-testid="activity-button"]');
  await page.waitForSelector('[data-testid="activity"]');
  // The rail names the SEAT that did it — the tab's seat, "tidy", whose
  // body the chat shares (it wrote as "chat" before the seat and the chat
  // were one robot) — not a person, beside the mutation's own intent.
  const attributed = await page.evaluate(() => {
    const rail = document.querySelector('[data-testid="activity"]')?.textContent ?? "";
    return rail.includes('Finish "Book the van"') && (rail.includes("tidy") || rail.includes("chat"));
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
  await remote.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await remote.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  const remoteSource = await sourceOf(remote);

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
  // The ladder is a setting in the profile pane now, not a form in the chat.
  const rung = async (page, value) => {
    const shown = await page.evaluate(() => {
      const pane = document.querySelector('[data-testid="profile"]');
      return pane !== null && !pane.hasAttribute("hidden");
    });
    if (!shown) {
      await page.click('[data-testid="profile-button"]');
      await page.waitForTimeout(300);
    }
    await page.click(`[data-testid="setting-intelligence-${value}"]`);
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    // The conversation comes back from the seat's own field.
    await openSeat(page);
  };
  await rung(remote, "graph");
  await sourceComes(remote, (said) => said === "graph-native");
  const kept = await remote.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("graview:intelligence") ?? "{}");
    return { source: stored.source, key: stored.remote?.apiKey };
  });
  report.checks.keySurvivesRungSwitch = {
    ...kept,
    ok: kept.source === "graph" && kept.key === "k-test",
  };

  /* --------------- the decision rung says what it cannot do, in the answer */
  // Four rungs on one switch; the fourth decides and does not talk, so the
  // graph answers the chat and the seat SAYS SO in the reply itself — the
  // sentence is part of the answer, not chrome painted by the panel — and
  // switching takes effect without a reload.
  await rung(remote, "decision");
  await remote.click('[data-testid="profile-button"]');
  await remote.waitForTimeout(200);
  const rungs = await remote.$$eval('[data-testid^="setting-intelligence-"][aria-pressed]', (pills) => pills.map((pill) => pill.getAttribute("data-testid").replace("setting-intelligence-", "")));
  await remote.keyboard.press("Escape");
  await remote.waitForTimeout(150);
  const decidesSaid = await sourceComes(remote, (said) => said.includes("decides"));
  const decided = await send(remote, "what's wrong?");
  report.checks.decisionRungSaysItDecides = {
    rungs,
    header: decidesSaid,
    reply: decided.text.slice(-120),
    ok:
      rungs.join(",") === "graph,local,decision,remote" &&
      decided.text.includes("decides rather than talks") &&
      decided.text.includes("the graph is answering here"),
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
