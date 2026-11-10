#!/usr/bin/env node
/**
 * A PAGE STEPS BACK OVER THE CITY, AND COMES IN AGAIN AS IT WAS
 * (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * Nick: "almost like a slider … from viewing this page, into viewing the
 * page, but I just backed up 20 steps and a few to the left, and now I can
 * see the cityscape of data behind the page, with some lightweight
 * connected pipe/line things that show where on the page it's related to
 * connected datas."
 *
 * On the todo example and the garden (seedbed), at a desk and on a phone,
 * this asks:
 *
 *   everyRoutedPageHasTheControl — the home, a list, a record, the map and
 *   the problems each have the bar's step-back control, a toggle that says
 *   whether it is pressed;
 *   theKeyboardReachesTheControl — Tab from the top of the page reaches it;
 *   outThePageStandsAngledInFrontOfTheCity — pressed, the page is the same
 *   page, about half its size, up and to the left, turned in perspective (a
 *   3D transform, less on a phone), in front of the city, its title still in
 *   the window and drawn big enough to read;
 *   theCityFillsTheGroundBehindThePage — the city's layer is the whole
 *   region under the bar, under the page, its districts and buildings drawn,
 *   and most of its buildings are not under the page;
 *   linesRunFromThePageToTheRecordsItShows — on a record's page, a line from
 *   the title to the record's own building and one from each part of the
 *   page that links to a record to that record's building, every one ending
 *   on a lit roof — named by the record and its links;
 *   backInTheScrollTheKeyboardAndTheAddressAreKept — scrolled down and on a
 *   link, stepped back and in again by Escape: the same scroll, the keyboard
 *   on the same link, the same address; pressed twice by the keyboard, the
 *   keyboard is still on the control;
 *   outThePageShowsExactlyWhatWasOnScreen — scrolled down and stepped back,
 *   each part of the page stands where it stood in the window, at the
 *   sheet's scale: nothing moved by the bar's height;
 *   theKeyboardReachesTheCitysRecords — out, Tab from the control reaches a
 *   record a line runs to, named for it, and Enter opens its page, in, with
 *   the keyboard on the new page;
 *   escapeFromTheCityLeavesTheKeyboardOnTheControl — Escape pressed on a way
 *   into the city brings the page in with the keyboard on the control;
 *   lessMotionSkipsTheTravel — with reduced motion asked for, the page is at
 *   its end state in the frame after the press, with no transition.
 *
 *   node scripts/verify-step-back.mjs [--engine=chromium|webkit|firefox] [--quick] [--shots=<dir>]
 *
 * Writes docs/step-back.json; screenshots of each state go to --shots, else
 * .generated/step-back.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { at, portFor } from "./lib/ports.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const QUICK = process.argv.includes("--quick");
const SHOTS = resolve(process.argv.find((arg) => arg.startsWith("--shots="))?.slice("--shots=".length) ?? resolve(repoRoot, ".generated/step-back"));
const DESK = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** Each example: its routed pages, and a record whose page links to others. */
const APPS = [
  { app: "todo", query: "?today=2026-09-01", pages: ["/pages", "/pages/tasks", "/pages/tasks/t-deposit", "/pages/map", "/pages/problems"], record: "/pages/tasks/t-deposit" },
  { app: "seedbed", query: "?chapter=9", pages: ["/pages", "/pages/plantings", "/pages/gardeners/june", "/pages/map", "/pages/problems"], record: "/pages/gardeners/june" },
];

const report = { at: new Date().toISOString(), engine: ENGINE, claims: {} };
const claim = (name, ok, detail) => {
  const held = report.claims[name];
  // A claim asked of several pages holds only if it held on each.
  report.claims[name] = { ok: Boolean(ok) && (held ? held.ok : true), detail: held ? [...[held.detail].flat(), detail] : detail };
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — ${JSON.stringify(detail).slice(0, 600)}`}\n`);
};

