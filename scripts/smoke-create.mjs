#!/usr/bin/env node
/**
 * Does `graview create` make a project a stranger can actually run?
 *
 * `smoke-install` proves the tarballs work as an SDK, headless. This proves
 * the ONBOARDING, in four rehearsals:
 *
 *   1. npm.   The scaffolder writes a project; it installs from the packed
 *             tarballs with no workspace and no path mapping; its OWN verify
 *             passes; the checker says so in its own words; the skills land
 *             where both assistants look; and a real browser walks the first
 *             hour — the empty district, the seat's starter data, the derived
 *             form, a reload that remembers, the way back to empty, the routed
 *             face at phone width, and axe-core in both schemes.
 *   2. pnpm.  The same project through the other package manager.
 *   3. door.  `create-graview` — what `npm create graview` runs — installed
 *             from its tarball, makes the same project.
 *   4. link.  A project that consumes the framework from this checkout by
 *             path, through the CLI's own install, with a hyphenated kind.
 *
 *   node scripts/smoke-create.mjs [--keep] [--no-browser] [--engine=chromium|webkit|firefox]
 *
 * Writes docs/create.json.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { packTarballs, pinToTarballs } from "./lib/tarballs.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const scratch = mkdtempSync(join(tmpdir(), "graview-create-"));
const cli = resolve(repoRoot, "packages/core/dist/cli/index.js");
const withBrowser = !process.argv.includes("--no-browser");
const report = { at: new Date().toISOString(), scratch, engine: engineName(), npm: {}, pnpm: {}, door: {}, linked: {}, browser: {} };

const run = (command, args, cwd, env = {}) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });

const trimmed = (error) =>
  [error.stdout, error.stderr, error.message]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);

/** The line the checker itself writes: "no problems found", or its count of errors and warnings. */
const checkerSentence = (output) =>
  output.split("\n").find((line) => /no problems found|\d+ error\(s\), \d+ warning\(s\)/.test(line)) ?? null;

/** Every file under a project that a person would commit. */
const tree = (dir, prefix = "") =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !["node_modules", "dist", "build", "docs", ".claude", ".agents", ".git"].includes(entry.name))
    .filter((entry) => !/lock/.test(entry.name))
    .flatMap((entry) =>
      entry.isDirectory() ? tree(join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
    )
    .sort();

function startVite(cwd, port) {
  const child = spawn("npx", ["vite", "--port", String(port), "--strictPort"], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("vite did not start in 60s")), 60_000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes(String(port))) {
        clearTimeout(timer);
        ready(child);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`vite exited with ${code}`));
    });
  });
}

const stop = (child) => {
  if (!child) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
};

const axeSource = readFileSync(resolve(repoRoot, "node_modules/axe-core/axe.min.js"), "utf8");
/** axe-core against the live page: the violations, by rule and impact. */
async function axe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ["violations"] });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  });
}

