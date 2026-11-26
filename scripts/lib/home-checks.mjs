/**
 * GRAVIEW.DEV'S HOME, HELD TO WHAT IT PROMISES.
 *
 * The home is one canvas (docs/site/home.js): an app screen an agent drew, a
 * hole through it, and the map of the records behind it, gone down into a
 * scene at a time as the page scrolls. These are its claims, run by
 * scripts/verify-site.mjs in its own report:
 *
 * - the story is told in three engines at a phone's width and a desk's, its
 *   six captions in the page whether the engine drew the map or the plain
 *   page (an engine with no WebGL gets the plain page, and that is said; but
 *   Chromium has WebGL here, so in Chromium the map must be drawn);
 * - no page reaches another site while it runs, the live frames included;
 * - the story's place is the scroll's, exactly, on the frame that drew it;
 * - the opening hole is two thirds of the prototype's (13% of the short side
 *   on a desk, 13.5% on a phone);
 * - a block on the map is hovered (a pointer, its name) and pressed (its
 *   card, its ties, which select in turn), and Escape lets go with the
 *   keyboard kept;
 * - a press through the hole at the opening takes the reader to the scene
 *   that fits: a module with no doc to "what is wrong";
 * - the keyboard selects any record from the list, and the card is said;
 * - without WebGL, without script, and with forced colors, the same words
 *   read as a page; with reduced motion the page is calm and settles;
 * - the map stops drawing once nothing changes;
 * - frame times at real speed, on a desk and on a phone's CPU throttled four
 *   times, across every scene with a hover and a press, recorded (the GPU is
 *   whatever the runner has, often software, so they are reported, not
 *   judged).
 */
import { launchEngine } from "./engine.mjs";

const WIDTHS = [{ width: 390, height: 844, phone: true }, { width: 1440, height: 900, phone: false }];
const drawnOrPlain = (page) =>
  page.waitForFunction(() => document.documentElement.classList.contains("drawn") || !document.documentElement.classList.contains("gl"), null, { timeout: 25_000 }).catch(() => {});
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const state = (page) => page.evaluate(() => (window.__home ? window.__home.state() : null));
const CAPTIONS = 6;

/** The six captions are in the page, each with its words, and so is the prompt. */
const storyInPage = (page) =>
  page.evaluate((n) => {
    const caps = [...document.querySelectorAll(".scenes .cap h2")].map((h) => h.textContent.trim()).filter((t) => t.length > 20);
    const prompt = (document.getElementById("prompt")?.textContent ?? "").includes("start.md");
    const dots = [...document.querySelectorAll("#dots button")].every((b) => /^Scene \d of 7: ./.test(b.getAttribute("aria-label") ?? ""));
    return caps.length === n && prompt && dots;
  }, CAPTIONS);

/** Every caption laid out and opaque: the plain page, read whole. */
const storyShown = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".scenes .cap")].every((cap) => {
      const box = cap.getBoundingClientRect();
      return box.height > 30 && getComputedStyle(cap).opacity === "1" && getComputedStyle(cap).position !== "absolute";
    }) && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );

export async function homeInEngines(report, pageAt) {
  const engines = {};
  for (const engine of ["chromium", "firefox", "webkit"]) {
    let browser;
    try {
      browser = await launchEngine(engine, { headless: true });
    } catch (error) {
      engines[engine] = { error: String(error).slice(0, 120) };
      continue;
    }
    for (const { width, height, phone } of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: phone });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
      await page.goto(pageAt("index.html"), { waitUntil: "load" });
      await drawnOrPlain(page);
      const drawn = await page.evaluate(() => document.documentElement.classList.contains("drawn"));
      const seen = [];
      if (drawn) {
        const span = await page.evaluate(() => document.getElementById("track").offsetHeight - document.getElementById("gl").clientHeight);
        for (let beat = 0; beat <= 6; beat++) {
          await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), Math.round((span * beat) / 6));
          await frame(page);
          seen.push(await page.evaluate(() => document.querySelector(".cap.on")?.getAttribute("data-beat") ?? "sheet"));
        }
      }
      const ok =
        (await storyInPage(page)) &&
        (drawn ? seen.join(",") === "sheet,1,2,3,4,5,6" : await storyShown(page)) &&
        (await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)) &&
        errors.length === 0 &&
        (engine !== "chromium" || drawn);
      engines[`${engine}/${width}`] = { drawn, seen, errors, ok };
      await page.close();
    }
    await browser.close();
  }
  report.home = { ...(report.home ?? {}), engines };
  report.criteria.theHomeTellsItsStoryInThreeEnginesAtPhoneAndDeskWidths = Object.values(engines).every((e) => e.ok);
}

