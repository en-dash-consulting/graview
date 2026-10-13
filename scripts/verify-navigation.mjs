#!/usr/bin/env node
/**
 * Getting somewhere, and getting back.
 *
 * Traveling is a double click, and the screen you land on is the one nobody
 * designs: you arrived by accident as often as on purpose, and the first thing
 * you want is out. Every stop here is a URL, so back and forward are the
 * browser's. The bar drew them again as ← and → for a while; it is the one
 * app bar now, on the scene as in an embed, and the browser's own back and
 * forward are the way — so this walks them, and holds that the stops they
 * walk are the ones a person made, and that the bar draws no arrows of its
 * own beside the browser's.
 *
 * This walks it in a real browser, because history is not something static
 * rendering has an opinion about.
 *
 *   node scripts/verify-navigation.mjs [--headed]
 *
 * Writes docs/navigation.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
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
function startVite(name, port) {
  return serving(name, port, repoRoot);
}

const report = { at: new Date().toISOString(), engine: ENGINE, steps: [] };
let browser;
let vite;

const where = (page) => page.evaluate(() => window.location.hash);
const note = async (page, step) =>
  report.steps.push({
    step,
    url: await where(page),
    arrows: await page.evaluate(() => document.querySelector('[data-testid="backtrack"]') !== null),
    trail: await page.evaluate(
      () => document.querySelector('nav[aria-label="View"]')?.textContent?.trim() ?? null,
    ),
    // Each relation's caption, as drawn over the band — once each (W-095).
    captions: await page.evaluate(() =>
      [...document.querySelectorAll("[data-graview-relation]")].map((el) => el.textContent.trim()),
    ),
  });

try {
  vite = await startVite("todo", portFor("todo"));
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  /*
   * A page that throws is not navigating, whatever the addresses say. The
   * blank screen this file now drives into was an unhandled React error
   * with a perfectly ordinary-looking hash behind it.
   */
  report.pageErrors = [];
  page.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await page.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(900);
  await note(page, "landed");

  // Travel: the double click, and the screen it lands on.
  await page.dblclick('[data-graview-pick="t-deposit"]');
  await page.waitForTimeout(800);
  await note(page, "traveled");

  /*
   * Travel again, deeper — through a PICK TARGET rather than a card.
   *
   * Double-clicking a card with no pick target inside it zooms it in close,
   * which is a different move with a different meaning ("give this the
   * room") — and an ordinary stop like any other. Traveling is following a
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
    await note(page, "traveled again");
  }
  report.wentDeeper = onward !== null;

  // And back, twice, by the browser's own back.
  await page.goBack();
  await page.waitForTimeout(600);
  await note(page, "back once");
  await page.goBack();
  await page.waitForTimeout(600);
  await note(page, "back twice");

  // And forward one.
  await page.goForward();
  await page.waitForTimeout(600);
  await note(page, "forward once");

  // And Escape gets you home: the focused record's own card names it, so no crumb repeats it over the picture.
  await page.locator("main").focus().catch(() => {});
  // Escape backs out a step at a time — the selection first, then the focus — so it is pressed until it has left the record, at most three times.
  for (let press = 0; press < 3 && (await where(page)).includes("focus=t-deposit"); press++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  }
  await note(page, "home by escape");

  /*
   * A VIEW THAT DRAWS BOTH ENDS HAS DRAWN THE RELATION. With the lists in
   * focus and every task raised, each task is drawn inside its list; a line
   * from the list column to the same task's chip says nothing the column
   * does not. Twelve of them over the panel were the picture Nick sent.
   */
  await page.goto(`${at("todo")}/?today=2026-09-01#focus=aggregate%3Alist&relation=task`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1200);
  report.restated = await page.evaluate(() => ({
    holds: document.querySelectorAll('[data-graview-connector="holds"]').length,
    chips: document.querySelectorAll('[data-graview-plane="1"]').length,
    inside: document.querySelectorAll('[data-graview-view="aggregate:list"] [data-graview-pick^="t-"]').length,
  }));
  await note(page, "lists with every task raised");

  // The other way round: the week in focus, the lists raised as cards. A card
  // summarizing its members as chips has not drawn the relation between the
  // week's entries and itself; every entry keeps its line to its list.
  await page.goto(`${at("todo")}/?today=2026-09-01#focus=aggregate%3Atask&relation=list`, { waitUntil: "load" });
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
  /*
   * Reached by its address: a district's records are listed beside the map
   * now (the panel), not opened in place as chips to double-click.
   */
  await page.evaluate(() => {
    window.location.hash = "#overview=1&focus=t-deposit";
  });
  await page.waitForTimeout(1200);
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
    report.moves.traveled = await pinnedNow();
    await page.goBack();
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
    // The district's own ground, in the middle of its plot: never its name, never the open control.
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(900);
    // Where it went, and what stands beside the map for it: a lens, or the kind's own stop.
    const at = await page.evaluate(() => `${location.hash}|stop=${document.querySelector('[data-graview-map-panel] [data-testid="kind-stop"]')?.getAttribute("data-graview-kind-stop") ?? ""}`);
    await page.goBack();
    await page.waitForTimeout(700);
    return at;
  };
  report.districts = {
    withAPicture: await deeper("task"),
    withoutOne: await deeper("reason"),
  };
  // And it is listed in the panel beside the map, every record in it, at a size a person reads.
  const listing = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  listing.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await listing.goto(`${at("todo")}/?today=2026-09-01#overview=1&sel=kind%3Areason`, { waitUntil: "load" });
  await listing.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await listing.waitForSelector('[data-testid="district-panel"]', { timeout: 10_000 }).catch(() => {});
  report.districts.listed = await listing.evaluate(() => {
    const panel = document.querySelector('[data-testid="district-panel"]');
    const rows = [...(panel?.querySelectorAll("[data-graview-record]") ?? [])];
    return {
      panel: panel?.getAttribute("data-graview-map-panel") ?? null,
      rows: rows.length,
      font: rows[0] ? parseFloat(getComputedStyle(rows[0]).fontSize) : null,
      // Nothing of the district floats over the map as a card of chips.
      floating: document.querySelectorAll(".graview-kind-members").length,
    };
  });
  await listing.close();
  /*
   * THE PROBLEM COUNT ON A DISTRICT'S NAME IS A CONTROL. "⚠ 3" on Tasks was
   * dead text: nothing on the map said what the warning was. It is a button
   * now, a fingertip tall, named "3 problems in Tasks"; pressed (or Enter on
   * the keyboard) it chooses the district and brings its problems up beside
   * the map, the bar's own rows, as many as it said — and Escape gives the
   * keyboard back to something, never to the page.
   */
  const problems = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  problems.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await problems.goto(`${at("todo")}/?today=2026-09-01#overview=1`, { waitUntil: "load" });
  await problems.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await problems.waitForSelector(".graview-district-problems", { timeout: 15_000 }).catch(() => {});
  const asButton = await problems.evaluate(() =>
    [...document.querySelectorAll(".graview-district-problems")].map((el) => {
      const box = el.getBoundingClientRect();
      return { tag: el.tagName, name: el.getAttribute("aria-label"), said: el.getAttribute("data-graview-problems"), title: el.getAttribute("title"), width: box.width, height: box.height };
    }),
  );
  const first = asButton[0];
  const kind = first ? await problems.evaluate(() => document.querySelector(".graview-district-problems")?.getAttribute("data-testid")?.replace("district-problems-", "") ?? "") : "";
  if (first) {
    await problems.focus(`[data-testid="district-problems-${kind}"]`);
    await problems.keyboard.press("Enter");
    await problems.waitForSelector('[data-testid="district-problem-rows"] li', { timeout: 10_000 }).catch(() => {});
  }
  const opened = await problems.evaluate(() => ({
    panel: document.querySelector('[data-testid="district-panel"]') !== null,
    rows: document.querySelectorAll('[data-testid="district-problem-rows"] li').length,
    said: document.querySelector('[data-testid="district-problems"]')?.getAttribute("data-graview-problems") ?? null,
    keyboard: document.activeElement?.getAttribute("data-testid") ?? null,
  }));
  await problems.keyboard.press("Escape");
  await problems.waitForTimeout(500);
  const closed = await problems.evaluate(() => ({ panel: document.querySelector('[data-testid="district-panel"]') !== null, onBody: document.activeElement === document.body || document.activeElement === null }));
  report.districtProblems = { asButton, opened, closed };
  await problems.close();
  /*
   * THE SAME TRUE THING ON THE GROUND. The flat district cards along the foot
   * of the ground painted the MEMBER count in the warning color with a ⚠ —
   * "⚠ 12" on a district with two problems. They say the members as a plain
   * count, with its own title, and the problems as the same button: the same
   * number, named, and pressing it rises to the map with the problems open.
   */
  const ground = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  ground.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await ground.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await ground.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await ground.waitForSelector('[data-graview-view^="kind:"] .graview-district-problems', { timeout: 15_000 }).catch(() => {});
  const onTheGround = await ground.evaluate(() => {
    const button = document.querySelector('[data-graview-view^="kind:"] .graview-district-problems');
    const card = button?.closest('[data-graview-view^="kind:"]');
    const members = [...(card?.querySelectorAll("span[title]") ?? [])].find((el) => /^\d[\d,]* /.test(el.getAttribute("title") ?? "") && !el.contains(button));
    return {
      up: document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true",
      name: button?.getAttribute("aria-label") ?? null,
      said: button?.getAttribute("data-graview-problems") ?? null,
      members: members?.textContent?.trim() ?? null,
      membersTitle: members?.getAttribute("title") ?? null,
      // The count itself never carries the mark.
      markOnTheMembers: members ? members.textContent.includes("⚠") : null,
      height: button?.getBoundingClientRect().height ?? 0,
      kind: button?.getAttribute("data-testid")?.replace("district-problems-", "") ?? null,
    };
  });
  if (onTheGround.kind) {
    await ground.focus(`[data-testid="district-problems-${onTheGround.kind}"]`);
    await ground.keyboard.press("Enter");
    await ground.waitForSelector('[data-testid="district-problem-rows"] li', { timeout: 10_000 }).catch(() => {});
  }
  onTheGround.risen = await ground.evaluate(() => ({
    up: document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true",
    rows: document.querySelectorAll('[data-testid="district-problem-rows"] li').length,
  }));
  report.districtProblems.onTheGround = onTheGround;
  await ground.close();
  /*
   * A DISTRICT'S NAME IS NOT MOVED BY HAND, from altitude. The city is laid
   * out by the data, and a name stands under its own plot; a name dragged
   * off its plot and pinned in the address is geometry that compensates for
   * the layout. A drag that starts on it is the ground's own gesture — it
   * pans the city, plot and name together — and writes no pin; an old pin in
   * a bookmark is ignored.
   */
  const unmoved = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  unmoved.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  const nameAgainstPlot = () =>
    unmoved.evaluate(() => {
      const face = document.querySelector('[data-graview-view="kind:task"] .graview-kind-face')?.getBoundingClientRect();
      const tile = document.querySelector('[data-graview-plot="kind:task"] .graview-plot-tile')?.getBoundingClientRect();
      return face && tile ? { dx: Math.round(face.x + face.width / 2 - (tile.x + tile.width / 2)), dy: Math.round(face.y - (tile.y + tile.height)), tileX: Math.round(tile.x), tileY: Math.round(tile.y), hash: location.hash, pinned: document.querySelectorAll("[data-graview-pinned]").length } : null;
    });
  await unmoved.goto(`${at("todo")}/?today=2026-09-01#overview=1`, { waitUntil: "load" });
  await unmoved.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await unmoved.waitForTimeout(1500);
  const resting = await nameAgainstPlot();
  const grab = await unmoved.evaluate(() => {
    const face = document.querySelector('[data-graview-view="kind:task"] .graview-kind-face');
    const box = face?.getBoundingClientRect();
    if (!face || !box) return null;
    // On the name itself, not on a control drawn in it.
    for (const fx of [0.5, 0.35, 0.65, 0.2]) {
      for (const fy of [0.3, 0.5, 0.7]) {
        const x = Math.round(box.x + box.width * fx);
        const y = Math.round(box.y + box.height * fy);
        const el = document.elementFromPoint(x, y);
        if (el && face.contains(el) && !el.closest("button, a, [role='button']")) return { x, y };
      }
    }
    return null;
  });
  let dragged = null;
  if (grab) {
    await unmoved.mouse.move(grab.x, grab.y);
    await unmoved.mouse.down();
    for (let i = 1; i <= 16; i++) {
      await unmoved.mouse.move(grab.x + i * 8, grab.y + i * 4);
      await unmoved.waitForTimeout(16);
    }
    await unmoved.mouse.up();
    await unmoved.waitForTimeout(600);
    dragged = await nameAgainstPlot();
  }
  // And a pin an old bookmark carries for a district is ignored.
  await unmoved.goto(`${at("todo")}/?today=2026-09-01#overview=1&pin.kind%3Atask=40,40`, { waitUntil: "load" });
  await unmoved.waitForTimeout(1800);
  const bookmarked = await nameAgainstPlot();
  report.districtName = { resting, dragged, bookmarked };
  await unmoved.close();
  /*
   * THE PANEL FLOATS OVER THE MAP; it is not a column beside it. Docked on a
   * desk (or a sheet on a phone) it is inset from the edges of the picture by
   * the app's gap, below the bar, with the app's radius on its corners and a
   * real elevation — and the city is laid out in the room left, so no
   * district, name or control stands under it.
   */
  report.mapPanel = {};
  for (const [width, height] of [[1560, 940], [390, 844]]) {
    const floating = await browser.newPage({ viewport: { width, height } });
    floating.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
    await floating.goto(`${at("todo")}/?today=2026-09-01#overview=1&focus=aggregate%3Atask&in.view=the-week`, { waitUntil: "load" });
    await floating.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
    await floating.waitForSelector('[data-graview-map-panel]', { timeout: 15_000 }).catch(() => {});
    await floating.waitForTimeout(1500);
    report.mapPanel[width] = await floating.evaluate(() => {
      const panel = document.querySelector("[data-graview-map-panel]");
      const box = panel?.getBoundingClientRect();
      if (!panel || !box) return null;
      const bar = document.querySelector('[data-testid="app-bar"]')?.getBoundingClientRect();
      const style = getComputedStyle(panel);
      const meets = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      const under = [];
      for (const el of document.querySelectorAll('[data-graview-view^="kind:"] .graview-kind-face, [data-graview-plot] .graview-plot-tile, [data-testid="overview"], [data-testid="lines-key"], .graview-zoom, [data-testid="seat-field"]')) {
        // On a phone a sheet stands over the ask field on purpose: the field is behind the sheet while it is open.
        if (panel.getAttribute("data-graview-map-panel") === "sheet" && el.getAttribute("data-testid") === "seat-field") continue;
        const r = el.getBoundingClientRect();
        // What is drawn outside the window is not under anything.
        if (r.width > 0 && r.height > 0 && meets(r, box)) under.push(el.getAttribute("data-testid") ?? el.getAttribute("class")?.split(" ")[0] ?? el.tagName);
      }
      return {
        kind: panel.getAttribute("data-graview-map-panel"),
        right: Math.round(innerWidth - box.right),
        bottom: Math.round(innerHeight - box.bottom),
        left: Math.round(box.left),
        belowTheBar: bar ? box.top >= bar.bottom : null,
        top: Math.round(box.top),
        radius: parseFloat(style.borderTopLeftRadius) || 0,
        shadow: style.boxShadow !== "none",
        edge: parseFloat(style.borderTopWidth) > 0,
        under,
      };
    });
    await floating.close();
  }

  /*
   * THE ACT THAT REMOVES WHAT YOU ARE STANDING IN.
   *
   * Every stop here is an id in the address, and ordinary acts remove
   * things. Traveled into a task and dropped it, the focus was an id
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
    // The destructive act by its own row, in the menu the acts key opens on the card.
    await page.evaluate((id) => document.querySelector(`[data-graview-view="${CSS.escape(id)}"]`)?.focus(), victim);
    await page.keyboard.press("a");
    await page.waitForSelector('[data-testid="context-menu"] [data-pin-for="drop"]', { timeout: 10_000 }).catch(() => {});
    await page
      .locator('[data-testid="context-menu"] li:has([data-pin-for="drop"]) button[data-affordance]')
      .first()
      .click();
    await page.waitForTimeout(1000);
    return {
      standingIn,
      landedOn: await page.evaluate(() => location.hash),
      // A live picture, not a blank page.
      views: await page.evaluate(() => document.querySelectorAll("[data-graview-view]").length),
      /*
       * What must not survive is the DEAD NODE — a menu still offering acts
       * on a thing that is gone, or the seat still about it.
       */
      pane: await page.evaluate(
        () => document.querySelector('[data-testid="context-menu"]')?.innerText ?? null,
      ),
      seat: await page.evaluate(() => document.querySelector('[data-testid="seat"]')?.innerText ?? null),
      victim,
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
      // Nothing left standing about the thing that is gone.
      !(removed.seat ?? "").includes(removed.victim ?? "\u0000") &&
      !(removed.pane ?? "").includes(removed.victim ?? "\u0000"),
  };

  /* --------------- the two doors the back button did not know about */
  /*
   * "Show the installation" and the studio are both STOPS: one raises the
   * installation's own districts into the scene, the other opens the app's
   * declaration over it. Neither pushed a history entry — the address
   * changed and the entry was REPLACED — so the arrows stayed gray and one
   * Back from either left the app entirely. Both live behind the profile
   * now, which is also where a harness has to go to find them.
   */
  const doorState = () =>
    page.evaluate(() => ({
      hash: decodeURIComponent(window.location.hash),
      studio: document.querySelector('[data-testid="studio"]') !== null,
      installation: document.querySelector('[data-graview-view="kind:user"]') !== null,
    }));
  const openProfile = async () => {
    const shown = await page.evaluate(() => {
      const pane = document.querySelector('[data-testid="profile"]');
      return pane !== null && !pane.hasAttribute("hidden");
    });
    if (shown) return;
    await page.click('[data-testid="profile-button"]');
    await page.waitForTimeout(350);
  };

  await page.goto(`${at("todo")}/?today=2026-09-01&fresh=1&as=user-nora`, { waitUntil: "load" });
  await page.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await page.waitForTimeout(900);

  await openProfile();
  await page.click('[data-testid="show-installation"]');
  await page.waitForTimeout(800);
  const shownInstallation = await doorState();
  await page.goBack();
  await page.waitForTimeout(800);
  const afterBack = await doorState();
  await page.goForward();
  await page.waitForTimeout(800);
  const afterForward = await doorState();
  report.installationIsAStop = {
    shown: shownInstallation,
    back: afterBack,
    forward: afterForward,
    ok: shownInstallation.installation && !afterBack.installation && afterBack.hash.includes("today") === false && afterForward.installation,
  };

  await openProfile();
  await page.click('[data-testid="studio-place"]');
  await page.waitForSelector('[data-testid="studio"]', { timeout: 20_000 });
  await page.waitForTimeout(900);
  const inStudio = await doorState();
  await page.goBack();
  await page.waitForTimeout(900);
  const outOfStudio = await doorState();
  await page.goForward();
  await page.waitForTimeout(900);
  const backInStudio = await doorState();
  report.theStudioIsAStop = {
    inStudio,
    outOfStudio,
    backInStudio,
    ok:
      inStudio.studio &&
      inStudio.hash.includes("in.studio=open") &&
      /* Back leaves the STUDIO, not the app: the scene is still there. */
      !outOfStudio.studio &&
      !outOfStudio.hash.includes("in.studio") &&
      backInStudio.studio,
  };

