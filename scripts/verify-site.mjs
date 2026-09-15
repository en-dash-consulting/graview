#!/usr/bin/env node
/**
 * The page that explains this thing holds up at any width, to anyone.
 *
 * `docs/site/index.html` is the marketing page, and it is also published as a
 * Claude artifact. It makes claims about the framework, so it had better not
 * be a page that reflows into a mess on a phone or that a screen reader cannot
 * get through — which is exactly the failure a marketing page gets away with
 * for years because nobody measures it.
 *
 * Ten widths, both schemes, plus the things axe cannot see: keyboard order,
 * reduced motion, forced colours, text-only zoom, and whether every live
 * Graview on it is there at every width.
 *
 *   node scripts/verify-site.mjs
 *
 * Writes docs/site-check.json.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AXE = require.resolve("axe-core/axe.min.js");
/*
 * TWO PAGES NOW, AND BOTH ARE THE PRODUCT.
 *
 * The site used to be one document doing two jobs: a landing page that
 * opened with a code block and a tutorial that ran to fifteen chapters.
 * Split, the harness has to follow — and the interesting part is that the
 * claims did not move with the content. Keyboard order, reflow, contrast and
 * reduced motion are asked of BOTH pages, because a docs page nobody can tab
 * through is exactly as broken as a landing page nobody can. What is asked
 * of one page only is what only one page has: the stepper here, the
 * chapters and the kit there.
 */
const pageAt = (file) => `file://${resolve(repoRoot, "docs/site", file)}`;
const PAGES = [
  { file: "index.html", name: "the page", live: 2, skip: "#what" },
  { file: "progression.html", name: "the long version", live: 16, skip: "#grown" },
  /*
   * And a sample of the docs. Thirty-one pages at ten widths in two schemes
   * is six hundred page loads for thirty-one renderings of four templates,
   * so this takes one of each: the map, a package (the longest README in the
   * repository), a skill (the longest body), and the generated lists.
   */
  { file: "docs/index.html", name: "docs home", live: 0, skip: "#main", widths: [320, 768, 1280] },
  { file: "docs/concepts.html", name: "concepts", live: 0, skip: "#main", widths: [320, 768, 1280] },
  { file: "docs/packages/core.html", name: "a package page", live: 0, skip: "#main", widths: [320, 768, 1280] },
  { file: "docs/skills/graview-lens.html", name: "a skill page", live: 0, skip: "#main", widths: [320, 768, 1280] },
  { file: "docs/checks.html", name: "the findings list", live: 0, skip: "#main", widths: [320, 768, 1280] },
];
const PAGE = pageAt("index.html");
const ENGINE = engineName();

/* 320 is the reflow floor WCAG asks for; 1920 is where a wide layout gives up. */
const WIDTHS = [320, 360, 414, 600, 768, 900, 1024, 1280, 1440, 1920];

const report = { at: new Date().toISOString(), engine: ENGINE, viewports: [], criteria: {} };
const browser = await launchEngine(ENGINE, { headless: true });