export async function homeMap(report, browser, pageAt) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(pageAt("index.html"), { waitUntil: "load" });
  await drawnOrPlain(page);
  if (!(await page.evaluate(() => document.documentElement.classList.contains("drawn")))) {
    /* This engine has WebGL; a map that is not drawn here is a fault, and every claim of it fails. */
    report.home = { ...(report.home ?? {}), map: "the map was not drawn" };
    for (const claim of ["theStoryFollowsTheScrollExactly", "theOpeningHoleIsTwoThirdsOfThePrototypes", "aRecordIsHoveredAndPressedOnTheMap", "aPressThroughTheHoleTakesTheReaderToTheSceneThatFits", "theKeyboardSelectsARecordFromTheList", "theMapStopsDrawingWhenNothingChanges"]) report.criteria[claim] = false;
    await page.close();
    return;
  }
  const said = {};
  /* Two thirds of the prototype's .19 on a desk and .2 on a phone, measured at each. */
  said.hole = { desk: (await state(page)).hole };
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await phone.goto(pageAt("index.html"), { waitUntil: "load" });
  await drawnOrPlain(phone);
  await frame(phone);
  said.hole.phone = (await state(phone))?.hole ?? 0;
  await phone.close();
  report.criteria.theOpeningHoleIsTwoThirdsOfThePrototypes = Math.abs(said.hole.desk - 0.19 * 2 / 3) < 0.01 && Math.abs(said.hole.phone - 0.2 * 2 / 3) < 0.01;

  /* The page's own scrolling, read on the frame it drew. */
  const follows = [];
  for (const dy of [333, 517, 1201, -640]) {
    await page.mouse.wheel(0, dy);
    await frame(page);
    /* The t the frame drew with against the scroll it read on that frame, and that scroll against the page's now. */
    const s = await state(page);
    const now = await page.evaluate(() => window.scrollY);
    const drew = s.drew;
    follows.push(drew ? Math.abs(drew.t - Math.min(1, Math.max(0, drew.scrollY / drew.span)) * 6) + Math.abs(drew.scrollY - now) : Infinity);
  }
  said.follow = follows;
  report.criteria.theStoryFollowsTheScrollExactly = follows.every((d) => d < 1e-9);

  /* At the opening, the hole over a module with no doc, and a press through it. */
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await frame(page);
  await page.waitForTimeout(300);
  const search = await page.evaluate(() => window.__home.screenOf("modules:0"));
  await page.mouse.move(search.x, search.y, { steps: 8 });
  await page.waitForTimeout(700);
  await page.mouse.click(search.x, search.y);
  await page.waitForFunction(() => Math.abs(window.__home.state().t - 2) < 0.01, null, { timeout: 6_000 }).catch(() => {});
  const peek = await state(page);
  said.peek = { t: peek.t, picked: peek.picked };
  report.criteria.aPressThroughTheHoleTakesTheReaderToTheSceneThatFits =
    Math.abs(peek.t - 2) < 0.01 && peek.picked === "modules:0" && (await page.evaluate(() => !document.getElementById("card").hidden && document.getElementById("card-name").textContent === "packages/search"));

  /* In a scene: hover, press, a tie, Escape. */
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__home.at(4));
  await page.waitForTimeout(400);
  const telemetry = await page.evaluate(() => window.__home.screenOf("modules:5"));
  await page.mouse.move(telemetry.x, telemetry.y, { steps: 5 });
  await page.waitForTimeout(400);
  const hover = await state(page);
  await page.mouse.click(telemetry.x, telemetry.y);
  await page.waitForTimeout(300);
  const card = await page.evaluate(() => ({ picked: window.__home.state().picked, name: document.getElementById("card-name").textContent, ties: document.querySelectorAll("#card-body .tie").length, said: document.getElementById("record-said").textContent }));
  await page.click("#card-body .tie >> nth=0");
  const tie = await page.evaluate(() => ({ picked: window.__home.state().picked, focus: document.activeElement.id }));
  await page.keyboard.press("Escape");
  const gone = await page.evaluate(() => ({ picked: window.__home.state().picked, hidden: document.getElementById("card").hidden, focus: document.activeElement.id }));
  said.select = { hover, card, tie, gone };
  report.criteria.aRecordIsHoveredAndPressedOnTheMap =
    hover.hovered === "modules:5" && hover.cursor === "pointer" &&
    card.picked === "modules:5" && card.name === "telemetry" && card.ties >= 2 && card.said.startsWith("Module telemetry selected.") &&
    tie.picked === "people:1" && tie.focus === "card-name" &&
    gone.picked === null && gone.hidden && gone.focus === "records-toggle";

  /* The keyboard: the list, a record, the card said and focused. */
  await page.focus("#records-toggle");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const keys = await page.evaluate(() => ({ picked: window.__home.state().picked, focus: document.activeElement.id, said: document.getElementById("record-said").textContent, live: document.getElementById("record-said").getAttribute("aria-live") }));
  said.keyboard = keys;
  report.criteria.theKeyboardSelectsARecordFromTheList = keys.picked === "modules:0" && keys.focus === "card-name" && keys.live === "polite" && keys.said.startsWith("Module packages/search selected.");

  /* Left alone after a scroll, it stops drawing. */
  await page.keyboard.press("Escape");
  await page.mouse.move(5, 5);
  await page.evaluate(() => window.__home.at(3));
  await page.waitForFunction(() => !window.__home.state().running, null, { timeout: 12_000 }).catch(() => {});
  report.criteria.theMapStopsDrawingWhenNothingChanges = !(await state(page)).running;
  report.home = { ...(report.home ?? {}), map: said };
  await page.close();
}