/*
 * A LENS IS A DRIVE-IN. From altitude a kind's named pictures are a
 * marquee on its district — real buttons. Pressing a showing opens the
 * picture BESIDE THE MAP at a size a person reads — a panel docked at the
 * side, never the lens drawn small on its plot — and the panel's Open goes
 * down to the picture's place in ONE gesture, tweening from the plot, which
 * the mid-tween capture asserts: at a hundred milliseconds in, the lens's
 * host is nearer the plot than the canvas center.
 */
try {
  const drive = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  drive.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await drive.goto(`${at("todo")}/?today=2026-09-01#overview=1`, { waitUntil: "load" });
  await drive.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await drive.waitForTimeout(1200);
  const marquee = await drive.evaluate(() =>
    [...document.querySelectorAll('[data-testid="drive-in-task"] .graview-drive-in-thumb-press')].map((el) => ({
      label: el.getAttribute("aria-label"),
      focusable: el.tabIndex >= 0 && !el.disabled,
    })),
  );
  const noteDriveIn = await drive.evaluate(() => document.querySelector('[data-testid="drive-in-reason"]') !== null);
  /*
   * Each place tile on the marquee says its place's whole name in words
   * (FR-118) and holds exactly one control, its press: the name is text a
   * person reads, never a second control or a lens drawn small. Counted
   * per tile, so a marquee with no tiles has nothing to pass on.
   */
  const tiles = await drive.evaluate(() =>
    [...document.querySelectorAll('[data-testid="drive-in-task"] .graview-drive-in-thumb')].map((tile) => ({
      name: tile.querySelector(".graview-drive-in-thumb-title")?.textContent?.trim() ?? "",
      label: tile.querySelector(".graview-drive-in-thumb-press")?.getAttribute("aria-label") ?? "",
      controls: [...tile.querySelectorAll("button, a, input, select, textarea, [tabindex]")].filter((el) => !el.closest("[inert]")).length,
      pictures: tile.querySelectorAll("svg, canvas, img, [data-graview-view]").length,
    })),
  );
  /* Switch showings at altitude: focus the tasks' month by the marquee, rise stays. */
  await drive.evaluate(() => {
    window.location.hash = "#overview=1&focus=aggregate%3Atask&in.view=the-week";
  });
  await drive.waitForTimeout(1200);
  /*
   * THE PICTURE OPENS BESIDE THE MAP, at a size a person reads: a panel
   * docked at the side, the lens in it at its own size — no billboard of
   * the lens drawn small on its plot, and no line drawn over it.
   */
  await drive.waitForSelector('[data-testid="lens-panel"]', { timeout: 10_000 }).catch(() => {});
  const standing = await drive.evaluate(() => {
    const panel = document.querySelector('[data-testid="lens-panel"]');
    const box = panel?.getBoundingClientRect() ?? null;
    const picks = [...(panel?.querySelectorAll("[data-graview-pick]") ?? [])];
    const first = picks[0] ?? null;
    const at = first ? first.getBoundingClientRect() : null;
    const over = at ? document.elementFromPoint(at.x + at.width / 2, at.y + at.height / 2) : null;
    return {
      panel: panel?.getAttribute("data-graview-map-panel") ?? null,
      title: panel?.querySelector('[data-testid="lens-panel-title"]')?.textContent ?? null,
      width: box ? Math.round(box.width) : 0,
      right: box ? Math.round(innerWidth - box.right) : null,
      font: first ? parseFloat(getComputedStyle(first).fontSize) : null,
      scaled: first ? Math.abs(first.getBoundingClientRect().width - first.offsetWidth) > 1 : null,
      onTop: over !== null && panel !== null && panel.contains(over),
      screens: document.querySelectorAll("[data-graview-screen]").length,
      url: location.hash,
    };
  });
  await drive.focus('[data-testid="showing-the-month"]');
  await drive.click('[data-testid="showing-the-month"]');
  await drive.waitForTimeout(600);
  const switched = await drive.evaluate(() => ({
    url: location.hash,
    up: document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true",
  }));
  /* Switch KINDS at altitude: the tasks' picture sinks into its village while the lists' rises out of its own.
     Captured mid-tween, because the fault was two pictures over each other for the length of it. */
  const panelTitle = () => drive.evaluate(() => document.querySelector('[data-testid="lens-panel-title"]')?.textContent ?? null);
  const before = await panelTitle();
  await drive.focus('[data-testid="showing-the-lists"]');
  await drive.click('[data-testid="showing-the-lists"]');
  await drive.waitForTimeout(1200);
  // One panel, now the lists': the tasks' picture gave way rather than standing beside it.
  const afterSwitch = { title: await panelTitle(), panels: await drive.evaluate(() => document.querySelectorAll('[data-testid="lens-panel"]').length) };
  // Back to the tasks' month for the descent below.
  await drive.focus('[data-testid="showing-the-month"]');
  await drive.click('[data-testid="showing-the-month"]');
  await drive.waitForTimeout(1200);
  /* Open: the panel's own control is the way to the place; capture mid-tween. */
  const centerX = 1560 / 2;
  const plot = await drive.evaluate(() => {
    const b = document.querySelector('[data-graview-plot="kind:task"]')?.getBoundingClientRect();
    return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
  });
  /*
   * WATCHED EVERY FRAME, not read once at a hundred and ten milliseconds.
   * On the nightly's runner (and under GRAVIEW_SLOW=4) the press took longer
   * than that to reach the first frame of the tween, so the one reading saw
   * the lens still on its plot and called a descent that then tweened all
   * the way a jump. Where the lens stood on each frame for a second after
   * the press is the question; the claim below asks whether any of those
   * frames had it between the plot and the middle.
   */
  const watching = drive.evaluate(
    () =>
      new Promise((done) => {
        const seen = [];
        const started = performance.now();
        const frame = () => {
          const b = document.querySelector('[data-graview-view="aggregate:task"]')?.getBoundingClientRect();
          if (b) seen.push({ t: Math.round(performance.now() - started), x: b.x + b.width / 2, y: b.y + b.height / 2, width: b.width });
          if (performance.now() - started < 1400) requestAnimationFrame(frame);
          else done(seen);
        };
        requestAnimationFrame(frame);
      }),
  );
  await drive.click('[data-testid="lens-panel-open"]');
  const frames = await watching;
  await drive.waitForTimeout(300);
  const landed = await drive.evaluate(() => ({
    url: location.hash,
    up: document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true",
  }));
  const plotX = plot ? plot.x : null;
  const between = (x) => plotX !== null && Math.min(plotX, centerX) + 20 < x && x < Math.max(plotX, centerX) - 20;
  // The first frame on its way, else the frame nearest halfway: what the report shows as midway.
  const midway = frames.find((one) => between(one.x)) ?? frames[Math.floor(frames.length / 2)] ?? null;
  report.driveIn = {
    marquee,
    tiles,
    leavingBefore: before,
    afterSwitch,
    noteDriveIn,
    standing,
    switched,
    midway,
    frames: frames.length,
    plot,
    landed,
    /*
     * Mid-tween the lens is on its way from the plot: between the plot's
     * column and the middle it lands in, at neither end. (It was "nearer the
     * plot than the middle", which held only while the district stood near
     * the middle; upstream districts now stand at the city's left, and a
     * tween eased out is past halfway at a hundred milliseconds.) Some frame
     * after the press, not the frame at a fixed time: a jump has none.
     */
    movedFromThePlot: frames.some((one) => between(one.x)),
  };
  await drive.close();
} catch (error) {
  report.driveIn = { error: String(error).slice(0, 2000) };
}

