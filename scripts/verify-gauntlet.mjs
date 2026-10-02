#!/usr/bin/env node
/**
 * The awkward example, driven into as many states as it has.
 *
 * Every other harness drives a tame fixture: short unique ASCII names, one
 * person, permitted seats, a few dozen records. `apps/gauntlet` is the
 * opposite on purpose — long, accented, case-variant and duplicate names, a
 * kind with no label field, an edge name on two kinds, two relations
 * between one pair, a lifecycle with retired members, a volunteer refused
 * nearly everything, an agent seat, a calendar over two kinds, and four
 * thousand records (see its `src/domain/schema.ts`).
 *
 * This harness's job is to REACH states: both faces, at 1440 and at 390,
 * in both schemes, as every seat; districts opened, records with long and
 * duplicate names focused, the calendar opened and paged, asks and forms
 * opened and put away with Escape, acts pressed from the keyboard, undone.
 * It judges very little itself — whether each state was reached, and that
 * nothing threw — because the rules that hold on every screen belong to
 * the in-page watch that `launchEngine` attaches, which judges every state
 * this reaches without this file having to know what the rules are.
 *
 *   node scripts/verify-gauntlet.mjs [--headed] [--engine=webkit]
 *
 * Writes docs/gauntlet.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const PORT = 5191;
const BASE = `http://localhost:${PORT}`;

/** Every seat the app offers, by the id `?as=` takes — none of them a name. */
const ALL_SEATS = [
  { id: "u-4f1c9a", who: "chair" },
  { id: "u-9b27e0", who: "reviewer" },
  { id: "u-02d8c4", who: "volunteer" },
  { id: "agent-sched-7", who: "agent" },
  { id: "u-anon-0", who: "visitor" },
];
/*
 * QUICK, while iterating (GRAVIEW_QUICK, `pnpm verify --quick`): the seat
 * that may do most and the seat that may do least, in one scheme — the
 * nine-minute sweep in about two. The nightly walks every seat.
 */
const QUICK = process.env["GRAVIEW_QUICK"] === "1";
const SEATS = QUICK ? ALL_SEATS.filter((seat) => seat.who === "chair" || seat.who === "volunteer") : ALL_SEATS;
const WIDTHS = [1440, 390];
/** The seats whose role grants an act on a talk; the volunteer and the visitor have none. */
const MAY_ACT_ON_A_TALK = ["chair", "reviewer", "agent"];
const SCHEMES = QUICK ? ["light"] : ["light", "dark"];
/*
 * Who is on staff is the programme's own people's to see
 * (apps/gauntlet/src/domain/policy.ts, `sees`): the visitor, with no role,
 * is shown six districts, and a staff member is kept from it on both faces.
 */
const MAY_SEE_STAFF = ["chair", "reviewer", "volunteer", "agent"];
const seesStaff = (seat) => MAY_SEE_STAFF.includes(ALL_SEATS.find((one) => one.id === seat)?.who);

/*
 * Records chosen for their shape, by the ids the seed generator mints
 * (apps/gauntlet/scripts/generate-seed.mjs is deterministic, so these are
 * stable). A rename there fails here as "not reached", by name.
 */
const RECORDS = {
  longTalk: "talk:uber-die-zuverlassigkeit-verteilter-systeme-erfahrungen-aus-a-startup-that-grew-faster-than-its-database",
  submittedTalk: "talk:uber-die-zuverlassigkeit-verteilter-systeme-erfahrungen-aus-a-municipal-water-utility-6",
  openingRemarks: "talk:opening-remarks-7",
  weiZhang: "speaker:wei-zhang-2",
  nonLatin: "speaker:王-芳",
  longSpeaker: "speaker:maximiliane-franziska-wilhelmina-von-hohenzollern-sigmaringen-ostbrandenburg",
  room: "room:aula",
  staff: "staff:sam-taylor-2",
  workshop: "workshop:hands-on-fifty-people-twenty-four-chairs-and-one-projector",
  session: "session:2026-day-1-morning-track-a-distributed-systems-and-the-long-tail-of-reliability-engineering",
};

const report = { at: new Date().toISOString(), engine: ENGINE, states: [], pageErrors: [], checks: {} };

