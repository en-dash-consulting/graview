#!/usr/bin/env node
/**
 * THE SEAT IS A COMPANION ON THE FRAME, held to its claims in a real browser.
 *
 * The rail is in the same place at every height and in every mode — on the
 * ground, at altitude, flown closer, inside a full-screen lens — because it
 * is attached to the frame rather than standing on the ground. Its header
 * names what "this" is: the selection, else what the pointer has settled
 * on, else where you are. Right-click opens the same acts at the pointer,
 * so the context menu and the assistant are one construct. A refused
 * proposal is said in the rail, at the gate. And nothing animates on a
 * quiet city three seconds after load.
 *
 *   node scripts/verify-companion.mjs [--engine=chromium|webkit|firefox]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const report = { at: new Date().toISOString(), engine: ENGINE, checks: {}, pageErrors: [] };
let browser;
let vite;

const box = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="companion"]');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  });
const subject = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="companion"]');
    return el
      ? {
          id: el.getAttribute("data-graview-subject"),
          because: el.getAttribute("data-graview-because"),
          said: document.querySelector('[data-testid="companion-subject"]')?.textContent?.trim() ?? null,
        }
      : null;
  });

try {
  vite = await serving("todo", 5193, repoRoot);
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  page.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1500);

  /* ------------------------------------------- the rail is fixed to the frame */
  const onTheGround = await box(page);
  await page.evaluate(() => {
    window.location.hash = "#overview=1";
  });
  await page.waitForTimeout(1200);
  const aloft = await box(page);
  await page.evaluate(() => {
    window.location.hash = "#overview=1&focus=aggregate%3Atask&in.view=the-week";
  });
  await page.waitForTimeout(1400);
  const closer = await box(page);
  /* Down into the picture: the lens full screen, where the figure had no place at all. */
  await page.click('[data-testid="screen-fullscreen"]').catch(() => {});
  await page.waitForTimeout(1200);
  const inALens = await box(page);
  const same = (a, b) => a !== null && b !== null && a.x === b.x && a.y === b.y && a.w === b.w;
  report.checks.theRailIsFixed = {
    onTheGround,
    aloft,
    closer,
    inALens,
    ok: same(onTheGround, aloft) && same(aloft, closer) && same(closer, inALens),
  };

  /* ------------------------------------------------- the subject, without a gesture */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  const atRest = await subject(page);
  /* Pointed at: a pick under the pointer becomes the subject after a dwell, with no gesture to turn on. */
  const chip = await page.$('[data-graview-pick="t-deposit"]');
  if (chip) {
    const at = await chip.boundingBox();
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.waitForTimeout(700);
  }
  const pointed = await subject(page);
  /* Chosen outranks pointed at. */
  if (chip) await chip.click();
  await page.waitForTimeout(500);
  await page.mouse.move(20, 20);
  await page.waitForTimeout(700);
  const chosen = await subject(page);
  report.checks.theSubjectFollowsTheHover = {
    atRest,
    pointed,
    chosen,
    ok:
      atRest?.because === "place" &&
      pointed?.id === "t-deposit" &&
      pointed?.because === "hover" &&
      chosen?.id === "t-deposit" &&
      chosen?.because === "selection",
  };

  /* --------------------------------------- "this" in a message means that subject */
  const input = await page.$('[aria-label="Message the seat"]');
  let thisIsTheSubject = { ok: false, why: "no message field in the rail" };
  if (input) {
    await input.fill("tell me about this");
    await input.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-panel"] ol li').length >= 2, undefined, { timeout: 15_000 });
    await page.waitForTimeout(400);
    const reply = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-testid="chat-panel"] ol li')];
      return rows[rows.length - 1]?.textContent ?? "";
    });
    thisIsTheSubject = { reply: reply.slice(0, 120), ok: /deposit/i.test(reply) };
  }
  report.checks.thisIsTheSubject = thisIsTheSubject;

  /* ------------------------------------- right-click opens the same acts at the pointer */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  /* Choose a thing: the acts the inspector used to strip out are the rail's, about the subject it names. */
  const target = await page.$('[data-graview-pick="t-deposit"]');
  if (target) await target.click();
  await page.waitForTimeout(600);
  const railActs = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="companion"] [data-affordance]')].map((el) => el.getAttribute("data-affordance")),
  );
  if (target) {
    const at = await target.boundingBox();
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2, { button: "right" });
    await page.waitForTimeout(500);
  }
  const menu = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="context-menu"]');
    return el
      ? {
          acts: [...el.querySelectorAll("[data-affordance]")].map((one) => one.getAttribute("data-affordance")),
          struck: el.querySelectorAll("s").length,
          railAlso: document.querySelectorAll('[data-testid="companion"] [data-affordance]').length,
        }
      : null;
  });
  report.checks.rightClickOpensItHere = {
    railActs: railActs.length,
    menu,
    // The same pane, from the same derivation — and NOT drawn twice.
    ok: menu !== null && menu.acts.length > 0 && menu.railAlso === 0,
  };
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const afterEscape = await page.evaluate(() => ({
    menu: document.querySelector('[data-testid="context-menu"]') !== null,
    subject: document.querySelector('[data-testid="companion"]')?.getAttribute("data-graview-subject") ?? null,
  }));
  report.checks.escapeClosesThePopover = {
    ...afterEscape,
    ok: afterEscape.menu === false && afterEscape.subject === "t-deposit",
  };

  /* ------------------------------------------------- the acts the inspector had */
  report.checks.theInspectorsActsAreInIt = {
    acts: railActs,
    ok: railActs.length > 0,
  };

  /* ------------------------------- what the seat wrote is marked where it is */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  await page.click('[data-testid="activity-button"]').catch(() => {});
  await page.waitForTimeout(400);
  const seat = await page.$('[data-testid="agent-tidy"]');
  let marked = { ok: false, why: "no seat to press" };
  if (seat && !(await seat.isDisabled())) {
    await seat.click();
    await page.waitForTimeout(700);
    const marks = await page.evaluate(() => ({
      on: [...document.querySelectorAll('[data-testid="seat-mark"]')].map((el) => el.getAttribute("data-graview-seat-mark")),
      who: document.querySelector('[data-testid="seat-mark"]')?.getAttribute("data-graview-seat-who") ?? null,
      log: [...document.querySelectorAll('[data-testid="companion-log"] li')].length,
    }));
    marked = { ...marks, ok: marks.on.length > 0 && marks.who !== null && marks.log > 0 };
  }
  report.checks.aTurnMarksWhatItWrote = marked;

  /* ------------------------------------- "show me" takes the camera to it */
  let shown = { ok: false, why: "nothing in the log to show" };
  if (marked.ok) {
    const going = await page.$('[data-testid="companion-show-me"]');
    if (going) {
      const target = await going.getAttribute("data-graview-show");
      await page.evaluate(() => {
        window.location.hash = "#overview=1";
      });
      await page.waitForTimeout(900);
      await page.click('[data-testid="companion-show-me"]');
      await page.waitForTimeout(900);
      const aloft = await page.evaluate(() => location.hash);
      await page.evaluate(() => {
        window.location.hash = "";
      });
      await page.waitForTimeout(900);
      await page.click('[data-testid="companion-show-me"]');
      await page.waitForTimeout(700);
      const onTheGround = await page.evaluate(() => location.hash);
      shown = {
        target,
        aloft,
        onTheGround,
        // Up there a single task is a building: the camera goes to its district.
        ok: aloft.includes("focus=aggregate") && onTheGround.includes(`focus=${target}`),
      };
    }
  }
  report.checks.showMeFliesThere = shown;

  /* ------------------------------------------- undo takes the mark with it */
  let cleared = { ok: false, why: "nothing to undo" };
  if (marked.ok) {
    await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1", { waitUntil: "load" });
    await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
    await page.waitForTimeout(1400);
    await page.click('[data-testid="activity-button"]').catch(() => {});
    await page.waitForTimeout(400);
    const again = await page.$('[data-testid="agent-tidy"]');
    if (again && !(await again.isDisabled())) {
      await again.click();
      await page.waitForTimeout(700);
      const before = await page.evaluate(() => document.querySelectorAll('[data-testid="seat-mark"]').length);
      const undo = await page.$('[data-testid="undo-turn"], button[aria-label^="Undo"], button:has-text("Undo")');
      if (undo) {
        await undo.click();
        await page.waitForTimeout(700);
        const after = await page.evaluate(() => ({
          marks: document.querySelectorAll('[data-testid="seat-mark"]').length,
          log: document.querySelectorAll('[data-testid="companion-log"] li').length,
        }));
        cleared = { before, ...after, ok: before > 0 && after.marks === 0 && after.log === 0 };
      }
    }
  }
  report.checks.undoClearsTheMarks = cleared;

  /* -------------------- the key opens under the conversation, not through it */
  /*
   * The rail is a column of sections, and the conversation used to be a
   * fixed box shorter than what was in it: with the key expanded, the
   * chips and the field were painted straight over the relations. A
   * section that overlaps the one below it is a panel nobody can use.
   */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1#overview=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1400);
  await page.click('[data-testid="companion-key"] summary').catch(() => {});
  await page.waitForTimeout(500);
  /* And with something in hand, so the acts and the relations are in the column too. */
  await page.click('[data-graview-pick]').catch(() => {});
  await page.waitForTimeout(600);
  report.checks.theSectionsDoNotOverlap = await page.evaluate(() => {
    const rail = document.querySelector('[data-testid="companion"]');
    const sections = [...(rail?.querySelectorAll(':scope > div > *') ?? [])].filter((el) => el.getBoundingClientRect().height > 0);
    const boxes = sections.map((el) => el.getBoundingClientRect());
    const over = [];
    for (let at = 1; at < boxes.length; at++) {
      if (boxes[at].top < boxes[at - 1].bottom - 2) over.push(`${sections[at - 1].tagName} over ${sections[at].tagName}`);
    }
    /* And nothing paints outside the box it was given, which is the shape the overlap took. */
    const spills = sections.filter((el) => el.scrollHeight > el.clientHeight + 2).map((el) => el.getAttribute("data-testid") ?? el.tagName);
    return { sections: sections.length, over, spills, ok: sections.length > 1 && over.length === 0 && spills.length === 0 };
  });

  /* --------------------------------- quiet: nothing animating on a still city */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1#overview=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(3000);
  const quiet = await page.evaluate(() => ({
    animations: document.getAnimations().filter((a) => a.playState === "running").length,
    figures: document.querySelectorAll('[data-graview-figure^="agent:"]').length,
  }));
  report.checks.quietCityRunsNothing = { ...quiet, ok: quiet.animations === 0 && quiet.figures === 0 };

  /* ------------------------------------ a refused proposal is said in the rail */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1&as=user-sam", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  const ask = await page.$('[aria-label="Message the seat"]');
  let refusal = { ok: false, why: "no message field in the rail" };
  if (ask) {
    await ask.fill("give a role keeper to Sam");
    await ask.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-panel"] ol li').length >= 2, undefined, { timeout: 15_000 });
    await page.waitForTimeout(600);
    const said = await page.evaluate(() => ({
      thread: [...document.querySelectorAll('[data-testid="chat-panel"] ol li')].map((li) => li.textContent ?? "").join(" | ").slice(0, 200),
      state: document.querySelector('[data-testid="companion-state"]')?.textContent?.trim() ?? null,
    }));
    refusal = { ...said, ok: /not permitted|may not|refus|cannot/i.test(said.thread) };
  }
  report.checks.aRefusalIsSaidAtTheGate = refusal;

  /* ---------------------------------------------- the keyboard reaches the dock */
  await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1200);
  let reached = false;
  for (let press = 0; press < 30 && !reached; press++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "companion-dock");
  }
  const shut = reached
    ? await (async () => {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(400);
        return page.evaluate(() => document.querySelector('[data-testid="companion"]')?.getAttribute("data-graview-companion"));
      })()
    : null;
  report.checks.keyboardReachesIt = { reached, shut, ok: reached && shut === "shut" };

  await page.close();
  report.passed = Object.values(report.checks).every((check) => check.ok) && report.pageErrors.length === 0;
} catch (error) {
  report.error = String(error).slice(0, 2000);
  report.passed = false;
} finally {
  await browser?.close();
  vite?.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/companion.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/companion.json\n`);
process.exit(report.passed ? 0 : 1);
