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
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BROWSER =
  process.env["GRAVIEW_BROWSER"] ??
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary";
const out = resolve(repoRoot, "docs/survey");

/** Every landing place, and how to get to it from a fresh load. */
const APPS = {
  todo: {
    port: 5193,
    ready: "__todoReady",
    states: {
      lists: async () => {},
      week: async (page) => {
        await page.locator('[data-testid="places"] button', { hasText: "The week" }).click();
      },
      selected: async (page) => {
        await page.click('[data-graview-pick="t-deposit"]');
      },
      // The screen you land on by DOUBLE CLICKING, which is the one nobody
      // designs and everybody meets.
      travelled: async (page) => {
        await page.dblclick('[data-graview-pick="t-deposit"]');
      },
      jackedIn: async (page) => {
        await page.dblclick('[data-graview-pick="t-deposit"]');
        await page.waitForTimeout(800);
        const id = await page.getAttribute('[data-graview-plane="0"]', "data-graview-view");
        await page.dblclick(`[data-graview-view="${id}"]`);
      },
      graview: async (page) => {
        await page.click('[data-testid="overview"]');
      },
      tidied: async (page) => {
        await page.click('[data-testid="agent-tidy"]');
        await page.waitForTimeout(1400);
      },
    },
  },
  launcher: {
    port: 5199,
    ready: "__launcherReady",
    states: {
      home: async () => {},
    },
  },
  the household example: {
    port: 5190,
    ready: "__the household exampleReady",
    states: {
      home: async () => {},
      selected: async (page) => {
        const span = await page.getAttribute("[data-graview-span]", "data-graview-span");
        await page.click(`[data-graview-pick="${span}"]`);
      },
      raised: async (page) => {
        await page.click('[data-graview-view="kind:person"]');
      },
      focused: async (page) => {
        await page.click('[data-graview-view="kind:person"]');
        await page.waitForTimeout(700);
        const id = await page.getAttribute('[data-graview-plane="1"]', "data-graview-view");
        await page.dblclick(`[data-graview-view="${id}"]`);
      },
      // Double-clicking a span in the calendar: the screen you TRAVEL to.
      travelled: async (page) => {
        const span = await page.getAttribute("[data-graview-span]", "data-graview-span");
        await page.dblclick(`[data-graview-pick="${span}"]`);
      },
      jackedIn: async (page) => {
        await page.click('[data-graview-view="kind:rationale"]');
        await page.waitForTimeout(700);
        const id = await page.getAttribute('[data-graview-plane="1"]', "data-graview-view");
        await page.dblclick(`[data-graview-view="${id}"]`);
      },
      graview: async (page) => {
        await page.click('[data-testid="overview"]');
      },
      menu: async (page) => {
        const span = await page.getAttribute("[data-graview-span]", "data-graview-span");
        await page.click(`[data-graview-pick="${span}"]`, { button: "right" });
      },
      activity: async (page) => {
        await page.click('[data-testid="agent-rebalance"]');
        await page.waitForSelector('[data-testid="activity-button"]', { timeout: 30_000 });
        await page.waitForTimeout(1500);
        await page.click('[data-testid="activity-button"]');
      },
    },
  },
  proposal: {
    port: 5191,
    ready: "__proposalReady",
    states: {
      home: async () => {},
      selected: async (page) => {
        const pick = await page.getAttribute("[data-graview-pick]", "data-graview-pick");
        await page.click(`[data-graview-pick="${pick}"]`);
      },
      jackedIn: async (page) => {
        const pick = await page.getAttribute("[data-graview-pick]", "data-graview-pick");
        await page.dblclick(`[data-graview-pick="${pick}"]`);
        await page.waitForTimeout(800);
        const id = await page.getAttribute('[data-graview-plane="0"]', "data-graview-view");
        await page.dblclick(`[data-graview-view="${id}"]`);
      },
      graview: async (page) => {
        await page.click('[data-testid="overview"]');
      },
    },
  },
  the coaching example: {
    port: 5192,
    ready: "__the coaching exampleReady",
    states: {
      team: async () => {},
      training: async (page) => {
        await page.locator('[data-testid="places"] button', { hasText: "What we train" }).click();
      },
      week: async (page) => {
        await page.locator('[data-testid="places"] button', { hasText: "The week" }).click();
      },
      selected: async (page) => {
        await page.click('[data-graview-pick="p-amara"]');
      },
      travelled: async (page) => {
        await page.dblclick('[data-graview-pick="p-amara"]');
      },
      withheld: async (page) => {
        await page.selectOption('[data-testid="seat"] select', "player");
        await page.waitForTimeout(300);
        await page.click('[data-graview-pick="pos-lb"]');
      },
      jackedIn: async (page) => {
        await page.dblclick('[data-graview-pick="p-amara"]');
        await page.waitForTimeout(900);
        const id = await page.getAttribute('[data-graview-plane="0"]', "data-graview-view");
        await page.dblclick(`[data-graview-view="${id}"]`);
      },
      graview: async (page) => {
        await page.click('[data-testid="overview"]');
      },
    },
  },
};