export async function homePlain(report, browser, pageAt) {
  /* No WebGL: the engine's context refused, as a machine without a GPU or with WebGL turned off refuses it. */
  const nogl = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await nogl.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(String(kind)) ? null : get.call(this, kind, ...rest); };
  });
  await nogl.goto(pageAt("index.html"), { waitUntil: "load" });
  await drawnOrPlain(nogl);
  /* Read whole, then scrolled and tabbed through: nothing of the story moves the plain page. */
  const plainWhole = !(await nogl.evaluate(() => document.documentElement.classList.contains("gl"))) && (await storyInPage(nogl)) && (await storyShown(nogl));
  await nogl.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight / 2, behavior: "instant" }));
  await frame(nogl);
  await nogl.focus('.cap[data-beat="6"] .copy');
  await nogl.waitForTimeout(400);
  const plainStill = await nogl.evaluate(() => {
    const box = document.activeElement.getBoundingClientRect();
    return (document.getElementById("story").getAttribute("style") ?? "") === "" && box.top >= 0 && box.bottom <= innerHeight && document.activeElement.classList.contains("copy");
  });
  report.criteria.theStoryReadsWholeWithoutWebGL = plainWhole && plainStill;
  await nogl.close();

  const bare = await browser.newPage({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  await bare.goto(pageAt("index.html"), { waitUntil: "load" });
  report.criteria.theStoryReadsWholeWithoutScript = await storyShown(bare);
  await bare.close();

  const forced = await browser.newPage({ viewport: { width: 1280, height: 900 }, forcedColors: "active" });
  await forced.goto(pageAt("index.html"), { waitUntil: "load" });
  report.criteria.forcedColorsReadTheStoryAsAPage = await storyShown(forced);
  await forced.close();

  const reduced = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await reduced.goto(pageAt("index.html"), { waitUntil: "load" });
  await drawnOrPlain(reduced);
  const drawn = await reduced.evaluate(() => document.documentElement.classList.contains("drawn"));
  if (drawn) await reduced.waitForFunction(() => !window.__home.state().running, null, { timeout: 4_000 }).catch(() => {});
  report.criteria.reducedMotionIsCalmAndComplete =
    (await storyInPage(reduced)) &&
    (await reduced.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior === "auto" && [...document.querySelectorAll(".cap")].every((c) => parseFloat(getComputedStyle(c).transitionDuration) < 0.05))) &&
    (!drawn || !(await state(reduced)).running);
  await reduced.close();
}

