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
       * WHAT IT DID, IN THE ACT'S OWN WORDS.
       *
       * The rail lists the calls a seat made, and listed them by the name
       * the mutation is REGISTERED under: "changed · close-item", the tool
       * surface's identifier read out in the one place a person looks to
       * see what an agent just did. Every act carries a title; this is the
       * same smell as a card named by its node id.
       */
      const said = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="activity"] li span')]
          .map((el) => (el.textContent ?? "").trim())
          .filter((text) => /^(changed|read) · /.test(text))
          .map((text) => text.replace(/^(changed|read) · /, "")),
      );
      check(`${app}: the rail says what the act is called, not what it is registered as`,
        said.length > 0 && said.every((name) => /^[A-Z]/.test(name) && !/[-_]/.test(name)),
        said.join(" | ") || "no calls listed");

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
      /*
       * A SEAT THAT MAY NOT SIT DOWN SAYS SO where the strike is. The reason
       * was a `title` on a disabled button and the label under it said
       * something else — "There is something here already" where the answer
       * was "not from this seat".
       */
      const refusedSeat = await page.evaluate((id) => {
        const button = document.querySelector(`[data-testid="${id}"]`);
        const why = document.querySelector(`[data-testid="${id}-why"]`);
        return {
          permitted: button?.getAttribute("data-agent-permitted"),
          struck: Boolean(button?.querySelector("s")),
          why: why?.textContent ?? null,
        };
      }, seat.testId);
      check(`${app}: a permitted seat is not struck through and needs no excuse`,
        refusedSeat.permitted === "true" && refusedSeat.struck === false && refusedSeat.why === null,
        JSON.stringify(refusedSeat));

      check(`${app}: the seat signs its own work`,
        signed.includes(seat.who) && !signed.includes("claude"),
        signed.slice(0, 3).join(", "));
      await page.close();

      // The permission claim, where there is a policy to narrow it.
    } finally {
      try { process.kill(-vite.pid, "SIGKILL"); } catch { vite.kill("SIGKILL"); }
    }
  }

  /*
   * AND TAKING IT BACK IS A CHANGE SOMEBODY MAKES.
   *
   * The store judges an undo the way it judges any other change — what you
   * may undo is what you may have done — and the rail's control called
   * `store.undo(batch)` with no author at all, so in any app with a policy
   * the store judged an anonymous principal, who may do nothing. A person
   * could not take back the edit they had just made, on a row that said
   * "you". Every app this harness drove was policy-free, so the refusal had
   * nowhere to happen. Seedbed's seventh chapter is the framework's own app
   * WITH one, sat in by a gardener who may sow.
   */
  const seedbed = await startVite("seedbed", 5194);
  try {
    const seven = await browser.newPage({ viewport: { width: 1560, height: 940 } });
    const seatErrors = [];
    seven.on("pageerror", (e) => seatErrors.push(String(e).slice(0, 90)));
    await seven.goto("http://localhost:5194/?chapter=7&theme=light#overview=1", { waitUntil: "load" });
    await seven.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 60_000 });
    await seven.waitForTimeout(1400);
    /*
     * An ordinary act this seat may take, from the strip — asked on a
     * MEMBER. A district's own creating act is the coordinator's, and a
     * gardener may legitimately not take it: standing there, everything is
     * withheld whether or not the seat is reaching the interface at all.
     */
    await seven.click('[data-testid="overview"]');
    await seven.waitForTimeout(900);
    const member = await seven.$("[data-graview-pick]");
    if (member) {
      await member.click();
      await seven.waitForTimeout(700);
    }
    const took = await seven
      // The OFFERED list, not the withheld one beside it: those are
      // deliberately disabled buttons carrying the policy's reason.
      .locator('[data-testid="affordances"] [data-affordance]')
      .first()
      .textContent()
      .catch(() => null);
    await seven.locator('[data-testid="affordances"] [data-affordance]').first().click();
    await seven.waitForTimeout(900);
    // Answer anything the act still wants, so there is a turn to take back.
    for (let step = 0; step < 3 && (await seven.$("[data-graview-asking]")) !== null; step++) {
      const choice = await seven.$("[data-graview-asking] button:not([disabled])");
      if (!choice) break;
      await choice.click();
      await seven.waitForTimeout(500);
    }
    await seven.click('[data-testid="activity-button"]');
    await seven.waitForTimeout(600);
    const turns = await seven.evaluate(
      () => document.querySelectorAll('[data-testid="diff-log"] li').length,
    );
    await seven.locator('[data-testid="undo-turn"]').first().click();
    await seven.waitForTimeout(900);
    const undone = await seven.evaluate(() => ({
      refused: document.querySelector('[data-testid="undo-refused"]')?.textContent ?? null,
      turns: document.querySelectorAll('[data-testid="diff-log"] li').length,
    }));
    check("seedbed: a person can take back their own edit where there is a policy",
      turns > 0 && undone.refused === null && undone.turns > turns,
      `took "${(took ?? "").trim()}" · ${turns} turns → ${undone.turns}${undone.refused ? ` · ${undone.refused}` : ""}`);
    check("seedbed: nothing threw on the way", seatErrors.length === 0, seatErrors[0] ?? "");
    await seven.close();
  } finally {
    try { process.kill(-seedbed.pid, "SIGKILL"); } catch { seedbed.kill("SIGKILL"); }
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