/** The page drawn: its title is there and the control with it. */
async function arrive(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForSelector('[data-testid="step-back"]', { timeout: 60_000 });
  await page.waitForSelector("[data-graview-page-title], main h1, main h2", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

const phaseOf = (page) => page.evaluate(() => document.querySelector("[data-graview-step-back]")?.getAttribute("data-graview-step-back") ?? null);

async function steppedBack(page) {
  await page.waitForSelector('[data-graview-step-back="out"]', { timeout: 10_000 });
  await page.waitForSelector('[data-testid="city-lines"][data-graview-settled]', { timeout: 15_000 });
}

async function steppedIn(page) {
  await page.waitForSelector('[data-graview-step-back="in"]', { timeout: 10_000 });
  await page.waitForTimeout(100);
}

/** What the stepped-back page and the city behind it measure, in the window. */
const measureOut = () => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const width = document.documentElement.clientWidth;
  const sheet = document.querySelector("[data-graview-step-back]");
  const foot = document.querySelector("[data-graview-bar-foot]");
  const barBottom = foot ? Math.round(foot.getBoundingClientRect().top) : 0;
  const title = [...(sheet?.querySelectorAll("[data-graview-page-title], h1, h2") ?? [])].find((one) => one.getBoundingClientRect().width > 2) ?? null;
  const layer = document.querySelector('[data-testid="city-behind"]');
  const titleBox = box(title);
  const sheetBox = box(sheet);
  const layerBox = box(layer);
  const transform = sheet?.style.transform ?? "";
  const scale = Number(transform.match(/scale\(([\d.]+)\)/)?.[1] ?? NaN);
  const turn = Number(transform.match(/rotateY\(([\d.]+)deg\)/)?.[1] ?? NaN);
  const computed = sheet ? getComputedStyle(sheet).transform : "none";
  const threeD = computed !== "none" && !new DOMMatrix(computed).is2D;
  const inside = (r, b) => b && r.x >= b.x && r.x <= b.x + b.width && r.y >= b.y && r.y <= b.y + b.height;
  const buildings = [...document.querySelectorAll("[data-graview-city-record]")];
  const centers = buildings.map((one) => {
    const r = one.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const covered = centers.filter((c) => inside(c, sheetBox)).length;
  // In front: the middle of the page is the page, not the city.
  const middle = sheetBox ? document.elementFromPoint(sheetBox.x + sheetBox.width / 2, sheetBox.y + sheetBox.height / 2) : null;
  const zOf = (el) => Number(el ? getComputedStyle(el).zIndex : NaN);
  return {
    width,
    barBottom,
    sheet: sheetBox,
    scale,
    turn,
    threeD,
    seenAt: sheetBox ? sheetBox.width / width : null,
    title: titleBox,
    titleText: title?.textContent?.trim().slice(0, 60) ?? null,
    titleFont: title ? parseFloat(getComputedStyle(title).fontSize) * scale : null,
    inWindow: Boolean(titleBox && titleBox.x >= 0 && titleBox.y >= 0 && titleBox.x + titleBox.width <= innerWidth && titleBox.y + titleBox.height <= innerHeight),
    upAndLeft: Boolean(sheetBox && sheetBox.x < width * 0.1 && sheetBox.y < barBottom + innerHeight * 0.1 && sheetBox.x + sheetBox.width / 2 < width / 2),
    inFront: Boolean(middle && sheet?.contains(middle)) && zOf(sheet) > zOf(layer),
    layer: layerBox,
    layerFills: Boolean(layerBox && Math.abs(layerBox.x) <= 1 && Math.abs(layerBox.y - barBottom) <= 1 && Math.abs(layerBox.width - width) <= 1 && Math.abs(layerBox.y + layerBox.height - innerHeight) <= 2),
    kinds: document.querySelectorAll("[data-graview-city-kind]").length,
    buildings: buildings.length,
    coveredByThePage: covered,
    inert: sheet?.firstElementChild?.hasAttribute("inert") ?? false,
  };
};

/** Both claims about the page out, from one measure; a phone's turn less than a desk's. */
function claimOut(out, detail, deskTurn) {
  claim(
    "outThePageStandsAngledInFrontOfTheCity",
    out.threeD && out.turn > 4 && out.turn < 30 && (deskTurn === undefined || out.turn < deskTurn) && out.seenAt > 0.3 && out.seenAt < 0.75 && out.inWindow && out.titleFont >= 8 && out.upAndLeft && out.inFront && out.inert && (out.sheet?.y ?? 0) >= out.barBottom - 1,
    { ...detail, sheet: out.sheet, turn: out.turn, scale: out.scale, threeD: out.threeD, title: out.titleText, titleFont: out.titleFont, inWindow: out.inWindow, upAndLeft: out.upAndLeft, inFront: out.inFront },
  );
  claim(
    "theCityFillsTheGroundBehindThePage",
    out.layerFills && out.kinds > 0 && out.buildings > 0 && out.coveredByThePage <= out.buildings / 2,
    { ...detail, layer: out.layer, barBottom: out.barBottom, kinds: out.kinds, buildings: out.buildings, coveredByThePage: out.coveredByThePage },
  );
}

/** The lines drawn, and what the page links to, read independently from its hrefs. */
const measureLines = (base) => {
  const sheet = document.querySelector("[data-graview-step-back]");
  const sheetBox = sheet.getBoundingClientRect();
  const lines = [...document.querySelectorAll("[data-graview-line-to]")].map((g) => {
    const to = g.getAttribute("data-graview-line-to");
    const line = g.querySelector("line");
    const end = { x: Number(line.getAttribute("x2")), y: Number(line.getAttribute("y2")) };
    const building = document.querySelector(`[data-graview-city-record="${CSS.escape(to)}"]`);
    const r = building?.getBoundingClientRect();
    /* Where it leaves: on a part of the page that shows this record, as the page's turned plane draws that part. */
    const [fx, fy] = (g.getAttribute("data-graview-line-from") ?? "").split(",").map(Number);
    const part = g.getAttribute("data-graview-line-part");
    const showing = part === "self"
      ? [...sheet.querySelectorAll("[data-graview-page-title], h1, h2")]
      : [...sheet.querySelectorAll("[data-graview-record], a[href]")].filter((el) => el.getAttribute("data-graview-record") === to || (el.href && decodeURIComponent(new URL(el.href).pathname).endsWith(`/${to}`)));
    const onItsPart = showing.some((el) => {
      const b = el.getBoundingClientRect();
      return fx >= b.left - 3 && fx <= b.right + 3 && fy >= b.top - 3 && fy <= b.bottom + 3;
    });
    return {
      onItsPart,
      to,
      part: g.getAttribute("data-graview-line-part"),
      name: building?.querySelector("title")?.textContent ?? null,
      endsOnItsBuilding: Boolean(r && end.x >= r.left - 1 && end.x <= r.right + 1 && end.y >= r.top - 1 && end.y <= r.bottom + 1),
      lit: building?.hasAttribute("data-graview-lit") ?? false,
    };
  });
  // Every record the page's visible parts link to, by its address alone.
  const linked = new Set();
  for (const a of sheet.querySelectorAll("a[href]")) {
    const r = a.getBoundingClientRect();
    if (r.width === 0 || r.bottom < sheetBox.top || r.top > sheetBox.bottom) continue;
    const path = new URL(a.href).pathname;
    const rest = path.startsWith(base) ? path.slice(base.length) : null;
    const parts = rest?.split("/").filter(Boolean) ?? [];
    if (parts.length === 2 && document.querySelector(`[data-graview-city-record="${CSS.escape(decodeURIComponent(parts[1]))}"]`)) linked.add(decodeURIComponent(parts[1]));
  }
  for (const row of sheet.querySelectorAll("[data-graview-record]")) linked.add(row.getAttribute("data-graview-record"));
  return { lines, linked: [...linked], said: document.querySelector('[data-testid="city-lines-said"]')?.textContent ?? null };
};

let browser;
let deskTurn;
const servers = [];
mkdirSync(SHOTS, { recursive: true });
try {
  browser = await launchEngine(ENGINE);
  for (const { app, query, pages, record } of APPS) {
    servers.push(await serving(app, portFor(app), repoRoot));
    const origin = at(app);
    const desk = await browser.newPage({ viewport: DESK, colorScheme: "light" });

    /* EVERY ROUTED PAGE: the control is there, a toggle; pressed, the page steps back over the city; pressed again, it is in. */
    for (const path of QUICK ? [pages[0], record] : pages) {
      await arrive(desk, `${origin}${path}${query}`);
      const control = await desk.evaluate(() => {
        const button = document.querySelector('[data-testid="step-back"]');
        const r = button?.getBoundingClientRect();
        return button ? { pressed: button.getAttribute("aria-pressed"), name: button.getAttribute("aria-label"), width: Math.round(r.width), height: Math.round(r.height) } : null;
      });
      claim("everyRoutedPageHasTheControl", control?.pressed === "false" && /step back/i.test(control.name ?? "") && control.width >= 24 && control.height >= 24, { app, path, control });
      await desk.click('[data-testid="step-back"]');
      await steppedBack(desk);
      const out = await desk.evaluate(measureOut);
      claimOut(out, { app, path });
      deskTurn = out.turn;
      if (path === record) await desk.screenshot({ path: resolve(SHOTS, `${app}-record-out-${ENGINE}.png`) });
      await desk.click('[data-testid="step-back"]');
      await steppedIn(desk);
      if (path === record) await desk.screenshot({ path: resolve(SHOTS, `${app}-record-in-${ENGINE}.png`) });
    }

    /* THE KEYBOARD REACHES THE CONTROL: Tab from the top of the page. */
    await arrive(desk, `${origin}${record}${query}`);
    await desk.evaluate(() => {
      document.activeElement?.blur?.();
      window.scrollTo(0, 0);
    });
    let reached = -1;
    for (let presses = 1; presses <= 40; presses += 1) {
      await desk.keyboard.press("Tab");
      if (await desk.evaluate(() => document.activeElement?.getAttribute("data-testid") === "step-back")) {
        reached = presses;
        break;
      }
    }
    claim("theKeyboardReachesTheControl", reached > 0, { app, path: record, presses: reached });

    /* LINES: pressed by the keyboard, out on the record's page, and in again by the keyboard — which stays on the control. */
    if (reached > 0) {
      await desk.keyboard.press("Enter");
      await steppedBack(desk);
      const base = new URL(desk.url()).pathname.startsWith("/pages") ? "/pages" : "";
      const drawn = await desk.evaluate(measureLines, base);
      const self = drawn.lines.find((line) => line.part === "self");
      const others = drawn.lines.filter((line) => line.part !== "self");
      const to = new Set(drawn.lines.map((line) => line.to));
      claim(
        "linesRunFromThePageToTheRecordsItShows",
        Boolean(self) && others.length > 0 && drawn.linked.every((id) => to.has(id)) && drawn.lines.every((line) => line.endsOnItsBuilding && line.lit && line.onItsPart) && /Lines run from this page to/.test(drawn.said ?? ""),
        { app, record: self ? `${self.name} (${self.to})` : null, links: others.map((line) => `${line.name} (${line.to}, ${line.part})`), linkedOnThePage: drawn.linked, missing: drawn.linked.filter((id) => !to.has(id)), said: drawn.said, astray: drawn.lines.filter((line) => !line.endsOnItsBuilding || !line.lit || !line.onItsPart) },
      );
      await desk.keyboard.press("Enter");
      await steppedIn(desk);
      const onControl = await desk.evaluate(() => document.activeElement?.getAttribute("data-testid") === "step-back");
      claim("backInTheScrollTheKeyboardAndTheAddressAreKept", onControl, { app, how: "pressed twice by the keyboard: the keyboard stays on the control", onControl });

      /* THE KEYBOARD REACHES THE CITY: out again, Tab on from the control to a record a line runs to, and Enter opens its page. */
      await desk.keyboard.press("Enter");
      await steppedBack(desk);
      const targets = await desk.evaluate(() => [...document.querySelectorAll("[data-graview-line-to]")].map((g) => g.getAttribute("data-graview-line-to")));
      let stop = null;
      for (let presses = 1; presses <= 30 && !stop; presses += 1) {
        await desk.keyboard.press("Tab");
        stop = await desk.evaluate(() => {
          const at = document.activeElement?.closest("[data-graview-city-record]");
          return at ? { id: at.getAttribute("data-graview-city-record"), name: at.getAttribute("aria-label"), lit: at.hasAttribute("data-graview-lit") } : null;
        });
        if (stop) stop.presses = presses;
      }
      let opened = null;
      if (stop) {
        /* Escape from a way into the city: the page comes in, and the keyboard waits on the control, not on nothing. */
        await desk.keyboard.press("Escape");
        await steppedIn(desk);
        const escaped = await desk.evaluate(() => ({
          phase: document.querySelector("[data-graview-step-back]")?.getAttribute("data-graview-step-back"),
          keyboard: document.activeElement === document.body ? "body" : (document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? null),
        }));
        claim("escapeFromTheCityLeavesTheKeyboardOnTheControl", escaped.phase === "in" && escaped.keyboard === "step-back", { app, record, from: stop.id, ...escaped });
        /* And out again, Tab on to the same way in, for Enter. */
        await desk.keyboard.press("Enter");
        await steppedBack(desk);
        let again = null;
        for (let presses = 1; presses <= 30 && again !== stop.id; presses += 1) {
          await desk.keyboard.press("Tab");
          again = await desk.evaluate(() => document.activeElement?.closest("[data-graview-city-record]")?.getAttribute("data-graview-city-record") ?? null);
        }
        await desk.keyboard.press("Enter");
        await steppedIn(desk);
        await desk.waitForTimeout(300);
        opened = await desk.evaluate(() => ({
          path: decodeURIComponent(location.pathname),
          phase: document.querySelector("[data-graview-step-back]")?.getAttribute("data-graview-step-back"),
          keyboard: document.activeElement === document.body ? "body" : (document.activeElement?.tagName ?? null),
        }));
      }
      claim(
        "theKeyboardReachesTheCitysRecords",
        Boolean(stop && stop.lit && targets.includes(stop.id) && /^Open \S/.test(stop.name ?? "") && opened && opened.path.endsWith(`/${stop.id}`) && opened.phase === "in" && opened.keyboard !== "body"),
        { app, record, stop, lines: targets, opened },
      );
    }

    /* BACK IN AS IT WAS: scrolled, the keyboard on a link of the page, out and in by Escape — in a window short enough that the page scrolls. */
    await desk.setViewportSize({ width: DESK.width, height: 560 });
    await arrive(desk, `${origin}${record}${query}`);
    const before = await desk.evaluate(() => {
      document.documentElement.style.minHeight = "";
      const room = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo(0, Math.min(240, Math.max(0, room)));
      const links = [...document.querySelectorAll("[data-graview-step-back] a[href]")].filter((a) => {
        const r = a.getBoundingClientRect();
        return r.width > 0 && r.top > 80 && r.bottom < innerHeight;
      });
      const link = links[0];
      link?.setAttribute("data-step-back-probe", "");
      link?.focus({ preventScroll: true });
      const at = link?.getBoundingClientRect();
      return { scrollY: Math.round(scrollY), address: location.href, focused: link ? link.textContent.trim().slice(0, 40) : null, probe: at ? { x: at.left, y: at.top } : null };
    });
    await desk.evaluate(() => document.querySelector('[data-testid="step-back"]').click());
    await steppedBack(desk);
    /* The sheet is the window as it was seen, then turned and set back as one plane: with its transform let go for a moment, each part stands where it stood. */
    const whileOut = await desk.evaluate(() => {
      const sheet = document.querySelector("[data-graview-step-back]");
      const held = sheet.style.transform;
      sheet.style.transform = "none";
      const probe = document.querySelector("[data-step-back-probe]")?.getBoundingClientRect();
      sheet.style.transform = held;
      return {
        active: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName ?? null,
        probe: probe ? { x: probe.left, y: probe.top } : null,
      };
    });
    const expected = before.probe;
    const off = expected && whileOut.probe ? Math.max(Math.abs(expected.x - whileOut.probe.x), Math.abs(expected.y - whileOut.probe.y)) : null;
    claim(
      "outThePageShowsExactlyWhatWasOnScreen",
      before.scrollY > 0 && off !== null && off <= 2,
      { app, path: record, scrolledBy: before.scrollY, probeBefore: before.probe, probeOut: whileOut.probe, expected, off },
    );
    await desk.keyboard.press("Escape");
    await steppedIn(desk);
    const after = await desk.evaluate(() => ({ scrollY: Math.round(scrollY), address: location.href, onTheLink: document.activeElement?.hasAttribute("data-step-back-probe") ?? false }));
    claim(
      "backInTheScrollTheKeyboardAndTheAddressAreKept",
      before.focused !== null && whileOut.active === "step-back" && Math.abs(after.scrollY - before.scrollY) <= 1 && after.address === before.address && after.onTheLink,
      { app, how: "scrolled, on a link, out and in by Escape", before, whileOut, after },
    );
    await desk.setViewportSize(DESK);
    await desk.close();

    /* LESS MOTION: the end state in the frame after the press, no transition. */
    const still = await browser.newContext({ viewport: DESK, reducedMotion: "reduce" });
    const calm = await still.newPage();
    await arrive(calm, `${origin}${record}${query}`);
    await calm.evaluate(() => {
      window.__phases = [];
      const sheet = document.querySelector("[data-graview-step-back]");
      new MutationObserver(() => window.__phases.push(sheet.getAttribute("data-graview-step-back"))).observe(sheet, { attributes: true, attributeFilter: ["data-graview-step-back"] });
    });
    await calm.click('[data-testid="step-back"]');
    const next = await calm.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => {
            const sheet = document.querySelector("[data-graview-step-back]");
            done({ phase: sheet.getAttribute("data-graview-step-back"), transition: getComputedStyle(sheet).transitionDuration, transform: getComputedStyle(sheet).transform });
          }),
        ),
    );
    await calm.click('[data-testid="step-back"]');
    const back = await calm.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(document.querySelector("[data-graview-step-back]").getAttribute("data-graview-step-back")))));
    const phases = await calm.evaluate(() => window.__phases);
    claim(
      "lessMotionSkipsTheTravel",
      next.phase === "out" && /^0s(, 0s)*$/.test(next.transition) && next.transform !== "none" && back === "in" && !phases.includes("leaving") && !phases.includes("returning"),
      { app, next, back, phases },
    );
    await still.close();

    /* A PHONE: the same, the city under the page. */
    const phoneContext = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: ENGINE !== "firefox", hasTouch: true });
    const phone = await phoneContext.newPage();
    await arrive(phone, `${origin}${record}${query}`);
    await phone.click('[data-testid="step-back"]');
    await steppedBack(phone);
    const small = await phone.evaluate(measureOut);
    claimOut(small, { app, path: record, phone: true }, deskTurn);
    await phone.screenshot({ path: resolve(SHOTS, `${app}-record-out-phone-${ENGINE}.png`) });
    await phone.click('[data-testid="step-back"]');
    await steppedIn(phone);
    await phone.screenshot({ path: resolve(SHOTS, `${app}-record-in-phone-${ENGINE}.png`) });
    await phoneContext.close();
  }
} catch (error) {
  report.error = String(error?.stack ?? error);
} finally {
  await browser?.close();
  for (const server of servers) server.stop();
}

report.shots = SHOTS.startsWith(repoRoot) ? SHOTS.slice(repoRoot.length + 1) : "elsewhere";
report.passed = !report.error && Object.keys(report.claims).length > 0 && Object.values(report.claims).every((one) => one.ok);
mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/step-back.json"), `${JSON.stringify(report, null, 2)}\n`);
if (report.error) process.stdout.write(`${report.error}\n`);
process.stdout.write("wrote docs/step-back.json\n");
process.exit(report.passed ? 0 : 1);
