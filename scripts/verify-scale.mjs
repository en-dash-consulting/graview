#!/usr/bin/env node
/**
 * A picture draws what a person can read, at a real size (docs/scale.md).
 *
 * The fixtures were a few dozen nodes, and every harness passed while a real
 * catalogue — Tech N9ne's discography, 1,177 songs, 568 artists, 479
 * releases, about 5,000 edges — drew 21,000 elements at altitude and panned
 * at one frame a second around its hub. This drives apps/discography's
 * PRODUCTION build (dev-mode React would exaggerate every number) and
 * records, per stop and gesture: the DOM, the hosts, the line strands, and
 * every frame's length from a requestAnimationFrame recorder with vsync off,
 * so a frame is exactly as long as the work in it.
 *
 *   node scripts/verify-scale.mjs            (writes docs/scale.json)
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = resolve(repoRoot, "apps/discography");
const PORT = portFor("discography-preview");
const ENGINE = engineName();
const report = { at: new Date().toISOString(), engine: ENGINE, stops: {} };

/* The page as it ships: built, then served by vite preview. */
execFileSync("npx", ["vite", "build"], { cwd: app, stdio: "ignore" });
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: app, detached: true, stdio: ["ignore", "pipe", "pipe"] });
await new Promise((ready, fail) => {
  const timer = setTimeout(() => fail(new Error("vite preview did not start")), 60_000);
  server.stdout.on("data", (chunk) => String(chunk).includes(String(PORT)) && (clearTimeout(timer), ready()));
});

