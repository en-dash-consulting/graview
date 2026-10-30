#!/usr/bin/env node
/**
 * THE SCENE HOLDS STEADY UNDER A FINGER AND A MOUSE.
 *
 * "Scene interactivity is buggy and awkward on mobile (and desktop)", said
 * of an app the size of a discography — a thousand songs, hundreds of
 * albums and artists. This drives the discography example (the same
 * catalog, 1,177 songs over five kinds) with every gesture a person makes
 * on its scene, on a phone and at a desk, and asks of each that it does
 * one thing:
 *
 *   a tap chooses and shows no focus ring, and a tap on bare ground never pans;
 *   on a phone the sheet a tap opens leaves the city where it stood — its
 *   size kept, moved as one only to lift the choice above the sheet — and
 *   nothing stands over the chosen district's controls;
 *   a drag — from bare ground or from a district — pans and never chooses;
 *   two fingers zoom the city under them (and on iOS, where Safari says a
 *   pinch twice, once as fingers and once as a GestureEvent, zoom it once);
 *   ctrl+wheel zooms under the cursor;
 *   a double-tap or a double-click goes into the district pressed, and two
 *   quick taps land on the second district, however the first moved the city;
 *   a focused district's list scrolls under a finger without moving the card;
 *   Up from a focus brings the city back as it stood;
 *   turning the phone and the browser's toolbar folding away choose nothing
 *   and move nothing;
 *   the page behind the scene never scrolls or zooms;
 *   and at a quarter of the processor (Chromium), a pan and a pinch keep
 *   their frames while the hand is on them.
 *
 * On a phone: Pixel 7 in Chromium, its touches sent as real touches
 * (`Input.dispatchTouchEvent`); iPhone 13 in WebKit, its taps real and its
 * drags and pinches said in the page as iOS says them — pointers, and a
 * GestureEvent beside them. At a desk: 1440×900 with a mouse and a wheel.
 *
 *   node scripts/verify-scene-hands.mjs [--engine=chromium|webkit]   (both by default)
 *
 * Writes docs/scene-hands.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { devices } from "playwright";
import { arriveWithoutWebfonts, launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const engines = asked ? [asked] : ["chromium", "webkit"];
const PHONES = { chromium: "Pixel 7", webkit: "iPhone 13" };
const DESK = { width: 1440, height: 900 };
/** The processor at a quarter of its speed, as the nightly's runner is (`GRAVIEW_SLOW`). */
const SLOW = Number(process.env.GRAVIEW_SLOW ?? 4) || 4;
/*
 * A FRAME'S BUDGET UNDER THE HAND, in real milliseconds at a quarter of the
 * processor: the same reading verify-panning holds a drag to — the median
 * frame at 55 a second, and no frame doing more than 24ms of work (×4, since
 * the processor is quartered) — with a pinch held to the same, since the
 * fingers move the same picture.
 */
const MEDIAN_MS = 1000 / 55 + 0.5;
const WORST_MS = 24 * SLOW;
/** How far a district's middle may stand from the fingers or the cursor after a zoom about them, in pixels. */
const UNDER = 12;
const SETTLE = 750;

/*
 * THE PHONE TURNED IN PLAYWRIGHT'S LINUX WEBKIT, WITHOUT `isMobile`.
 * Playwright 1.49.1's Linux WebKit kills its web process when the viewport
 * of an `isMobile` page grows shorter while the page holds a CSS query
 * container — any element with `container-type`, rendered; a page of one
 * such <div> is enough, a Graview page or not
 * (`<div style="container-type:inline-size">hi</div>`, iPhone 13, turned
 * to landscape). Without `isMobile` it turns, Chromium turns, WebKit on a
 * Mac turns, and 1.50.1's Linux WebKit turns. The Shell's bar and its
 * picture are query containers the panes and the bar size against, so
 * there is nothing in the page to change: the turn is judged here as the
 * iPhone with only `isMobile` set aside, and `where` says so.
 */
const LINUX_WEBKIT_TURN = { isMobile: false };

const DISTRICTS = ["kind:album", "kind:artist", "kind:song", "kind:era"];

