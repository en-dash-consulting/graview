#!/usr/bin/env node
/**
 * ROTA, THE PRODUCT-GRADE ONE — the things only it can demonstrate.
 *
 * Things is the example nobody has to be taught; Seedbed is the one that
 * grows a chapter at a time. Rota is what a person would actually ship, and
 * the claims worth driving in a browser are not the domain — two kinds and
 * an edge — but everything the platform does around it: three seats with
 * real differences, a brand with a kit, a stored roster carried forward by
 * a migration, the studio one press from the bar, and the whole thing on
 * somebody else's page twice.
 *
 *   node scripts/verify-rota.mjs [--engine=chromium|webkit|firefox]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const BASE = "http://localhost:5195";
const DAY = "today=2026-09-14";

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
const app = await serving("rota", 5195, repoRoot);
let browser;

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const open = async (where) => {
    await page.goto(`${BASE}${where}`, { waitUntil: "load" });
    await page.waitForFunction(() => "__rotaReady" in window, null, { timeout: 60_000 });
    await page.waitForTimeout(900);
  };

/*
 * THE KEEPER'S WAYS IN LIVE BEHIND THE PROFILE. "Show the installation" and
 * "Studio" were pills on the bar, beside the places, where every reader met
 * two controls only a keeper can use. A harness opens the pane first.
 */
