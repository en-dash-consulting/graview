#!/usr/bin/env node
/**
 * Every place a person can land, photographed.
 *
 * Not a test. A test asks whether a claim still holds; this asks what the
 * thing actually looks like, which is the question nothing else here answers.
 * The framework's harnesses all measure — criteria, contrast ratios, animation
 * frames — and a screen can pass every one of those and still be a page with
 * eight hundred pixels of nothing on it.
 *
 *   node scripts/survey-ui.mjs [app] [--headed]
 *
 * Writes docs/survey/<app>-<state>-<scheme>.png and docs/survey.json.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const out = resolve(repoRoot, "docs/survey");

/*
 * THE KEEPER'S WAYS IN, AND THE READER'S OWN SETTINGS, LIVE BEHIND THE
 * PROFILE. "Show the installation" and "Studio" were pills on the bar
 * beside the places, where every reader met two controls only a keeper can
 * use; the scheme was there AND in the pane, which is two controls for one
 * setting. A harness opens the pane before reaching for any of them.
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

/** Every landing place, and how to get to it from a fresh load. */
const APPS = {
  todo: {
    port: portFor("todo"),
    ready: "__todoReady",
    // The example is written around a day, so the screenshots pin it — a
    // survey whose pictures change every morning is a survey nobody can
    // compare.
    query: "&today=2026-09-01",
    states: {
      lists: async () => {},
      week: async (page) => {
        await page.locator('[data-testid="places"] button', { hasText: "The week" }).click();
      },
      selected: async (page) => {
        await page.click('[data-graview-pick="t-deposit"]');
      },
      /*
       * THE INSTALLATION, SHOWN — and the same screen for the seat that may
       * not see it. Who is here and who has been asked to are districts
       * beside the lists for the keeper, and are not there at all for a
       * member: the module is drawn only for those who administer it, so
       * this is a pair of screens rather than one screen and a refusal.
       */
      keeper: async (page) => {
        await openProfile(page);
        await page.click('[data-testid="show-installation"]');
        await page.waitForTimeout(700);
      },
      member: async (page) => {
        await page.goto(`${at("todo")}/?theme=light&today=2026-09-01&fresh=1&as=user-sam`, { waitUntil: "load" });
        await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
        await page.waitForTimeout(700);
      },
      /* What each role reaches, read from the policy the store refuses with. */
      reach: async (page) => {
        await openProfile(page);
        await page.click('[data-testid="show-installation"]');
        await page.waitForTimeout(500);
        await page.locator('nav[aria-label="Places"] button', { hasText: "Who may do what" }).click();
        await page.waitForTimeout(700);
      },
      // The screen you land on by DOUBLE CLICKING, which is the one nobody
      // designs and everybody meets.
      traveled: async (page) => {
        await page.dblclick('[data-graview-pick="t-deposit"]');
      },
      // The go-deeper gesture again, on the focus itself: ZOOMS it to most
      // of the scene, shelf and relations receding but present.
      zoomed: async (page) => {
        await page.dblclick('[data-graview-pick="t-deposit"]');
        await page.waitForTimeout(800);
        /*
         * On the DRAWN card, not the host: the host is the layout's box and
         * only its content is a target now, so the gesture lands on the
         * card's own bottom corner — padding, never a title or a chip.
         */
        const host = await page.$('[data-graview-plane="0"]');
        const card = (await host.$("[data-graview-natural] > *")) ?? (await host.$(":scope > :not(.graview-kind-tag)"));
        const box = await card.boundingBox();
        await page.mouse.dblclick(box.x + box.width - 14, box.y + box.height - 14);
      },
      graview: async (page) => {
        await page.click('[data-testid="overview"]');
      },
      /*
       * THE OTHER FACE, photographed like any state: the routed pages from
       * the same declaration, at the same two schemes.
       */
      pages: async (page) => {
        const scheme = new URL(page.url()).searchParams.get("theme");
        await page.goto(`${at("todo")}/pages?theme=${scheme}&today=2026-09-01`, { waitUntil: "networkidle" });
        await page.waitForTimeout(400);
      },
      pagesRecord: async (page) => {
        const scheme = new URL(page.url()).searchParams.get("theme");
        await page.goto(`${at("todo")}/pages/tasks/t-deposit?theme=${scheme}&today=2026-09-01`, { waitUntil: "networkidle" });
        await page.waitForTimeout(400);
      },
      tidied: async (page) => {
        await page.click('[data-testid="activity-button"]');
        await page.click('[data-testid="agent-tidy"]');
        await page.waitForTimeout(1400);
        // Photograph the tidied SCENE, not the popover the turn ran from.
        await page.mouse.click(60, 480);
        await page.waitForTimeout(400);
      },
    },
  },
  launcher: {
    port: portFor("launcher"),
    ready: "__launcherReady",
    states: {
      home: async () => {},
    },
  },
  seedbed: { port: portFor("seedbed"), ready: "__seedbedReady", states: {
    // The empty app's own first screen: a city of districts saying "none yet".
    empty: async () => {},
    /*
     * THE ROTATION, four years out. Everything else in the garden happens
     * inside one season; this is the picture that only exists because the
     * cell can coarsen to a month.
     */
    rotation: async (page) => {
      const scheme = new URL(page.url()).searchParams.get("theme");
      await page.goto(`${at("seedbed")}/?chapter=16&theme=${scheme}#focus=agg:rotation&in.view=the-rotation`, { waitUntil: "load" });
      await page.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 60_000 });
      await page.waitForTimeout(1100);
    },
    invited: async (p) => { await p.click('[data-graview-view="kind:gardener"]'); },
    planted: async (p) => {
      await p.click('[data-testid="activity-button"]');
      await p.waitForTimeout(300);
      await p.click('[data-testid="agent-starter"]');
      await p.waitForTimeout(1600);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(400);
    },
  } },
};

