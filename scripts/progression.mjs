#!/usr/bin/env node
/**
 * The garden, grown a chapter at a time — photographed.
 *
 * `apps/seedbed/src/domain/chapters.ts` is the progression the docs and the
 * marketing page teach from: one example, seven chapters, each a real
 * declaration with the seed it has earned. This opens every chapter in a
 * browser at the stop it names, in both schemes, and writes what it saw —
 * the check's verdict, what Standing says, what the districts say — so a
 * page built from these pictures cannot drift from the framework.
 *
 *   node scripts/progression.mjs [--engine=chromium|webkit|firefox] [--keep-vite]
 *
 * Writes docs/progression/NN-slug-{light,dark}.png and docs/progression.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { portFor } from "./lib/ports.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const out = resolve(repoRoot, "docs/progression");
mkdirSync(out, { recursive: true });
const port = portFor("seedbed");

// The chapters themselves, from the compiled app: the same objects the page opens.
const { CHAPTERS } = await import(pathToFileURL(resolve(repoRoot, "apps/seedbed/dist/domain/chapters.js")).href);
const { checkApp } = await import(pathToFileURL(resolve(repoRoot, "packages/core/dist/check.js")).href);
const { aggregateId } = await import(pathToFileURL(resolve(repoRoot, "packages/layout/dist/index.js")).href);

/**
 * The app this harness drives — borrowed if a dev server is already holding
 * the port, started and owned otherwise. See `lib/serve.mjs`: spawning a
 * second vite blindly meant every harness died with "vite did not start"
 * whenever anyone had the app open.
 */
function startVite() {
  // Seedbed, on the port the chapters are photographed at. This started Things
  // on Things' port for two weeks, and passed only where a Seedbed dev server
  // already held Seedbed's — which is every laptop, and never CI.
  return serving("seedbed", port, repoRoot);
}