function startVite(name, port) {
  const child = spawn("npx", ["vite"], {
    cwd: resolve(repoRoot, `apps/${name}`),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  return new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("vite did not start")), 40_000);
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
   * every deliberately ellipsised label — a matrix column head, a clamped
   * description — was reported as a defect while the real one, a rotated
   * header shaved by a single pixel at the top, was not. An ellipsis is a
   * decision; a hard edge with text behind it is a bug.
   */
  const overflowing = within("*")
    .filter((el) => {
      const style = getComputedStyle(el);
      if (style.display === "none") return false;
      if (style.textOverflow === "ellipsis") return false;
      if (style.webkitLineClamp && style.webkitLineClamp !== "none") return false;
      // A scroll region can be scrolled to, so it is not lost either.
      if (style.overflowY === "auto" || style.overflowY === "scroll") return false;
      const clipped =
        el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2;
      return clipped && el.clientWidth > 0 && style.overflow !== "visible";
    })
    .slice(0, 8)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      by: Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight),
      text: (el.textContent ?? "").trim().slice(0, 40),
    }));

  const unnamed = within("button, [role=button], a, select, input")
    .filter((el) => {
      const name =
        el.getAttribute("aria-label") ??
        el.getAttribute("title") ??
        (el.textContent ?? "").trim();
      return name.length === 0;
    })
    .slice(0, 8)
    .map((el) => el.tagName.toLowerCase());

  // A page whose content stops a long way up is a page with nothing on it.
  return {
    viewport: [vw, vh],
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
        const text = (el.textContent ?? "").trim();
        if (text.length < 8) continue;
        seen.set(text, (seen.get(text) ?? 0) + 1);
      }
      return [...seen.entries()].filter(([, n]) => n > 1).map(([text, n]) => ({ text, n }));
    })(),
  };
};

const only = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const report = { at: new Date().toISOString(), shots: [] };
let browser;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

try {
  browser = await chromium.launch({
    executablePath: BROWSER,
    headless: !process.argv.includes("--headed"),
    args: ["--enable-blink-features=CanvasDrawElement"],
  });

  for (const [name, app] of Object.entries(APPS)) {
    if (only && only !== name) continue;
    const vite = await startVite(name, app.port);
    try {
      for (const scheme of ["light", "dark"]) {
        for (const [state, go] of Object.entries(app.states)) {
          const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
          try {
            await page.goto(`http://localhost:${app.port}/?theme=${scheme}`, {
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
      try {
        process.kill(-vite.pid, "SIGKILL");
      } catch {
        vite.kill("SIGKILL");
      }
    }
  }
} catch (error) {
  report.error = String(error);
} finally {
  await browser?.close();
}

writeFileSync(resolve(repoRoot, "docs/survey.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
for (const shot of report.shots) {
  if (shot.error) {
    process.stdout.write(`FAIL ${shot.app}/${shot.state}/${shot.scheme}: ${shot.error}\n`);
    continue;
  }
  const flags = [
    shot.verticalFill < 55 ? `only ${shot.verticalFill}% tall` : "",
    shot.overflowing.length ? `${shot.overflowing.length} overflowing` : "",
    shot.unnamed.length ? `${shot.unnamed.length} unnamed controls` : "",
    shot.repeatedText.length ? `repeats: ${shot.repeatedText.map((r) => r.text.slice(0, 24)).join(" / ")}` : "",
  ].filter(Boolean);
  process.stdout.write(
    `${flags.length ? "??" : "ok"} ${`${shot.app}/${shot.state}/${shot.scheme}`.padEnd(34)} ${flags.join("; ")}\n`,
  );
}
