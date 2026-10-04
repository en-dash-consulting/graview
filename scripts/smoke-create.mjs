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
import { portFor } from "./lib/ports.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const scratch = mkdtempSync(join(tmpdir(), "graview-create-"));
const cli = resolve(repoRoot, "packages/graview/dist/cli.js");
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
    const port = portFor("created");
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
    await page.fill('input[aria-label="Name"]', "Water the ferns");
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(700);
    b.afterForm = (await districtText(page)).trim();
    b.theFormAddedIt = !b.afterForm.includes("none yet");

    /*
     * ESCAPE, FROM THE SCREEN A SCAFFOLDED APP OPENS ON.
     *
     * This app's home is altitude, and the provider lands a focusless
     * descent back on the overview on purpose — so the overview rung of the
     * ladder moved nothing and fell through to nothing, and Escape did
     * nothing at all from the first screen. A selection made here, then one
     * press: the selection has to come off, and the altitude has to stay.
     */
    await page.click('[data-graview-view="kind:note"]');
    await page.waitForTimeout(400);
    const escapeState = () =>
      page.evaluate(() => ({
        hash: location.hash,
        atAltitude:
          document.querySelector('[data-testid="overview"]')?.getAttribute("aria-pressed") === "true",
      }));
    b.escape = { selected: await escapeState() };
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    b.escape.pressed = await escapeState();
    b.axeAfterDark = await (async () => {
      /* The scheme lives in the profile now, with the reader's own
         settings — the bar's toggle was a second control for one setting. */
      await page.click('[data-testid="profile-button"]');
      await page.waitForTimeout(300);
      await page.click('[data-testid="profile-scheme-dark"]');
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

    /* ---- the scene at phone width: chrome must not sit on the content */
    /*
     * A rail needs a gutter, and 390 has none. The actions strip is placed
     * from the SCENE's box rather than the window's — an embed in a column
     * of an article is narrow on the widest monitor there is — and where
     * there is no room beside the picture it goes along the bottom. What
     * must never happen is the pane sitting on the thing you are acting on.
     */
    const narrow = watch(await browser.newPage({ viewport: { width: 390, height: 844 } }));
    // The embed page, at phone width: a box about 350 wide, which is the
    // shape a Graview in a column of an article has on any monitor.
    await narrow.goto(`${base}/embed.html`, { waitUntil: "networkidle" });
    await narrow.waitForTimeout(1500);
    // An empty graph has nothing to act on: put one thing in it, then go in.
    await narrow.click('#here [data-graview-view^="kind:"]');
    await narrow.waitForTimeout(400);
    /*
     * At phone width the acts are in the companion's sheet along the
     * bottom, which starts closed so the picture is the first thing
     * (348328a). A person opens it; so does this.
     */
    if ((await narrow.getAttribute('#here [data-testid="companion-dock"]', "aria-expanded")) === "false") {
      await narrow.click('#here [data-testid="companion-dock"]');
      await narrow.waitForTimeout(300);
    }
    await narrow.click('#here [data-testid="affordances"] button[data-affordance]', { timeout: 10_000 }).catch(async (error) => {
      // What the narrow Graview showed instead is the finding.
      const seen = await narrow.evaluate(() => ({
        testids: [...new Set([...document.querySelectorAll("#here [data-testid]")].map((el) => el.getAttribute("data-testid")))].slice(0, 60),
        affordances: document.querySelectorAll("#here [data-testid='affordances']").length,
        buttons: [...document.querySelectorAll("#here button")].map((el) => el.textContent?.trim()).filter(Boolean).slice(0, 30),
      }));
      throw new Error(`${error.message.split("\n")[0]} — the narrow page showed ${JSON.stringify(seen)}`);
    });
    await narrow.waitForTimeout(300);
    await narrow.fill('#here input[aria-label="Name"]', "Sweep the path");
    await narrow.click('#here [data-testid="inspector-strip"] button[type="submit"]');
    await narrow.waitForTimeout(700);
    await narrow.click('#here [data-testid^="open-"]');
    await narrow.waitForTimeout(500);
    await narrow.dblclick("#here [data-graview-pick]");
    await narrow.waitForTimeout(900);
    b.narrow = await narrow.evaluate(() => {
      const found = document.querySelector('#here [data-testid="inspector-strip"]');
      const focus = document.querySelector('#here [data-graview-plane="0"] [data-graview-primitive="panel"]');
      if (!found || !focus) return { strip: Boolean(found), focus: Boolean(focus) };
      /*
       * The strip is a section of the companion's sheet at this width, and
       * the sheet scrolls: it is the SHEET that must stay inside the
       * Graview and off the thing being acted on.
       */
      const strip = found.closest('[data-testid="companion"]') ?? found;
      const a = strip.getBoundingClientRect();
      const b = focus.getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const over = w > 0 && h > 0 ? w * h : 0;
      /*
       * The box the pane belongs to is the one it is positioned in — which
       * in a narrow Graview is bigger than the stage, because the stage
       * gives up room for the sheet rather than being covered by it.
       */
      const stage = document.querySelector("#here").getBoundingClientRect();
      /*
       * And nothing the picture drew is buried under it: a control a
       * person needs, covered by the pane that appeared over it, is the
       * same defect said a different way.
       */
      const buried = [...document.querySelectorAll("#here [data-testid^='open-'], #here [data-graview-pick]")]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          if (box.width < 2 || box.height < 2) return false;
          const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return Boolean(top && strip.contains(top));
        })
        .map((el) => el.getAttribute("data-testid") ?? el.getAttribute("data-graview-pick"));
      return {
        strip: true,
        focus: true,
        share: Math.round((over / (b.width * b.height)) * 100),
        buried,
        inside: a.left >= stage.left - 1 && a.right <= stage.right + 1 && a.bottom <= stage.bottom + 1,
      };
    });
    /*
     * THE PROFILE STAYS IN THE EMBED (W-119). It hung from its button's
     * right edge, 280 wide: in a 350-wide embed it began off the screen,
     * and the embed's own `overflow: hidden` cut it.
     */
    await narrow.click('#here [data-testid="profile-button"]');
    await narrow.waitForTimeout(400);
    b.profileInEmbed = await narrow.evaluate(() => {
      const box = document.querySelector("#here").getBoundingClientRect();
      const pane = document.querySelector('#here [data-testid="profile"]');
      if (!pane) return { pane: false };
      const r = pane.getBoundingClientRect();
      return { pane: true, inside: r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1 };
    });
    await narrow.close();

    /* ---- somebody else's page: the embed the project ships with */
    /*
     * A project's `embed.html` is an ordinary page with the app mounted into
     * one element of it. What must be true there is not what is true at the
     * app's own address: the host owns the `main`, the embed brings a named
     * region of its own, and nothing it draws sits outside a landmark.
     */
    const host = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
    await host.goto(`${base}/embed.html`, { waitUntil: "networkidle" });
    await host.waitForTimeout(1500);
    b.embed = await host.evaluate(() => {
      const root = document.getElementById("here")?.firstElementChild;
      return {
        mounted: Boolean(root),
        tag: root?.tagName ?? null,
        named: root?.getAttribute("aria-label") ?? null,
        mains: document.querySelectorAll("main").length,
        // The host page's own look, untouched by the app inside it.
        hostFont: getComputedStyle(document.body).fontFamily.slice(0, 8),
        rootTheme: getComputedStyle(document.documentElement).getPropertyValue("--graview-accent"),
      };
    });
    b.axeEmbed = await axe(host);
    await host.close();

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

    /*
     * ---- the routed face's FIRST screen: an empty graph, the way in alone
     * on a page. axe had never seen it — every pass below seeds first — and
     * it had no level-one heading (W-091).
     */
    const blank = watch(await browser.newPage({ viewport: { width: 390, height: 844 } }));
    await blank.goto(`${base}/pages`, { waitUntil: "networkidle" });
    await blank.waitForTimeout(500);
    b.axePagesEmpty = await axe(blank);
    await blank.close();

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
    const port = portFor("linked");
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
    await page.fill('input[aria-label="Name"]', "Replace the pump");
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
  // The profile pane opens inside a narrow embed's box, not off its side (W-119).
  theProfileStaysInTheEmbed: b.profileInEmbed?.pane === true && b.profileInEmbed?.inside === true,
  theScaffoldWroteAProject: (report.npm.tree ?? []).length === 20,
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
        theAskNamesItsFieldInWords: b.asksInWords?.name === "Name" && b.asksInWords?.placeholder === "Name",
        theDerivedFormAddsIt: b.theFormAddedIt === true,
        // The top rung of the ladder does not swallow the rest of it.
        escapeDoesSomethingFromTheFirstScreen:
          b.escape?.selected?.hash?.includes("sel=") === true &&
          b.escape?.pressed?.hash?.includes("sel=") === false &&
          b.escape?.selected?.atAltitude === true &&
          b.escape?.pressed?.atAltitude === true,
        // A quarter of the card is a pane lapping its margin; most of it is
        // the pane sitting on the thing you came to act on.
        theStripDoesNotCoverWhatYouAreActingOn:
          b.narrow?.strip === true &&
          b.narrow?.focus === true &&
          b.narrow?.inside === true &&
          (b.narrow?.share ?? 100) === 0 &&
          (b.narrow?.buried ?? ["unrun"]).length === 0,
        theProjectMountsItselfOnSomebodyElsesPage:
          b.embed?.mounted === true &&
          b.embed?.tag === "SECTION" &&
          typeof b.embed?.named === "string" &&
          b.embed?.mains === 1 &&
          b.embed?.hostFont?.startsWith("Georgia") === true &&
          b.embed?.rootTheme === "" &&
          clean(b.axeEmbed),
        theKeyboardAloneMakesTheFirstRecord:
          b.keyboardReachedTheDistrict === true &&
          b.keyboardSelectedIt === true &&
          b.keyboardReachedTheOffer === true &&
          b.theKeyboardAloneAddedIt === true,
        anEditSurvivesAReload: b.survivedAReload === true && b.offersStartFresh === true,
        thePagesFaceFitsAPhoneAndItsFormApplies: b.pagesHome === true && b.pagesFitsAPhone === true && b.pagesFormApplied === true,
        theProjectsOwnPageReplacesTheDerivedOne: b.ownRecordPage === true,
        axeFindsNothingInEitherScheme: clean(b.axeEmptyLight) && clean(b.axeAfterDark) && clean(b.axePagesLight) && clean(b.axePagesDark) && clean(b.axePagesEmpty),
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