const report = { at: new Date().toISOString(), engine: engineName(), chapters: [] };
let vite;
let browser;
try {
  vite = await startVite();
  browser = await launchEngine(engineName(), { headless: true });
  for (const chapter of CHAPTERS) {
    const check = checkApp(chapter.app);
    const entry = {
      n: chapter.n,
      slug: chapter.slug,
      title: chapter.title,
      claim: chapter.claim,
      adds: chapter.adds,
      kinds: [...chapter.app.schema.kinds],
      mutations: (chapter.app.mutations ?? []).map((m) => m.name),
      invariants: (chapter.app.invariants ?? []).map((i) => i.name),
      check: { ok: check.ok, errors: check.errors, warnings: check.warnings, findings: check.findings.map((f) => f.code) },
      pictures: {},
      errors: [],
    };
    // A fresh context per chapter: what one chapter remembered must not leak into the next.
    // Twice the pixels: the page shows these in a column two-thirds this
    // wide, and text photographed at 1x and shown at 0.6x is not text.
    const context = await browser.newContext({ viewport: { width: 1280, height: 680 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on("pageerror", (error) => entry.errors.push(String(error.message ?? error)));
    page.on("console", (message) => { if (message.type() === "error") entry.errors.push(message.text()); });
    for (const scheme of ["light", "dark"]) {
      if (chapter.face === "pages") {
        // The routed face, at phone width: the whole page, as a phone shows it.
        const phone = await context.newPage();
        // A phone for the derived face; a desk for a design that earns one.
        await phone.setViewportSize(chapter.wide ? { width: 1280, height: 800 } : { width: 390, height: 844 });
        phone.on("pageerror", (error) => entry.errors.push(String(error.message ?? error)));
        phone.on("console", (message) => { if (message.type() === "error") entry.errors.push(message.text()); });
        await phone.goto(`http://localhost:${port}${chapter.path}?chapter=${chapter.n}&theme=${scheme}`, { waitUntil: "networkidle" });
        await phone.waitForTimeout(900);
        const file = `${String(chapter.n).padStart(2, "0")}-${chapter.slug}-${scheme}.png`;
        await phone.screenshot({ path: resolve(out, file), fullPage: true });
        entry.pictures[scheme] = `docs/progression/${file}`;
        const height = await phone.evaluate(() => document.documentElement.scrollHeight);
        entry.picture = chapter.wide
          ? { width: 1280, height: Math.min(height, 1400) }
          : { width: 390, height: Math.min(height, 1400), phone: true };
        if (scheme === "light") {
          entry.saw = await phone.evaluate(() => ({
            standing: null,
            districts: [],
            page: document.querySelector("main")?.textContent?.trim().replace(/\s+/g, " ").slice(0, 240) ?? null,
            custom: document.querySelector('[data-testid="plot-page"]') !== null,
            design: document.querySelector('[data-testid="seedbed-design"]') !== null && document.querySelector('[data-testid="garden-map"]') !== null,
            fitsAPhone: document.documentElement.scrollWidth <= window.innerWidth + 1,
          }));
        }
        await phone.close();
        continue;
      }
      const remember = chapter.remembers ? "&remember=1" : "";
      // A stop may name an aggregate by kind; the id is the layout's to mint.
      const stop = chapter.stop.replace(/agg:([a-z-]+)/g, (_, kind) => aggregateId(kind));
      await page.goto(`http://localhost:${port}/?chapter=${chapter.n}&theme=${scheme}${remember}${stop}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 30_000 });
      await page.waitForTimeout(900);
      if (chapter.drive === "activity") {
        if (chapter.seat && scheme === "light" && chapter.seed.nodes.length === 0) {
          // The seat plants the starter garden: the picture is what it did.
          await page.click('[data-testid="activity-button"]');
          await page.waitForTimeout(300);
          await page.click('[data-testid="agent-starter"]');
          await page.waitForTimeout(2200);
        } else {
          await page.click('[data-testid="activity-button"]');
          await page.waitForTimeout(400);
        }
      }
      if (chapter.drive === "select-plot") {
        await page.click('[data-graview-view="kind:plot"]');
        await page.waitForTimeout(500);
      }
      if (chapter.drive === "standing") {
        await page.click('[data-testid="standing"]');
        await page.waitForTimeout(500);
      }
      /*
       * The picture is the part that matters, not the whole window. A city
       * with one district is mostly ground, and a full frame shrunk into a
       * column makes every label a smudge. So: the union of what is drawn —
       * views, the inspector, a popover — with room around it, and the bar
       * across the top so Standing and the trail stay in the picture.
       */
      const clip = await page.evaluate(() => {
        const rects = [...document.querySelectorAll('[data-graview-view], [data-testid="inspector-strip"], [data-testid="activity"], [data-testid="problems"], [data-testid="context-menu"]')]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0);
        if (rects.length === 0) return null;
        const pad = 28;
        const left = Math.max(0, Math.min(...rects.map((r) => r.left)) - pad);
        const right = Math.min(innerWidth, Math.max(...rects.map((r) => r.right)) + pad);
        const top = Math.max(0, Math.min(...rects.map((r) => r.top)) - pad);
        const bottom = Math.min(innerHeight, Math.max(...rects.map((r) => r.bottom)) + pad);
        // At least a readable width, centred on what is drawn. The bar is not
        // in the picture: the caption quotes what Standing said.
        const minW = 640;
        const width = Math.max(minW, right - left);
        const x = Math.max(0, Math.min(innerWidth - width, (left + right) / 2 - width / 2));
        return { x, y: top, width: Math.min(width, innerWidth - x), height: Math.max(240, bottom - top) };
      });
      const file = `${String(chapter.n).padStart(2, "0")}-${chapter.slug}-${scheme}.png`;
      await page.screenshot({ path: resolve(out, file), ...(clip ? { clip } : {}) });
      entry.pictures[scheme] = `docs/progression/${file}`;
      if (clip) entry.picture = { width: Math.round(clip.width), height: Math.round(clip.height) };
      if (scheme === "light") {
        entry.saw = await page.evaluate(() => ({
          standing: document.querySelector('[data-testid="standing"]')?.textContent?.trim() ?? null,
          districts: [...document.querySelectorAll('[data-graview-view^="kind:"]')].map((el) => el.textContent?.trim().replace(/\s+/g, " ") ?? ""),
          trail: document.querySelector("header")?.textContent?.trim().replace(/\s+/g, " ").slice(0, 160) ?? null,
          withheld: document.querySelector('[data-testid="withheld"]')?.textContent?.trim() ?? null,
          activity: [...document.querySelectorAll('[data-testid="diff-log"] li')].map((li) => li.textContent?.trim().replace(/\s+/g, " ") ?? "").slice(0, 6),
          remembered: document.querySelector('[data-testid="remembered"]')?.textContent?.trim() ?? null,
          problems: document.querySelector('[data-testid="problems"]')?.textContent?.trim().replace(/\s+/g, " ").slice(0, 300) ?? null,
          wordmark: document.querySelector("header h1")?.textContent?.trim() ?? null,
          focused: document.querySelector('[data-graview-plane="0"]')?.textContent?.trim().replace(/\s+/g, " ").slice(0, 400) ?? null,
        }));
        /*
         * WHAT THE SEAT MAY DO, asked somewhere it could do something.
         *
         * The picture above is taken wherever the chapter stands, and for
         * the policy chapters that is a district whose creating act this
         * seat may legitimately not take — so "something was withheld" was
         * true whether or not the seat was reaching the interface at all.
         * It was not: the chapter's principal went to the store and the
         * routed face and never to the scene, so the strip derived what
         * ANONYMOUS may do, which under a policy is nothing. Asked on a
         * MEMBER, after the picture is safely taken.
         */
        if (chapter.principal) {
          // Up, and only up: the control is a toggle, and a chapter that already
          // opens at altitude was being taken DOWN, to a ground with nothing on it.
          const up = await page.evaluate(() => document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true");
          if (!up) await page.click('[data-testid="overview"]').catch(() => {});
          await page.waitForTimeout(700);
          // A city with every district shut draws no members to press: open one.
          const pickable = () =>
            page.evaluate(() => [...document.querySelectorAll("[data-graview-stage] [data-graview-pick]")].some((el) => !el.closest("[inert]")));
          if (!(await pickable())) {
            await page.click('[data-testid^="open-"]').catch(() => {});
            await page.waitForTimeout(700);
          }
          // A member DRAWN IN THE SCENE, and one a person can press: a chapter that
          // opened the activity rail has chips there too (a log entry, not a thing),
          // and a lens drawn small as a picture is inert.
          const member = (
            await page.evaluateHandle(() =>
              [...document.querySelectorAll("[data-graview-stage] [data-graview-pick]")].find((el) => !el.closest("[inert]")) ?? null,
            )
          ).asElement();
          if (member) {
            await member.click();
            await page.waitForTimeout(600);
          }
          entry.seatSees = await page.evaluate(() => ({
            offered: [...document.querySelectorAll('[data-testid="affordances"] [data-affordance]')].map(
              (button) => button.textContent?.trim() ?? "",
            ),
            withheld: document.querySelector('[data-testid="withheld"]')?.textContent?.trim() ?? "",
          }));
        }
      }
    }
    await context.close();
    report.chapters.push(entry);
    process.stdout.write(`${entry.n} ${entry.slug}: check ${check.ok ? "ok" : "FAILED"} · ${entry.saw?.standing ?? ""} · ${entry.errors.length} console errors\n`);
  }
} catch (error) {
  report.error = String(error?.stack ?? error).slice(0, 4000);
  process.stdout.write(`${report.error}\n`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (vite && !process.argv.includes("--keep-vite")) { vite.stop(); }
}
report.verdict = {
  everyChapterChecksClean: report.chapters.length === CHAPTERS.length && report.chapters.every((c) => c.check.ok),
  everyChapterRenderedWithoutErrors: report.chapters.every((c) => c.errors.length === 0 && c.pictures.light && c.pictures.dark),
  theRuleFiresInChapterThree: /1 problem/.test(report.chapters[2]?.saw?.standing ?? "") && /Nobody tends Plot 2/.test(report.chapters[2]?.saw?.problems ?? ""),
  theHorizonShowsInChapterFour: (report.chapters[3]?.saw?.districts ?? []).some((d) => /past/.test(d)),
  theSeatPlantedInChapterFive: (report.chapters[4]?.saw?.activity ?? []).length > 0,
  itRemembersInChapterSix: /Remembered/.test(report.chapters[5]?.saw?.remembered ?? ""),
  aGardenerIsRefusedInChapterSeven: (report.chapters[6]?.saw?.withheld ?? "") !== "",
  /*
   * AND REFUSED FOR A REASON THAT IS NOT THEIR OWN ROLE.
   *
   * The chapter's seat reached the store and the routed face and not the
   * scene, so from here on the strip derived what an ANONYMOUS reader may
   * do — nothing, under a policy. The chapter claiming "the actions strip
   * narrows, so a gardener never sees a button that would fail" published a
   * picture of a gardener refused everything, one line reading "Not
   * permitted: tend — one of coordinator, gardener can" to a gardener. The
   * check above passes on that: any withheld text at all satisfies it.
   * This one reads the roles the refusal names and asks whether the seat
   * already holds one.
   */
  theSeatIsNeverRefusedByItsOwnRole: report.chapters
    .map((chapter, at) => ({ chapter, roles: new Set(CHAPTERS[at]?.principal?.roles ?? []) }))
    // Where the SCENE is what the chapter shows: a pages chapter has no
    // strip to ask, and says its half of this on its own surfaces.
    .filter(({ chapter, roles }) => roles.size > 0 && chapter.seatSees !== undefined)
    .every(({ chapter, roles }) => {
      const said = chapter.seatSees?.withheld ?? "";
      // Roles are said in words since W-143 — "— a coordinator or a gardener can." — so read them back as words.
      const named = [...said.matchAll(/—\s*([^—]*?)\s+can\./g)].flatMap((match) =>
        match[1].split(/,\s*|\s+or\s+/).map((role) => role.trim().replace(/^(?:an?|one of)\s+/, "")),
      );
      const spoken = new Set([...roles].map((role) => role.replace(/[-_]+/g, " ").toLowerCase()));
      // Something it MAY do, and nothing refused for a role it already holds.
      return (chapter.seatSees?.offered.length ?? 0) > 0 && !named.some((role) => spoken.has(role));
    }) && report.chapters[6]?.seatSees !== undefined,
  theBrandArrivesInChapterEight: report.chapters[6]?.saw?.wordmark === "Graview" && report.chapters[7]?.saw?.wordmark === "Seedbed",
  theOtherFaceIsThePlotsOwnPageInChapterNine: report.chapters[8]?.saw?.custom === true && report.chapters[8]?.saw?.fitsAPhone === true && /looked after by|nobody looks after/.test(report.chapters[8]?.saw?.page ?? ""),
  theLensShowsWhoTendsWhatInChapterTen: /June/.test(report.chapters[9]?.saw?.focused ?? "") && /Plot 2/.test(report.chapters[9]?.saw?.focused ?? ""),
  theBoardShowsTheEmptyBedInChapterEleven: /nothing sown/i.test(report.chapters[10]?.saw?.focused ?? "") && /Beans/.test(report.chapters[10]?.saw?.focused ?? ""),
  theMigrationIsInTheLogInChapterTwelve: (report.chapters[11]?.saw?.activity ?? []).some((line) => /agreement|migration/i.test(line)),
  theInstallationIsDrawnForTheKeeperInChapterFourteen: (report.chapters[13]?.saw?.districts ?? []).some((d) => /People/.test(d)) && (report.chapters[13]?.saw?.districts ?? []).some((d) => /Invitations/.test(d)),
  theDeclarationIsAGraphInChapterFifteen: (report.chapters[14]?.saw?.districts ?? []).some((d) => /^kinds/i.test(d)) && (report.chapters[14]?.saw?.districts ?? []).some((d) => /^acts/i.test(d)) && report.chapters[14]?.check?.ok === true,
  theGardenWearsItsOwnFaceInChapterThirteen: report.chapters[12]?.saw?.design === true && report.chapters[12]?.saw?.fitsAPhone === true && /Every plot has someone|waits? for a caretaker/.test(report.chapters[12]?.saw?.page ?? ""),
};
report.passed = Object.values(report.verdict).every(Boolean) && !report.error;
writeFileSync(resolve(repoRoot, "docs/progression.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n`);
process.exit(report.passed ? 0 : 1);