/* ------------------------------------------------------------------ */
/* What the page says                                                  */
/* ------------------------------------------------------------------ */

const boxOf = (page, id) =>
  page.evaluate((id) => {
    const card = document.querySelector(`[data-graview-view="${CSS.escape(id)}"]`);
    if (!card) return null;
    const box = card.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width, height: box.height };
  }, id);

/** Everything a gesture might have done that it should not: the stop, the choice, the page's own scroll and zoom. */
const stateOf = (page) =>
  page.evaluate(() => {
    const hash = decodeURIComponent(location.hash);
    const ground = document.querySelector(".graview-ground");
    return {
      hash,
      selected: [...document.querySelectorAll("[data-graview-selected]")].map((card) => card.getAttribute("data-graview-view")),
      pinned: /pin\./.test(hash),
      page: {
        scrollX: Math.round(scrollX),
        scrollY: Math.round(scrollY),
        top: document.scrollingElement?.scrollTop ?? 0,
        scale: Number((visualViewport?.scale ?? 1).toFixed(3)),
        offsetTop: Math.round(visualViewport?.offsetTop ?? 0),
      },
      // An engine that does not know the property (WebKit on Linux in Playwright 1.49) cannot be asked it.
      overscroll: !ground ? null : CSS.supports("overscroll-behavior", "contain") ? getComputedStyle(ground).overscrollBehaviorY : "unknown to this engine",
      ring: Boolean(document.activeElement?.matches?.(":focus-visible") && document.activeElement.closest("[data-graview-view]")),
    };
  });

/*
 * AT REST: the ground says nothing is moving, and every card stands where it
 * stood a moment ago. The sheet a choice opens on a phone comes in late (its
 * panel is loaded when it is first wanted) and moves the city up out of its
 * way after the ground first said it was settled.
 */
async function settled(page) {
  await page.waitForSelector(".graview-ground[data-graview-settled]", { timeout: 30_000 });
  await page.waitForTimeout(SETTLE);
  const where = () =>
    page.evaluate(() => [...document.querySelectorAll(".graview-ground [data-graview-view]")].map((card) => card.getBoundingClientRect()).map((box) => `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)}`).join(" ") + (document.querySelector(".graview-ground[data-graview-settled]") ? "" : "moving"));
  // Still across two looks, 400 ms apart: on a slow runner one quiet look came while the sheet's own module was still loading.
  let last = await where();
  let still = 0;
  for (let i = 0; i < 30 && still < 2; i += 1) {
    await page.waitForTimeout(400);
    const now = await where();
    still = now === last ? still + 1 : 0;
    last = now;
  }
}

/** Bare ground near the middle of what is seen: nothing pickable, no chrome, no sheet. */
const bareGround = (page) =>
  page.evaluate(() => {
    const ground = document.querySelector(".graview-ground").getBoundingClientRect();
    const bare = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return el !== null && el.closest(".graview-ground") !== null && !el.closest("[data-graview-view], [data-graview-pick], button, a, input, [role='button'], aside, section, [data-graview-offstage]");
    };
    const mid = { x: ground.left + ground.width / 2, y: ground.top + ground.height / 3 };
    for (let r = 0; r <= 600; r += 16) {
      for (let a = 0; a < 360; a += r === 0 ? 360 : 20) {
        const x = Math.round(mid.x + r * Math.cos((a * Math.PI) / 180));
        const y = Math.round(mid.y + r * Math.sin((a * Math.PI) / 180));
        // Bare for a finger's width all round: a phone moves a tap onto a target that close (Chrome's touch adjustment).
        const clear = [[0, 0], [-28, -28], [28, -28], [-28, 28], [28, 28], [0, -28], [0, 28], [-28, 0], [28, 0]].every(([dx, dy]) => bare(x + dx, y + dy));
        if (x > ground.left + 40 && x < ground.right - 40 && y > ground.top + 40 && y < ground.bottom - 40 && clear) return { x, y };
      }
    }
    return null;
  });

