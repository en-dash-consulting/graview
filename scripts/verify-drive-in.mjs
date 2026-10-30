#!/usr/bin/env node
/**
 * GOING INTO A DISTRICT ON A PHONE READS CLEAN.
 *
 * Nick, in Things' rules on a phone: "looks reallllly rough", and "The
 * whole thing" over it was confusing. The bar named the whole app while he
 * was inside one district; Up and the Key stood over the card's edge; the
 * card read "Acts…", a block of problems, a link, Filter, Arrange and Find,
 * an author's "derived from the declaration · Keep as a lens", and then two
 * of its three rules; and "+3 MORE" under it said nothing of what it was.
 *
 * This goes into every district of the todo example, the discography and
 * the rota on a Pixel 7 (Chromium) and an iPhone 13 (WebKit), and asks:
 *
 *   aDistrictGoneIntoOnAPhoneNamesWhereYouAre — the bar's place names the
 *   district (or the picture it draws), never "Everything", and Up is there;
 *   itsRecordsComeBeforeItsTools — in a district the framework derives, no
 *   Filter, Arrange, Find or "Acts…" stands above its first record;
 *   everyRecordItCountsIsReachable — every record its count says is a row,
 *   the last one reached by scrolling the card, and the card says how many
 *   stand below its foot when any do;
 *   noAuthorWordsReachAReader — no "derived from the declaration" and no
 *   "Keep as a lens" on a phone, nor at a desk for a seat that may not
 *   change the app (Things' member);
 *   aDistrictCardIsNoTallerThanWhatItHolds — a district's card on a phone
 *   ends under its last row, up to the room it has, and scrolls inside only
 *   past that;
 *   itsHeadingIsRingedOnlyForTheKeyboard — the heading holds the keyboard
 *   as it opens, with no ring after a tap or an address, and the ring is
 *   drawn once a key is pressed there;
 *   nothingOverlapsTheCard — Up and the Key stand clear of the card, the
 *   card takes the phone's width with even gutters, and the card for the
 *   other districts says what it is ("3 more districts").
 *
 *   node scripts/verify-drive-in.mjs [--engine=chromium|webkit] [--shots=<dir>]
 *
 * Writes docs/drive-in.json; the screenshots go to --shots, else
 * .generated/drive-in.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { devices } from "playwright";
import { arriveWithoutWebfonts, launchEngine } from "./lib/engine.mjs";
import { portFor } from "./lib/ports.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.find((arg) => arg.startsWith("--engine="))?.slice("--engine=".length);
const engines = asked ? [asked] : ["chromium", "webkit"];
const PHONES = { chromium: "Pixel 7", webkit: "iPhone 13" };
const SHOTS = resolve(process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length) ?? resolve(repoRoot, ".generated/drive-in"));
const DESK = { width: 1440, height: 900 };
/** Every district of each example; the ones drawn by a declared picture are named by it. */
const APPS = [
  { app: "todo", kinds: ["list", "task", "rule", "reason"], member: "user-sam" },
  { app: "discography", kinds: ["album", "song", "era"] },
  { app: "rota", kinds: ["shift", "volunteer", "location", "rule"] },
];
const AUTHOR = /derived from the declaration|keep as a lens/i;

/** At rest: the ground says nothing moves, and the cards stand where they stood a moment ago. */
async function settled(page) {
  await page.waitForSelector(".graview-ground[data-graview-settled]", { timeout: 60_000 });
  const where = () => page.evaluate(() => [...document.querySelectorAll(".graview-ground [data-graview-view]")].map((card) => card.getBoundingClientRect()).map((box) => `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`).join(" "));
  let last = await where();
  let still = 0;
  for (let i = 0; i < 30 && still < 2; i += 1) {
    await page.waitForTimeout(400);
    const now = await where();
    still = now === last ? still + 1 : 0;
    last = now;
  }
}