const focusHash = (id) => `#focus=${encodeURIComponent(id)}&sel=${encodeURIComponent(id)}`;
const pagePath = (plural, id) => `/pages/${plural}/${encodeURIComponent(id)}`;

/**
 * One state: what was asked, whether it was reached, and anything the page
 * threw while getting there. A step that throws is recorded as not reached
 * and the walk goes on — one broken door must not hide every room behind it.
 */
async function reach(page, where, name, step) {
  const before = page.__errors.length;
  let reached = false;
  let detail;
  let error;
  try {
    const result = await Promise.race([
      step(),
      new Promise((_, fail) => setTimeout(() => fail(new Error("timed out after 60s")), 60_000)),
    ]);
    reached = result === undefined ? true : Boolean(result.reached ?? result);
    detail = typeof result === "object" && result !== null ? result.detail : undefined;
  } catch (thrown) {
    error = String(thrown?.message ?? thrown).split("\n")[0].slice(0, 240);
  }
  const threw = page.__errors.slice(before);
  report.states.push({
    state: name,
    ...where,
    reached,
    ...(detail !== undefined ? { detail } : {}),
    ...(error ? { error } : {}),
    ...(threw.length > 0 ? { pageErrors: threw } : {}),
  });
  process.stdout.write(`${reached && threw.length === 0 ? "ok  " : "MISS"} ${where.face.padEnd(5)} ${String(where.width).padEnd(4)} ${where.scheme.padEnd(5)} ${where.seat.padEnd(9)} ${name}${error ? ` — ${error}` : ""}${threw.length ? ` — threw: ${threw[0]}` : ""}\n`);
  return reached;
}

async function newPage(browser, width, scheme) {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: scheme });
  page.__errors = [];
  page.on("pageerror", (thrown) => {
    const text = String(thrown).slice(0, 240);
    page.__errors.push(text);
    report.pageErrors.push(text);
  });
  return page;
}