let browser;
try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed"), args: ["--disable-gpu-vsync", "--disable-frame-rate-limit"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  report.pageErrors = [];
  page.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 200)));
  await page.addInitScript(() => {
    const w = window;
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__long.push(entry.duration);
    }).observe({ type: "longtask", buffered: true });
    w.__record = () => {
      w.__frames = [];
      w.__at = [];
      w.__long = [];
      w.__markIndex = null;
      /*
       * One recorder at a time. A loop that only checked a flag outlived its
       * stop whenever the next recording began before its next frame, and
       * then every frame was counted twice, at times past the stop's end.
       */
      const generation = (w.__generation = (w.__generation ?? 0) + 1);
      let last = performance.now();
      const began = last;
      const tick = (at) => {
        if (w.__generation !== generation) return;
        w.__frames.push(at - last);
        w.__at.push(at - began);
        last = at;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    // The moment the gesture began, so its first frame is found rather than assumed.
    w.__begin = () => {
      w.__markIndex = w.__frames.length;
    };
    w.__stop = () => {
      w.__generation = (w.__generation ?? 0) + 1;
      /*
       * THE FIRST FRAME is the one the new stop lands in: laid out, rendered
       * and drawn. With vsync off a frame is a couple of milliseconds, so it
       * is not the recording's first frame — the gesture has not happened
       * yet — nor reliably the one straight after the gesture: the
       * navigation reaches React a task or two later. It is the longest
       * frame in the 100 ms after the gesture began, judged on its own
       * (at most 150 ms), and every other frame is judged as a frame.
       */
      const start = w.__markIndex ?? 1;
      let firstAt = -1;
      for (let i = start, elapsed = 0; i < w.__frames.length && elapsed < 100; elapsed += w.__frames[i], i++) {
        if (firstAt < 0 || w.__frames[i] > w.__frames[firstAt]) firstAt = i;
      }
      const first = firstAt < 0 ? 0 : w.__frames[firstAt];
      const rest = w.__frames.filter((_, i) => i > 0 && i !== firstAt).sort((a, b) => a - b);
      const at = (p) => (rest.length ? Math.round(rest[Math.min(rest.length - 1, Math.floor(rest.length * p))] * 10) / 10 : 0);
      return {
        frames: rest.length,
        first: Math.round(first),
        p50: at(0.5),
        p95: at(0.95),
        worst: rest.length ? Math.round(rest[rest.length - 1]) : 0,
        // Every other frame over two frames' time, as [ms into the stop, length]: which part of it is slow.
        slow: w.__frames
          .map((length, i) => [i, Math.round(w.__at[i]), Math.round(length)])
          .filter(([i, , length]) => i > 0 && i !== firstAt && length > 33)
          .map(([, when, length]) => [when, length])
          .slice(0, 8),
        longTasks: w.__long.length,
        dom: document.querySelectorAll("*").length,
        hosts: document.querySelectorAll("[data-graview-view]").length,
        strands: document.querySelectorAll("[data-graview-connector]").length,
        // The places each district says by name on its marquee (FR-118): words, never a lens drawn small.
        names: document.querySelectorAll(".graview-drive-in-thumb-title").length,
      };
    };
  });
  const measure = async (name, act, settle = 800) => {
    await page.evaluate(() => window.__record());
    await page.evaluate(() => window.__begin());
    // A gesture that cannot be made is recorded, not fatal: the next claim still gets measured.
    try {
      await act();
    } catch (error) {
      report.stops[`${name} (failed)`] = String(error).split("\n")[0].slice(0, 200);
    }
    await page.waitForTimeout(settle);
    const seen = await page.evaluate(() => window.__stop());
    report.stops[name] = seen;
    process.stdout.write(`${name.padEnd(34)} ${JSON.stringify(seen)}\n`);
    return seen;
  };
  const drag = async (x, y, dx, dy, steps = 30) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
  };
  const wheel = async (x, y, dy, times = 24) => {
    await page.mouse.move(x, y);
    for (let i = 0; i < times; i++) {
      await page.mouse.wheel(0, dy);
      await page.waitForTimeout(16);
    }
  };
  const travel = (hash) => page.evaluate((next) => { location.hash = next; }, hash);
  /*
   * A point on the GROUND, found rather than assumed: a drag that starts on
   * a card moves the card (a different gesture, measured on its own), and a
   * fixed point was a card at one stop and ground at the next.
   */
  const ground = () =>
    page.evaluate(() => {
      for (let y = 200; y < innerHeight - 80; y += 30) {
        for (let x = 320; x < innerWidth - 160; x += 30) {
          const el = document.elementFromPoint(x, y);
          if (el?.closest(".graview-ground") && !el.closest("[data-graview-view], button, a, input, select, [data-graview-overlay]")) return { x, y };
        }
      }
      return { x: 700, y: 520 };
    });
  const card = (selector) =>
    page.evaluate((wanted) => {
      const box = document.querySelector(wanted)?.getBoundingClientRect();
      return box ? { x: box.x + 12, y: box.y + 8 } : null;
    }, selector);

  await page.goto(`${at("discography-preview")}/?fresh=1#overview=1`, { waitUntil: "load" });
  await page.waitForSelector("[data-graview-view]", { timeout: 120_000 });
  await page.waitForTimeout(1500);

  /* ALTITUDE: the city, and the ground dragged and wheeled under it. */
  const city = await measure("altitude, still", async () => {}, 300);
  const cityAt = await ground();
  const cityDrag = await measure("altitude, drag", () => drag(cityAt.x, cityAt.y, -260, -120));
  const cityWheel = await measure("altitude, wheel", () => wheel(700, 520, 60));

  /* DOWN, then THE HUB: an artist with more than a thousand songs. */
  const descend = await measure("descend", () => page.click('[data-testid="overview"]'), 1500);
  const hub = await measure("focus the hub", () => travel("#focus=artist%3Atech-n9ne"), 2000);
  const hubAt = await ground();
  const hubDrag = await measure("hub, drag", () => drag(hubAt.x, hubAt.y, -260, -120));
  // A card under the hand: the focus, moved a little way and brought back, so the band is where it was.
  const heldAt = await card('[data-graview-plane="0"]');
  const held = await measure("hub, move a card", async () => {
    if (!heldAt) return;
    await drag(heldAt.x, heldAt.y, 120, 60, 24);
    await drag(heldAt.x + 120, heldAt.y + 60, -120, -60, 24);
  });
  const hubWheel = await measure("hub, wheel", () => wheel(700, 420, 60));
  /*
   * THE BAND READS, measured on what is drawn. The first cut held every
   * other claim here while its captions sat on the cards of the row above,
   * its group cards were cut to their names and a chip ran over its
   * neighbour — the harness counted hosts and never looked at them.
   */
  const readable = () =>
    page.evaluate(() => {
      const hosts = [...document.querySelectorAll('[data-graview-plane="1"][data-graview-view]')].map((el) => ({ el, box: el.getBoundingClientRect() }));
      const overlaps = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      const captions = [...document.querySelectorAll("[data-graview-relation]")].map((el) => {
        const span = el.firstElementChild ?? el;
        return span.getBoundingClientRect();
      });
      const captionOnACard = captions.filter((caption) => caption.width > 0 && hosts.some(({ box }) => overlaps(caption, box))).length;
      const cutGroups = [...document.querySelectorAll(".graview-band-group")].filter((el) => el.getBoundingClientRect().height < 44).length;
      const spilledChips = hosts.filter(({ el, box }) => [...el.querySelectorAll('[data-graview-primitive="chip"]')].some((chip) => chip.getBoundingClientRect().right > box.right + 1)).length;
      return { captions: captions.length, captionOnACard, cutGroups, spilledChips };
    });
  const hubReads = await readable();
  await travel("#focus=artist%3Akrizz-kaliko");
  await page.waitForTimeout(2000);
  const guestReads = await readable();
  report.reads = { hub: hubReads, guest: guestReads };

  // The hub as it first lands: the drag above panned the band under the rail.
  await travel("#focus=artist%3Atech-n9ne");
  await page.waitForTimeout(1500);
  const groups = await page.evaluate(() =>
    [...document.querySelectorAll('[data-graview-plane="1"][data-graview-view^="aggregate:"]')].map((el) => {
      const box = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-graview-view"),
        opens: el.querySelector("[data-graview-band]")?.getAttribute("data-graview-band") ?? null,
        text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
        // Pressable where a person would press it: nothing drawn over its middle.
        reachable: el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)),
      };
    }),
  );
  report.groups = groups;

  /* A GROUP OPENS: a stop, its members take the band, Back closes it. */
  let opened = null;
  // An in-place group if the band drew one; the "+N more" door otherwise.
  const pressed = groups.find((group) => group.opens === "place" && group.reachable) ?? groups.find((group) => group.reachable);
  if (pressed) {
    const before = await page.evaluate(() => location.hash);
    await page.dblclick(`[data-graview-view="${pressed.id}"]`, { timeout: 5000 });
    await page.waitForTimeout(1500);
    const during = await page.evaluate(() => ({ hash: location.hash, band: document.querySelectorAll('[data-graview-plane="1"]').length }));
    await page.goBack();
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => location.hash);
    opened = { pressed: pressed.opens, before, during, after };
  }
  report.opened = opened;

  /* A SELECTION AND A SEARCH at the hub. */
  const select = await measure("hub, select", async () => {
    // Pressed where it is drawn, whatever line runs over it: the claim is about the cost of selecting.
    const card = await page.$('[data-graview-plane="1"] [data-graview-pick], [data-graview-plane="1"][data-graview-view]');
    if (card) await card.click({ force: true, timeout: 5000 });
  }, 1200);
  const search = await measure("hub, type in Find", async () => {
    // "/" reaches the Find box from anywhere that is not a field; no Escape first, which would leave the hub.
    await page.keyboard.press("/");
    await page.keyboard.type("the", { delay: 80 });
  }, 1200);
  await page.keyboard.press("Escape");
  const rise = await measure("rise", () => page.click('[data-testid="overview"]'), 1500);

  /*
   * SIXTY FRAMES A SECOND, as this browser can measure it: headless Chromium
   * paces an idle frame at about 19 ms even with vsync off (the altitude,
   * still, baseline), so the p95 is held to 20 ms — a frame that fits — and
   * no frame after the first may take longer than 50 ms, three frames.
   */
  const holds = (stop) => stop && stop.p95 <= 20 && stop.worst <= 50;
  const quiet = (stop) => stop && stop.worst <= 50;
  report.verdict = {
    // The city at altitude is a map of districts, not every member of every lens drawn small —
    // and every place is still named on its district: light because a marquee says names (FR-118), not by saying nothing.
    theCityAtAltitudeIsLight: city.dom < 3000 && city.names > 0,
    // Focusing a hub draws what the band can hold, and says what the rest are.
    aHubStopIsBounded: hub.hosts <= 60 && hub.strands <= 120 && groups.length > 0,
    // A group is a real place: a stop whose members take the band, and Back closes it.
    everyGroupOpens:
      opened !== null &&
      opened.during.hash !== opened.before &&
      // A group opens in place, its members in the band; the door goes to the kind's picture.
      (opened.pressed === "place" ? opened.during.band > 0 : opened.during.hash.includes("in.filter=")) &&
      // Back closes it, at the same focus. The press's first click selected the group, as a
      // first click does anywhere, so Back lands on it selected rather than on the address before.
      !opened.after.includes("expand=") &&
      opened.after.split("&")[0] === opened.before.split("&")[0],
    // A crowded band reads: no caption on a card, no group card cut to its name, no chip over its slot.
    theBandReads: [hubReads, guestReads].every((seen) => seen.captions > 0 && seen.captionOnACard === 0 && seen.cutGroups === 0 && seen.spilledChips === 0),
    // Dragging the ground holds sixty frames a second, up high and at the hub.
    panningHolds60: holds(cityDrag) && holds(hubDrag),
    // A card held by the hand follows it at sixty, and landing it is one frame.
    aHeldCardFollowsTheHand: holds(held),
    wheelHolds60: holds(cityWheel) && holds(hubWheel),
    // Rising, descending and changing focus: one first frame for the new stop, then sixty.
    aTransitionHolds60: [descend, hub, rise].every((stop) => stop.first <= 150 && holds(stop)),
    // Selecting and typing at the hub never drop a frame past 50 ms after the first.
    aSelectionAndASearchAreCheap: quiet(select) && quiet(search),
  };
} catch (error) {
  report.error = String(error).slice(0, 1800);
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid);
  } catch {}
}

report.passed = !report.error && report.verdict && Object.values(report.verdict).every(Boolean) && (report.pageErrors?.length ?? 0) === 0;
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/scale.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.verdict ?? report.error, null, 2)}\n\nwrote docs/scale.json\n`);
process.exit(report.passed ? 0 : 1);