/** What a district gone into shows a phone, measured in the page. */
const measure = ({ kind, author }) => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) } : null;
  };
  const card = document.querySelector(`[data-graview-view="aggregate:${kind}"]`);
  const stop = card?.querySelector('[data-testid="kind-stop"]') ?? null;
  // What scrolls: on a phone the stop's content, inside it.
  const scroller = stop?.querySelector('[data-testid="kind-stop-scroll"]') ?? stop;
  const meets = (a, b) => Boolean(a && b) && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const cardBox = box(card);
  const up = box(document.querySelector('[data-testid="overview"]'));
  const key = box(document.querySelector('[data-testid="lines-key"]'));
  const scene = box(document.querySelector(".graview-ground"));
  const firstRow = stop?.querySelector('[data-testid="kind-stop-table"] tbody tr[data-graview-pick]');
  // A tool a reader sees: Filter, Arrange, Find, "Acts…", the shape's switch.
  const tools = stop ? [...stop.querySelectorAll('[data-testid="kind-arrange"], [data-testid="kind-stop-acts"], [data-testid="kind-stop-shape"]')].map(box).filter(Boolean) : [];
  const counted = Number((stop?.querySelector('[data-testid="kind-stop-count"]')?.textContent ?? "").match(/^\d+/)?.[0] ?? NaN);
  const beyond = document.querySelector('[data-testid="beyond-more"]');
  return {
    here: document.querySelector('[data-testid="app-place-current"]')?.textContent?.trim() ?? null,
    upSays: document.querySelector('[data-testid="overview"]')?.getAttribute("aria-label") ?? null,
    upSeen: Boolean(up && scene && up.top >= scene.top && up.right <= innerWidth),
    width: innerWidth,
    card: cardBox,
    up,
    key,
    overlaps: [meets(up, cardBox) ? "Up" : "", meets(key, cardBox) ? "Key" : ""].filter(Boolean),
    gutters: cardBox ? [cardBox.left, innerWidth - cardBox.right] : null,
    stop: Boolean(stop),
    firstRow: box(firstRow),
    toolsAbove: firstRow ? tools.filter((tool) => tool.top < firstRow.getBoundingClientRect().top).length : tools.length,
    counted: Number.isFinite(counted) ? counted : null,
    rows: stop ? stop.querySelectorAll('[data-testid="kind-stop-table"] tbody tr[data-graview-pick]').length : null,
    paged: Boolean(stop?.querySelector('[data-testid="kind-stop-more"]')),
    below: stop?.querySelector('[data-testid="kind-stop-below"]')?.textContent?.trim() ?? null,
    belowCount: Number(stop?.querySelector('[data-testid="kind-stop-below"]')?.getAttribute("data-graview-below") ?? 0),
    // Rows that start below what the card shows (in its last 24 pixels, a name is cut): what "N more below" must count.
    unseen: stop ? [...stop.querySelectorAll('[data-testid="kind-stop-table"] tbody tr[data-graview-pick]')].filter((row) => row.getBoundingClientRect().top > scroller.getBoundingClientRect().bottom - 24).length : 0,
    beyond: beyond?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    // What the stop's box holds: from its foot to the foot of the last thing in it, and the room its card gives it.
    fit: stop
      ? (() => {
          const own = stop.getBoundingClientRect();
          const last = [...(scroller ?? stop).children].filter((child) => child.tagName !== "STYLE" && child.getBoundingClientRect().height > 0).at(-1);
          const end = Math.max(last ? last.getBoundingClientRect().bottom : own.top, stop.querySelector('[data-testid="kind-stop-below"]')?.getBoundingClientRect().bottom ?? 0);
          return { height: Math.round(own.height), room: Math.round(card.getBoundingClientRect().height), slack: Math.round(own.bottom - end), scrolls: scroller.scrollHeight > scroller.clientHeight + 1 };
        })()
      : null,
    ring: (() => {
      const heading = stop?.querySelector('[data-testid="kind-stop-title"]');
      if (!heading) return null;
      const style = getComputedStyle(heading);
      return { focused: document.activeElement === heading, drawn: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 };
    })(),
    author: new RegExp(author, "i").test(document.body.innerText),
  };
};

/** The last row reached: the card scrolled to its foot, the row inside what the card shows. */
const lastRowReached = () => {
  const stop = document.querySelector('[data-graview-view^="aggregate:"] [data-testid="kind-stop"]');
  if (!stop) return null;
  const scroller = stop.querySelector('[data-testid="kind-stop-scroll"]') ?? stop;
  scroller.scrollTop = scroller.scrollHeight;
  const rows = stop.querySelectorAll('[data-testid="kind-stop-table"] tbody tr[data-graview-pick]');
  const last = rows[rows.length - 1];
  if (!last) return true;
  const card = scroller.getBoundingClientRect();
  const row = last.getBoundingClientRect();
  return row.top >= card.top - 1 && row.top + Math.min(row.height, 24) <= card.bottom + 1;
};