let opened = 0;
async function open(page, hash = "#overview=1") {
  // A new address each time: the same address with another hash is no new page, and the last gesture's choice would stand.
  opened += 1;
  await arriveWithoutWebfonts(page, `${at("discography")}/?fresh=1&visit=${opened}${hash}`);
  await page.waitForFunction(() => "__graviewReady" in window, null, { timeout: 120_000 });
  // A district chosen or opened brings its panel up, beside the map or as a sheet, and the city is fitted to what it leaves: wait for it.
  if (/[#&](sel|focus)=/.test(hash)) await page.waitForSelector("[data-graview-map-panel]", { timeout: 30_000 }).catch(() => {});
  await settled(page);
}

/* ------------------------------------------------------------------ */
/* Hands                                                               */
/* ------------------------------------------------------------------ */

/**
 * A FINGER, OR TWO. In Chromium the touches are the browser's own; in
 * WebKit, which Playwright gives no multi-touch, they are said in the page
 * the way iOS says them: a pointer per finger, and for two fingers a
 * GestureEvent beside them as well — the double reading the scene must not
 * zoom twice for. A tap is always the browser's own (`touchscreen.tap`).
 */
function touchHand(page, engine, cdp) {
  const real = async (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  const said = (type, points, scale) =>
    page.evaluate(
      ({ type, points, scale }) => {
        const state = (window.__fingers ??= { targets: [], startedApart: 0 });
        const kind = { start: "pointerdown", move: "pointermove", end: "pointerup" }[type];
        points.forEach(([x, y], i) => {
          if (type === "start") state.targets[i] = document.elementFromPoint(x, y) ?? document.body;
          const target = state.targets[i];
          target.dispatchEvent(
            new PointerEvent(kind, { pointerId: 40 + i, pointerType: "touch", isPrimary: i === 0, clientX: x, clientY: y, button: type === "move" ? -1 : 0, buttons: type === "end" ? 0 : 1, bubbles: true, cancelable: true, composed: true }),
          );
        });
        if (points.length === 2) {
          const mid = { clientX: (points[0][0] + points[1][0]) / 2, clientY: (points[0][1] + points[1][1]) / 2 };
          const gesture = new Event({ start: "gesturestart", move: "gesturechange", end: "gestureend" }[type], { bubbles: true, cancelable: true });
          Object.assign(gesture, { scale, ...mid });
          state.targets[0].dispatchEvent(gesture);
        }
      },
      { type, points, scale },
    );
  const chromium = engine === "chromium";
  return {
    tap: (x, y) => page.touchscreen.tap(x, y),
    async drag(from, by, steps = 10, beforeEnd = async () => {}) {
      if (chromium) {
        await real("touchStart", [[from.x, from.y]]);
        for (let i = 1; i <= steps; i += 1) await real("touchMove", [[from.x + (by.x * i) / steps, from.y + (by.y * i) / steps]]);
        await beforeEnd();
        await real("touchEnd", []);
        return;
      }
      await said("start", [[from.x, from.y]]);
      for (let i = 1; i <= steps; i += 1) {
        await said("move", [[from.x + (by.x * i) / steps, from.y + (by.y * i) / steps]]);
        await page.waitForTimeout(16);
      }
      await said("end", [[from.x + by.x, from.y + by.y]]);
    },
    /** Two fingers about a middle, from `from` apart to `to` apart. */
    async pinch(mid, from, to, steps = 12, beforeEnd = async () => {}) {
      const at = (apart) => [
        [mid.x - apart / 2, mid.y],
        [mid.x + apart / 2, mid.y],
      ];
      if (chromium) {
        await real("touchStart", at(from));
        for (let i = 1; i <= steps; i += 1) await real("touchMove", at(from + ((to - from) * i) / steps));
        await beforeEnd();
        await real("touchEnd", []);
        return;
      }
      await said("start", at(from), 1);
      for (let i = 1; i <= steps; i += 1) {
        const apart = from + ((to - from) * i) / steps;
        await said("move", at(apart), apart / from);
        await page.waitForTimeout(16);
      }
      await said("end", at(to), to / from);
    },
  };
}

function mouseHand(page) {
  return {
    tap: (x, y) => page.mouse.click(x, y),
    async drag(from, by, steps = 10) {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i += 1) await page.mouse.move(from.x + (by.x * i) / steps, from.y + (by.y * i) / steps);
      await page.mouse.up();
    },
  };
}

/* ------------------------------------------------------------------ */
/* The gestures, each judged                                           */
/* ------------------------------------------------------------------ */

const near = (a, b, within) => a && b && Math.abs(a.x - b.x) <= within && Math.abs(a.y - b.y) <= within;
const stillPage = (state) => state.page.scrollX === 0 && state.page.scrollY === 0 && state.page.top === 0 && state.page.scale === 1 && state.page.offsetTop === 0;

/** A tap on a district: it is chosen, the ring the keyboard draws is not drawn for a finger, and the page behind stays still. */
async function tapChooses(page, hand, where) {
  await open(page);
  const before = await boxOf(page, "kind:album");
  await hand.tap(before.x, before.y);
  await settled(page);
  const after = await boxOf(page, "kind:album");
  const state = await stateOf(page);
  return {
    where,
    before,
    after,
    selected: state.selected,
    ring: state.ring,
    /*
     * At a desk the panel the choice opens beside the map fits the city to
     * what it leaves: one move, the one way (verify-viewport's
     * aTapOnTheSceneMovesTheCameraOnce). On a phone the sheet leaves the city
     * where it stood (aTapOpeningASheetLeavesTheCityWhereItStood).
     */
    ok: state.selected.includes("kind:album") && !state.ring && stillPage(state),
  };
}

/**
 * A TAP THAT OPENS A SHEET LEAVES THE CITY WHERE IT STOOD. On a phone a
 * chosen district opens its sheet over the foot of the screen; the city is
 * not drawn again at another size for it — every district keeps its size,
 * and the city moves, if at all, as one, only so far as lifts the chosen
 * district above the sheet — and nothing stands over the chosen district's
 * name and showings, the zoom included.
 */
async function sheetLeavesTheCity(page, hand, where) {
  await open(page);
  const boxes = () =>
    page.evaluate(() =>
      Object.fromEntries([...document.querySelectorAll('.graview-ground [data-graview-view^="kind:"]')].map((card) => {
        const box = card.getBoundingClientRect();
        return [card.getAttribute("data-graview-view"), { x: box.x, y: box.y, width: box.width, height: box.height }];
      })),
    );
  const runs = [];
  for (const id of ["kind:album", "kind:song"]) {
    await open(page);
    const before = await boxes();
    const at = before[id];
    await hand.tap(at.x + at.width / 2, at.y + at.height / 2);
    await page.waitForSelector("[data-graview-map-panel]", { timeout: 30_000 }).catch(() => {});
    await settled(page);
    const after = await boxes();
    const said = await page.evaluate((id) => {
      const sheet = document.querySelector("[data-graview-map-panel]")?.getBoundingClientRect() ?? null;
      const card = document.querySelector(`.graview-ground [data-graview-view="${id}"]`);
      // The chosen district's own controls — its name's count, its showings — each answers a press at its middle.
      // As the watch judges them (lib/watch.mjs): a control drawn and pressable, not one shown only on hover.
      const controls = [...(card?.querySelectorAll("button, [role='button']") ?? [])].filter((one) => {
        const box = one.getBoundingClientRect();
        const style = getComputedStyle(one);
        return box.width >= 8 && box.height >= 8 && style.visibility !== "hidden" && style.pointerEvents !== "none" && Number(style.opacity) > 0 && !one.closest("[hidden],[aria-hidden='true'],[inert]");
      });
      const covered = controls.flatMap((one) => {
        const box = one.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        // Itself, or a box that holds it (the stage a card stands on): not covered.
        return top && (top === one || one.contains(top) || top.contains(one)) ? [] : [`${one.getAttribute("aria-label") ?? one.textContent?.trim()} under ${top?.closest("[aria-label]")?.getAttribute("aria-label") ?? top?.tagName}`];
      });
      const chosen = card?.getBoundingClientRect();
      return { sheetTop: sheet?.top ?? null, chosenBottom: chosen?.bottom ?? null, covered, zoom: document.querySelector(".graview-zoom") !== null };
    }, id);
    const ids = Object.keys(before).filter((one) => after[one]);
    const moves = ids.map((one) => ({ id: one, dx: after[one].x - before[one].x, dy: after[one].y - before[one].y, grew: after[one].width - before[one].width }));
    const sameSize = moves.every((one) => Math.abs(one.grew) < 1);
    const asOne = moves.every((one) => Math.abs(one.dx - moves[0].dx) < 1.5 && Math.abs(one.dy - moves[0].dy) < 1.5);
    const above = said.sheetTop !== null && said.chosenBottom !== null && said.chosenBottom <= said.sheetTop + 1;
    runs.push({ id, moved: moves.find((one) => one.id === id), sameSize, asOne, above, said, ok: sameSize && asOne && above && said.covered.length === 0 && said.sheetTop !== null });
  }
  return { where, runs, ok: runs.every((run) => run.ok) };
}

/** A tap on bare ground puts the choice down and pans nothing. */
async function tapOnGroundNeverPans(page, hand, where) {
  await open(page, "#overview=1&sel=kind:album");
  const before = await boxOf(page, "kind:era");
  const bare = await bareGround(page);
  await hand.tap(bare.x, bare.y);
  await settled(page);
  const after = await boxOf(page, "kind:era");
  const state = await stateOf(page);
  return { where, bare, before, after, selected: state.selected, hash: state.hash, ok: state.selected.length === 0 && !/pan=/.test(state.hash) && stillPage(state) };
}

/** A drag from bare ground and from a district: the city pans by the drag, and nothing is chosen. */
async function dragNeverSelects(page, hand, where) {
  await open(page);
  const runs = [];
  for (const start of ["ground", "kind:song"]) {
    const before = await boxOf(page, "kind:era");
    const from = start === "ground" ? await bareGround(page) : await boxOf(page, start);
    const by = { x: 60, y: 40 };
    await hand.drag(from, by);
    await settled(page);
    const after = await boxOf(page, "kind:era");
    const state = await stateOf(page);
    runs.push({ start, before, after, selected: state.selected, ok: state.selected.length === 0 && near({ x: after.x - before.x, y: after.y - before.y }, by, 6) && stillPage(state) });
  }
  return { where, runs, ok: runs.every((run) => run.ok) };
}

/** Two fingers apart over a district: it grows, and stays under them; iOS's GestureEvent beside the pointers zooms nothing twice. */
async function pinchUnderFingers(page, hand, where) {
  await open(page);
  const before = await boxOf(page, "kind:song");
  const mid = { x: Math.round(before.x), y: Math.round(before.y) };
  await hand.pinch(mid, 60, 120);
  await settled(page);
  const after = await boxOf(page, "kind:song");
  const state = await stateOf(page);
  const grew = after.width / before.width;
  // Fingers twice as far apart: the city twice the size, not four times (the pinch read twice) and not unmoved.
  return { where, mid, before, after, grew: Number(grew.toFixed(2)), ok: grew > 1.6 && grew < 2.4 && near(after, mid, UNDER) && state.selected.length === 0 && stillPage(state) };
}

/** Ctrl+wheel (a trackpad's pinch) over a district zooms it under the cursor. */
async function wheelUnderCursor(page, where) {
  await open(page);
  const before = await boxOf(page, "kind:song");
  await page.mouse.move(before.x, before.y);
  await page.keyboard.down("Control");
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, -30);
    await page.waitForTimeout(20);
  }
  await page.keyboard.up("Control");
  await settled(page);
  const after = await boxOf(page, "kind:song");
  const state = await stateOf(page);
  return { where, before, after, ok: after.width > before.width * 1.3 && near(after, before, UNDER) && stillPage(state) };
}