let vite;
let browser;
try {
  const tarballs = packTarballs(repoRoot, scratch);
  report.packed = Object.keys(tarballs);

  /* ================================================================ npm */
  const app = resolve(scratch, "field-notes");
  const created = run(
    process.execPath,
    [cli, "create", app, "--name", "Field Notes", "--kind", "note", "--pm", "npm", "--no-install"],
    scratch,
  );
  report.npm.created = created.split("\n")[0];
  report.npm.tree = tree(app);

  /*
   * The specifiers the scaffold wrote name versions that are on no registry
   * yet, so only the SPECIFIERS change: every @graview/* dependency points
   * at its tarball. The files, scripts and shape are exactly what a
   * stranger gets.
   */
  const manifest = JSON.parse(readFileSync(resolve(app, "package.json"), "utf8"));
  writeFileSync(resolve(app, "package.json"), `${JSON.stringify(pinToTarballs(manifest, tarballs), null, 2)}\n`);

  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], app);
  report.npm.installed = true;
  report.npm.lockfile = existsSync(resolve(app, "package-lock.json"));

  // The project's OWN verify — the script the scaffold wrote, not one of ours.
  run("npm", ["run", "verify"], app);
  report.npm.verified = true;

  /*
   * And what the check SAID. A bin that resolves to the wrong file, or a
   * guard that decides it was imported rather than run, exits 0 having done
   * nothing — the quietest way a check can pass. So the verdict is the
   * checker's own sentence, not the exit code.
   */
  report.npm.checkSaid = checkerSentence(run("npm", ["run", "check"], app));

  // The check also FAILS when it should: an edge to a kind nobody declared
  // is what the whole gate exists for.
  const schemaPath = resolve(app, "src/domain/schema.ts");
  const schema = readFileSync(schemaPath, "utf8");
  writeFileSync(schemaPath, schema.replace('to: ["note"]', 'to: ["nobody"]'));
  try {
    run("npm", ["run", "typecheck"], app);
    report.npm.brokenSchemaTypechecked = true;
  } catch (error) {
    report.npm.brokenSchemaTypechecked = false;
    report.npm.tscSaid = String(error.stdout ?? "").split("\n").find((line) => line.includes("error TS")) ?? null;
  } finally {
    writeFileSync(schemaPath, schema);
  }

  // The domain compiled to plain modules that the CLI can load — the
  // contract every other tool (docs, the pages face, a host) relies on.
  run("npx", ["graview", "docs", "./dist/domain/app.js", "--out", "docs"], app);
  report.npm.docsWritten = existsSync(resolve(app, "docs/llms.txt")) && existsSync(resolve(app, "docs/agents.md"));
  report.npm.docsNameTheActs = readFileSync(resolve(app, "docs/agents.md"), "utf8").includes("add-note");

  // The authoring skills, where both assistants look.
  run("npm", ["run", "skills"], app);
  report.npm.skills = [".claude/skills/graview-new-app/SKILL.md", ".agents/skills/graview-new-app/SKILL.md"].every(
    (file) => existsSync(resolve(app, file)),
  );

  // A production build exists, separate from the checked declaration.
  report.npm.built = existsSync(resolve(app, "build/index.html")) && existsSync(resolve(app, "dist/domain/app.js"));

  /* ======================================================= the browser */
  if (withBrowser) {
    const port = 5177;
    const base = `http://localhost:${port}`;
    vite = await startVite(app, port);
    browser = await launchEngine(engineName(), { headless: true });
    const errors = [];
    const watch = (page) => {
      page.on("pageerror", (error) => errors.push(String(error.message ?? error)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      return page;
    };
    const ready = async (page) => {
      await page.waitForFunction(() => "__graviewReady" in window, null, { timeout: 30_000 });
      await page.waitForTimeout(500);
    };
    const districtText = (page) => page.locator('[data-graview-view="kind:note"]').first().textContent();
    const standing = (page) => page.locator('[data-testid="standing"]').first().textContent();

    const page = watch(await browser.newPage({ viewport: { width: 1280, height: 800 } }));
    const b = report.browser;

    /* ---- the first screen: one district for the one kind, "none yet" */
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await ready(page);
    b.districts = await page.locator('[data-graview-view^="kind:"]').count();
    b.saysNoneYet = (await districtText(page)).includes("none yet");
    b.wordmarkSaysTheName = (await page.locator("header").textContent()).includes("Field Notes");
    b.standingIsClean = (await standing(page)).trim();
    b.axeEmptyLight = await axe(page);

    /* ---- the seat at zero: starter data, proposed from the declaration */
    await page.click('[data-testid="activity-button"]');
    await page.waitForTimeout(300);
    b.seatOffered = (await page.locator('[data-testid="agent-starter"]').textContent()).trim();
    await page.click('[data-testid="agent-starter"]');
    await page.waitForTimeout(2000);
    b.seatLog = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="diff-log"] li')].map((li) => li.textContent.trim()).slice(0, 4),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    b.afterSeat = (await districtText(page)).trim();
    b.seatPlantedSomething = !b.afterSeat.includes("none yet");

    /* ---- back to empty: a driven browser starts fresh, and ?fresh=1 is the way back */
    await page.goto(`${base}/?fresh=1`, { waitUntil: "networkidle" });
    await ready(page);
    b.freshIsEmptyAgain = (await districtText(page)).includes("none yet");

    /* ---- the derived form: select the empty district, take its offer, answer it */
    await page.goto(`${base}/?remember=1`, { waitUntil: "networkidle" });
    await ready(page);
    await page.click('[data-graview-view="kind:note"]');
    await page.waitForTimeout(500);
    const offers = page.locator('[data-testid="affordances"] button[data-affordance]');
    b.offers = await offers.allTextContents();
    await offers.filter({ hasText: "Add a note" }).first().click();
    await page.waitForTimeout(300);
    /*
     * The ask names its field IN WORDS. `label` is the declaration's
     * identifier; the pages face has always said "Label", and the scene
     * asked with the raw key — the same act reading two ways on two faces.
     */
    b.asksInWords = await page.evaluate(() => {
      const input = document.querySelector('[data-testid="inspector-strip"] input');
      return input ? { name: input.getAttribute("aria-label"), placeholder: input.placeholder } : null;
    });
    await page.fill('input[aria-label="Label"]', "Water the ferns");
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(700);
    b.afterForm = (await districtText(page)).trim();
    b.theFormAddedIt = !b.afterForm.includes("none yet");
    b.axeAfterDark = await (async () => {
      await page.click('[data-testid="scheme"]');
      await page.waitForTimeout(300);
      return axe(page);
    })();

    /* ---- it remembers: the same browser, asking to */
    await page.goto(`${base}/?remember=1`, { waitUntil: "networkidle" });
    await ready(page);
    b.afterReload = (await districtText(page)).trim();
    b.survivedAReload = !b.afterReload.includes("none yet");
    await page.click('[data-testid="activity-button"]');
    await page.waitForTimeout(300);
    b.saysRemembered = (await page.locator('[data-testid="remembered"]').textContent().catch(() => "")).trim();
    b.offersStartFresh = (await page.locator('[data-testid="start-fresh"]').count()) > 0;
    await page.keyboard.press("Escape");

    /* ---- the keyboard alone, on a blank app */
    /*
     * A new product's first record, with no pointer at all.
     *
     * The one district is the whole of a blank app's interface: selecting it
     * is what opens the strip, and the strip is where the first act lives.
     * The card was a tab stop that did nothing, so this could not be done —
     * and nothing measured it, because every other rehearsal clicks.
     */
    const keys = watch(await browser.newPage({ viewport: { width: 1280, height: 800 } }));
    await keys.goto(`${base}/?fresh=1`, { waitUntil: "networkidle" });
    await ready(keys);
    const tabUntil = async (find) => {
      for (let press = 0; press < 24; press += 1) {
        await keys.keyboard.press("Tab");
        await keys.waitForTimeout(80);
        if (await keys.evaluate(find)) return true;
      }
      return false;
    };
    b.keyboardReachedTheDistrict = await tabUntil(
      () => document.activeElement?.dataset?.graviewView === "kind:note",
    );
    await keys.keyboard.press("Enter");
    await keys.waitForTimeout(400);
    b.keyboardSelectedIt = (await keys.locator('[data-testid="inspector-strip"]').count()) === 1;
    b.keyboardReachedTheOffer = await tabUntil(() => Boolean(document.activeElement?.dataset?.affordance));
    await keys.keyboard.press("Enter");
    await keys.waitForTimeout(300);
    await keys.keyboard.type("Sharpen the shears");
    await keys.keyboard.press("Enter");
    await keys.waitForTimeout(800);
    b.afterKeyboard = (await districtText(keys)).trim();
    b.theKeyboardAloneAddedIt = !b.afterKeyboard.includes("none yet");
    await keys.close();

    /* ---- the routed face, from the same declaration, at phone width */
    const phone = watch(await browser.newPage({ viewport: { width: 390, height: 844 } }));
    await phone.goto(`${base}/pages?remember=1`, { waitUntil: "networkidle" });
    await phone.waitForTimeout(500);
    b.pagesHome = await phone.evaluate(() => document.body.textContent.includes("Notes"));
    b.pagesFitsAPhone = await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    await phone.goto(`${base}/pages/notes?remember=1`, { waitUntil: "networkidle" });
    await phone.waitForTimeout(500);
    const recordsBefore = await phone.locator('[data-testid="records"] a').count();
    await phone.fill('[data-testid="form-add-note"] input[name="label"]', "Repot the monstera");
    await phone.click('[data-testid="form-add-note"] button[type="submit"]');
    await phone.waitForTimeout(700);
    const recordsAfter = await phone.locator('[data-testid="records"] a').count();
    b.pagesRecords = [recordsBefore, recordsAfter];
    b.pagesFormApplied = recordsAfter === recordsBefore + 1;
    // The project's own record page, over the derived one.
    await phone.locator('[data-testid="records"] a').first().click();
    await phone.waitForTimeout(600);
    b.ownRecordPage = (await phone.locator('[data-testid="note-page"]').count()) === 1;
    await phone.goBack();
    await phone.waitForTimeout(400);
    b.axePagesLight = await axe(phone);
    await phone.goto(`${base}/pages/notes?remember=1&theme=dark`, { waitUntil: "networkidle" });
    await phone.waitForTimeout(500);
    b.axePagesDark = await axe(phone);

    b.errors = errors;
    await browser.close();
    browser = undefined;
    stop(vite);
    vite = undefined;
  } else {
    report.browser.skipped = "--no-browser";
  }

  /* =============================================================== pnpm */
  const viaPnpm = resolve(scratch, "field-notes-pnpm");
  run(process.execPath, [cli, "create", viaPnpm, "--name", "Field Notes", "--kind", "note", "--pm", "pnpm", "--no-install"], scratch);
  const pnpmManifest = JSON.parse(readFileSync(resolve(viaPnpm, "package.json"), "utf8"));
  writeFileSync(resolve(viaPnpm, "package.json"), `${JSON.stringify(pinToTarballs(pnpmManifest, tarballs), null, 2)}\n`);
  report.pnpm.ciUsesPnpm = readFileSync(resolve(viaPnpm, ".github/workflows/ci.yml"), "utf8").includes("pnpm/action-setup");
  run("pnpm", ["install", "--silent"], viaPnpm);
  report.pnpm.installed = true;
  run("pnpm", ["verify"], viaPnpm);
  report.pnpm.verified = true;
  report.pnpm.checkSaid = checkerSentence(run("pnpm", ["check"], viaPnpm));

  /* ============================================================== vowel */
  /*
   * "Add a item" was on the first screen of every project whose kind began
   * with a vowel — the scaffolder wrote the article as a literal. It is
   * derived from the kind's own word now, so the generated prose is read as
   * prose: every "a" in it, against the word that follows.
   */
  const vowel = resolve(scratch, "vowel-app");
  run(process.execPath, [cli, "create", vowel, "--name", "Walk", "--kind", "item", "--plural", "items", "--pm", "npm", "--no-install"], scratch);
  const vowelProse = tree(vowel)
    .filter((path) => path.startsWith("src/") || path === "README.md")
    .map((path) => readFileSync(resolve(vowel, path), "utf8"))
    .join("\n");
  report.vowel = {
    theAddActSaysAn: vowelProse.includes('title: "Add an item"'),
    theKindDescriptionSaysAn: vowelProse.includes("An item: something Walk keeps track of."),
    articlesBeforeVowels: vowelProse.match(/\ba (?=[aeiou])[a-z]+/g) ?? [],
  };

  /* =============================================================== door */
  const doorHost = resolve(scratch, "door-host");
  mkdirSync(doorHost);
  writeFileSync(
    resolve(doorHost, "package.json"),
    `${JSON.stringify(pinToTarballs({ name: "door-host", private: true, dependencies: { "create-graview": "*" } }, tarballs), null, 2)}\n`,
  );
  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], doorHost);
  const doorOut = run("npx", ["create-graview", "door-app", "--name", "Field Notes", "--kind", "note", "--pm", "npm", "--no-install"], doorHost);
  report.door.said = doorOut.split("\n")[0];
  report.door.tree = tree(resolve(doorHost, "door-app"));
  report.door.sameProject =
    JSON.stringify(report.door.tree) === JSON.stringify(report.npm.tree) &&
    readFileSync(resolve(doorHost, "door-app/src/domain/app.ts"), "utf8") === readFileSync(resolve(app, "src/domain/app.ts"), "utf8");

  /* =============================================================== link */
  const linked = resolve(scratch, "linked-orders");
  // Through the CLI's own install this time — and a kind with a hyphen in it.
  const linkOut = run(
    process.execPath,
    [cli, "create", linked, "--name", "Linked Orders", "--kind", "work-order", "--plural", "work-orders", "--link", repoRoot, "--pm", "pnpm"],
    scratch,
  );
  report.linked.said = linkOut.split("\n").filter((line) => line.startsWith("graview create:"));
  const linkedManifest = JSON.parse(readFileSync(resolve(linked, "package.json"), "utf8"));
  report.linked.consumesByPath = Object.values(linkedManifest.dependencies).some((spec) => String(spec).startsWith("link:"));
  report.linked.skills = existsSync(resolve(linked, ".claude/skills/graview-ship/SKILL.md")) && existsSync(resolve(linked, ".agents/skills/graview-ship/SKILL.md"));
  run("pnpm", ["verify"], linked);
  report.linked.verified = true;
  report.linked.checkSaid = checkerSentence(run("pnpm", ["check"], linked));
  report.linked.hyphenatedKind = readFileSync(resolve(linked, "src/domain/mutations.ts"), "utf8").includes('"add-work-order"');
  report.linked.gitInitialised = existsSync(resolve(linked, ".git/HEAD"));
  report.linked.ciChecksOutTheFramework = readFileSync(resolve(linked, ".github/workflows/ci.yml"), "utf8").includes("repository: en-dash-consulting/graview");

  // And the linked dev server in a browser: the aliases into the framework's
  // sources, the dedupe, and the allowed directory are what this shape adds,
  // and a headless verify exercises none of them.
  if (withBrowser) {
    const port = 5178;
    vite = await startVite(linked, port);
    browser = await launchEngine(engineName(), { headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error.message ?? error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`http://localhost:${port}/?remember=1`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => "__graviewReady" in window, null, { timeout: 30_000 });
    await page.waitForTimeout(500);
    await page.click('[data-graview-view="kind:work-order"]');
    await page.waitForTimeout(500);
    await page.locator('[data-testid="affordances"] button[data-affordance]').filter({ hasText: "Add a work order" }).first().click();
    await page.waitForTimeout(300);
    await page.fill('input[aria-label="Label"]', "Replace the pump");
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(700);
    report.linked.browser = {
      districtAfterAdd: (await page.locator('[data-graview-view="kind:work-order"]').first().textContent()).trim(),
      errors,
    };
    await browser.close();
    browser = undefined;
    stop(vite);
    vite = undefined;
  }
} catch (error) {
  report.error = trimmed(error);
} finally {
  if (browser) await browser.close().catch(() => {});
  stop(vite);
  if (!process.argv.includes("--keep")) rmSync(scratch, { recursive: true, force: true });
}