const report = { at: new Date().toISOString(), engines, shots: SHOTS, districts: [], desk: [], checks: {} };
const errors = [];
const servers = [];
let browser;
mkdirSync(SHOTS, { recursive: true });
try {
  for (const { app } of APPS) servers.push(await serving(app, portFor(app), repoRoot));
  const url = (app) => servers[APPS.findIndex((one) => one.app === app)].url;
  for (const engine of engines) {
    browser = await launchEngine(engine);
    const device = PHONES[engine];
    for (const { app, kinds } of APPS) {
      for (const kind of kinds) {
        const context = await browser.newContext({ ...devices[device] });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${engine} ${app} ${kind}: ${error.message}`));
        try {
          await arriveWithoutWebfonts(page, `${url(app)}/places/overview#focus=${encodeURIComponent(`aggregate:${kind}`)}`);
          await settled(page);
          await page.waitForTimeout(400);
          const measured = await page.evaluate(measure, { kind, author: AUTHOR.source });
          const shot = resolve(SHOTS, `${app}-${kind}-${engine}.png`);
          await page.screenshot({ path: shot });
          // A key pressed on the heading: the reader is on the keyboard now, and the ring is drawn.
          let keyed = null;
          if (measured.ring?.focused) {
            await page.keyboard.press("Shift");
            keyed = await page.evaluate(() => {
              const heading = document.querySelector('[data-testid="kind-stop-title"]');
              const style = heading ? getComputedStyle(heading) : null;
              return Boolean(style && style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0);
            });
          }
          const reached = measured.stop ? await page.evaluate(lastRowReached) : null;
          report.districts.push({ engine, device, app, kind, ...measured, keyed, reached, shot });
          process.stdout.write(`${engine.padEnd(8)} ${app.padEnd(11)} ${kind.padEnd(9)} here=${measured.here} rows=${measured.rows ?? "-"}/${measured.counted ?? "-"} over=${measured.overlaps.join(",") || "none"}\n`);
        } catch (error) {
          report.districts.push({ engine, device, app, kind, error: String(error?.message ?? error).split("\n")[0] });
        }
        await context.close();
      }
    }
    await browser.close();
    browser = undefined;
  }

  /* A DESK, as Things' member and its keeper: the declaration is told to the seat that may change the app only. */
  browser = await launchEngine("chromium");
  for (const as of ["user-sam", "user-nora"]) {
    const context = await browser.newContext({ viewport: DESK });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`desk ${as}: ${error.message}`));
    await arriveWithoutWebfonts(page, `${url("todo")}/places/overview?as=${as}#focus=${encodeURIComponent("aggregate:rule")}`);
    await settled(page);
    await page.waitForSelector('[data-testid="kind-stop"]', { timeout: 15_000 });
    report.desk.push({ as, author: await page.evaluate((source) => new RegExp(source, "i").test(document.body.innerText), AUTHOR.source) });
    await context.close();
  }
  await browser.close();
  browser = undefined;

  const all = report.districts;
  const ran = all.length > 0 && all.every((one) => !one.error);
  const stops = all.filter((one) => one.stop);
  report.checks.aDistrictGoneIntoOnAPhoneNamesWhereYouAre = {
    ok: ran && all.every((one) => one.here && one.here !== "Everything" && one.upSays === "Up" && one.upSeen),
    held: all.map(({ engine, app, kind, here, upSays, upSeen, error }) => ({ engine, app, kind, here, upSays, upSeen, ...(error ? { error } : {}) })),
  };
  report.checks.itsRecordsComeBeforeItsTools = {
    ok: ran && stops.length > 0 && stops.every((one) => one.firstRow !== null && one.toolsAbove === 0),
    held: stops.map(({ engine, app, kind, firstRow, toolsAbove }) => ({ engine, app, kind, firstRow, toolsAbove })),
  };
  report.checks.everyRecordItCountsIsReachable = {
    ok: ran && stops.length > 0 && stops.every((one) => (one.rows === one.counted || (one.paged && one.rows > 0)) && one.reached === true && one.belowCount === one.unseen),
    held: stops.map(({ engine, app, kind, counted, rows, paged, reached, unseen, below }) => ({ engine, app, kind, counted, rows, paged, reached, unseen, below })),
  };
  report.checks.aDistrictCardIsNoTallerThanWhatItHolds = {
    ok: ran && stops.length > 0 && stops.every((one) => one.fit && one.fit.height <= one.fit.room + 1 && (one.fit.scrolls ? one.fit.height >= one.fit.room - 2 : one.fit.slack <= 24)),
    held: stops.map(({ engine, app, kind, fit }) => ({ engine, app, kind, ...fit })),
  };
  report.checks.itsHeadingIsRingedOnlyForTheKeyboard = {
    ok: ran && stops.length > 0 && stops.every((one) => one.ring?.focused === true && one.ring.drawn === false && one.keyed === true),
    held: stops.map(({ engine, app, kind, ring, keyed }) => ({ engine, app, kind, ...ring, keyed })),
  };
  report.checks.noAuthorWordsReachAReader = {
    ok: ran && all.every((one) => one.author === false) && report.desk.find((one) => one.as === "user-sam")?.author === false && report.desk.find((one) => one.as === "user-nora")?.author === true,
    held: { phones: all.filter((one) => one.author !== false).map(({ engine, app, kind }) => `${engine} ${app} ${kind}`), desk: report.desk },
  };
  report.checks.nothingOverlapsTheCard = {
    ok:
      ran &&
      all.every((one) => one.card && one.overlaps.length === 0 && Math.abs(one.gutters[0] - one.gutters[1]) <= 3 && one.card.right - one.card.left >= one.width - 2 * 40 && (one.beyond === null || /^\d+ (more|other) districts?\b/.test(one.beyond))),
    held: all.map(({ engine, app, kind, card, up, key, overlaps, gutters, beyond }) => ({ engine, app, kind, card, up, key, overlaps, gutters, beyond })),
  };
  report.checks.noPageThrew = { ok: errors.length === 0, errors };
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.passed = false;
} finally {
  await browser?.close();
  for (const server of servers) server.stop();
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/drive-in.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, check] of Object.entries(report.checks)) process.stdout.write(`${check.ok ? "ok  " : "FAIL"} ${name}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write(`wrote docs/drive-in.json; screenshots in ${SHOTS}\n`);
process.exit(report.passed ? 0 : 1);
