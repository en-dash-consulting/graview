#!/usr/bin/env node
/**
 * The chat experience, held to its own claims in a real browser.
 *
 * The seat promises specific things: it answers from the graph before any
 * model, a change it proposes travels the same validated path as a click
 * and really can be undone, a refusal is a result in the thread (never a
 * "Done" over a change the store refused), nothing asks the reader which
 * machine answers, an open question with no model is told AI isn't on
 * here, the host's model answers it with one quiet "Answered with AI", and
 * a broken model leaves the graph's answer with a quiet line rather than an
 * error. Every one of those is driven here, end to end —
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

/** A rung's name, or the words of the picker that offered them: none of it is ever shown now. */
const RUNG_WORDS = "graph-native|Graph only|Onboard AI|\\bJev\\b|\\bLLM\\b|on this device|with my key|What answers|Answers come from|Answering now";
const CHOOSERS = ["seat-settings", "seat-source", "seat-ladder", "setting-intelligence", "seat-offer-model", "chat-settings"];

/** Whatever in the open seat, and in the person's menu, offers a choice of what answers or names a rung. */
async function whatAnswersIsOffered(page) {
  await openSeat(page);
  const read = (where) =>
    page.evaluate(
      ({ where, words, choosers }) => {
        const at = document.querySelector(where);
        const said = `${at?.innerText ?? ""} ${[...(at?.querySelectorAll("[aria-label],[title]") ?? [])].map((el) => `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`).join(" ")}`;
        return {
          found: at !== null,
          controls: choosers.filter((id) => document.querySelector(`[data-testid="${id}"]`) !== null),
          words: [...new Set(said.match(new RegExp(words, "g")) ?? [])],
        };
      },
      { where, words: RUNG_WORDS, choosers: CHOOSERS },
    );
  const seat = await read('[data-testid="seat"]');
  await page.click('[data-testid="profile-button"]');
  await page.waitForTimeout(300);
  const menu = await read('[data-testid="profile"]');
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  return { seat, menu };
}

/** The seat's reply row: its words, and whether it carries the quiet note a model's answer does. */
const noteOf = (page) =>
  page.evaluate(() => [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')].at(-1)?.querySelector('[data-testid="seat-answered-with-ai"]')?.textContent ?? null);

const NO_AI = "I can answer about what's in this app. Open questions need AI, which isn't on here.";
/** The same, in a dev build whose server holds no key: how to turn it on (`aiDevProxy`). Never in a built page. */
const NO_AI_IN_DEV = "I can answer about what's in this app. Open questions need AI. Set ANTHROPIC_API_KEY when you start the dev server to turn it on.";

/** Sends one message and returns the seat's reply row. */
async function send(page, text) {
  await openSeat(page);
  await page.fill(FIELD, text);
  await page.press(FIELD, "Enter");
  await page.waitForFunction(
    (asked) => {
      const rows = [...document.querySelectorAll('[data-testid="seat-panel"] ol > li')];
      const mine = rows.findIndex((row) => (row.textContent ?? "").includes(asked));
      // The answer itself, not the line that says it is coming.
      return mine >= 0 && rows.length > mine + 1 && !(rows[rows.length - 1]?.textContent ?? "").startsWith("thinking");
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

  /* ------------- nothing asks the reader which machine answers, nor names one */
  const offered = await whatAnswersIsOffered(page);
  report.checks.noChoiceOfWhatAnswers = {
    ...offered,
    ok: offered.seat.found && offered.menu.found && [offered.seat, offered.menu].every((one) => one.controls.length === 0 && one.words.length === 0),
  };

  /* ----------------------------- the graph answers its own shape, keyless */
  const overview = await send(page, "what is here?");
  report.checks.groundedOverview = {
    reply: overview.text.slice(0, 120),
    // Where the reader stands, said from the graph: the home and what it holds, now that the seat knows the places.
    ok: /This graph holds|^Home\. It holds /.test(overview.text) && overview.applies === 0,
  };

  /*
   * ------------- with no model, an open question is told so, once, in plain words —
   * and, this being a dev server holding no key, how to turn one on.
   */
  const open = await send(page, "should we repaint the hallway?");
  const openNote = await noteOf(page);
  report.checks.withoutAiAnOpenQuestionIsToldSo = {
    reply: open.text.slice(0, 160),
    note: openNote,
    ok: open.text.includes(NO_AI_IN_DEV) && openNote === null && !new RegExp(RUNG_WORDS).test(open.text),
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

  /* ============ the host's model: an open question is the model's, said quietly */
  /*
   * The host decides the AI, once — here the example's host hook, as a
   * host's own page passes `ai` to the embed. A fact the graph holds is
   * still the graph's, with nothing under it; an open question goes to the
   * model, and its answer carries one quiet "Answered with AI".
   */
  const modeled = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  modeled.on("pageerror", (error) => errors.push(error.message));
  await modeled.addInitScript(() => {
    window.__todoModelAsked = 0;
    window.__todoAi = {
      name: "harness",
      complete: async () => {
        window.__todoModelAsked += 1;
        return JSON.stringify({ say: "Repaint it in the spring, when the windows can stay open.", proposals: [] });
      },
    };
  });
  await modeled.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await modeled.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  const fact = await send(modeled, "what's wrong?");
  const factNote = await noteOf(modeled);
  const askedForTheFact = await modeled.evaluate(() => window.__todoModelAsked);
  const answered = await send(modeled, "should we repaint the hallway?");
  const answeredNote = await noteOf(modeled);
  const modeledOffered = await whatAnswersIsOffered(modeled);
  report.checks.theHostsModelAnswersAnOpenQuestionQuietly = {
    fact: fact.text.slice(0, 80),
    factNote,
    askedForTheFact,
    answered: answered.text.slice(0, 120),
    answeredNote,
    offered: modeledOffered,
    ok:
      /problem/.test(fact.text) &&
      factNote === null &&
      askedForTheFact === 0 &&
      answered.text.includes("Repaint it in the spring") &&
      answeredNote === "Answered with AI" &&
      !answered.text.includes(NO_AI) &&
      [modeledOffered.seat, modeledOffered.menu].every((one) => one.controls.length === 0 && one.words.length === 0),
  };
  await modeled.close();

  /* ============ a broken model: the graph's answer stands, with a quiet line */
  const broken = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  await broken.addInitScript(() => {
    window.__todoAi = {
      complete: async () => {
        throw new Error("the model is down");
      },
    };
  });
  await broken.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await broken.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
  // A fact the graph holds never reaches the model, broken or not.
  const grounded = await send(broken, "what's wrong?");
  const floored = await send(broken, "should we repaint the hallway?");
  const flooredNote = await noteOf(broken);
  report.checks.aBrokenModelLeavesTheGraphsAnswer = {
    grounded: grounded.text.slice(-80),
    floored: floored.text.slice(-120),
    flooredNote,
    ok:
      /problem/.test(grounded.text) &&
      !grounded.text.includes("AI didn't answer") &&
      floored.text.includes("AI didn't answer just now, so this is from the app alone.") &&
      flooredNote === null &&
      !new RegExp(RUNG_WORDS).test(floored.text),
  };
  await broken.close();
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