/** A double-tap (or a double-click) on each district goes into it, however the first tap moved the city. */
async function doubleGoesIn(page, hand, where, desk) {
  const runs = [];
  for (const id of DISTRICTS) {
    await open(page);
    const at = await boxOf(page, id);
    if (desk) await page.mouse.dblclick(at.x, at.y);
    else {
      await hand.tap(at.x, at.y);
      await page.waitForTimeout(90);
      await hand.tap(at.x, at.y);
    }
    await settled(page);
    const state = await stateOf(page);
    runs.push({ id, hash: state.hash, ok: state.hash.includes(`focus=aggregate:${id.slice("kind:".length)}`) && stillPage(state) });
  }
  return { where, runs, ok: runs.every((run) => run.ok) };
}

/** Two quick taps on two districts, both aimed at the city as it stood: the second is chosen. */
async function twoQuickTaps(page, hand, where) {
  const runs = [];
  for (const [first, second] of [
    ["kind:album", "kind:artist"],
    ["kind:artist", "kind:era"],
    ["kind:era", "kind:song"],
  ]) {
    await open(page);
    const a = await boxOf(page, first);
    const b = await boxOf(page, second);
    await hand.tap(a.x, a.y);
    await page.waitForTimeout(150);
    await hand.tap(b.x, b.y);
    await settled(page);
    const state = await stateOf(page);
    runs.push({ first, second, selected: state.selected, hash: state.hash, ok: state.selected.length === 1 && state.selected[0] === second && !state.hash.includes("focus=") });
  }
  return { where, runs, ok: runs.every((run) => run.ok) };
}