/**
 * The app this harness drives — borrowed if a dev server is already holding
 * the port, started and owned otherwise. See `lib/serve.mjs`: spawning a
 * second vite blindly meant every harness died with "vite did not start"
 * whenever anyone had the app open.
 */
function startVite(name, port) {
  return serving(name, port, repoRoot);
}

/**
 * What is on the page, in numbers.
 *
 * The screenshots are for looking at; this is so a regression in the obvious
 * things — a page that is mostly empty, text that overflows its box, a control
 * with no accessible name — is a value rather than something to spot by eye.
 */
const measure = () => {
  const vw = innerWidth;
  const vh = innerHeight;
  /*
   * Only what is ON TOP.
   *
   * A full page covers the scene, and the scene underneath still has its own
   * headings and its own overflow — so measuring the whole document reported
   * the covered scene's problems as the page's, and reported the page's own
   * heading as a duplicate of the card it was lifted from. Neither is
   * something a person can see.
   */
  const root = document.querySelector('[role="dialog"]') ?? document.body;
  const within = (selector) => [...root.querySelectorAll(selector)];
  const painted = within("*")
    .map((el) => el.getBoundingClientRect())
    .filter((box) => box.width > 4 && box.height > 4 && box.bottom > 0 && box.top < vh);
  const lowest = Math.max(0, ...painted.map((box) => box.bottom));
  const rightmost = Math.max(0, ...painted.map((box) => box.right));

  /*
   * Content cut WITHOUT SAYING SO.
   *
   * The first version flagged any element wider than its box, which meant
   * every deliberately ellipsized label — a matrix column head, a clamped
   * description — was reported as a defect while the real one, a rotated
   * header shaved by a single pixel at the top, was not. An ellipsis is a
   * decision; a hard edge with text behind it is a bug.
   */
  const behind = new Map();
  const overflowing = within("*")
    .filter((el) => {
      const style = getComputedStyle(el);
      if (style.display === "none") return false;
      if (style.textOverflow === "ellipsis") return false;
      // A crop that is hidden from assistive tech is a decision too: a lens drawn
      // small as a picture (a gallery's thumbnail) is cut to its frame on purpose.
      if (el.getAttribute("aria-hidden") === "true" || el.closest('[aria-hidden="true"]')) return false;
      /*
       * VISUALLY HIDDEN IS A DECISION TOO.
       *
       * The 1x1 clip-rect idiom — text present for a screen reader and absent
       * to the eye — is by construction an element whose content does not fit
       * its box, so it read here exactly like a caption cut off mid-word. It
       * was reported on every screen of every app (the wordmark's own `h1`),
       * which is twenty lines of noise for a count whose entire job is to
       * make one real cut visible. Same argument as the ellipsis above: an
       * ellipsis is a decision, a clip rect is a decision, a hard edge with
       * text behind it is a bug.
       */
      if (el.clientWidth <= 1 && el.clientHeight <= 1) return false;
      if (style.webkitLineClamp && style.webkitLineClamp !== "none") return false;
      // A scroll region can be scrolled to, so it is not lost either.
      if (style.overflowY === "auto" || style.overflowY === "scroll") return false;
      // And sideways: the places are tabs that scroll (FR-117), wider than their room on purpose.
      if ((style.overflowX === "auto" || style.overflowX === "scroll") && el.scrollHeight <= el.clientHeight + 2) return false;
      // The stage clips the city on purpose from altitude: flown closer, the
      // city runs past the window and the ground says how far the camera
      // reaches (data-graview-reach) — a district past the edge is panned to.
      if (el.hasAttribute("data-graview-stage") && el.closest("[data-graview-reach]")) return false;
      const clipped =
        el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2;
      if (!clipped || el.clientWidth <= 0 || style.overflow === "visible") return false;
      /*
       * AN INVISIBLE THING BEHIND THE EDGE IS NOT A CUT.
       *
       * A district card in the stack keeps its iso block resting eighteen
       * pixels below its foot at opacity zero, ready to rise from altitude;
       * clipping the card is what stops that invisible box from making the
       * stage scroll. The clip is a decision like the ellipsis above, and
       * what it clips cannot be seen — so the count asks what is actually
       * behind the edge, and only something a reader could have seen there
       * is a cut. A caption run off the bottom of a fixed-height box still
       * counts; a hidden drawing waiting its turn does not.
       */
      const box = el.getBoundingClientRect();
      const seen = (node) => {
        for (let at = node; at && at !== el; at = at.parentElement) {
          const s = getComputedStyle(at);
          if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.05) return false;
        }
        return true;
      };
      const culprit = [...el.querySelectorAll("*")].find((child) => {
        const r = child.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const past =
          r.right > box.right + 2 || r.bottom > box.bottom + 2 || r.left < box.left - 2 || r.top < box.top - 2;
        return past && seen(child);
      });
      if (!culprit) return false;
      behind.set(el, culprit);
      return true;
    })
    .slice(0, 8)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      by: Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight),
      text: (el.textContent ?? "").trim().slice(0, 40),
      // What is behind the edge, so the report names the cut and not only the box.
      behind: `${behind.get(el).tagName.toLowerCase()}.${[...behind.get(el).classList].join(".")} ${(behind.get(el).textContent ?? "").trim().slice(0, 30)}`,
    }));

  const unnamed = within("button, [role=button], a, select, input")
    .filter((el) => {
      // A picture drawn small is inert and hidden from assistive tech: its
      // controls are not controls (a gallery's thumbnails, W-118).
      if (el.closest('[inert], [aria-hidden="true"]')) return false;
      const name =
        el.getAttribute("aria-label") ??
        el.getAttribute("title") ??
        // A field named by the <label> around it is named.
        ((el.labels?.[0]?.textContent ?? "").trim() || (el.textContent ?? "").trim());
      return name.length === 0;
    })
    .slice(0, 8)
    .map((el) => el.tagName.toLowerCase());

  /*
   * Chrome sitting ON TOP of the CONTENT.
   *
   * The strip is an elevated transient surface: it floats in front of the
   * scene rather than reserving a band of it, and hovering over the
   * constant plane-2 shelf while a selection is open is the design — the
   * shelf is a map, the strip is dismissible, and the elevation shadow says
   * which is nearer. What would still be wrong is the strip sitting on a
   * real share of the focus or a raised card, so that is what this counts —
   * against the panel someone can see, not the band slot the layout allots.
   *
   * A menu at the pointer is EXCLUDED: covering the thing you right-clicked
   * is what a menu is for.
   */
  const covered = (() => {
    // A full page covers the scene on purpose; what is underneath it is not
    // something anyone can see, let alone something the strip is hiding.
    if (document.querySelector('[role="dialog"]')) return [];
    const strip = document.querySelector('[data-testid="inspector-strip"]');
    if (!strip) return [];
    const over = strip.getBoundingClientRect();
    return [...document.querySelectorAll("[data-graview-view]")]
      .filter((el) => Number(el.getAttribute("data-graview-plane")) < 2)
      .map((el) => ({
        id: el.getAttribute("data-graview-view"),
        box: (
          el.querySelector('[data-graview-primitive="panel"], .graview-kind-card') ?? el
        ).getBoundingClientRect(),
      }))
      .filter(({ box }) => {
        const w = Math.min(box.right, over.right) - Math.max(box.left, over.left);
        const h = Math.min(box.bottom, over.bottom) - Math.max(box.top, over.top);
        return w > 0 && h > 0 && w * h > Math.max(200, box.width * box.height * 0.06);
      })
      .map(({ id, box }) => ({
        id,
        by: Math.round(Math.min(box.bottom, over.bottom) - Math.max(box.top, over.top)),
      }));
  })();

  // A page whose content stops a long way up is a page with nothing on it.
  return {
    viewport: [vw, vh],
    covered,
    contentBottom: Math.round(lowest),
    contentRight: Math.round(rightmost),
    verticalFill: Math.round((lowest / vh) * 100),
    horizontalFill: Math.round((rightmost / vw) * 100),
    overflowing,
    unnamed,
    // Repeated headings are the "same string three times" smell.
    repeatedText: (() => {
      const seen = new Map();
      for (const el of within("h1,h2,h3,strong,dt")) {
        // A lens drawn small as a picture repeats its own
        // headings by construction, and is hidden from assistive tech.
        if (el.closest('[aria-hidden="true"]')) continue;
        const text = (el.textContent ?? "").trim();
        if (text.length < 8) continue;
        seen.set(text, (seen.get(text) ?? 0) + 1);
      }
      /*
       * A crumb naming the thing you traveled to is not a duplicate — that
       * is a breadcrumb beside a heading, which is how every document works.
       * What is a duplicate is chrome naming a PLACE the picture under it
       * also names, and that is what this is looking for.
       */
      const crumb = (document.querySelector("[data-testid=focused]")?.textContent ?? "")
        .replace(/\s*×\s*$/, "")
        .trim();
      return [...seen.entries()]
        .filter(([text, n]) => n > 1 && text !== crumb)
        .map(([text, n]) => ({ text, n }));
    })(),
  };
};

