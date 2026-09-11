#!/usr/bin/env node
/**
 * An agent seat does what it says, and says when there is nothing to do.
 *
 * Every app's seat had the same button and the same three faults: it never said how
 * much there was to do, it stayed live and silently did nothing when there was
 * none, and a refusal from the store surfaced as an unhandled rejection.
 *
 *   node scripts/verify-seat.mjs
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

const SEATS = {
  todo: { port: 5193, ready: "__todoReady", testId: "agent-tidy", who: "tidy", query: "&today=2026-09-01" },
};

function startVite(name, port) {
  const child = spawn("npx", ["vite"], { cwd: resolve(repoRoot, `apps/${name}`), stdio: ["ignore", "pipe", "pipe"], detached: true });
  return new Promise((ok, no) => {
    const timer = setTimeout(() => no(new Error("vite did not start")), 60_000);
    child.stdout.on("data", (d) => { if (String(d).includes(String(port))) { clearTimeout(timer); ok(child); } });
    child.on("exit", (code) => { clearTimeout(timer); no(new Error(`vite exited with ${code}`)); });
  });
}

const criteria = [];
const check = (name, ok, detail = "") => { criteria.push({ name, ok, detail }); };

const browser = await launchEngine(ENGINE, { headless: true });
try {
  for (const [app, seat] of Object.entries(SEATS)) {
    const vite = await startVite(app, seat.port);
    try {
      const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 90)));
      await page.goto(`http://localhost:${seat.port}/?theme=light${seat.query ?? ""}`, { waitUntil: "load" });
      await page.waitForFunction((f) => f in window, seat.ready, { timeout: 60_000 });
      await page.waitForTimeout(1200);

      /*
       * THE SEAT YOU CAN TALK TO. Ask what's wrong; the graph answers with
       * the standing and the rules' own repairs as apply buttons; applying
       * one is an ordinary attributed change. Close it before the button
       * seat runs, so the two exchanges don't share a surface.
       */
      // The seat lives in the Activity popover now; open it the way a person
      // would. Clicks inside the popover keep it open, so one open serves
      // the whole exchange.
      await page.click('[data-testid="activity-button"]');
      await page.waitForTimeout(300);

      const read = () => page.evaluate((id) => {
        const b = document.querySelector(`[data-testid="${id}"]`);
        return {
          label: b?.textContent.trim() ?? null,
          disabled: b?.disabled ?? null,
          problems: document.querySelector('[data-testid="standing"]')?.textContent.trim() ?? null,
          activity: document.querySelector('[data-testid="activity-button"]')?.textContent.trim() ?? "",
        };
      }, seat.testId);

      const before = await read();
      check(`${app}: the seat says how much there is to do`,
        /\d/.test(before.label ?? "") && before.disabled === false, before.label);

      await page.click(`[data-testid="${seat.testId}"]`);
      await page.waitForTimeout(2500);
      const after = await read();

      check(`${app}: the turn actually changes the graph`,
        after.problems !== before.problems || /\d/.test(after.activity),
        `${before.problems} → ${after.problems}, activity "${after.activity}"`);
      check(`${app}: it goes quiet once there is nothing to do`,
        after.disabled === true && !/\d/.test(after.label ?? ""), after.label);
      check(`${app}: no unhandled rejection`, errors.length === 0, errors[0] ?? "");

      /*
       * WHOSE TURN IT WAS. Every seat in every app signed its ops "claude" —
       * a hardcoded id, so two seats on one embed were indistinguishable in
       * the history and a seat that is a rules mender or a scheduled job wore
       * a vendor's name. The seat says who is sitting in it now, and Activity
       * reads that back.
       */
      const signed = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="diff-log"] li strong')].map((el) =>
          el.textContent.trim(),
        ),
      );
      check(`${app}: the seat signs its own work`,
        signed.includes(seat.who) && !signed.includes("claude"),
        signed.slice(0, 3).join(", "));
      await page.close();

      // The permission claim, where there is a policy to narrow it.
    } finally {
      try { process.kill(-vite.pid, "SIGKILL"); } catch { vite.kill("SIGKILL"); }
    }
  }
} finally {
  await browser.close();
}

for (const c of criteria) {
  process.stdout.write(`${c.ok ? "ok  " : "FAIL"} ${c.name.padEnd(56)} ${c.detail}\n`);
}
const failed = criteria.filter((c) => !c.ok).length;
process.stdout.write(`\n${criteria.length - failed} of ${criteria.length} criteria hold\n`);
process.exitCode = failed ? 1 : 0;