/** A finger in a focused district's list scrolls the list, and the card stays where it is, unpinned. */
async function previewScrolls(page, hand, where) {
  // The first focused district whose card holds a list that scrolls at this size (the albums' years stand in four columns on an iPhone).
  let scroller = null;
  let focused = null;
  for (const kind of ["album", "song", "artist"]) {
    await open(page, `#focus=aggregate:${kind}`);
    scroller = await findScroller(page);
    focused = `aggregate:${kind}`;
    if (scroller) break;
  }
  if (!scroller) return { where, ok: false, error: "no scrolling list in a focused district" };
  return scrollIn(page, hand, where, scroller, focused);
}

const findScroller = (page) =>
  page.evaluate(() => {
    const one = [...document.querySelectorAll(".graview-ground [data-graview-view] *")].find(
      (el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 40 && el.getBoundingClientRect().height > 80,
    );
    if (!one) return null;
    one.setAttribute("data-harness-scroller", "");
    const box = one.getBoundingClientRect();
    return { x: box.x + Math.min(60, box.width / 3), y: box.y + box.height - 16, height: box.height };
  });

async function scrollIn(page, hand, where, scroller, focused) {
  const card = await boxOf(page, focused);
  const before = await page.evaluate(() => document.querySelector("[data-harness-scroller]").scrollTop);
  await hand.drag(scroller, { x: 0, y: -Math.min(120, scroller.height - 30) }, 12);
  await settled(page);
  const after = await page.evaluate(() => document.querySelector("[data-harness-scroller]").scrollTop);
  const cardAfter = await boxOf(page, focused);
  const state = await stateOf(page);
  // In WebKit the finger is said in the page, which scrolls nothing natively: there the card staying put is the claim.
  const scrolled = where.engine === "chromium" ? after > before : true;
  return { where, focused, before, after, card, cardAfter, pinned: state.pinned, ok: scrolled && near(card, cardAfter, 1) && !state.pinned && stillPage(state) };
}

/** Up from a focus: the city back as it stood before going in. */
async function upFromFocus(page, where) {
  await open(page);
  const before = await boxOf(page, "kind:era");
  // On the ground, in the albums: the way a person reads them.
  await open(page, "#focus=aggregate:album");
  await page.getByRole("button", { name: /^Up\b/ }).first().click();
  await settled(page);
  // Up chooses the district it came from: put that down, and the city stands as it did.
  await page.keyboard.press("Escape");
  await settled(page);
  const after = await boxOf(page, "kind:era");
  const state = await stateOf(page);
  return { where, before, after, hash: state.hash, ok: !state.hash.includes("focus=") && near(after, before, 2) && Math.abs(after.width - before.width) < 1 };
}

/** The phone turned, and turned back, and the toolbar folding away: the choice kept, nothing moved, the page still. */
async function turnsAndToolbar(page, where, phone) {
  await open(page, "#overview=1&sel=kind:song");
  const before = await boxOf(page, "kind:song");
  const { width, height } = phone.viewport;
  await page.setViewportSize({ width, height: height + 70 });
  await page.waitForTimeout(SETTLE);
  const toolbar = await boxOf(page, "kind:song");
  await page.setViewportSize({ width: height, height: width });
  await settled(page);
  await page.setViewportSize({ width, height });
  await settled(page);
  const state = await stateOf(page);
  return { where, before, toolbar, turned: true, selected: state.selected, ok: near(before, toolbar, 1) && state.selected.includes("kind:song") && stillPage(state) };
}

/** Every page above, and the ground's own word: a list's scroll stops at the ground. */
const pageStill = (state) => stillPage(state) && (state.overscroll === "contain" || state.overscroll === "unknown to this engine");

/**
 * FRAMES UNDER THE HAND, at a quarter of the processor: a drag across the
 * city and a pinch on it, timed by the page's own animation frames.
 */
async function framesUnderTheHand(page, hand, cdp, where) {
  await open(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: SLOW });
  const timed = async (label, gesture) => {
    await page.evaluate(() => {
      const at = [];
      let stop = false;
      window.__stopFrames = () => ((stop = true), at);
      const tick = (now) => {
        at.push(now);
        if (!stop) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    // The clock stops as the hand lifts: what letting go costs is verify-scene-at-scale's to hold, against its reference.
    let stamps = [];
    await gesture(async () => {
      stamps = await page.evaluate(() => window.__stopFrames());
    });
    const gaps = stamps.slice(1).map((stamp, i) => stamp - stamps[i]).sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)] ?? Infinity;
    const worst = gaps[gaps.length - 1] ?? Infinity;
    return { label, frames: gaps.length, medianMs: Number(median.toFixed(1)), worstMs: Number(worst.toFixed(1)), ok: gaps.length >= 8 && median <= MEDIAN_MS && worst <= WORST_MS };
  };
  const bare = await bareGround(page);
  const pan = await timed("pan", (beforeEnd) => hand.drag(bare, { x: 120, y: 80 }, 30, beforeEnd));
  await settled(page);
  const song = await boxOf(page, "kind:song");
  const pinch = await timed("pinch", (beforeEnd) => hand.pinch({ x: song.x, y: song.y }, 60, 140, 30, beforeEnd));
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return { where, slowdown: SLOW, budget: { medianMs: Number(MEDIAN_MS.toFixed(1)), worstMs: WORST_MS }, runs: [pan, pinch], ok: pan.ok && pinch.ok };
}

/* ------------------------------------------------------------------ */
/* The run                                                             */
/* ------------------------------------------------------------------ */

const report = { at: new Date().toISOString(), engines, app: "apps/discography", checks: {} };
const errors = [];
const seen = { sheet: [], tap: [], ground: [], drag: [], pinch: [], wheel: [], double: [], quick: [], preview: [], up: [], turn: [], page: [], frames: [] };
let browser;
const discography = await serving("discography", portFor("discography"), repoRoot);
try {
  for (const engine of engines) {
    browser = await launchEngine(engine);
    const name = PHONES[engine];
    const phone = devices[name];
    /*
     * A PAGE OF ITS OWN FOR EACH GESTURE, in a context of its own. One page
     * opened forty times over crashed WebKit on the nightly's Linux runner
     * part way through ("Page crashed"), and every gesture after it failed
     * for the crash rather than for anything it did.
     */
    const run = async (options, label, gestures) => {
      for (const [list, gesture, own = {}] of gestures) {
        const context = await browser.newContext({ ...options, ...own });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${label}: ${error.message}`));
        const cdp = engine === "chromium" && options.hasTouch ? await context.newCDPSession(page) : null;
        const hand = options.hasTouch ? touchHand(page, engine, cdp) : mouseHand(page);
        const where = { engine, device: label, ...(own.isMobile === false ? { isMobile: false } : {}) };
        try {
          list.push(await gesture(page, hand, where, cdp));
        } catch (error) {
          list.push({ where, ok: false, error: String(error?.message ?? error) });
        }
        seen.page.push({ where, after: list.at(-1)?.error ? "threw" : "ran", state: await stateOf(page).catch(() => null) });
        await context.close().catch(() => {});
      }
    };
    // A phone: its own touches.
    await run({ ...phone }, name, [
      [seen.tap, (page, hand, where) => tapChooses(page, hand, where)],
      [seen.sheet, (page, hand, where) => sheetLeavesTheCity(page, hand, where)],
      [seen.ground, (page, hand, where) => tapOnGroundNeverPans(page, hand, where)],
      [seen.drag, (page, hand, where) => dragNeverSelects(page, hand, where)],
      [seen.pinch, (page, hand, where) => pinchUnderFingers(page, hand, where)],
      [seen.double, (page, hand, where) => doubleGoesIn(page, hand, where, false)],
      [seen.quick, (page, hand, where) => twoQuickTaps(page, hand, where)],
      [seen.preview, (page, hand, where) => previewScrolls(page, hand, where)],
      [seen.turn, (page, _hand, where) => turnsAndToolbar(page, where, phone), engine === "webkit" && process.platform === "linux" ? LINUX_WEBKIT_TURN : {}],
      [seen.up, (page, _hand, where) => upFromFocus(page, where)],
      ...(engine === "chromium" ? [[seen.frames, (page, hand, where, cdp) => framesUnderTheHand(page, hand, cdp, where)]] : []),
    ]);
    // A desk: a mouse and a wheel.
    await run({ viewport: DESK }, "desk 1440×900", [
      [seen.tap, (page, hand, where) => tapChooses(page, hand, where)],
      [seen.ground, (page, hand, where) => tapOnGroundNeverPans(page, hand, where)],
      [seen.drag, (page, hand, where) => dragNeverSelects(page, hand, where)],
      [seen.wheel, (page, _hand, where) => wheelUnderCursor(page, where)],
      [seen.double, (page, hand, where) => doubleGoesIn(page, hand, where, true)],
      [seen.quick, (page, hand, where) => twoQuickTaps(page, hand, where)],
      [seen.up, (page, _hand, where) => upFromFocus(page, where)],
    ]);
    await browser.close();
    browser = undefined;
  }

  const every = (list) => list.length > 0 && list.every((one) => one.ok);
  report.checks.aTapChoosesWithoutARing = { held: seen.tap, ok: every(seen.tap) };
  report.checks.aTapOpeningASheetLeavesTheCityWhereItStood = { held: seen.sheet, ok: every(seen.sheet) };
  report.checks.aTapOnTheGroundNeverPans = { held: seen.ground, ok: every(seen.ground) };
  report.checks.aDragOnTheSceneNeverSelects = { held: seen.drag, ok: every(seen.drag) };
  report.checks.aPinchZoomsUnderTheFingers = { held: seen.pinch, ok: every(seen.pinch) };
  report.checks.aWheelZoomStaysUnderTheCursor = { held: seen.wheel, ok: every(seen.wheel) };
  report.checks.aDoubleTapGoesIntoTheDistrictPressed = { held: seen.double, ok: every(seen.double) };
  report.checks.twoQuickTapsLandOnTheSecondCard = { held: seen.quick, ok: every(seen.quick) };
  report.checks.aFocusedPreviewScrollsWithoutMovingTheScene = { held: seen.preview, ok: every(seen.preview) };
  report.checks.upFromAFocusBringsTheCityBackAsItStood = { held: seen.up, ok: every(seen.up) };
  report.checks.turningThePhoneAndItsToolbarMoveNothing = { held: seen.turn, ok: every(seen.turn) };
  report.checks.thePageNeverScrollsBehindTheScene = {
    held: seen.page,
    ok: seen.page.length > 0 && seen.page.every((one) => one.state && pageStill(one.state)),
  };
  if (engines.includes("chromium")) report.checks.panAndPinchKeepTheirFramesAtAQuarterSpeed = { held: seen.frames, ok: every(seen.frames) };
  report.checks.noPageThrew = { errors, ok: errors.length === 0 };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  discography.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/scene-hands.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/scene-hands.json\n");
process.exit(report.passed ? 0 : 1);