const only = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const report = { at: new Date().toISOString(), engine: ENGINE, shots: [] };
let browser;

/*
 * A filtered run replaces ITS OWN pictures, not everybody's.
 *
 * `node scripts/survey-ui.mjs todo` used to wipe the whole directory and put
 * back ten files, silently deleting the other forty — so a quick look at one
 * app left the survey a fifth of a survey, and the next person to open
 * docs/survey found most of it missing with nothing to say why.
 */
if (only) {
  mkdirSync(out, { recursive: true });
  for (const file of readdirSync(out)) {
    if (file.startsWith(`${only}-`)) rmSync(resolve(out, file), { force: true });
  }
} else {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
}

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });

  for (const [name, app] of Object.entries(APPS)) {
    if (only && only !== name) continue;
    const vite = await startVite(name, app.port);
    try {
      for (const scheme of ["light", "dark"]) {
        for (const [state, go] of Object.entries(app.states)) {
          const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
          try {
            await page.goto(`http://localhost:${app.port}/?theme=${scheme}${app.query ?? ""}`, {
              waitUntil: "load",
            });
            await page.waitForFunction((flag) => flag in window, app.ready, { timeout: 120_000 });
            await page.waitForTimeout(900);
            await go(page);
            await page.waitForTimeout(1100);
            const file = `${name}-${state}-${scheme}.png`;
            await page.screenshot({ path: resolve(out, file) });
            report.shots.push({ app: name, state, scheme, file, ...(await page.evaluate(measure)) });
          } catch (error) {
            report.shots.push({ app: name, state, scheme, error: String(error).slice(0, 200) });
          } finally {
            await page.close();
          }
        }
      }
    } finally {
      vite.stop();
    }
  }
} catch (error) {
  report.error = String(error);
} finally {
  await browser?.close();
}

