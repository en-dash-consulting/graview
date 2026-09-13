#!/usr/bin/env node
/**
 * Getting somewhere, and getting back.
 *
 * Travelling is a double click, and the screen you land on is the one nobody
 * designs: you arrived by accident as often as on purpose, and the first thing
 * you want is out. Every stop here is a URL, so back and forward are the
 * browser's — but an interface whose navigation is the browser's should not
 * require the person using it to know that, which is what the ← → controls are
 * for.
 *
 * This walks it in a real browser, because history is not something static
 * rendering has an opinion about.
 *
 *   node scripts/verify-navigation.mjs [--headed]
 *
 * Writes docs/navigation.json.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

function startVite(name, port) {
  const child = spawn("npx", ["vite"], {
    cwd: resolve(repoRoot, `apps/${name}`),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("vite did not start")), 40_000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes(String(port))) {
        clearTimeout(timer);
        ready(child);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`vite exited with ${code}`));
    });
  });
}

const report = { at: new Date().toISOString(), engine: ENGINE, steps: [] };
let browser;
let vite;

const enabled = (page, label) =>
  page.evaluate(
    (name) =>
      !document.querySelector(`[data-testid="backtrack"] button[aria-label="${name}"]`)?.disabled,
    label,
  );
const where = (page) => page.evaluate(() => window.location.hash);
const note = async (page, step) =>
  report.steps.push({
    step,
    url: await where(page),
    back: await enabled(page, "Back"),
    forward: await enabled(page, "Forward"),
    trail: await page.evaluate(
      () => document.querySelector('nav[aria-label="View"]')?.textContent?.trim() ?? null,
    ),
  });

try {
  vite = await startVite("todo", 5193);
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  /*
   * A page that throws is not navigating, whatever the addresses say. The
   * blank screen this file now drives into was an unhandled React error
   * with a perfectly ordinary-looking hash behind it.
   */
  report.pageErrors = [];
  page.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await page.goto("http://localhost:5193/?today=2026-09-01", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(900);
  await note(page, "landed");

  // Travel: the double click, and the screen it lands on.
  await page.dblclick('[data-graview-pick="t-deposit"]');
  await page.waitForTimeout(800);
  await note(page, "travelled");

  /*
   * Travel again, deeper — through a PICK TARGET rather than a card.
   *
   * Double-clicking a card with no pick target inside it zooms it in close,
   * which is a different move with a different meaning ("give this the
   * room") — and an ordinary stop like any other. Travelling is following a
   * thing the view nominated, and that is what a chain of stops is made of.
   */
  const onward = await page.evaluate(
    () =>
      [...document.querySelectorAll("[data-graview-pick]")]
        .map((el) => el.getAttribute("data-graview-pick"))
        .find((id) => id?.startsWith("reason")) ?? null,
  );
  if (onward) {
    await page.dblclick(`[data-graview-pick="${onward}"]`);
    await page.waitForTimeout(800);
    await note(page, "travelled again");
  }
  report.wentDeeper = onward !== null;

  // And back, twice, through the control rather than the keyboard.
  await page.click('[data-testid="backtrack"] button[aria-label="Back"]');
  await page.waitForTimeout(600);
  await note(page, "back once");
  await page.click('[data-testid="backtrack"] button[aria-label="Back"]');
  await page.waitForTimeout(600);
  await note(page, "back twice");

  // Forward is only offered when there is somewhere to go.
  await page.click('[data-testid="backtrack"] button[aria-label="Forward"]');
  await page.waitForTimeout(600);
  await note(page, "forward once");

  // And the breadcrumb gets you home in one.
  await page.click('[data-testid="focused"]');
  await page.waitForTimeout(600);
  await note(page, "home by breadcrumb");

  /*
   * A VIEW THAT DRAWS BOTH ENDS HAS DRAWN THE RELATION. With the lists in
   * focus and every task raised, each task is drawn inside its list; a line
   * from the list column to the same task's chip says nothing the column
   * does not. Twelve of them over the panel were the picture Nick sent.
   */
  await page.goto("http://localhost:5193/?today=2026-09-01#focus=aggregate%3Alist&relation=task", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1200);
  report.restated = await page.evaluate(() => ({
    holds: document.querySelectorAll('[data-graview-connector="holds"]').length,
    chips: document.querySelectorAll('[data-graview-plane="1"]').length,
    inside: document.querySelectorAll('[data-graview-view="aggregate:list"] [data-graview-pick^="t-"]').length,
  }));
  await note(page, "lists with every task raised");

  // The other way round: the week in focus, the lists raised as cards. A card
  // summarising its members as chips has not drawn the relation between the
  // week's entries and itself; every entry keeps its line to its list.
  await page.goto("http://localhost:5193/?today=2026-09-01#focus=aggregate%3Atask&relation=list", { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1200);
  report.restated = {
    ...report.restated,
    entries: await page.evaluate(() => document.querySelectorAll('[data-graview-view="aggregate:task"] [data-graview-pick^="t-"]').length),
    weekLines: await page.evaluate(() => document.querySelectorAll('[data-graview-connector="holds"]').length),
  };
  await note(page, "the week with the lists raised");

  /*
   * The altitude control is a TOGGLE, and says which way it goes.
   *
   * "Graview" from the ground, "Focus" from altitude, aria state agreeing
   * with the word — and the mark morphs between its two states on the
   * scene's own curve rather than being swapped. Sampled mid-transition on
   * the way back down: a mark caught between its states is morphing; one
   * already at its end is cutting. Which of those is RIGHT depends on the
   * engine: where the property registers, the scene morphs and so must the
   * mark; where it cannot, the scene cuts and the mark must cut with it.
   */
  const control = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="overview"]');
      if (!el) return null;
      const wing = el.querySelector(".graview-altitude-mark-wing");
      return {
        label: el.textContent.trim(),
        pressed: el.getAttribute("aria-pressed"),
        name: el.getAttribute("aria-label"),
        wingOpacity: wing ? Number(getComputedStyle(wing).opacity) : null,
        registered: typeof globalThis.CSSPropertyRule !== "undefined",
      };
    });
  report.control = { ground: await control() };
  await page.click('[data-testid="overview"]');
  await page.waitForTimeout(900);
  report.control.altitude = await control();
  await page.click('[data-testid="overview"]');
  await page.waitForTimeout(300);
  report.control.midway = await control();
  await page.waitForTimeout(700);
  report.control.groundAgain = await control();

  /*
   * WHAT YOU CAN PRESS IS WHAT YOU CAN SEE.
   *
   * A record read from altitude is drawn scaled inside a host the size of
   * the layout's slot, and its content fills only part of that. The rest is
   * invisible — and it must not be a target, or a district it happens to
   * sit over stops answering. Hit-tested directly: a point inside the host
   * but below the drawn content must resolve to something else; a point on
   * the content must resolve to the record.
   */
  await page.click('[data-testid="overview"]');
  await page.waitForTimeout(900);
  const kindOfDeposit = await page.evaluate(() => {
    const chip = document.querySelector('[data-graview-pick="t-deposit"]');
    return chip?.closest("[data-graview-view]")?.dataset.graviewView ?? null;
  });
  if (!kindOfDeposit) {
    // The district is shut: open the one the deposit lives in.
    const opened = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("[data-testid^='open-']")];
      for (const button of buttons) button.click();
      return buttons.length;
    });
    report.hitArea = { openedDistricts: opened };
    await page.waitForTimeout(700);
  }
  await page.dblclick('[data-graview-pick="t-deposit"]');
  await page.waitForTimeout(800);
  report.hitArea = {
    ...(report.hitArea ?? {}),
    ...(await page.evaluate(() => {
      const host = document.querySelector('[data-graview-view="t-deposit"]');
      if (!host) return { host: null };
      const box = host.getBoundingClientRect();
      const content = host.querySelector("[data-graview-natural] > *") ?? host.firstElementChild;
      const drawn = content.getBoundingClientRect();
      const viewAt = (x, y) => document.elementFromPoint(x, y)?.closest("[data-graview-view]")?.dataset.graviewView ?? null;
      return {
        host: [box.width, box.height].map(Math.round),
        drawn: [drawn.width, drawn.height].map(Math.round),
        onContent: viewAt(drawn.left + drawn.width / 2, drawn.top + drawn.height / 2),
        belowContent: drawn.bottom + 24 < box.bottom ? viewAt(drawn.left + drawn.width / 2, drawn.bottom + 24) : "no remainder",
      };
    })),
  };

  /*
   * A MOVE BELONGS TO THE STOP IT WAS MADE AT.
   *
   * Drag the focus a little, then travel: the next stop starts where the
   * layout puts things — no pin in its address, no pinned host on the
   * scene — and Back returns to the arranged picture, pin and all.
   */
  await page.click('[data-testid="overview"]');
  await page.waitForTimeout(900);
  {
    const card = await page.$('[data-graview-plane="0"] [data-graview-natural] > *, [data-graview-plane="0"] > :not(.graview-kind-tag)');
    const box = await card.boundingBox();
    const fromX = box.x + box.width - 14;
    const fromY = box.y + box.height - 14;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(fromX + i * 8, fromY - i * 4);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  const pinnedNow = () =>
    page.evaluate(() => ({
      url: location.hash,
      pinned: [...document.querySelectorAll("[data-graview-pinned]")].map((el) => el.dataset.graviewView),
    }));
  report.moves = { arranged: await pinnedNow() };
  const next = await page.evaluate(() => {
    const focus = document.querySelector('[data-graview-plane="0"]')?.dataset.graviewView;
    return [...document.querySelectorAll("[data-graview-pick]")].map((el) => el.dataset.graviewPick).find((id) => id && id !== focus) ?? null;
  });
  if (next) {
    await page.dblclick(`[data-graview-pick="${next}"]`);
    await page.waitForTimeout(900);
    report.moves.travelled = await pinnedNow();
    await page.click('[data-testid="backtrack"] button[aria-label="Back"]');
    await page.waitForTimeout(900);
    report.moves.back = await pinnedNow();
  }

  /*
   * GOING DEEPER INTO A DISTRICT THAT HAS A PICTURE OF ITS OWN.
   *
   * A district explodes into a ring of chips because a bag of names is the
   * best a generic card can do with its members. A kind with a lens over it
   * has something better, and the card draws a ◆ to say so — and going
   * deeper burst it into chips anyway. Both branches, from the same gesture:
   * "task" has the week lens over it, "reason" has nothing but the default.
   */
  // Rise — the control is a TOGGLE, so ask where it is rather than pressing it.
  const rise = async () => {
    const up = await page.evaluate(
      () => document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true",
    );
    if (!up) {
      await page.click('[data-testid="overview"]');
      await page.waitForTimeout(900);
    }
  };
  await rise();
  const deeper = async (kind) => {
    await rise();
    await page.evaluate(() => {
      for (const button of document.querySelectorAll("[data-testid^='open-']")) {
        if (button.getAttribute("aria-expanded") === "true") button.click();
      }
    });
    await page.waitForTimeout(400);
    const card = await page.$(`[data-graview-view="kind:${kind}"]`);
    const box = await card.boundingBox();
    // The card's own top edge: never a chip, never the open control.
    await page.mouse.dblclick(box.x + 14, box.y + 6);
    await page.waitForTimeout(900);
    const at = await page.evaluate(() => location.hash);
    await page.click('[data-testid="backtrack"] button[aria-label="Back"]');
    await page.waitForTimeout(700);
    return at;
  };
  report.districts = {
    withAPicture: await deeper("task"),
    withoutOne: await deeper("reason"),
  };

  /*
   * THE ACT THAT REMOVES WHAT YOU ARE STANDING IN.
   *
   * Every stop here is an id in the address, and ordinary acts remove
   * things. Travelled into a task and dropped it, the focus was an id
   * nothing resolved: the layout placed nothing, the view host measured its
   * own kind tag instead of the panel that was no longer there, and moved
   * it nine pixels up and fourteen right on every render until React gave
   * up with "Maximum update depth exceeded" and blanked the page. Selecting
   * a record and dropping it left its pane open, titled with the raw node
   * id and saying "nothing can be done with this mix of kinds".
   */
  const dropTheFocus = async () => {
    await page.evaluate(() => {
      const up = document.querySelector('[data-testid="overview"]');
      if (up?.getAttribute("aria-pressed") === "true") up.click();
    });
    await page.waitForTimeout(900);
    // Whichever task the scene is showing: the point is the act, not the row.
    const victim = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-graview-pick]")]
          .map((el) => el.dataset.graviewPick)
          .find((id) => id?.startsWith("t-")) ?? null,
    );
    if (!victim) return { standingIn: null, landedOn: null, views: 0, pane: "no task on screen" };
    await page.dblclick(`[data-graview-pick="${victim}"]`);
    await page.waitForTimeout(900);
    const standingIn = await page.evaluate(() => location.hash);
    // The destructive act by its own row — the searcher appears only past
    // the fold, and Enter deliberately never runs a destructive act.
    await page
      .locator('[data-testid="inspector-strip"] li:has([data-pin-for="drop"]) button[data-affordance]')
      .first()
      .click();
    await page.waitForTimeout(1000);
    return {
      standingIn,
      landedOn: await page.evaluate(() => location.hash),
      // A live picture, not a blank page.
      views: await page.evaluate(() => document.querySelectorAll("[data-graview-view]").length),
      pane: await page.evaluate(
        () => document.querySelector('[data-testid="inspector-strip"]')?.innerText ?? null,
      ),
    };
  };
  const removed = await dropTheFocus();
  report.removed = {
    ...removed,
    ok:
      removed.standingIn !== null &&
      removed.standingIn.includes("focus=t-") &&
      !removed.landedOn.includes(removed.standingIn.replace(/^#focus=/, "").split("&")[0]) &&
      removed.views > 0 &&
      removed.pane === null,
  };

} catch (error) {
  report.error = String(error).slice(0, 1800);
} finally {
  await browser?.close();
  if (vite) {
    try {
      process.kill(-vite.pid, "SIGKILL");
    } catch {
      vite.kill("SIGKILL");
    }
  }
}

const step = (name) => report.steps.find((entry) => entry.step === name);
const near = (value, target) => typeof value === "number" && Math.abs(value - target) < 0.03;
const between = (value, low, high) => typeof value === "number" && value > low && value < high;
/*
 * The stop without its selection. A stop's address carries what was selected
 * at it — deliberately, so returning restores the pane — and the click that
 * precedes a double-click's travel updates the departing stop's selection.
 * Claims about GOING BACK are claims about places.
 */
const placeOf = (hash) => {
  const params = new URLSearchParams((hash ?? "").replace(/^#/, ""));
  params.delete("sel");
  return params.toString();
};
report.verdict = {
  // Nowhere to go back to on arrival, and the control says so rather than
  // being offered and doing nothing.
  nothingToGoBackToAtFirst: step("landed")?.back === false,
  travellingChangesTheAddress: step("travelled")?.url !== step("landed")?.url,
  backBecomesAvailable: step("travelled")?.back === true,
  // Nothing ahead until you have actually gone back.
  nothingAheadUntilYouGoBack: step("travelled")?.forward === false,
  backActuallyGoesBack: placeOf(step("back once")?.url) === placeOf(step("travelled")?.url),
  // The pane you had open at that stop comes back with it.
  backRestoresTheSelection: (step("back once")?.url ?? "").includes("sel="),
  wentDeeperThanOnce: report.wentDeeper === true,
  eachTravelIsItsOwnStop: step("travelled again")?.url !== step("travelled")?.url,
  // Two stops back from two stops in is where you started.
  backAgainReachesTheStart: placeOf(step("back twice")?.url) === placeOf(step("landed")?.url),
  forwardIsOfferedOnceThereIsSomewhere: step("back twice")?.forward === true,
  // The lists draw their tasks, the band draws them again, and no line restates it.
  aViewThatDrawsBothEndsDrawsTheRelation: (report.restated?.inside ?? 0) >= 12 && (report.restated?.chips ?? 0) >= 12 && report.restated?.holds === 0,
  // Nine entries on the week, nine lines to the lists that hold them.
  aCardsChipsDoNotSilenceItsLines: (report.restated?.entries ?? 0) >= 9 && (report.restated?.weekLines ?? 0) >= (report.restated?.entries ?? 0),
  // Forward is ONE step, not all the way back to where you had got to.
  forwardActuallyGoesForward: placeOf(step("forward once")?.url) === placeOf(step("travelled")?.url),
  // And the breadcrumb still names where you are, and gets you out in one.
  theTrailNamesWhereYouAre: (step("travelled")?.trail ?? "").includes("deposit"),
  theTrailGetsYouHome: placeOf(step("home by breadcrumb")?.url) === placeOf(step("landed")?.url),
  // The altitude control: a toggle that names where it takes you.
  theControlSaysGraviewOnTheGround:
    report.control?.ground?.label === "Graview" &&
    report.control?.ground?.name === "Graview" &&
    report.control?.ground?.pressed === "false",
  theControlSaysFocusFromAltitude:
    report.control?.altitude?.label === "Focus" &&
    report.control?.altitude?.name === "Focus" &&
    report.control?.altitude?.pressed === "true",
  theMarkHasTwoStates:
    near(report.control?.ground?.wingOpacity, 0.75) && near(report.control?.altitude?.wingOpacity, 0),
  // Morphing where the scene morphs; cutting where it cuts.
  theMarkMovesAsTheSceneDoes: report.control?.midway?.registered
    ? between(report.control?.midway?.wingOpacity, 0.04, 0.71)
    : near(report.control?.midway?.wingOpacity, 0.75),
  theControlComesBackDown:
    report.control?.groundAgain?.label === "Graview" &&
    near(report.control?.groundAgain?.wingOpacity, 0.75),
  // An invisible box is not a target: the record answers on its content and nowhere else.
  // A move belongs to the stop it was made at: the next stop is the layout's, and Back has the arrangement.
  aNewStopStartsWhereTheLayoutPutsThings:
    (report.moves?.arranged?.pinned?.length ?? 0) > 0 &&
    report.moves?.arranged?.url.includes("pin.") &&
    report.moves?.travelled?.pinned?.length === 0 &&
    !report.moves?.travelled?.url.includes("pin.") &&
    (report.moves?.back?.pinned?.length ?? 0) > 0,
  // A kind with a lens goes INTO the lens; a kind without one opens in place.
  aDistrictWithAPictureGoesIntoIt:
    (report.districts?.withAPicture ?? "").includes("focus=aggregate%3Atask") &&
    (report.districts?.withAPicture ?? "").includes("zoom=1") &&
    !(report.districts?.withAPicture ?? "").includes("expand="),
  aDistrictWithoutOneOpensInPlace:
    (report.districts?.withoutOne ?? "").includes("expand=kind%3Areason") &&
    !(report.districts?.withoutOne ?? "").includes("focus=aggregate"),
  // The act that removes what you are standing in leaves you somewhere real.
  theStopSurvivesWhatItNames: report.removed?.ok === true,
  whatYouCanPressIsWhatYouCanSee:
    report.hitArea?.onContent === "t-deposit" &&
    report.hitArea?.belowContent !== "t-deposit" &&
    report.hitArea?.belowContent !== "no remainder",
};
report.passed =
  Object.values(report.verdict).every(Boolean) &&
  !report.error &&
  (report.pageErrors?.length ?? 0) === 0;

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/navigation.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n\nwrote docs/navigation.json\n`);
process.exit(report.passed ? 0 : 1);