/** Frame times at real speed: the whole story scrolled with the wheel, a hover and a press, on a desk and on a phone throttled four times. */
export async function homeFrames(report, browser, pageAt) {
  const runs = {};
  for (const run of [{ name: "desk", width: 1440, height: 900, throttle: 1 }, { name: "phone-cpu-4x", width: 390, height: 844, throttle: 4, phone: true }]) {
    const context = await browser.newContext({ viewport: { width: run.width, height: run.height }, hasTouch: !!run.phone, deviceScaleFactor: run.phone ? 3 : 1 });
    const page = await context.newPage();
    await page.goto(pageAt("index.html"), { waitUntil: "load" });
    await drawnOrPlain(page);
    if (!(await page.evaluate(() => document.documentElement.classList.contains("drawn")))) { runs[run.name] = { plain: true }; await context.close(); continue; }
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: run.throttle });
    await page.evaluate(() => {
      window.__frames = []; window.__long = []; window.__homeCosts = [];
      let last = performance.now();
      const loop = (now) => { window.__frames.push(now - last); last = now; if (!window.__stopFrames) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      try { new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: "longtask", buffered: false }); } catch {}
    });
    await page.mouse.move(run.width * 0.7, run.height * 0.3, { steps: 10 });
    const span = await page.evaluate(() => document.getElementById("track").offsetHeight - document.getElementById("gl").clientHeight);
    for (let y = 0; y < span; y += 60) { await page.mouse.wheel(0, 60); await page.waitForTimeout(16); }
    const block = await page.evaluate(() => window.__home.screenOf("modules:1"));
    if (block) { await page.mouse.move(block.x, block.y, { steps: 6 }); await page.mouse.click(block.x, block.y); await page.waitForTimeout(400); }
    for (let y = span; y > 0; y -= 120) { await page.mouse.wheel(0, -120); await page.waitForTimeout(16); }
    const { frames, long, costs } = await page.evaluate(() => { window.__stopFrames = true; return { frames: window.__frames.slice(2), long: window.__long, costs: window.__homeCosts }; });
    const q = (list, f) => { const sorted = [...list].sort((a, b) => a - b); return sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))] * 10) / 10 : 0; };
    const at = (f) => q(frames, f);
    runs[run.name] = { frames: frames.length, p50: at(0.5), p95: at(0.95), max: at(1), work: { frames: costs.length, p50: q(costs, 0.5), p95: q(costs, 0.95), max: q(costs, 1) }, over50ms: frames.filter((f) => f > 50).length, longTasks: long.length, longestTask: Math.max(0, ...long), dpr: (await state(page)).dpr };
    await context.close();
  }
  report.home = { ...(report.home ?? {}), frames: runs };
  report.criteria.frameTimesAreRecordedOnADeskAndAThrottledPhone = Object.values(runs).every((r) => r.plain || r.frames > 60);
}

/** Every request a page makes while it runs, its live frames mounted: none leaves the site (the analytics runs only on graview.dev). */
export async function homeHosts(report, browser, pageAt) {
  const reached = {};
  for (const file of ["index.html", "tour.html", "progression.html", "docs/demos.html", "docs/recipes/docs.html"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const hosts = new Set();
    page.on("request", (r) => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol)) hosts.add(u.hostname); });
    await page.goto(pageAt(file), { waitUntil: "load" });
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 800) { await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), y); await page.waitForTimeout(120); }
    await page.waitForTimeout(1500);
    reached[file] = [...hosts];
    await page.close();
  }
  report.home = { ...(report.home ?? {}), hosts: reached };
  report.criteria.noPageReachesAnotherSite = Object.values(reached).every((hosts) => hosts.length === 0);
}