writeFileSync(resolve(repoRoot, "docs/survey.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
let flagged = 0;
for (const shot of report.shots) {
  if (shot.error) {
    process.stdout.write(`FAIL ${shot.app}/${shot.state}/${shot.scheme}: ${shot.error}\n`);
    continue;
  }
  const flags = [
    shot.verticalFill < 55 ? `only ${shot.verticalFill}% tall` : "",
    shot.overflowing.length ? `${shot.overflowing.length} overflowing` : "",
    shot.unnamed.length ? `${shot.unnamed.length} unnamed controls` : "",
    shot.covered?.length ? `chrome covers ${shot.covered.length} views` : "",
    shot.repeatedText.length ? `repeats: ${shot.repeatedText.map((r) => r.text.slice(0, 24)).join(" / ")}` : "",
  ].filter(Boolean);
  if (flags.length) flagged += 1;
  process.stdout.write(
    `${flags.length ? "??" : "ok"} ${`${shot.app}/${shot.state}/${shot.scheme}`.padEnd(34)} ${flags.join("; ")}\n`,
  );
}
process.stdout.write(`\n${report.shots.length - flagged} of ${report.shots.length} screens clean\n`);

/*
 * A FLAG IS A FAILURE NOW.
 *
 * These were advisory for as long as twenty of twenty-six screens carried
 * one: the wordmark's own visually-hidden `h1` counted as a cut caption on
 * every screen of every app, so the `??` column was noise and a real cut
 * would have sat in the middle of it unnoticed. With the idiom recognized
 * for what it is, every screen is clean — and a count nobody has to read
 * past is a count that can be enforced.
 *
 * A pass that could not take its pictures is a FAILED pass too, and the
 * engine matrix reads this exit code — exiting 0 over broken shots made the
 * matrix's survey verdict vacuous.
 */
process.exit(report.error || flagged > 0 || report.shots.some((shot) => shot.error) ? 1 : 0);
