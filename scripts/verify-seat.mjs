#!/usr/bin/env node
/**
 * An agent seat does what it says, and says when there is nothing to do.
 *
 * Every app's seat had the same button and the same three faults: it never said how
 * much there was to do, it stayed live and silently did nothing when there was
 * none, and a refusal from the store surfaced as an unhandled rejection. The
 * the coaching example's was worse than that — it ran as a roleless agent against a policy
 * that grants selection to the coach, so it had never worked at all and said
 * so nowhere.
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
  todo: { port: 5193, ready: "__todoReady", testId: "agent-tidy", query: "&today=2026-09-01" },
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
      if (app === "the household example") {
        await page.click('[data-testid="chat"]');
        await page.waitForTimeout(300);
        await page.fill('[data-testid="chat-panel"] input', "what is wrong?");
        await page.click('[data-testid="chat-panel"] button[type="submit"]');
        await page.waitForTimeout(600);
        const chat = await page.evaluate(() => {
          const panel = document.querySelector('[data-testid="chat-panel"]');
          return {
            said: panel?.textContent ?? "",
            applies: panel?.querySelectorAll('[data-testid="chat-apply"]').length ?? 0,
          };
        });
        check("the household example: the chat states the standing in words",
          /problem|Nothing is broken/.test(chat.said), chat.said.slice(0, 70));
        let appliedOk = true;
        if (chat.applies > 0) {
          await page.click('[data-testid="chat-panel"] [data-testid="chat-apply"]');
          await page.waitForTimeout(600);
          appliedOk = await page.evaluate(() =>
            (document.querySelector('[data-testid="chat-panel"]')?.textContent ?? "").includes("Done —"),
          );
        }
        check("the household example: a chat proposal applies as an ordinary change",
          appliedOk, `${chat.applies} proposal(s)`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
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
      await page.close();

      // The permission claim, where there is a policy to narrow it.
      if (app === "the coaching example") {
        const p2 = await browser.newPage({ viewport: { width: 1560, height: 940 } });
        await p2.goto(`http://localhost:${seat.port}/?theme=light`, { waitUntil: "load" });
        await p2.waitForFunction((f) => f in window, seat.ready, { timeout: 60_000 });
        await p2.waitForTimeout(1000);
        await p2.selectOption('[data-testid="seat"] select', "analyst");
        await p2.waitForTimeout(800);
        // Changing seats clicked outside the popover, which closed it.
        await p2.click('[data-testid="activity-button"]');
        await p2.waitForTimeout(300);
        const narrowed = await p2.evaluate((id) => {
          const b = document.querySelector(`[data-testid="${id}"]`);
          return { disabled: b?.disabled, permitted: b?.dataset.agentPermitted ?? null, title: b?.title ?? "" };
        }, seat.testId);
        check("the coaching example: one policy narrows the seat as well as the strip",
          narrowed.disabled === true && narrowed.permitted === null,
          narrowed.title.slice(0, 76));
        await p2.close();

        // The chat, where problems actually exist: the standing in words,
        // a rule's own repair as a button, and the apply as an ordinary
        // attributed change confirmed in the thread.
        const p3 = await browser.newPage({ viewport: { width: 1560, height: 940 } });
        await p3.goto(`http://localhost:${seat.port}/?theme=light`, { waitUntil: "load" });
        await p3.waitForFunction((f) => f in window, seat.ready, { timeout: 60_000 });
        await p3.waitForTimeout(900);
        await p3.click('[data-testid="chat"]');
        await p3.fill('[data-testid="chat-panel"] input', "what is wrong?");
        await p3.click('[data-testid="chat-panel"] button[type="submit"]');
        await p3.waitForTimeout(600);
        const proposals = await p3.evaluate(
          () => document.querySelectorAll('[data-testid="chat-apply"]').length,
        );
        check("the coaching example: the chat proposes the rules' own repairs", proposals > 0, `${proposals} proposals`);
        await p3.click('[data-testid="chat-apply"]');
        await p3.waitForTimeout(700);
        const applied = await p3.evaluate(() => ({
          done: (document.querySelector('[data-testid="chat-panel"]')?.textContent ?? "").includes("Done —"),
          activity: document.querySelector('[data-testid="activity-button"]')?.textContent?.trim() ?? "",
        }));
        check("the coaching example: a chat apply is an ordinary attributed change",
          applied.done && applied.activity.length > 0, applied.activity);
        await p3.close();
      }
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