/*
 * ZOOM AND PAN BY HAND, from altitude. Ctrl+wheel (what a trackpad pinch
 * arrives as) zooms the city about the pointer; the plain wheel over the
 * ground pans; the corner controls zoom; and the ground can be dragged as
 * far as the camera reaches even after the camera flew to a village.
 */
try {
  const cam = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  cam.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await cam.goto(`${at("todo")}/?today=2026-09-01#overview=1&focus=aggregate%3Alist&in.view=the-lists`, { waitUntil: "load" });
  await cam.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await cam.waitForTimeout(1500);
  const ground = () =>
    cam.evaluate(() => {
      const el = document.querySelector(".graview-ground");
      const st = el.style;
      const pan = new URLSearchParams(location.hash.slice(1)).get("pan");
      return {
        cell: parseFloat(st.getPropertyValue("--graview-lattice-cell")),
        latticeX: parseFloat(st.getPropertyValue("--graview-lattice-x")),
        pan,
        level: document.querySelector('[data-testid="zoom-level"]')?.textContent ?? null,
        reach: (el.getAttribute("data-graview-reach") ?? "0 0").split(" ").map(Number),
      };
    });
  const start = await ground();
  // A pinch in: ctrl+wheel with a negative delta zooms in, about the pointer.
  const spot = { x: 700, y: 600 };
  await cam.mouse.move(spot.x, spot.y);
  await cam.mouse.wheel(0, -120).catch(() => {});
  await cam.keyboard.down("Control");
  for (let i = 0; i < 6; i++) await cam.mouse.wheel(0, -40);
  await cam.keyboard.up("Control");
  await cam.waitForTimeout(400);
  const zoomedIn = await ground();
  /*
   * The plain wheel over the ground pans. OVER THE GROUND: a fixed point
   * was (400, 300) until the lists' picture grew over it, and a wheel over
   * a scrolling list scrolls the list — rightly. So the point is found, not
   * assumed: the first on a coarse grid with no picture or card under it.
   */
  const open = await cam.evaluate(() => {
    for (let y = 160; y < innerHeight - 60; y += 40) {
      for (let x = 120; x < innerWidth - 120; x += 40) {
        const el = document.elementFromPoint(x, y);
        // On the ground — the element the wheel is heard on — and not on anything drawn over it.
        if (el?.closest(".graview-ground") && !el.closest("[data-graview-view], .graview-scroll, [data-graview-overlay], .graview-zoom, button, a, input")) return { x, y };
      }
    }
    return { x: 400, y: 300 };
  });
  await cam.mouse.move(open.x, open.y);
  await cam.mouse.wheel(60, 80);
  await cam.waitForTimeout(400);
  const wheeled = await ground();
  // The controls.
  await cam.click('[data-testid="zoom-out"]');
  await cam.waitForTimeout(400);
  const buttonOut = await ground();
  await cam.click('[data-testid="zoom-in"]');
  await cam.waitForTimeout(400);
  const buttonIn = await ground();
  // Dragging the ground as far as it goes: the whole offset reaches the limit, not the pan alone.
  const box = await cam.evaluate(() => { const b = document.querySelector(".graview-ground").getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const dragFrom = { x: box.x + box.w - 60, y: box.y + box.h / 2 };
  await cam.mouse.move(dragFrom.x, dragFrom.y);
  await cam.mouse.down();
  for (let i = 1; i <= 20; i++) await cam.mouse.move(dragFrom.x - i * 90, dragFrom.y, { steps: 2 });
  await cam.mouse.up();
  await cam.waitForTimeout(400);
  const dragged = await ground();
  /*
   * AND THE CITY BESIDE AN OPEN PICTURE PANS. A picture chosen from
   * altitude opens beside the map, which lays itself out in the room left;
   * the ground there still moves under the hand.
   */
  await cam.goto(`${at("todo")}/?today=2026-09-01#overview=1&focus=aggregate%3Alist&in.view=the-lists`, { waitUntil: "load" });
  /*
   * A LOAD, NOT A HASH CHANGE: the address differs from the last only after
   * the #, so without one the camera kept the drag above, already at the
   * limit of how far the picture goes that way — and a drag the same way
   * moved nothing. With the left rail gone that limit is where the drag
   * above leaves it.
   */
  await cam.reload({ waitUntil: "load" });
  await cam.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await cam.waitForTimeout(1500);
  const before = await ground();
  /* The picture stands beside the map; the city beside it still pans under the hand. */
  const city = await cam.$(".graview-ground");
  let onThePicture = { ok: false, why: "no city drawn" };
  if (city) {
    const at = await city.boundingBox();
    const from = await cam.evaluate(() => {
      for (let y = 200; y < innerHeight - 80; y += 30) {
        for (let x = 80; x < innerWidth - 80; x += 30) {
          const el = document.elementFromPoint(x, y);
          if (el?.closest(".graview-ground") && !el.closest("[data-graview-view], button, a, input, [data-graview-overlay]")) return { x, y };
        }
      }
      return null;
    }) ?? { x: at.x + at.width / 2, y: at.y + at.height / 2 };
    await cam.mouse.move(from.x, from.y);
    await cam.mouse.down();
    for (let i = 1; i <= 10; i++) await cam.mouse.move(from.x - i * 24, from.y, { steps: 2 });
    await cam.mouse.up();
    await cam.waitForTimeout(400);
    const after = await ground();
    onThePicture = {
      moved: Math.round((before.latticeX ?? 0) - (after.latticeX ?? 0)),
      ok: Math.abs((after.latticeX ?? 0) - (before.latticeX ?? 0)) > 100,
    };
  }
  /*
   * THE GROUND TRAVELS WITH THE CARDS. The lattice, the plots and the roads
   * were drawn from the live pan and the destination's cell while the cards
   * rode the tween — so choosing a picture snapped the whole ground to the
   * new place on one frame and the buildings walked over to join it.
   */
  await cam.goto(`${at("todo")}/?today=2026-09-01#overview=1`, { waitUntil: "load" });
  await cam.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await cam.waitForTimeout(1500);
  const travel = await cam.evaluate(async () => {
    const read = () => {
      const g = document.querySelector(".graview-ground");
      return {
        cell: Math.round(parseFloat(g.style.getPropertyValue("--graview-lattice-cell")) || 0),
        x: Math.round(parseFloat(g.style.getPropertyValue("--graview-lattice-x")) || 0),
        t: performance.now(),
      };
    };
    const seen = [];
    let frames = 0;
    const tick = () => {
      seen.push(read());
      if (++frames < 40) requestAnimationFrame(tick);
    };
    document.querySelector('[data-testid="showing-the-week"]')?.click();
    requestAnimationFrame(tick);
    await new Promise((done) => setTimeout(done, 900));
    const cells = [...new Set(seen.map((one) => one.cell))];
    /*
     * A LEAP IS MOST OF THE WAY IN ONE STEP, not more than twenty pixels in
     * one frame. Twenty per frame assumed sixty frames a second; a runner that
     * drew eight frames in the same 900 ms moved the ground in steps of thirty
     * and called each a jump. A cut puts the whole move in one step at any
     * frame rate; easing never puts more than a share of it in one.
     */
    const travel = Math.abs((seen[seen.length - 1]?.cell ?? 0) - (seen[0]?.cell ?? 0));
    /*
     * AND IN ONE ORDINARY FRAME. A cut lands in the frame after the press; a
     * runner that stalled for a third of a second drew most of an easing in
     * one late frame, which is a starved machine, not a cut — a step counts
     * as a leap only when it came within 50 ms of the one before.
     */
    const jumps = seen.filter((one, at) => at > 0 && Math.abs(one.cell - seen[at - 1].cell) > Math.max(20, travel * 0.6) && one.t - seen[at - 1].t < 50).length;
    /*
     * AND WHERE IT STANDS. A picture opens beside the map now, and the city
     * is laid out again in the room left: at the same cell when the room's
     * height is what held it, so what travels is where the ground stands.
     * The same rule for the lattice's origin as for its cell.
     */
    const xs = [...new Set(seen.map((one) => one.x))];
    const shift = Math.abs((seen[seen.length - 1]?.x ?? 0) - (seen[0]?.x ?? 0));
    const xJumps = seen.filter((one, at) => at > 0 && Math.abs(one.x - seen[at - 1].x) > Math.max(20, shift * 0.6) && one.t - seen[at - 1].t < 50).length;
    return { steps: cells.length, jumps, first: cells[0], last: cells[cells.length - 1], xSteps: xs.length, xJumps, xFirst: seen[0]?.x, xLast: seen[seen.length - 1]?.x };
  });
  report.checks = {
    ...(report.checks ?? {}),
    theCityPansBesideAnOpenPicture: onThePicture,
    // Many small steps and no leap: the ground eased from one cell to the other.
    theGroundTravelsWithTheCards: {
      ...travel,
      // Whatever moved — the cell, where the ground stands, or both — eased there in many small steps and no leap, and something moved.
      ok:
        travel.jumps === 0 &&
        travel.xJumps === 0 &&
        (travel.last !== travel.first || travel.xLast !== travel.xFirst) &&
        (travel.last === travel.first || travel.steps >= 5) &&
        (travel.xLast === travel.xFirst || travel.xSteps >= 5),
    },
  };
  report.camera = { start, zoomedIn, wheelAt: open, wheeled, buttonOut, buttonIn, dragged, onThePicture };
  await cam.close();
} catch (error) {
  report.camera = { error: String(error).slice(0, 2000) };
}

/*
 * A SEARCH IS A STOP, AND THE PICTURE IS THE RESULT LIST. `/` reaches the
 * Find box from the city; typing lights the districts the words found and
 * dims the rest, without piling up history; the strip names the hits as a
 * listbox; pressing a lit district's count lands inside it narrowed by the
 * same words; Back returns to the lit city; Escape clears the words. And
 * on a phone at a 32px root font the strip is a sheet, nothing scrolls
 * sideways, and nothing in the box is under 24px.
 */
try {
  const find = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  find.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await find.goto(`${at("todo")}/?today=2026-09-01#overview=1`, { waitUntil: "load" });
  await find.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await find.waitForTimeout(1200);
  const history = () => find.evaluate(() => window.history.length);
  const before = await history();
  await find.keyboard.press("/");
  const reached = await find.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  await find.keyboard.type("deposit", { delay: 40 });
  await find.waitForTimeout(700);
  const lit = await find.evaluate(() => {
    const cards = [...document.querySelectorAll(".graview-kind-card[data-graview-emphasis]")];
    const box = document.querySelector('[data-testid="find-box"]');
    return {
      url: location.hash,
      lit: cards.filter((el) => el.getAttribute("data-graview-emphasis") === "lit").map((el) => el.closest("[data-graview-view]")?.getAttribute("data-graview-view")),
      dimmed: cards.filter((el) => el.getAttribute("data-graview-emphasis") === "dimmed").length,
      hits: [...document.querySelectorAll('[data-testid="find-hit"]')].map((el) => el.getAttribute("data-about")),
      role: box?.getAttribute("role"),
      expanded: box?.getAttribute("aria-expanded"),
      controls: box?.getAttribute("aria-controls") === document.querySelector('[data-testid="find-strip"]')?.id,
      count: document.querySelector('[data-testid="find-count"]')?.textContent ?? "",
    };
  });
  const typedHistory = await history();
  await find.keyboard.press("ArrowDown");
  await find.waitForTimeout(250);
  const active = await find.evaluate(() => {
    const id = document.querySelector('[data-testid="find-box"]')?.getAttribute("aria-activedescendant");
    return id ? document.getElementById(id)?.getAttribute("aria-selected") : null;
  });
  // Out of the box, then the lit district's count: into it, narrowed.
  await find.evaluate(() => document.activeElement?.blur());
  await find.click('[data-testid="hits-task"]');
  await find.waitForTimeout(1200);
  const landed = await find.evaluate(() => ({
    url: location.hash,
    row: document.querySelector('[data-testid="arrange-query"]')?.value ?? null,
    tasks: [...new Set([...document.querySelectorAll("[data-graview-pick^='t-']")].map((el) => el.getAttribute("data-graview-pick")))],
  }));
  await find.goBack();
  await find.waitForTimeout(900);
  const back = await find.evaluate(() => ({
    url: location.hash,
    box: document.querySelector('[data-testid="find-box"]')?.value,
    lit: document.querySelectorAll('.graview-kind-card[data-graview-emphasis="lit"]').length,
  }));
  await find.evaluate(() => document.activeElement?.blur());
  await find.keyboard.press("Escape");
  await find.waitForTimeout(500);
  const cleared = await find.evaluate(() => ({
    url: location.hash,
    lit: document.querySelectorAll(".graview-kind-card[data-graview-emphasis]").length,
  }));
  await find.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  phone.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await phone.goto(`${at("todo")}/?today=2026-09-01`, { waitUntil: "load" });
  await phone.waitForFunction(() => "__todoReady" in window, undefined, { timeout: 120_000 });
  await phone.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await phone.waitForTimeout(1200);
  // A phone's bar keeps Find behind its magnifier, as an embed's does: pressed, the box opens over the row.
  await phone.click('[data-testid="app-find-open"]');
  await phone.focus('[data-testid="find-box"]');
  await phone.keyboard.type("move", { delay: 40 });
  await phone.waitForTimeout(700);
  const onAPhone = await phone.evaluate(() => {
    const strip = document.querySelector('[data-testid="find-strip"]').getBoundingClientRect();
    const box = document.querySelector('[data-testid="find-box"]').getBoundingClientRect();
    const small = [...document.querySelectorAll('[data-testid="find-box"], [data-testid="find-hit"]')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.height < 23.5 || r.width < 23.5)).length;
    return {
      scrollWidth: document.documentElement.scrollWidth,
      width: innerWidth,
      strip: { left: Math.round(strip.left), top: Math.round(strip.top), width: Math.round(strip.width) },
      boxBottom: Math.round(box.bottom),
      boxWidth: Math.round(box.width),
      small,
    };
  });
  await phone.close();

  report.search = {
    reached, lit, before, typedHistory, active, landed, back, cleared, onAPhone,
    ok:
      reached === "find-box" &&
      lit.url.includes("q=deposit") &&
      lit.lit.includes("kind:task") &&
      lit.dimmed > 0 &&
      typedHistory === before &&
      landed.url.includes("focus=aggregate%3Atask") &&
      landed.url.includes("in.q=deposit") &&
      back.url.includes("q=deposit") &&
      !back.url.includes("focus=aggregate%3Atask") &&
      back.lit > 0 &&
      !cleared.url.includes("q="),
  };
} catch (error) {
  report.search = { error: String(error).slice(0, 2000) };
}

} catch (error) {
  report.error = String(error).slice(0, 1800);
} finally {
  await browser?.close();
  if (vite) {
    vite.stop();
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
  /*
   * A RELATION IS CAPTIONED ONCE at every stop walked. A caption per run of
   * the id-sorted frame said "the songs they are featured on" twice over one
   * artist, and — keyed by edge kind alone — left an old stop's captions on
   * the next one (W-095).
   */
  everyRelationIsCaptionedOnce:
    report.steps.length > 0 &&
    report.steps.every((step) => new Set(step.captions ?? []).size === (step.captions ?? []).length),
  // A kind with named pictures has a drive-in whose showings are real, labeled, focusable buttons, each in a tile that says its name whole and holds no other control or picture; a kind with only defaults has none.
  aDriveInHasAMarquee:
    (report.driveIn?.marquee?.length ?? 0) >= 2 &&
    report.driveIn.marquee.every((button) => /^Tasks: /.test(button.label ?? "") && button.focusable) &&
    report.driveIn?.noteDriveIn === false &&
    (report.driveIn?.tiles?.length ?? 0) === report.driveIn.marquee.length &&
    report.driveIn.tiles.every((tile) => tile.name.length > 0 && tile.label === `Tasks: ${tile.name}` && tile.controls === 1 && tile.pictures === 0),
  // Ctrl+wheel from altitude zooms the city — the cell grows — and says so in the corner.
  theWheelZoomsTheCity:
    (report.camera?.zoomedIn?.cell ?? 0) > (report.camera?.start?.cell ?? 0) * 1.1 &&
    report.camera?.zoomedIn?.level !== report.camera?.start?.level,
  // The plain wheel over the ground pans: the lattice, pinned to the city, moves with it.
  theWheelPansTheGround:
    report.camera?.wheeled !== undefined &&
    Math.abs((report.camera?.wheeled?.latticeX ?? 0) - (report.camera?.zoomedIn?.latticeX ?? 0)) > 20,
  // The corner controls zoom out and in.
  theZoomControlsWork:
    (report.camera?.buttonOut?.cell ?? 0) < (report.camera?.wheeled?.cell ?? 0) &&
    (report.camera?.buttonIn?.cell ?? 0) > (report.camera?.buttonOut?.cell ?? 0),
  // With a picture open beside it, the city still pans under the hand.
  theCityPansBesideAnOpenPicture: report.camera?.onThePicture?.ok === true,
  // And flying closer is travel, not a cut: the ground eases with the cards on it.
  theGroundTravelsWithTheCards: report.checks?.theGroundTravelsWithTheCards?.ok === true,
  /*
   * Dragged as far as it goes, the ground reaches the camera's limit: the far side is reachable. (It was "more than
   * 400 px" while choosing a picture flew the camera half as close again; the picture opens beside the map now, the
   * city keeps its size in the room left, and how far is far is the limit the scene itself says.)
   */
  theGroundReachesItsFarEdge:
    (report.camera?.buttonIn?.latticeX ?? 0) - (report.camera?.dragged?.latticeX ?? 0) > 40 &&
    Math.abs(Number((report.camera?.dragged?.pan ?? "0").split(",")[0])) >= (report.camera?.dragged?.reach?.[0] ?? Infinity) - 2,
  // Switching kinds: the panel gives the tasks' picture up for the lists', one panel and never two.
  switchingKindsSwapsThePicture:
    report.driveIn?.leavingBefore !== null &&
    report.driveIn?.leavingBefore !== report.driveIn?.afterSwitch?.title &&
    report.driveIn?.afterSwitch?.title === "The lists" &&
    report.driveIn?.afterSwitch?.panels === 1,
  // A pressed showing opens beside the map: docked at the side, wide enough to read, its text at its own size, nothing drawn over it, and no billboard on the plot.
  aPictureOpensBesideTheMapAtASizeYouRead:
    report.driveIn?.standing?.panel === "dock" &&
    // Floating over the map, a gap in from the right edge, not flush to it (see theMapPanelFloatsOver...).
    (report.driveIn?.standing?.right ?? 0) >= 4 &&
    (report.driveIn?.standing?.width ?? 0) >= 440 &&
    (report.driveIn?.standing?.font ?? 0) >= 12 &&
    report.driveIn?.standing?.scaled === false &&
    report.driveIn?.standing?.onTop === true &&
    report.driveIn?.standing?.screens === 0,
  // Pressing a showing at altitude changes in.view and stays up; the panel's Open is the way to its place.
  switchingAShowingStaysUp:
    (report.driveIn?.switched?.url ?? "").includes("in.view=the-month") && report.driveIn?.switched?.up === true,
  openGoesToThePlaceInOneGesture:
    report.driveIn?.landed?.up === false && (report.driveIn?.landed?.url ?? "").includes("in.view=the-month"),
  theDescentTweensFromThePlot: report.driveIn?.movedFromThePlot === true,
  // The browser's back and forward are the way: the bar draws no arrows of its own beside them.
  theBarDrawsNoArrowsOfItsOwn: report.steps.length > 0 && report.steps.every((one) => one.arrows === false),
  travelingChangesTheAddress: step("traveled")?.url !== step("landed")?.url,
  backActuallyGoesBack: placeOf(step("back once")?.url) === placeOf(step("traveled")?.url),
  // The pane you had open at that stop comes back with it.
  backRestoresTheSelection: (step("back once")?.url ?? "").includes("sel="),
  wentDeeperThanOnce: report.wentDeeper === true,
  eachTravelIsItsOwnStop: step("traveled again")?.url !== step("traveled")?.url,
  // Two stops back from two stops in is where you started.
  backAgainReachesTheStart: placeOf(step("back twice")?.url) === placeOf(step("landed")?.url),
  // The lists draw their tasks, the band draws them again, and no line restates it.
  aViewThatDrawsBothEndsDrawsTheRelation: (report.restated?.inside ?? 0) >= 12 && (report.restated?.chips ?? 0) >= 12 && report.restated?.holds === 0,
  // Nine entries on the week, nine lines to the lists that hold them.
  aCardsChipsDoNotSilenceItsLines: (report.restated?.entries ?? 0) >= 9 && (report.restated?.weekLines ?? 0) >= (report.restated?.entries ?? 0),
  // Forward is ONE step, not all the way back to where you had got to.
  forwardActuallyGoesForward: placeOf(step("forward once")?.url) === placeOf(step("traveled")?.url),
  // Where you are is said once, by the record's own card, not again by a crumb over it; Escape gets you out.
  theFocusIsNotNamedAgainOverThePicture: report.steps.every((one) => !(one.trail ?? "").includes("deposit")),
  escapeGetsYouHome: placeOf(step("home by escape")?.url) === placeOf(step("landed")?.url),
  // The altitude control: a toggle that names where it takes you.
  theControlSaysUpOnTheGround:
    report.control?.ground?.label === "Up" &&
    report.control?.ground?.name === "Up" &&
    report.control?.ground?.pressed === "false",
  // From altitude the control says what pressing it does — "Close the map" — and, to the keyboard, where you land.
  theControlSaysCloseTheMapFromAltitude:
    report.control?.altitude?.label === "Close the map" &&
    /^Close the map, down to /.test(report.control?.altitude?.name ?? "") &&
    report.control?.altitude?.pressed === "true",
  theMarkHasTwoStates:
    near(report.control?.ground?.wingOpacity, 0.75) && near(report.control?.altitude?.wingOpacity, 0),
  // Morphing where the scene morphs; cutting where it cuts.
  theMarkMovesAsTheSceneDoes: report.control?.midway?.registered
    ? between(report.control?.midway?.wingOpacity, 0.04, 0.71)
    : near(report.control?.midway?.wingOpacity, 0.75),
  theControlComesBackDown:
    report.control?.groundAgain?.label === "Up" &&
    near(report.control?.groundAgain?.wingOpacity, 0.75),
  // An invisible box is not a target: the record answers on its content and nowhere else.
  // A move belongs to the stop it was made at: the next stop is the layout's, and Back has the arrangement.
  aNewStopStartsWhereTheLayoutPutsThings:
    (report.moves?.arranged?.pinned?.length ?? 0) > 0 &&
    report.moves?.arranged?.url.includes("pin.") &&
    report.moves?.traveled?.pinned?.length === 0 &&
    !report.moves?.traveled?.url.includes("pin.") &&
    (report.moves?.back?.pinned?.length ?? 0) > 0,
  // A kind with a lens goes INTO the lens; a kind without one opens in place.
  aDistrictWithAPictureGoesIntoIt:
    (report.districts?.withAPicture ?? "").includes("focus=aggregate%3Atask") &&
    (report.districts?.withAPicture ?? "").includes("zoom=1") &&
    !(report.districts?.withAPicture ?? "").includes("expand="),
  // A district's "⚠ N" is a control: a button, a fingertip tall, named for what it opens; pressed, it brings up as many problems as it said.
  aDistrictsProblemCountIsAControlThatRevealsItsProblems:
    (report.districtProblems?.asButton?.length ?? 0) > 0 &&
    report.districtProblems.asButton.every((one) => one.tag === "BUTTON" && one.height >= 24 && one.width >= 24 && /^\d+ problems? in /.test(one.name ?? "") && (one.title ?? "").includes(one.name ?? "~")) &&
    report.districtProblems.opened.panel === true &&
    report.districtProblems.opened.rows > 0 &&
    String(report.districtProblems.opened.rows) === report.districtProblems.asButton[0].said &&
    report.districtProblems.opened.said === report.districtProblems.asButton[0].said &&
    report.districtProblems.closed.panel === false &&
    report.districtProblems.closed.onBody === false &&
    // On the ground the card says its members plainly and the problems as the same control, which rises to the map with them open.
    report.districtProblems.onTheGround?.markOnTheMembers === false &&
    /^\d+ problems? in /.test(report.districtProblems.onTheGround.name ?? "") &&
    report.districtProblems.onTheGround.height >= 24 &&
    /^\d/.test(report.districtProblems.onTheGround.membersTitle ?? "") &&
    report.districtProblems.onTheGround.risen.up === true &&
    String(report.districtProblems.onTheGround.risen.rows) === report.districtProblems.onTheGround.said,
  // A district's name is not moved by hand from altitude: a drag that starts on it pans the city (plot and name together), writes no pin, and an old pin in a bookmark is ignored.
  aDistrictsNameDoesNotMoveWhenDragged:
    report.districtName?.resting !== null &&
    report.districtName?.dragged !== null &&
    // The name stands where it stood under its plot, and the city went with the hand.
    report.districtName.dragged.dx === report.districtName.resting.dx &&
    report.districtName.dragged.dy === report.districtName.resting.dy &&
    Math.hypot(report.districtName.dragged.tileX - report.districtName.resting.tileX, report.districtName.dragged.tileY - report.districtName.resting.tileY) > 20 &&
    !report.districtName.dragged.hash.includes("pin.") &&
    report.districtName.dragged.pinned === 0 &&
    report.districtName.bookmarked?.dx === report.districtName.resting.dx &&
    report.districtName.bookmarked?.dy === report.districtName.resting.dy &&
    report.districtName.bookmarked?.pinned === 0,
  // The panel beside the map floats over it: inset from the right and the foot, below the bar, rounded, edged and lifted — and nothing of the city stands under it.
  theMapPanelFloatsOverTheMapInsteadOfRunningFlushToItsEdges:
    ["1560", "390"].every((width) => {
      const one = report.mapPanel?.[width];
      return (
        one !== null &&
        one !== undefined &&
        one.right >= 4 &&
        one.bottom >= 4 &&
        one.belowTheBar === true &&
        one.radius > 0 &&
        one.shadow === true &&
        one.edge === true &&
        one.under.length === 0 &&
        (width === "390" ? one.left >= 4 && one.kind === "sheet" : one.kind === "dock" && one.top >= (report.mapPanel[width].top ?? 0))
      );
    }),
  // A kind without one opens to its stop beside the map, in the panel a lens opens in, rather than in place over its neighbors;
  // chosen, it is listed there, every record in it.
  aDistrictWithoutOneIsListedBesideTheMap:
    (report.districts?.withoutOne ?? "").includes("focus=aggregate%3Areason") &&
    (report.districts?.withoutOne ?? "").includes("overview=1") &&
    (report.districts?.withoutOne ?? "").endsWith("|stop=reason") &&
    !(report.districts?.withoutOne ?? "").includes("expand=") &&
    report.districts?.listed?.panel === "dock" &&
    (report.districts?.listed?.rows ?? 0) > 0 &&
    (report.districts?.listed?.font ?? 0) >= 12 &&
    report.districts?.listed?.floating === 0,
  // Typing lights the districts the words found and dims the rest, as an adjustment rather than a stop per letter;
  // pressing a lit district lands inside it narrowed by the same words; Back returns to the lit city; Escape clears.
  typingLightsAndALitDistrictLandsNarrowed: report.search?.ok === true,
  // The box is a combobox over a listbox, ↓ moves an active descendant, and a live region says the count.
  theFindBoxIsACombobox:
    report.search?.lit?.role === "combobox" &&
    report.search?.lit?.expanded === "true" &&
    report.search?.lit?.controls === true &&
    report.search?.active === "true" &&
    /found/.test(report.search?.lit?.count ?? ""),
  // Inside the district only what the words found is drawn, and its row says the words.
  theDistrictOpensNarrowed:
    report.search?.landed?.row === "deposit" &&
    (report.search?.landed?.tasks ?? []).length === 1 &&
    report.search?.landed?.tasks?.[0] === "t-deposit",
  // At 390 and a 32px root font: a sheet the screen's width under the box, no sideways scroll, no target under 24px.
  theStripIsASheetOnAPhone:
    report.search?.onAPhone?.scrollWidth <= report.search?.onAPhone?.width &&
    report.search?.onAPhone?.strip?.left === 0 &&
    report.search?.onAPhone?.strip?.width >= report.search?.onAPhone?.width - 1 &&
    report.search?.onAPhone?.strip?.top >= report.search?.onAPhone?.boxBottom - 1 &&
    report.search?.onAPhone?.small === 0,
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
