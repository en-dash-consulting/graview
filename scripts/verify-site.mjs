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
 * reduced motion, forced colours, text-only zoom, and whether the interactive
 * demo's connector captions collide.
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
const PAGE = `file://${resolve(repoRoot, "docs/site/index.html")}`;
const ENGINE = engineName();

/* 320 is the reflow floor WCAG asks for; 1920 is where a wide layout gives up. */
const WIDTHS = [320, 360, 414, 600, 768, 900, 1024, 1280, 1440, 1920];

const report = { at: new Date().toISOString(), engine: ENGINE, viewports: [], criteria: {} };
const browser = await launchEngine(ENGINE, { headless: true });

try {
  for (const scheme of ["light", "dark"]) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error).slice(0, 90)));
      await page.goto(PAGE, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      await page.addScriptTag({ path: AXE });

      const violations = await page.evaluate(async () => {
        const run = await window.axe.run(document, { resultTypes: ["violations"] });
        return run.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
      });

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

        // The demo's connector captions must not run into one another.
        const labels = [...document.querySelectorAll(".wire-label")].map((t) => t.getBBox());
        let captionHits = 0;
        for (let i = 0; i < labels.length; i++) {
          for (let j = i + 1; j < labels.length; j++) {
            const a = labels[i], b = labels[j];
            const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
            if (w > 2 && h > 2) captionHits++;
          }
        }
        return {
          sideways: root.scrollWidth > root.clientWidth + 1,
          small: small.slice(0, 4),
          cut: cut.slice(0, 4),
          captionHits,
        };
      });

      report.viewports.push({
        scheme, width, violations, ...geometry,
        errors: errors.slice(0, 2),
      });
      await page.close();
    }
  }

  /* The things axe cannot answer. */
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.keyboard.press("Tab");
  report.criteria.theFirstStopIsTheWayPastTheNavigation =
    (await page.evaluate(() => document.activeElement?.className)) === "skip";
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  report.criteria.theSkipLinkReachesTheContent =
    (await page.evaluate(() => location.hash)) === "#what";
  report.criteria.focusIsVisible = await page.evaluate(() => {
    const link = document.querySelector(".jump a");
    link.focus();
    const style = getComputedStyle(link);
    return style.outlineStyle === "solid" && parseFloat(style.outlineWidth) >= 2;
  });
  const demo = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".node")];
    nodes[3].click();
    return {
      live: document.getElementById("foot")?.getAttribute("aria-live"),
      said: (document.getElementById("foot")?.textContent ?? "").length,
      edges: document.querySelectorAll("#scene-edges li").length,
      current: document.querySelectorAll('.node[aria-current="true"]').length,
      labelled: nodes.every((n) => (n.getAttribute("aria-label") ?? "").length > 3),
    };
  });
  report.criteria.activatingANodeIsAnnounced = demo.live === "polite" && demo.said > 10;
  report.criteria.theConnectorWordsExistAsText = demo.edges > 0;
  report.criteria.exactlyOneNodeIsCurrent = demo.current === 1;
  report.criteria.everyNodeIsNamed = demo.labelled === true;
  await page.addStyleTag({ content: "html { font-size: 200% }" });
  await page.waitForTimeout(400);
  report.criteria.textZoomToTwoHundredDoesNotScrollSideways = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  await page.close();

  const reduced = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await reduced.goto(PAGE, { waitUntil: "networkidle" });
  await reduced.waitForTimeout(400);
  report.criteria.reducedMotionIsHonoured = await reduced.evaluate(() => {
    const node = document.querySelector(".node");
    return (
      parseFloat(getComputedStyle(node).transitionDuration) < 0.05 &&
      getComputedStyle(document.documentElement).scrollBehavior === "auto"
    );
  });
  await reduced.close();

  const forced = await browser.newPage({ viewport: { width: 1280, height: 900 }, forcedColors: "active" });
  await forced.goto(PAGE, { waitUntil: "networkidle" });
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
  (v) => v.violations.length || v.sideways || v.small.length || v.cut.length || v.captionHits || v.errors.length,
);
report.criteria.everyViewportIsClean = bad.length === 0;
report.passed = Object.values(report.criteria).every(Boolean) && !report.error;

writeFileSync(resolve(repoRoot, "docs/site-check.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

for (const v of report.viewports) {
  const notes = [
    v.violations.length ? v.violations.map((x) => `${x.id}(${x.impact})`).join(" ") : "",
    v.sideways ? "sideways scroll" : "",
    v.small.length ? `small: ${v.small.join("; ")}` : "",
    v.cut.length ? `cut: ${v.cut.join("; ")}` : "",
    v.captionHits ? `${v.captionHits} caption collisions` : "",
    v.errors.length ? `js: ${v.errors[0]}` : "",
  ].filter(Boolean);
  if (notes.length) process.stdout.write(`?? ${v.scheme}/${String(v.width).padStart(4)}  ${notes.join("  ")}\n`);
}
for (const [name, ok] of Object.entries(report.criteria)) {
  process.stdout.write(`${ok ? "ok  " : "FAIL"} ${name}\n`);
}
process.stdout.write(`\n${report.passed ? "the page holds up" : "the page does not hold up"}\n`);
process.exit(report.passed ? 0 : 1);