try {
  for (const sheet of PAGES) {
  for (const scheme of ["light", "dark"]) {
    for (const width of sheet.widths ?? WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error).slice(0, 90)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 90)}`);
      });
      await page.goto(pageAt(sheet.file), { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      /*
       * The chapters mount as the reader comes near them. The whole page is
       * under test, so every one of them is brought near, and the page is
       * judged with fourteen live Graviews on it — their targets, their text,
       * their accessibility tree, their console.
       */
      const height = sheet.live > 0 ? await page.evaluate(() => document.documentElement.scrollHeight) : 0;
      const step = Math.max(400, 900 - 100);
      for (let y = 0; y <= height; y += step) {
        // One step per call, as a reader scrolls: a whole sweep inside one
        // script call starves the frames the chapters mount on.
        await page.evaluate((to) => window.scrollTo(0, to), y);
        await page.waitForTimeout(150);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      /*
       * A chapter mounts on the frame after the scroll that brought it near.
       * Scrolling away before that frame is what a reader may do, and then
       * nothing should mount — so the harness stays put at the foot of the
       * page until everything near it is up, and only then goes back.
       */
      if (sheet.live > 0) {
        await page
          .waitForFunction(
            () => [...document.querySelectorAll("[data-graview-chapter]")].every((el) => el.querySelector("[data-graview-embed]") !== null),
            null,
            { timeout: 20_000 },
          )
          .catch(() => {});
      }
      await page.waitForTimeout(150);
      await page.evaluate(() => window.scrollTo(0, 0));
      /*
       * WAIT FOR THIS PAGE'S OWN COUNT, which is the thing that was
       * hardcoded. Seventeen was right when there was one page; after the
       * split no page has seventeen, so every viewport sat out the whole
       * thirty-second timeout and a five-minute sweep became seventy. A
       * harness slow enough that nobody runs it is a harness that is not
       * checking anything, and this one degraded silently into that — it
       * still PASSED, it just took an hour to say so.
       */
      if (sheet.live > 0) {
        await page.waitForFunction(
          (n) => document.querySelectorAll("[data-graview-embed]").length >= n,
          sheet.live,
          { timeout: 30_000 },
        ).catch(() => {});
      }
      await page.waitForTimeout(900);
      await page.addScriptTag({ path: AXE });

      const violations = await page.evaluate(async () => {
        const run = await window.axe.run(document, { resultTypes: ["violations"] });
        return run.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
      });

      const live = await page.evaluate(() => document.querySelectorAll("[data-graview-embed]").length);
      const geometry = await page.evaluate(() => {
        const root = document.documentElement;
        const scale = (el) => {
          const host = el.closest("[data-graview-view]");
          if (!host) return 1;
          const m = new DOMMatrixReadOnly(getComputedStyle(host).transform);
          return Math.max(0.05, m.a || 1);
        };
        // A control's DESIGNED size: a scaled context is the depth model
        // working, not a target anyone built too small.
        const small = [...document.querySelectorAll("a[href], button, [role=button]")]
          .filter((el) => {
            const style = getComputedStyle(el);
            return style.display !== "none" && style.visibility !== "hidden";
          })
          .map((el) => ({ el, box: el.getBoundingClientRect(), scale: scale(el) }))
          .filter(({ box, scale: s }) => box.width > 1 && (box.width / s < 23.5 || box.height / s < 23.5))
          .map(({ el, box }) => `${(el.textContent ?? "").trim().slice(0, 16)} ${Math.round(box.width)}x${Math.round(box.height)}`);

        // Text cut without saying so. An ellipsis with a tooltip is a decision.
        const cut = [...document.querySelectorAll("*")]
          .filter((el) => el.children.length === 0)
          .filter((el) => {
            const style = getComputedStyle(el);
            if (style.textOverflow !== "ellipsis") return false;
            if (el.scrollWidth <= el.clientWidth + 2) return false;
            return !el.closest("[title]");
          })
          .map((el) => (el.textContent ?? "").trim().slice(0, 30));

        /*
         * Text drawn over text. Two leaf elements with words in them whose
         * boxes intersect is a layout that has failed, whatever the CSS
         * meant — the terminal's notes were drawn across its commands for
         * a week before anyone looked. Siblings only, outside the live
         * Graviews (a scene's planes overlap on purpose), and only where the
         * intersection is more than a rounding.
         */
        const words = [...document.querySelectorAll("main.col *")]
          .filter((el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 0)
          .filter((el) => !el.closest("[data-graview-embed], svg, pre") && getComputedStyle(el).display !== "none")
          // An inline that wrapped onto two lines has a bounding box that
          // spans both, and "intersects" the next inline honestly: only
          // elements drawn as one box are compared.
          .filter((el) => el.getClientRects().length === 1)
          .map((el) => ({ el, box: el.getBoundingClientRect() }))
          .filter(({ box }) => box.width > 0 && box.height > 0);
        const overlaps = [];
        for (let i = 0; i < words.length && overlaps.length < 4; i++) {
          for (let j = i + 1; j < words.length; j++) {
            const a = words[i], b = words[j];
            if (a.el.parentElement !== b.el.parentElement) continue;
            const w = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
            const h = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
            if (w > 3 && h > 3) overlaps.push(`${(a.el.textContent ?? "").trim().slice(0, 18)} × ${(b.el.textContent ?? "").trim().slice(0, 18)}`);
          }
        }
        return {
          sideways: root.scrollWidth > root.clientWidth + 1,
          small: small.slice(0, 4),
          cut: cut.slice(0, 4),
          overlaps,
        };
      });

      report.viewports.push({
        page: sheet.file, scheme, width, violations, ...geometry,
        live,
        wanted: sheet.live,
        errors: errors.slice(0, 2),
      });
      await page.close();
    }
  }
  }

  /*
   * The things axe cannot answer — asked of every page, because a docs page
   * nobody can tab through is exactly as broken as a landing page nobody
   * can. The name of the page goes in the criterion, so a failure says which.
   */
  for (const sheet of PAGES) {
    const one = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await one.goto(pageAt(sheet.file), { waitUntil: "networkidle" });
    await one.waitForTimeout(600);
    await one.keyboard.press("Tab");
    report.criteria[`theFirstStopIsTheWayPastTheNavigationOn_${sheet.file}`] =
      (await one.evaluate(() => document.activeElement?.className)) === "skip";
    await one.keyboard.press("Enter");
    await one.waitForTimeout(300);
    report.criteria[`theSkipLinkReachesTheContentOn_${sheet.file}`] =
      (await one.evaluate(() => location.hash)) === sheet.skip;
    report.criteria[`focusIsVisibleOn_${sheet.file}`] = await one.evaluate(() => {
      const link = document.querySelector(".jump a");
      link.focus();
      const style = getComputedStyle(link);
      return style.outlineStyle === "solid" && parseFloat(style.outlineWidth) >= 2;
    });
    await one.addStyleTag({ content: "html { font-size: 200% }" });
    await one.waitForTimeout(400);
    report.criteria[`textZoomToTwoHundredDoesNotScrollSidewaysOn_${sheet.file}`] = await one.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    await one.close();
  }

  /*
   * THE STEPPER, which is the landing page's whole argument: press a step and
   * the application on the right is a DIFFERENT application, mounted at that
   * point in the declaration. A row of buttons that looks like it does that
   * and does not is the worst thing this page could ship.
   */
  const stepper = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await stepper.goto(pageAt("index.html"), { waitUntil: "networkidle" });
  await stepper.locator("#grow").scrollIntoViewIfNeeded();
  await stepper
    .waitForFunction(() => document.querySelector('[data-step-live="1"] [data-graview-embed]') !== null, null, { timeout: 20_000 })
    .catch(() => {});
  /* A district is a view of a kind: `data-graview-view="kind:plot"`. */
  const districtsAt = (step) =>
    stepper.evaluate((s) => document.querySelectorAll(`[data-step-live="${s}"] [data-graview-view^="kind:"]`).length, step);
  const atOne = await districtsAt(1);
  await stepper.click("#step-tab-5");
  await stepper
    .waitForFunction(() => document.querySelector('[data-step-live="5"] [data-graview-embed]') !== null, null, { timeout: 20_000 })
    .catch(() => {});
  const atFive = await districtsAt(5);
  report.criteria.aStepMountsTheApplicationAtThatStep = atOne > 0 && atFive > atOne;
  /* And the tabs are tabs: an arrow key moves, and only one panel is shown. */
  await stepper.focus("#step-tab-5");
  await stepper.keyboard.press("ArrowRight");
  await stepper.waitForTimeout(300);
  report.criteria.theStepsAreReachableFromTheKeyboard = await stepper.evaluate(
    () =>
      document.activeElement?.id === "step-tab-9" &&
      [...document.querySelectorAll(".step-panel")].filter((p) => !p.hidden).length === 1,
  );
  await stepper.close();

  /* The long version is where the chapters and the kit went. */
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pageAt("progression.html"), { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  /* A chapter's face switches on the page itself: the picture is the app. */
  await page.locator('#chapter-1 [data-graview-chapter="1"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#chapter-1 [data-graview-chapter="1"] [data-graview-embed]') !== null, null, { timeout: 20_000 }).catch(() => {});
  const faceBefore = await page.locator('#chapter-1 [data-graview-chapter="1"] [data-graview-embed]').getAttribute("data-graview-embed").catch(() => null);
  await page.locator('#chapter-1 [data-graview-chapter="1"] [data-testid="embed-face-pages"]').click().catch(() => {});
  await page.waitForTimeout(500);
  const faceAfter = await page.locator('#chapter-1 [data-graview-chapter="1"] [data-graview-embed]').getAttribute("data-graview-embed").catch(() => null);
  report.criteria.aChapterSwitchesFaceOnThePage = faceBefore !== null && faceBefore !== "pages" && faceAfter === "pages";

  /* The kit re-dresses the live garden: a right-angled route draws elbows, a kind kept quiet is not drawn. */
  await page.locator('#kit [data-graview-chapter="8"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#kit [data-graview-chapter="8"] [data-graview-connector="tended-by"]') !== null, null, { timeout: 20_000 }).catch(() => {});
  const kitPath = () => page.evaluate(() => document.querySelector('#kit [data-graview-chapter="8"] [data-graview-connector="tended-by"]')?.getAttribute("d") ?? null);
  const curved = await kitPath();
  await page.locator('#kit-form input[name="route"][value="orthogonal"]').check().catch(() => {});
  await page.waitForTimeout(400);
  const elbowed = await kitPath();
  await page.locator('#kit-form input[name="tended-visible"]').uncheck().catch(() => {});
  await page.waitForTimeout(400);
  const quiet = await kitPath();
  const declared = await page.evaluate(() => document.getElementById("kit-decl")?.textContent ?? "");
  report.criteria.theKitRedressesTheLiveGarden =
    curved !== null && curved.includes(" Q ") && elbowed !== null && elbowed.includes(" L ") && !elbowed.includes(" Q ") && quiet === null && declared.includes('visible: false');
  await page.locator('#kit-form input[name="tended-visible"]').check().catch(() => {});
  await page.locator('#kit-form input[name="tended-painted"]').check().catch(() => {});
  await page.locator('#kit-form input[name="tended-colour"]').fill("#f4f4f4").catch(() => {});
  await page.waitForTimeout(300);
  report.criteria.theKitsVerdictIsTheCheckers = await page.evaluate(() => document.getElementById("kit-verdict")?.textContent?.includes("kit-contrast-below-aa") ?? false);

  await page.close();

  const reduced = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await reduced.goto(pageAt("index.html"), { waitUntil: "networkidle" });
  await reduced.waitForTimeout(400);
  // The opener's own Graview is on screen at load, so its cards are the
  // thing to ask: under reduced motion the theme turns their transitions off.
  await reduced.waitForFunction(() => document.querySelector("[data-graview-view]") !== null, null, { timeout: 20_000 }).catch(() => {});
  report.criteria.reducedMotionIsHonoured = await reduced.evaluate(() => {
    const card = document.querySelector("[data-graview-view]");
    return (
      card !== null &&
      parseFloat(getComputedStyle(card).transitionDuration) < 0.05 &&
      getComputedStyle(document.documentElement).scrollBehavior === "auto"
    );
  });
  await reduced.close();

  const forced = await browser.newPage({ viewport: { width: 1280, height: 900 }, forcedColors: "active" });
  await forced.goto(pageAt("index.html"), { waitUntil: "networkidle" });
  await forced.waitForTimeout(400);
  report.criteria.forcedColoursKeepTheMeaningfulMarks = await forced.evaluate(
    () => getComputedStyle(document.querySelector(".head .tick")).forcedColorAdjust === "none",
  );
  await forced.close();
} catch (error) {
  report.error = String(error).slice(0, 300);
} finally {
  await browser.close();
}

const bad = report.viewports.filter(
  (v) => v.violations.length || v.sideways || v.small.length || v.cut.length || v.overlaps.length || v.errors.length,
);
report.criteria.everyViewportIsClean = bad.length === 0;
/*
 * Every live Graview is up, at every width and in both schemes — each page
 * judged with the applications ON it rather than with pictures of them. The
 * landing page carries two (the hero's garden and the stepper's first step);
 * the long version carries fifteen chapters and the kit's garden.
 */
report.criteria.everyGraviewIsLiveAtEveryWidth = report.viewports.every((v) => v.live === v.wanted);
report.passed = Object.values(report.criteria).every(Boolean) && !report.error;

writeFileSync(resolve(repoRoot, "docs/site-check.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

for (const v of report.viewports) {
  const notes = [
    v.violations.length ? v.violations.map((x) => `${x.id}(${x.impact})`).join(" ") : "",
    v.sideways ? "sideways scroll" : "",
    v.small.length ? `small: ${v.small.join("; ")}` : "",
    v.cut.length ? `cut: ${v.cut.join("; ")}` : "",
    v.errors.length ? `js: ${v.errors[0]}` : "",
  ].filter(Boolean);
  if (v.live !== v.wanted) notes.push(`live: ${v.live} of ${v.wanted}`);
  if (notes.length) process.stdout.write(`?? ${v.page} ${v.scheme}/${String(v.width).padStart(4)}  ${notes.join("  ")}\n`);
}
for (const [name, ok] of Object.entries(report.criteria)) {
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}\n`);
}
process.stdout.write(`\n${report.passed ? "the page holds up" : "the page does not hold up"}\n`);
process.exit(report.passed ? 0 : 1);