const b = report.browser;
const clean = (violations) => Array.isArray(violations) && violations.length === 0;
report.verdict = {
  theScaffoldWroteAProject: (report.npm.tree ?? []).length === 18,
  itInstalledFromTheTarballsWithNpm: report.npm.installed === true && report.npm.lockfile === true,
  itsOwnVerifyPassed: report.npm.verified === true,
  theCheckerActuallySpoke: typeof report.npm.checkSaid === "string" && report.npm.checkSaid.includes("no problems found"),
  anEdgeToAnUndeclaredKindFailsTsc: report.npm.brokenSchemaTypechecked === false,
  theDeclarationLoadsOutsideABundler: report.npm.docsWritten === true && report.npm.docsNameTheActs === true,
  theSkillsLandedForBothAssistants: report.npm.skills === true,
  itBuiltASite: report.npm.built === true,
  ...(withBrowser
    ? {
        theFirstScreenIsOneDistrictSayingNoneYet: b.districts === 1 && b.saysNoneYet === true,
        theBrandIsTheProductsName: b.wordmarkSaysTheName === true,
        theSeatPlantsStarterDataFromTheDeclaration: b.seatPlantedSomething === true && (b.seatLog ?? []).length > 0,
        freshIsTheWayBackToEmpty: b.freshIsEmptyAgain === true,
        theEmptyDistrictOffersTheFirstNote: (b.offers ?? []).some((text) => text.includes("Add a note")),
        theAskNamesItsFieldInWords: b.asksInWords?.name === "Label" && b.asksInWords?.placeholder === "Label",
        theDerivedFormAddsIt: b.theFormAddedIt === true,
        theKeyboardAloneMakesTheFirstRecord:
          b.keyboardReachedTheDistrict === true &&
          b.keyboardSelectedIt === true &&
          b.keyboardReachedTheOffer === true &&
          b.theKeyboardAloneAddedIt === true,
        anEditSurvivesAReload: b.survivedAReload === true && b.offersStartFresh === true,
        thePagesFaceFitsAPhoneAndItsFormApplies: b.pagesHome === true && b.pagesFitsAPhone === true && b.pagesFormApplied === true,
        theProjectsOwnPageReplacesTheDerivedOne: b.ownRecordPage === true,
        axeFindsNothingInEitherScheme: clean(b.axeEmptyLight) && clean(b.axeAfterDark) && clean(b.axePagesLight) && clean(b.axePagesDark),
        nothingErroredInTheBrowser: Array.isArray(b.errors) && b.errors.length === 0,
      }
    : {}),
  theSameProjectVerifiesUnderPnpm: report.pnpm.verified === true && (report.pnpm.checkSaid ?? "").includes("no problems found") && report.pnpm.ciUsesPnpm === true,
  npmCreateGraviewMakesTheSameProject: report.door.sameProject === true,
  aVowelKindIsSpokenWithAn:
    report.vowel?.theAddActSaysAn === true &&
    report.vowel?.theKindDescriptionSaysAn === true &&
    (report.vowel?.articlesBeforeVowels ?? ["unrun"]).length === 0,
  aLinkedProjectInstallsSkillsAndVerifies:
    report.linked.verified === true && report.linked.skills === true && (report.linked.checkSaid ?? "").includes("no problems found"),
  aHyphenatedKindWorksEndToEnd: report.linked.hyphenatedKind === true && report.linked.verified === true,
  aLinkedProjectIsARepositoryWhoseCiCanBuildTheFramework:
    report.linked.gitInitialised === true && report.linked.ciChecksOutTheFramework === true,
  ...(withBrowser
    ? {
        theLinkedDevServerRunsInABrowser:
          report.linked.browser?.errors?.length === 0 && !(report.linked.browser?.districtAfterAdd ?? "none yet").includes("none yet"),
      }
    : {}),
};
report.passed = Object.values(report.verdict).every(Boolean) && !report.error;

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/create.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n`);
if (report.error) process.stdout.write(`\n${report.error}\n`);
process.exit(report.passed ? 0 : 1);