/** Open a URL of the app as a seat, in a scheme, and wait until the store has opened. */
async function open(page, path, { scheme, seat, hash = "" }) {
  const query = new URLSearchParams({ theme: scheme, as: seat });
  const [pathname, extra] = path.split("?");
  const url = `${BASE}${pathname}?${query}${extra ? `&${extra}` : ""}${hash}`;
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  await page.waitForFunction(() => "__graviewReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1500);
}

const count = (page, selector) => page.evaluate((s) => document.querySelectorAll(s).length, selector);
const has = async (page, selector) => (await count(page, selector)) > 0;
const go = async (page, hash, settle = 1500) => {
  await page.evaluate((next) => {
    window.location.hash = next;
  }, hash);
  await page.waitForTimeout(settle);
};
/**
 * The strip, wherever this width keeps it: beside the scene at a desk, in
 * the companion's dock on a phone — opened if it is shut.
 */
const showStrip = async (page) => {
  const dock = page.locator('[data-testid="companion-dock"]');
  if ((await dock.count()) > 0 && (await dock.first().getAttribute("aria-expanded")) === "false") {
    await dock.first().click();
    await page.waitForTimeout(700);
  }
};
/** Rise to altitude whichever way the toggle stands. */
const rise = async (page) => {
  const up = await page.evaluate(() => document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true");
  if (!up) {
    await page.click('[data-testid="overview"]');
    await page.waitForTimeout(1200);
  }
};

/* ------------------------------------------------------------- landings */

/** Both faces, both widths, both schemes, every seat: the door each one walks in by. */
async function landings(browser) {
  for (const width of WIDTHS) {
    for (const scheme of SCHEMES) {
      const page = await newPage(browser, width, scheme);
      for (const { id: seat } of SEATS) {
        const scene = { face: "scene", width, scheme, seat };
        await reach(page, scene, "the city from altitude", async () => {
          await open(page, "/", { scheme, seat, hash: "#overview=1" });
          const districts = await count(page, '[data-graview-view^="kind:"]');
          return { reached: districts === (seesStaff(seat) ? 7 : 6), detail: districts };
        });
        const pages = { face: "pages", width, scheme, seat };
        await reach(page, pages, "the pages' home", async () => {
          await open(page, "/pages", { scheme, seat });
          return has(page, '[data-testid="masthead"]');
        });
      }
      await page.close();
    }
  }
}

/* ---------------------------------------------------------- the scene */

/**
 * A walk through the scene as one seat, at one width, in one scheme:
 * districts, long and duplicate names, the calendar, an ask put away with
 * Escape, an act pressed from the keyboard, and the turn taken back.
 */
async function sceneWalk(browser, { width, scheme, seat, who }) {
  const page = await newPage(browser, width, scheme);
  const where = { face: "scene", width, scheme, seat };
  await open(page, "/", { scheme, seat, hash: "#overview=1" });

  for (const kind of ["talk", "speaker", "session"]) {
    await reach(page, where, `the ${kind} district opened in place`, async () => {
      await rise(page);
      const control = page.locator(`[data-testid="open-${kind}"]`).first();
      // On a phone a district can stand past the edge of the ground; its sign brings it in, as a person would press it.
      const sign = page.locator(`[data-graview-past-edge="kind:${kind}"]`).first();
      if ((await sign.count()) > 0) {
        await sign.click();
        await page.waitForTimeout(800);
      }
      await control.click();
      await page.waitForTimeout(1200);
      return { reached: (await control.getAttribute("aria-expanded")) === "true", detail: await count(page, `[data-graview-view="kind:${kind}"] [data-graview-pick]`) };
    });
  }

  await reach(page, where, "a district gone deeper into", async () => {
    await go(page, "#focus=aggregate%3Atalk", 2500);
    return has(page, '[data-graview-view="aggregate:talk"]');
  });

  for (const [label, id] of [
    ["a talk with a long, shared-prefix title focused", RECORDS.longTalk],
    ["one of ten Opening Remarks focused", RECORDS.openingRemarks],
    ["one of three Wei Zhangs focused", RECORDS.weiZhang],
    ["a speaker named in Han script focused", RECORDS.nonLatin],
    ["a speaker with a seventy-character name focused", RECORDS.longSpeaker],
    ["a room with no label field focused", RECORDS.room],
    ["a workshop over its room's seats focused", RECORDS.workshop],
  ]) {
    await reach(page, where, label, async () => {
      await go(page, focusHash(id), 2000);
      return { reached: await has(page, `[data-graview-view="${id}"]`), detail: await page.evaluate(() => location.hash) };
    });
  }

  if (seesStaff(seat)) {
    await reach(page, where, "one of two staff members of one name focused", async () => {
      await go(page, focusHash(RECORDS.staff), 2000);
      return { reached: await has(page, `[data-graview-view="${RECORDS.staff}"]`), detail: await page.evaluate(() => location.hash) };
    });
  } else {
    await reach(page, where, "a staff member kept from a seat that may not see them", async () => {
      await go(page, focusHash(RECORDS.staff), 2000);
      return { reached: !(await has(page, `[data-graview-view="${RECORDS.staff}"]`)), detail: await page.evaluate(() => location.hash) };
    });
  }

  await reach(page, where, "the strip on a submitted talk, withheld acts shown", async () => {
    await go(page, focusHash(RECORDS.submittedTalk), 2000);
    await showStrip(page);
    const more = page.locator('[data-testid="withheld-more"]');
    if (await more.count()) await more.first().click();
    await page.waitForTimeout(400);
    const offered = await count(page, '[data-testid="affordances"] [data-affordance]');
    const withheld = await count(page, '[data-testid="withheld"] [data-affordance]');
    return { reached: offered + withheld > 0, detail: { offered, withheld } };
  });

  /*
   * A seat with no act on a talk reaches a different state — the strip with
   * every act withheld — and that is the state worth reaching for it.
   */
  if (!MAY_ACT_ON_A_TALK.includes(who)) {
    await reach(page, where, "a talk with every act withheld", async () => {
      await showStrip(page);
      const offered = await count(page, '[data-testid="affordances"] [data-affordance]:not([disabled])');
      return { reached: offered === 0, detail: { offered } };
    });
  } else await reach(page, where, "an ask opened from the strip and put away with Escape", async () => {
    await showStrip(page);
    const asks = page.locator('[data-testid="affordances"] [data-affordance]:not([disabled])', { hasText: /Add a presenter|Say what it is about|Give it a slot/ });
    if ((await asks.count()) === 0) return { reached: false, detail: "this seat is offered no act that asks" };
    await asks.first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(900);
    const asked = await has(page, "[data-graview-asking]");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    return { reached: asked && !(await has(page, "[data-graview-asking]")), detail: { asked } };
  });

  await reach(page, where, "the Find box asked for a name ten records share", async () => {
    await page.click('[data-testid="find-box"]');
    await page.fill('[data-testid="find-box"]', "");
    await page.keyboard.type("Opening Remarks", { delay: 20 });
    await page.waitForTimeout(1500);
    const hits = await count(page, '[data-testid="find-strip"] [data-testid="find-hit"]');
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    return { reached: hits > 1, detail: { hits } };
  });

  /*
   * Typed as text the keyboard has no key for (an IME's, Playwright's
   * insertText). With a talk of a hundred characters focused at a desk,
   * the trail's crumb squeezed the Find box to 23px, and Chromium commits
   * such text into a field that narrow with the caret left at the start:
   * "Плинов" read "вонилП" and found nothing. The box now keeps a floor and
   * the crumb truncates (the Shell and the Trail in @graview/primitives).
   */
  await reach(page, where, "the Find box asked in another script", async () => {
    await page.click('[data-testid="find-box"]');
    await page.fill('[data-testid="find-box"]', "");
    await page.keyboard.type("Плинов", { delay: 20 });
    await page.waitForTimeout(1500);
    const hits = await count(page, '[data-testid="find-strip"] [data-testid="find-hit"]');
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    return { reached: hits > 0, detail: { hits } };
  });

  await reach(page, where, "the timetable over talks and workshops opened", async () => {
    await go(page, "#focus=aggregate%3Atalk&in.view=the-timetable", 3000);
    return has(page, '[data-testid="calendar"]');
  });

  await reach(page, where, "the timetable paged a week on", async () => {
    await page.locator('[data-testid="calendar"] button[aria-label="Next"]').first().click();
    await page.waitForTimeout(1200);
    return has(page, '[data-testid="calendar"]');
  });

  await reach(page, where, "the timetable over all ten editions", async () => {
    // Buttons at a desk, a select on a phone: the same ranges either way.
    const button = page.locator('[data-testid="calendar-range-years"]');
    if ((await button.count()) > 0) await button.first().click();
    else await page.locator('select[data-testid="calendar-ranges"]').first().selectOption("years");
    await page.waitForTimeout(2000);
    return { reached: await has(page, '[data-testid="calendar"]'), detail: await page.evaluate(() => location.hash) };
  });

  await reach(page, where, "the workshops' timetable, the calendar's second kind", async () => {
    await go(page, "#focus=aggregate%3Aworkshop&in.view=the-timetable", 2500);
    return has(page, '[data-testid="calendar"]');
  });

  await reach(page, where, "what the talks are about, at real size", async () => {
    await go(page, "#focus=aggregate%3Atalk&in.view=what-the-talks-are-about", 3000);
    return has(page, '[data-graview-view="aggregate:talk"]');
  });

  /*
   * AN ACT, PRESSED FROM THE KEYBOARD, AND TAKEN BACK. Each seat presses
   * the act it may take: the chair and the reviewer accept a submitted
   * talk, the volunteer checks a speaker in, the scheduler moves a
   * session's room. A visitor may take none, so walks past both.
   */
  const act = {
    chair: [RECORDS.submittedTalk, /Accept it/],
    reviewer: [RECORDS.submittedTalk, /Accept it/],
    volunteer: [RECORDS.weiZhang, /Check them in/],
    agent: [RECORDS.session, /Say which room/],
  }[who];
  let pressed = false;
  if (act) await reach(page, where, "an act pressed from the keyboard", async () => {
    await go(page, focusHash(act[0]), 2000);
    await showStrip(page);
    const button = page.locator('[data-testid="affordances"] [data-affordance]:not([disabled])', { hasText: act[1] });
    if ((await button.count()) === 0) return { reached: false, detail: `${who} is offered no ${act[1]}` };
    await button.first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
    // An act that still asks: answer each question with its first offer, by the keyboard.
    for (let step = 0; step < 3 && (await has(page, "[data-graview-asking]")); step++) {
      const choice = page.locator("[data-graview-asking] button:not([disabled])").first();
      if ((await choice.count()) === 0) break;
      await choice.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(800);
    }
    if (await has(page, "[data-graview-asking]")) {
      await page.keyboard.press("Escape");
      return { reached: false, detail: "the act asked for more than a choice" };
    }
    pressed = true;
    return true;
  });

  if (act) await reach(page, where, "the turn taken back from the activity", async () => {
    await page.click('[data-testid="activity-button"]');
    await page.waitForTimeout(800);
    const undo = page.locator('[data-testid="undo-turn"]');
    if (!pressed || (await undo.count()) === 0) {
      await page.keyboard.press("Escape");
      return { reached: false, detail: pressed ? "no turn to take back" : "nothing was pressed" };
    }
    await undo.first().click();
    await page.waitForTimeout(1000);
    const refused = await page.evaluate(() => document.querySelector('[data-testid="undo-refused"]')?.textContent ?? null);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    return { reached: refused === null, detail: refused ?? undefined };
  });

  await reach(page, where, "the keyboard walked from the page and Escape pressed", async () => {
    await go(page, focusHash(RECORDS.longTalk), 1500);
    await page.evaluate(() => document.activeElement?.blur?.());
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    return { reached: true, detail: await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? null) };
  });

  await reach(page, where, "the profile opened and the seats listed", async () => {
    await page.click('[data-testid="profile-button"]');
    await page.waitForTimeout(500);
    const seats = await count(page, '[data-testid^="seat-"]');
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    return { reached: seats === ALL_SEATS.length, detail: { seats } };
  });

  if (who === "chair") {
    await reach(page, where, "the studio opened over the declaration", async () => {
      await page.click('[data-testid="profile-button"]');
      await page.waitForTimeout(400);
      await page.click('[data-testid="studio-place"]');
      await page.waitForSelector('[data-testid="studio"]', { timeout: 30_000 });
      await page.waitForTimeout(1200);
      const shown = await has(page, '[data-testid="studio"]');
      await page.goBack();
      await page.waitForTimeout(1000);
      return shown;
    });
  }
  await page.close();
}

/* ---------------------------------------------------------- the pages */

async function pagesWalk(browser, { width, scheme, seat, who }) {
  const page = await newPage(browser, width, scheme);
  const where = { face: "pages", width, scheme, seat };
  const visit = (name, path, selector) =>
    reach(page, where, name, async () => {
      await open(page, path, { scheme, seat });
      return { reached: await has(page, selector), detail: { wide: await page.evaluate(() => document.documentElement.scrollWidth) } };
    });

  await visit("the talks, every one of two thousand", "/pages/talks", '[data-testid="records"]');
  await visit("the talks, the past widened", "/pages/talks?filter=is%3Aany", '[data-testid="records"]');
  await visit("the speakers", "/pages/speakers", '[data-testid="records"]');
  if (seesStaff(seat)) await visit("the staff, a mass noun", "/pages/staff", '[data-testid="records"] [href*="/pages/staff/"]');
  else
    await reach(page, where, "the staff kept from a seat that may not see them", async () => {
      await open(page, "/pages/staff", { scheme, seat });
      return { reached: !(await has(page, '[href*="/pages/staff/"]')), detail: await page.evaluate(() => document.title) };
    });
  await visit("a talk with a long, shared-prefix title", pagePath("talks", RECORDS.longTalk), '[data-testid="record-fields"]');
  await visit("one of ten Opening Remarks", pagePath("talks", RECORDS.openingRemarks), '[data-testid="record-fields"]');
  await visit("one of three Wei Zhangs", pagePath("speakers", RECORDS.weiZhang), '[data-testid="record-fields"]');
  await visit("a speaker whose id is in Han script", pagePath("speakers", RECORDS.nonLatin), '[data-testid="record-fields"]');
  await visit("a room with no label field", pagePath("rooms", RECORDS.room), '[data-testid="record-fields"]');
  await visit("a session, held in a room and chaired by one", pagePath("sessions", RECORDS.session), '[data-testid="record-fields"]');
  await visit("the places", "/pages/places", '[data-testid="places"], [data-testid="gallery"]');
  await visit("the timetable's place", "/pages/places/the-timetable", '[data-testid="place-lens"]');
  await visit("the coverage's place", "/pages/places/what-the-talks-are-about", '[data-testid="place-lens"]');
  await visit("the problems the seed was written with", "/pages/problems", '[data-testid="repairs"]');
  await visit("a search for a name ten records share", "/pages/search?q=Opening%20Remarks", '[data-testid="search-hit"]');
  await visit("a search that folds an accent", "/pages/search?q=zoe%20lamarre", '[data-testid="search-hit"]');
  await visit("the map of the kinds", "/pages/map", '[data-testid="kind-map"]');

  if (!MAY_ACT_ON_A_TALK.includes(who)) {
    await reach(page, where, "a talk's page with every act withheld", async () => {
      await open(page, pagePath("talks", RECORDS.submittedTalk), { scheme, seat });
      const offered = await count(page, '[data-testid="record-actions"] button[data-affordance]');
      return { reached: offered === 0, detail: { offered } };
    });
  } else await reach(page, where, "a form opened on a submitted talk and put away with Escape", async () => {
    await open(page, pagePath("talks", RECORDS.submittedTalk), { scheme, seat });
    const actions = page.locator('[data-testid="record-actions"] button[data-affordance]');
    if ((await actions.count()) === 0) return { reached: false, detail: "this seat is offered nothing here" };
    const wanted = page.locator('[data-testid="record-actions"] button[data-affordance]', { hasText: /Add a presenter|Say what it is about|Give it a slot/ });
    const button = (await wanted.count()) > 0 ? wanted.first() : actions.first();
    await button.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    const form = await has(page, 'form[data-testid^="form-"]');
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    return { reached: form, detail: { form, expanded: await button.getAttribute("aria-expanded") } };
  });

  await reach(page, where, "a refused act on a page says why", async () => {
    await open(page, pagePath("talks", RECORDS.submittedTalk), { scheme, seat });
    return { reached: true, detail: { withheld: await count(page, '[data-testid="withheld"] li, [data-testid="withheld"] [data-affordance]') } };
  });
  await page.close();
}

/* -------------------------------------------------------------- the run */

let browser;
let app;
try {
  app = await serving("gauntlet", PORT, repoRoot);
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });

  // `--seat=volunteer` walks one seat and skips the landings: for working on the walk, never for a verdict.
  const only = process.argv.find((arg) => arg.startsWith("--seat="))?.slice("--seat=".length);
  if (!only) await landings(browser);

  /*
   * The walks, one per seat, spread over the widths and schemes so every
   * combination is walked by somebody: the chair and the agent at a desk,
   * the reviewer and the volunteer on a phone, the visitor in the dark.
   */
  const WALKS = [
    { seat: "u-4f1c9a", who: "chair", width: 1440, scheme: "light" },
    { seat: "u-9b27e0", who: "reviewer", width: 390, scheme: "light" },
    { seat: "u-02d8c4", who: "volunteer", width: 390, scheme: "dark" },
    { seat: "agent-sched-7", who: "agent", width: 1440, scheme: "dark" },
    { seat: "u-anon-0", who: "visitor", width: 1440, scheme: "dark" },
  ];
  for (const walk of WALKS.filter((one) => (!only || one.who === only) && SEATS.some((seat) => seat.id === one.seat))) {
    await sceneWalk(browser, walk);
    await pagesWalk(browser, walk);
  }
} catch (error) {
  report.error = String(error?.stack ?? error).slice(0, 600);
} finally {
  await browser?.close();
  app?.stop();
}