const openProfile = async (page) => {
  const shown = await page.evaluate(() => {
    const pane = document.querySelector('[data-testid="profile"]');
    return pane !== null && !pane.hasAttribute("hidden");
  });
  if (shown) return;
  const button = await page.$('[data-testid="profile-button"]');
  if (!button) return;
  await button.click();
  await page.waitForTimeout(350);
};

  /* -------------------------------- three pictures of one roster, by name */
  await open(`/?${DAY}&fresh=1`);
  await openProfile(page);
  const opened = await page.evaluate(() => ({
    places: [...document.querySelectorAll('nav[aria-label="Places"] button')].map((b) => b.textContent?.trim()),
    studio: document.querySelector('[data-testid="studio-place"]') !== null,
    installation: document.querySelector('[data-testid="show-installation"]') !== null,
    /* The kit: the one relation this app has is drawn the way Rota says,
       not the way the framework would by default. */
    connector: getComputedStyle(document.documentElement).getPropertyValue("--graview-kit-connector-covered-by").trim(),
  }));
  report.checks.threePicturesAndTheWayIn = {
    ...opened,
    ok:
      opened.places.includes("The week") &&
      opened.places.includes("The fortnight") &&
      opened.places.includes("Who is covering what") &&
      opened.studio &&
      opened.installation,
  };

  /* ------------------------------- three seats, and the third is the point */
  const seatSays = async (as) => {
    await open(`/?${DAY}&fresh=1&as=${as}#focus=aggregate:shift&sel=s-fri-repair`);
    await openProfile(page);
    return page.evaluate(() => ({
      offered: [...document.querySelectorAll('[data-testid="inspector-strip"] [data-affordance]:not([disabled])')].length,
      withheld: [...document.querySelectorAll('[data-testid="inspector-strip"] [data-withheld]')].map((b) =>
        b.getAttribute("data-withheld"),
      ),
      installation: document.querySelector('[data-testid="show-installation"]') !== null,
      studio: document.querySelector('[data-testid="studio-place"]') !== null,
    }));
  };
  const coordinator = await seatSays("user-jo");
  const volunteer = await seatSays("user-ada");
  const viewer = await seatSays("user-sam");
  report.checks.aGradientRatherThanADifference = {
    coordinator,
    volunteer,
    viewer,
    /*
     * Two roles can show a difference; three can show a gradient, and a
     * gradient is what anybody actually has. The viewer is offered NOTHING
     * and told about everything, each with the role that could take it.
     */
    ok:
      coordinator.offered > volunteer.offered &&
      volunteer.offered > 0 &&
      viewer.offered === 0 &&
      viewer.withheld.length > 0 &&
      viewer.withheld.every((need) => need !== "nobody") &&
      coordinator.installation &&
      !volunteer.installation &&
      !viewer.installation &&
      coordinator.studio &&
      !viewer.studio,
  };

  /* ------------------ a roster stored before the rule existed still opens */
  await open(`/?${DAY}&stored=1`);
  const carried = await page.evaluate(() => window.__rotaReady.migrated);
  // Opening again must NOT run it a second time: a migration is once.
  await open(`/?${DAY}`);
  const again = await page.evaluate(() => window.__rotaReady.migrated);
  report.checks.aStoredRosterIsCarriedForwardOnce = {
    carried,
    again,
    ok: carried.length === 1 && String(carried[0]).includes("1→2") && again.length === 0,
  };

  /* ---------------------------- the studio, over Rota's own declaration */
  await open(`/?${DAY}&fresh=1`);
  await openProfile(page);
  await page.click('[data-testid="studio-place"]');
  await page.waitForSelector('[data-testid="studio"]', { timeout: 20_000 });
  await page.waitForTimeout(1200);
  const studio = await page.evaluate(() => ({
    verdict: document.querySelector('[data-testid="studio-verdict"]')?.getAttribute("data-errors"),
    kinds: [...document.querySelectorAll('[data-testid="studio"] [data-graview-view]')].map((e) =>
      e.getAttribute("data-graview-view"),
    ),
  }));
  report.checks.theStudioOpensOverRotasOwnDeclaration = {
    ...studio,
    ok: studio.verdict === "0" && studio.kinds.includes("kind:kind") && studio.kinds.includes("kind:grant"),
  };
  await page.click('[data-testid="studio-close"]');
  await page.waitForTimeout(400);

  /* ------------------------------ the roster on somebody else's page, twice */
  await page.goto(`${BASE}/embed.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-graview-embed]", { timeout: 30_000 });
  await page.waitForTimeout(1600);
  const embedded = await page.evaluate(() => {
    const embeds = [...document.querySelectorAll("[data-graview-embed]")];
    return {
      labels: embeds.map((el) => el.getAttribute("aria-label")),
      // The host page keeps its own serif and paper: an embed that restyled
      // the page it is on would be the rudest thing this package could do.
      hostFont: getComputedStyle(document.body).fontFamily,
      scoped: embeds.every((el) => el.querySelector("style") !== null),
      views: embeds.map((el) => el.querySelectorAll("[data-graview-view]").length),
    };
  });
  report.checks.theRosterOnSomebodyElsesPage = {
    ...embedded,
    ok:
      embedded.labels.length === 2 &&
      embedded.scoped &&
      embedded.hostFont.includes("Georgia") &&
      embedded.views.every((many) => many > 0),
  };

  /* ------------------- the routed face, read by a machine, on every route */
  const axeSource = readFileSync(resolve(repoRoot, "node_modules/axe-core/axe.min.js"), "utf8");
  const routes = ["/pages", "/pages/shifts", "/pages/shifts/s-fri-repair", "/pages/volunteers/v-bo", "/pages/problems"];
  const findings = {};
  for (const width of [390, 1280]) {
    for (const theme of ["light", "dark"]) {
      const seen = await browser.newPage({ viewport: { width, height: 900 } });
      for (const route of routes) {
        await seen.goto(`${BASE}${route}?${DAY}&theme=${theme}`, { waitUntil: "networkidle" });
        await seen.waitForTimeout(350);
        await seen.addScriptTag({ content: axeSource });
        const found = await seen.evaluate(async () => {
          const result = await window.axe.run(document, { resultTypes: ["violations"] });
          return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
        });
        if (found.length > 0) findings[`${width}-${theme}${route}`] = found;
      }
      await seen.close();
    }
  }
  report.checks.everyRouteIsReachable = { ...findings, ok: Object.keys(findings).length === 0 };

  /* --------------- and at the reader's own 200% text size, on a phone */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const reflow = {};
  for (const route of routes) {
    await phone.goto(`${BASE}${route}?${DAY}`, { waitUntil: "networkidle" });
    await phone.evaluate(() => {
      document.documentElement.style.fontSize = "32px";
    });
    await phone.waitForTimeout(400);
    reflow[route] = await phone.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
      widest: [...document.querySelectorAll("*")]
        .filter((el) => {
          if (el.getBoundingClientRect().right <= window.innerWidth + 1) return false;
          for (let at = el.parentElement; at; at = at.parentElement) {
            const overflow = getComputedStyle(at).overflowX;
            if ((overflow === "auto" || overflow === "scroll") && at.scrollWidth > at.clientWidth + 1) return false;
          }
          return true;
        })
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className || "").split(" ")[0]}`),
    }));
  }
  await phone.close();
  report.checks.theReadersOwnTextSize = {
    ...reflow,
    ok: Object.values(reflow).every((one) => one.scrollWidth <= one.width + 1 && one.widest.length === 0),
  };

  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  report.error = String(error).slice(0, 1200);
  report.passed = false;
} finally {
  await browser?.close();
  app.stop();
}

writeFileSync(resolve(repoRoot, "docs/rota.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/rota.json\n`);
process.exit(report.passed ? 0 : 1);
