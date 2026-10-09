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
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";
import { at, portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

const SEATS = {
  todo: { port: portFor("todo"), ready: "__todoReady", testId: "agent-tidy", who: "tidy", query: "&today=2026-09-01" },
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
      /*
       * IT FOUND WHAT IT CHANGED BY NAME, and said what it looked at. The
       * seat's first call is `search_graph` for the overdue tasks; a read's
       * records reach the rail as chips and the picture as attention.
       */
      const searched = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('[data-testid="activity"] li')];
        const row = rows.find((li) => /^read · Search graph/.test((li.querySelector("span:not([aria-hidden])")?.textContent ?? "").trim()));
        const reads = row ? [...row.querySelectorAll('[data-testid="activity-reads"] [data-graview-pick]')].map((chip) => chip.getAttribute("data-graview-pick")) : [];
        return { listed: Boolean(row), reads, all: rows.map((li) => (li.textContent ?? "").trim().slice(0, 60)).slice(0, 6) };
      });
      check(`${app}: the seat finds what it changes with search_graph, and the rail shows what it read`,
        searched.listed && searched.reads.includes("t-deposit"),
        `${searched.reads.join(", ") || "no reads"} · ${searched.all.join(" | ")}`);
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
    } finally {
      vite.stop();
    }
  }

  /*
   * TWO SEATS AT THE KEYBOARD OF THE APP PEOPLE OPEN FIRST.
   *
   * The installation is in the todo app now, which means the policy is
   * something a reader can stand on the other side of rather than read
   * about. The keeper is offered the acts that keep it; the member is told
   * they exist and who could run them, with the policy's own sentence — and
   * never meets a person or an invitation at all, because the module is
   * drawn only for those who administer it.
   */
  const things = await startVite("todo", portFor("todo"));
  try {
    const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 90)));

    const sitAs = async (as) => {
      await page.goto(`${at("todo")}/?theme=light&today=2026-09-01&fresh=1&as=${as}`, { waitUntil: "load" });
      await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
      await page.waitForTimeout(900);
    };
    /*
     * What the bar says about this seat. The seats live INSIDE the profile
     * pane — "who am I" and "be somebody else" are one question — so the
     * pane is opened to read them, and closed again so the next gesture
     * lands on the picture rather than on a popover.
     */
    const bar = async () => {
      await page.click('[data-testid="profile-button"]');
      // What is behind the person is fetched when first reached for (FR-131): wait for who is signed in.
      await page.waitForFunction(() => document.querySelector('[data-testid="profile"]')?.textContent?.includes("Signed in as"), null, { timeout: 10_000 });
      const said = await page.evaluate(() => ({
        // The person on the bar is a mark; who it is is its name (FR-131).
        signedInAs: document.querySelector('[data-testid="profile-button"]')?.getAttribute("aria-label")?.trim(),
        seats: [...document.querySelectorAll('[data-testid="profile"] [data-testid="seats"] button')].map(
          (b) => b.textContent.trim(),
        ),
        sittingAs: document
          .querySelector('[data-testid="profile"] [data-testid="seats"] button[aria-pressed="true"]')
          ?.textContent.trim(),
        canShow: document.querySelector('[data-testid="show-installation"]') !== null,
      }));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      return said;
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

    const districts = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-graview-view]")].map((e) =>
          e.getAttribute("data-graview-view"),
        ),
      );

    await sitAs("user-nora");
    const keeperBar = await bar();
    check("things: the bar says who is signed in, and the pane offers the other seat",
      keeperBar.signedInAs?.includes("Nora") === true &&
        keeperBar.seats.length === 2 &&
        keeperBar.sittingAs === "Nora, keeper",
      `${keeperBar.signedInAs} · ${keeperBar.seats.join(" / ")}`);

    await openProfile(page);
    await page.click('[data-testid="show-installation"]');
    await page.waitForTimeout(900);
    const raised = await districts();
    check("things: the keeper may show the installation, and its kinds rise beside the domain",
      keeperBar.canShow && raised.includes("kind:user") && raised.includes("kind:invitation"),
      raised.join(", "));

    /*
     * An act that KEEPS the installation, offered on the kind itself.
     *
     * Right-click rather than click: a plain click on a kind card at
     * altitude RAISES that relation and deliberately does not select, so
     * the strip would have stayed empty for reasons that have nothing to do
     * with the policy. Right-click always selects, and the menu it opens
     * reads the same derivation the strip does.
     */
    await page.click('[data-graview-view="kind:invitation"]', { button: "right" });
    await page.waitForSelector('[data-testid="context-menu"] [data-affordance]', { timeout: 10_000 });
    const keeperOffers = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="context-menu"] [data-affordance]')].map((b) =>
        b.textContent.trim(),
      ),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("things: the keeper is offered the act that begins an invitation",
      keeperOffers.some((label) => label.includes("Invite")),
      keeperOffers.join(" · ").slice(0, 90));

    /* The same app, the other seat. */
    await sitAs("user-sam");
    const memberBar = await bar();
    const memberDistricts = await districts();
    check("things: a member is never offered the installation at all — absent, not refused",
      memberBar.canShow === false &&
        !memberDistricts.includes("kind:user") &&
        !memberDistricts.includes("kind:invitation"),
      `${memberBar.sittingAs} · ${memberDistricts.join(", ")}`);

    /* And what a member IS told about a person's own record. */
    const refused = await page.evaluate(async () => {
      const response = await fetch("/pages/users/user-nora?today=2026-09-01");
      return response.ok;
    });
    check("things: the member's routed face still answers, and lists only their own kinds",
      refused === true,
      String(refused),
    );
    const memberKinds = await page.evaluate(async () => {
      window.location.href = "/pages?today=2026-09-01&as=user-sam";
      return true;
    });
    await page.waitForTimeout(1400);
    const listed = await page.evaluate(() =>
      [...document.querySelectorAll('nav[aria-label="Kinds"] a')].map((a) => a.textContent.trim()),
    );
    check("things: the routed face lists People only for the seat that keeps them",
      memberKinds && !listed.some((word) => word.startsWith("People")),
      listed.join(", "),
    );
    await page.goto(`${at("todo")}/pages?today=2026-09-01&as=user-nora`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const keeperListed = await page.evaluate(() =>
      [...document.querySelectorAll('nav[aria-label="Kinds"] a')].map((a) => a.textContent.trim()),
    );
    check("things: and lists them for the keeper",
      keeperListed.some((word) => word.startsWith("People")),
      keeperListed.join(", "),
    );

    check("things: nothing threw while the seats changed", errors.length === 0, errors[0] ?? "");
    await page.close();
  } finally {
    things.stop();
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
  const seedbed = await startVite("seedbed", portFor("seedbed"));
  try {
    const seven = await browser.newPage({ viewport: { width: 1560, height: 940 } });
    const seatErrors = [];
    seven.on("pageerror", (e) => seatErrors.push(String(e).slice(0, 90)));
    await seven.goto(`${at("seedbed")}/?chapter=7&theme=light#overview=1`, { waitUntil: "load" });
    await seven.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 60_000 });
    await seven.waitForTimeout(1400);
    /*
     * An ordinary act this seat may take, from its acts — asked on a
     * MEMBER. A district's own creating act is the coordinator's, and a
     * gardener may legitimately not take it: standing there, everything is
     * withheld whether or not the seat is reaching the interface at all.
     */
    await seven.click('[data-testid="overview"]');
    await seven.waitForTimeout(900);
    const member = await seven.$("[data-graview-pick]");
    if (member) {
      // Its acts: the menu a right-click opens on it.
      await member.click({ button: "right" });
      await seven.waitForTimeout(700);
    }
    const took = await seven
      // The OFFERED list, not the withheld one beside it: those are
      // deliberately disabled buttons carrying the policy's reason.
      .locator('[data-testid="context-menu"] [data-testid="affordances"] [data-affordance]')
      .first()
      .textContent()
      .catch(() => null);
    await seven.locator('[data-testid="context-menu"] [data-testid="affordances"] [data-affordance]').first().click();
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
    seedbed.stop();
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