/* ---------------------------------------------------------- the claims */

const reached = (name, match = () => true) => {
  const states = report.states.filter((one) => one.state === name && match(one));
  return states.length > 0 && states.every((one) => one.reached);
};
const missed = report.states.filter((one) => !one.reached).map((one) => `${one.face} ${one.width} ${one.scheme} ${one.seat}: ${one.state}${one.detail ? ` (${JSON.stringify(one.detail)})` : ""}${one.error ? ` — ${one.error}` : ""}`);
report.missed = missed;

/*
 * THE HARNESS'S OWN CLAIMS: that it got where it meant to, and that nothing
 * broke on the way. What is TRUE on each of those screens is the watch's to
 * say, not this file's.
 */
report.checks = {
  // Both faces opened at 1440 and 390, in both schemes, as every seat.
  everyFaceOpensAtEveryWidthSchemeAndSeat:
    report.states.filter((one) => one.state === "the city from altitude" || one.state === "the pages' home").length === WIDTHS.length * SCHEMES.length * SEATS.length * 2 &&
    reached("the city from altitude") &&
    reached("the pages' home"),
  // Every district clicked open at altitude, opened.
  everyDistrictOpensInPlace: ["talk", "speaker", "session"].every((kind) => reached(`the ${kind} district opened in place`)),
  // Each record chosen for an awkward name is reached on both faces.
  everyAwkwardRecordIsReached:
    [
      "a talk with a long, shared-prefix title focused",
      "one of ten Opening Remarks focused",
      "one of three Wei Zhangs focused",
      "a speaker named in Han script focused",
      "a speaker with a seventy-character name focused",
      "a room with no label field focused",
      "one of two staff members of one name focused",
      "a workshop over its room's seats focused",
    ].every((name) => reached(name)) &&
    ["a talk with a long, shared-prefix title", "one of ten Opening Remarks", "one of three Wei Zhangs", "a speaker whose id is in Han script", "a room with no label field"].every((name) => reached(name)),
  // The calendar over two kinds opens, pages and widens to ten years, on both faces.
  theCalendarOverTwoKindsOpens:
    reached("the timetable over talks and workshops opened") &&
    reached("the timetable paged a week on") &&
    reached("the timetable over all ten editions") &&
    reached("the workshops' timetable, the calendar's second kind") &&
    reached("the timetable's place"),
  // What a seat may not see is not reached: the visitor is kept from the staff on both faces.
  whatASeatMayNotSeeIsKeptFromIt:
    !SEATS.some((seat) => !seesStaff(seat.id)) ||
    (reached("a staff member kept from a seat that may not see them") && reached("the staff kept from a seat that may not see them")),
  // Find and search answer a name ten records share, and one in another script.
  findingReachesAwkwardNames:
    reached("the Find box asked for a name ten records share") &&
    reached("the Find box asked in another script") &&
    reached("a search for a name ten records share") &&
    reached("a search that folds an accent"),
  // A seat that may act opens an ask and puts it away with Escape; a page opens a form.
  asksAndFormsOpenAndClose:
    reached("an ask opened from the strip and put away with Escape", (one) => ["u-4f1c9a", "u-9b27e0", "agent-sched-7"].includes(one.seat)) &&
    reached("a form opened on a submitted talk and put away with Escape", (one) => ["u-4f1c9a", "u-9b27e0", "agent-sched-7"].includes(one.seat)),
  // Every seat that may act presses an act from the keyboard and takes it back.
  anActIsPressedAndTakenBackByEverySeatThatMayAct:
    reached("an act pressed from the keyboard", (one) => one.seat !== "u-anon-0") &&
    reached("the turn taken back from the activity", (one) => one.seat !== "u-anon-0"),
  // Nothing the harness asked threw inside the harness.
  noStepThrew: report.states.every((one) => !one.error) && !report.error,
  // And nothing threw inside the page.
  noPageErrors: report.pageErrors.length === 0,
};
report.reached = `${report.states.filter((one) => one.reached).length} of ${report.states.length} states`;
report.passed = Object.values(report.checks).every(Boolean);

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/gauntlet.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`\n${JSON.stringify(report.checks, null, 2)}\n${missed.length ? `\nnot reached:\n  ${missed.join("\n  ")}\n` : ""}\n${report.reached} reached · wrote docs/gauntlet.json\n`);
process.exit(report.passed ? 0 : 1);
