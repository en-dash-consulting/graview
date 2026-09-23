#!/usr/bin/env node
/**
 * THE STUDIO IS ONE PRESS FROM THE APP, and it actually works.
 *
 * `@graview/studio` shipped as a package and as a chapter of the seedbed
 * with no way in from the app you were looking at — so the claim the whole
 * platform story rests on, that a declaration is a graph you change with
 * the same gestures you change data with, was true and unreachable.
 *
 * Driven the way a person would: open it from Things' own bar as the seat
 * that keeps the installation, add a field to a kind from the actions
 * strip, read what the checker makes of the declaration as it now stands,
 * see the field in the schema the studio would write, take the change back,
 * and check that the seat that may not administer is never offered the door
 * at all — then ASK FOR A CHANGE IN WORDS, read what the checker makes of it
 * before keeping it, keep it, and undo it.
 *
 *   node scripts/verify-studio.mjs [--engine=chromium|webkit|firefox]
 */
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { serving } from "./lib/serve.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();

const report = { at: new Date().toISOString(), engine: ENGINE, checks: {} };
const app = await serving("todo", 5193, repoRoot);
let browser;

/** The written schema, read out of the download link the studio offers. */
const writtenSchema = (page) =>
  page.evaluate(() => {
    const link = document.querySelector('[data-testid="studio-file-src/domain/schema.ts"]');
    const href = link?.getAttribute("href") ?? "";
    return decodeURIComponent(href.slice(href.indexOf(",") + 1));
  });

/** Apply, read the schema the studio would write, and dismiss what it said. */
const writtenSchemaNow = async (page) => {
  await page.click('[data-testid="studio-apply"]');
  await page.waitForSelector('[data-testid="studio-applied"]', { timeout: 10_000 });
  const written = await writtenSchema(page);
  await page.locator('[data-testid="studio-applied"] button', { hasText: "Dismiss" }).first().click();
  await page.waitForTimeout(200);
  return written;
};

const verdict = (page) =>
  page.evaluate(() => {
    const said = document.querySelector('[data-testid="studio-verdict"]');
    return {
      text: said?.textContent?.trim() ?? null,
      errors: Number(said?.getAttribute("data-errors") ?? -1),
      warnings: Number(said?.getAttribute("data-warnings") ?? -1),
    };
  });

try {
  browser = await launchEngine(ENGINE, { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const open = async (as) => {
    await page.goto(`http://localhost:5193/?today=2026-09-01&fresh=1&as=${as}`, { waitUntil: "load" });
    await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
    await page.waitForTimeout(800);
    await profile();
  };

  /*
   * THE KEEPER'S WAYS IN LIVE BEHIND THE PROFILE. "Show the installation"
   * and "Studio" were pills on the bar, beside the places, where every
   * reader met two controls only a keeper can use. They are in the profile
   * pane now, with the other things that are about you rather than about
   * the graph — so a harness opens the pane before looking for them.
   */
  const profile = async () => {
    /*
     * The pane is MOUNTED whether or not it is open — a control in it may
     * own something that outlives it — so "is it there" is not the
     * question. Whether it is hidden is.
     */
    const shown = await page.evaluate(() => {
      const pane = document.querySelector('[data-testid="profile"]');
      return pane !== null && !pane.hasAttribute("hidden");
    });
    if (shown) return;
    const button = await page.$('[data-testid="profile-button"]');
    if (!button) return;
    await button.click();
    await page.waitForTimeout(400);
  };

  /* ------------------------------------ the door, and who is offered it */
  await open("user-sam");
  const memberSees = await page.$('[data-testid="studio-place"]');
  await open("user-nora");
  const keeperSees = await page.$('[data-testid="studio-place"]');
  report.checks.theDoorBelongsToWhoeverKeepsTheApp = {
    member: memberSees !== null,
    keeper: keeperSees !== null,
    ok: memberSees === null && keeperSees !== null,
  };

  /* ------------------------------------------- it opens the running app */
  await page.click('[data-testid="studio-place"]');
  await page.waitForSelector('[data-testid="studio"]', { timeout: 20_000 });
  await page.waitForTimeout(1200);
  const opened = await page.evaluate(() => ({
    districts: [...document.querySelectorAll('[data-testid="studio"] [data-graview-view]')].map((el) =>
      el.getAttribute("data-graview-view"),
    ),
    places: [...document.querySelectorAll('[data-testid="studio"] nav[aria-label="Places"] button')].map(
      (button) => button.textContent?.trim(),
    ),
  }));
  const before = await verdict(page);
  report.checks.itOpensTheRunningAppsOwnDeclaration = {
    ...opened,
    verdict: before,
    ok:
      ["kind:kind", "kind:field", "kind:act", "kind:rule", "kind:role", "kind:grant"].every((one) =>
        opened.districts.includes(one),
      ) &&
      opened.places.includes("What the checker says") &&
      before.errors === 0,
  };

  /* ------------------------------- a field added with the ordinary acts */
  /*
   * The kinds district, opened into its members, then the task kind itself.
   * An act on a kind is offered where the kind is, like any other act on
   * any other node — which is the whole claim: there is no second editor.
   */
  await page.locator('[data-graview-view="kind:kind"] button', { hasText: "open" }).first().click();
  await page.waitForSelector('[data-graview-pick="declared:task"]', { timeout: 10_000 });
  await page.waitForTimeout(600);
  /*
   * Selected FROM THE KEYBOARD. A chip in an opened district can sit under
   * the district's own card, so a pointer click is refused as intercepted —
   * and the keyboard path is the one that matters anyway: the scene makes
   * every pick target focusable precisely so that the primary way through
   * the graph is not mouse-only.
   */
  await page.focus('[data-graview-pick="declared:task"]');
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid="inspector-strip"] [data-affordance]', { timeout: 10_000 });
  const offered = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="inspector-strip"] [data-affordance]')].map((b) =>
      b.textContent?.trim(),
    ),
  );
  await page.locator('[data-testid="inspector-strip"] [data-affordance]', { hasText: "Add a field" }).first().click();
  await page.waitForSelector("[data-graview-asking]", { timeout: 10_000 });
  // Answer what the act still wants: a name, a type, and whether it is required.
  await page.keyboard.type("urgency");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  for (let step = 0; step < 4 && (await page.$("[data-graview-asking]")) !== null; step++) {
    const choice = await page.$("[data-graview-asking] button:not([disabled])");
    if (choice) {
      await choice.click();
    } else {
      await page.keyboard.type("x");
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(600);
  const after = await verdict(page);
  await page.click('[data-testid="studio-apply"]');
  await page.waitForSelector('[data-testid="studio-applied"]', { timeout: 10_000 });
  const schema = await writtenSchema(page);
  report.checks.aFieldAddedIsAFieldWritten = {
    offered,
    verdict: after,
    inTheSchema: schema.includes("urgency"),
    stillATask: schema.includes('defineNode("task"'),
    /* What the studio does not model it must not destroy: the task's own
       display labels came from the checkout and have to survive the trip. */
    keptHowItReads: schema.includes("Blocked"),
    ok:
      after.errors === 0 &&
      schema.includes("urgency") &&
      schema.includes('defineNode("task"') &&
      schema.includes("Blocked"),
  };

  /* ------------------------------------------- and taking it back works */
  // The STUDIO's rail, not the app's behind it: two exist on the page, and
  // the one that matters is the one about the declaration.
  await page.click('[data-testid="studio"] [data-testid="activity-button"]');
  await page.waitForTimeout(500);
  await page.locator('[data-testid="studio"] [data-testid="undo-turn"]').first().click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.click('[data-testid="studio-apply"]');
  await page.waitForSelector('[data-testid="studio-applied"]', { timeout: 10_000 });
  const undone = await writtenSchema(page);
  report.checks.everyChangeIsAnActWithUndo = {
    goneAgain: !undone.includes("urgency"),
    ok: !undone.includes("urgency") && undone.includes('defineNode("task"'),
  };

  /* ------------------------- an agent proposes; the trail keeps or declines */
  /*
   * A rule that says what is wrong without naming what puts it right is a
   * rule the interface can only complain about. The studio's seat finds
   * them and proposes the act that plausibly repairs each — under its own
   * name, in a batch of its own, so the trail beside it says who did it and
   * one press takes it back. Keeping is doing nothing.
   */
  await page.click('[data-testid="studio"] [data-testid="activity-button"]');
  await page.waitForTimeout(400);
  const seat = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="studio-seat"]');
    return { label: button?.textContent?.trim() ?? null, disabled: button?.disabled ?? null };
  });
  if (seat.disabled === false) {
    await page.click('[data-testid="studio-seat"]');
    await page.waitForTimeout(1500);
  }
  const proposed = await page.evaluate(() => ({
    turns: [...document.querySelectorAll('[data-testid="studio"] [data-testid="diff-log"] li')].map((li) =>
      (li.textContent ?? "").replace(/\s+/g, " ").slice(0, 80),
    ),
  }));
  report.checks.anAgentProposesAndTheTrailDecides = {
    seat,
    ...proposed,
    /* Either it had something to propose and the trail carries it under the
       agent's name, or every rule already names its repair and the seat
       says so instead of sitting there live and doing nothing. */
    ok:
      seat.label !== null &&
      (seat.disabled === true
        ? /names what puts it right|Nothing/i.test(seat.label)
        : proposed.turns.some((turn) => /studio|repair/i.test(turn))),
  };
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  /* ------------- asked for in words, checked, kept, and taken back again */
  /*
   * THE WHOLE TURN, as a person does it. The one surface whose subject is
   * the declaration was the one surface you could not talk to: ask for a
   * field, read what the checker makes of the change BEFORE keeping it,
   * keep it, see it in the schema the studio would write, and undo it.
   * Keyless — the declaration answers for itself — so this runs anywhere.
   */
  await page.click('[data-testid="studio-agent"]');
  await page.waitForSelector('[data-testid="studio-agent-panel"]', { timeout: 10_000 });
  const asked = async (words) => {
    await page.fill('[data-testid="studio-agent-draft"]', words);
    await page.click('[data-testid="studio-agent-send"]');
    await page.waitForTimeout(900);
  };

  await asked("what kinds are there?");
  const answered = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="studio-agent-panel"] li p')].map((p) => p.textContent?.trim() ?? ""),
  );
  report.checks.theDeclarationAnswersForItself = {
    answered: answered.slice(-1),
    /* It knows its own subject: the meta-graph's kinds, not the app's data. */
    ok: answered.some((said) => /kind/i.test(said) && /act|rule/i.test(said)),
  };

  await asked("add a due date to tasks");
  /*
   * A PROPOSAL IS THE ACT'S OWN FORM, not a sentence and a button: the
   * arguments are drawn as controls, filled with what was proposed, and the
   * person corrects them before keeping. So the harness reads the form.
   */
  const theOffer = await page.evaluate(() => {
    const offer = document.querySelector('[data-testid="studio-agent-offer"]');
    const arg = (name) => document.querySelector(`[data-testid="studio-agent-arg-${name}"]`)?.value ?? null;
    return {
      act: offer?.getAttribute("data-mutation") ?? null,
      kind: arg("kind"),
      label: arg("label"),
      type: arg("type"),
      keep: document.querySelector('[data-testid="studio-agent-keep"]')?.textContent?.trim() ?? null,
      keepable: document.querySelector('[data-testid="studio-agent-keep"]')?.disabled === false,
      check: document.querySelector('[data-testid="studio-agent-check"]')?.textContent?.trim() ?? null,
      errors: document.querySelector('[data-testid="studio-agent-check"]')?.getAttribute("data-errors") ?? null,
    };
  });
  const beforeKeeping = await writtenSchemaNow(page);
  report.checks.theCheckerSpeaksBeforeYouKeepAnything = {
    ...theOffer,
    /* Nothing is applied by asking: the declaration is untouched until Keep. */
    untouchedUntilKept: !beforeKeeping.includes("due-date"),
    ok:
      theOffer.act === "add-field" &&
      theOffer.kind === "declared:task" &&
      theOffer.label === "due date" &&
      theOffer.type === "date" &&
      theOffer.keepable === true &&
      theOffer.errors === "0" &&
      !beforeKeeping.includes("due-date"),
  };

  /* ------------------------------ and a proposal is the person's to correct */
  /*
   * The whole reason the arguments are drawn as a form: an answer that is
   * half right costs one press to fix rather than another sentence and
   * another turn. Change the name here and the declaration takes THAT.
   */
  await page.fill('[data-testid="studio-agent-arg-label"]', "wanted by");
  await page.waitForTimeout(400);
  const corrected = await page.evaluate(() => ({
    label: document.querySelector('[data-testid="studio-agent-arg-label"]')?.value ?? null,
    errors: document.querySelector('[data-testid="studio-agent-check"]')?.getAttribute("data-errors") ?? null,
  }));

  await page.click('[data-testid="studio-agent-keep"]');
  await page.waitForTimeout(700);
  const afterKeeping = await writtenSchemaNow(page);
  const kept = await verdict(page);
  report.checks.aProposalIsYoursToCorrectBeforeYouKeepIt = {
    ...corrected,
    wroteTheCorrection: afterKeeping.includes("wanted-by"),
    andNotTheProposal: !afterKeeping.includes("due-date"),
    ok: corrected.label === "wanted by" && corrected.errors === "0" && afterKeeping.includes("wanted-by") && !afterKeeping.includes("due-date"),
  };
  report.checks.keepingIsAnOrdinaryOp = {
    inTheSchema: afterKeeping.includes("wanted-by"),
    verdict: kept,
    ok: afterKeeping.includes("wanted-by") && kept.errors === 0,
  };

  /* And it is an op like any other: the trail names the agent, undo takes it back. */
  await page.click('[data-testid="studio"] [data-testid="activity-button"]');
  await page.waitForTimeout(500);
  const trail = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="studio"] [data-testid="diff-log"] li')].map((li) =>
      (li.textContent ?? "").replace(/\s+/g, " ").slice(0, 100),
    ),
  );
  await page.locator('[data-testid="studio"] [data-testid="undo-turn"]').first().click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const afterUndo = await writtenSchemaNow(page);
  report.checks.whatTheAgentProposesIsUndone = {
    trail: trail.slice(0, 3),
    goneAgain: !afterUndo.includes("wanted-by"),
    ok: !afterUndo.includes("wanted-by") && afterUndo.includes('defineNode("task"'),
  };

  /* -------------- what the keyless rung cannot read, it offers a way out of */
  await asked("sort the tasks out a bit, they are a mess");
  const stuck = await page.evaluate(() => ({
    said: [...document.querySelectorAll('[data-testid="studio-agent-panel"] li p')].at(-1)?.textContent?.trim().slice(0, 80) ?? null,
    offered: document.querySelector('[data-testid="studio-agent-offer-model"]') !== null,
  }));
  await page.click('[data-testid="studio-agent-offer-model"]');
  await page.waitForTimeout(400);
  const gear = await page.evaluate(() => document.querySelector('[data-testid="studio-agent-ladder"] [data-testid="setting-intelligence"]') !== null);
  report.checks.whatTheKeylessRungCannotReadItOffersAWayOutOf = {
    ...stuck,
    opensThePicker: gear,
    ok: stuck.offered === true && gear === true,
  };
  await page.click('[data-testid="studio-agent-settings"]');
  await page.waitForTimeout(300);

  /* ------------------- a model on the ladder, driven against a real provider */
  /*
   * THE MODEL PATH, END TO END, WITHOUT A MODEL.
   *
   * The on-device rung needs WebGPU, which a harness machine may not have —
   * but "we cannot run Gemini Nano here" is no reason to leave the whole
   * model path untested, and it was: every test of it stubbed the responder
   * itself, so nothing had ever checked that a provider's answer reaches
   * the panel, that several proposals become several forms, or that one
   * waiting on another comes alive when it is kept.
   *
   * So the provider is a real OpenAI-compatible endpoint on localhost that
   * answers what we tell it to. Everything between the person and it is the
   * shipping path: the config, the adapter, the prompt, the gate, the forms.
   */
  const prompts = [];
  let answer = "{}";
  const provider = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      /* A key in the headers makes this a cross-origin request the browser
         asks permission for first, so the preflight has to be answered. */
      const cors = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "POST, OPTIONS",
      };
      if (request.method === "OPTIONS") {
        response.writeHead(204, cors);
        response.end();
        return;
      }
      try {
        prompts.push(JSON.parse(body).messages[0].content);
      } catch {
        prompts.push(body.slice(0, 200));
      }
      response.writeHead(200, { "content-type": "application/json", ...cors });
      response.end(JSON.stringify({ choices: [{ message: { content: answer } }] }));
    });
  });
  await new Promise((ready) => provider.listen(5399, ready));

  try {
    /*
     * One loose sentence, three acts, and two of them wait for the first —
     * which is what a person actually types and what a pattern-matcher can
     * never split. The model names the kind the way a person does.
     */
    answer = JSON.stringify({
      say: "Three changes.",
      proposals: [
        { mutation: "add-kind", args: { label: "Meal" }, why: "you asked for a Meal" },
        { mutation: "add-field", args: { kind: "Meal", label: "name", type: "string", required: false }, why: "the name of the food" },
        { mutation: "add-field", args: { kind: "Meal", label: "serves", type: "number", required: false }, why: "how many it feeds" },
      ],
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "graview:intelligence",
        JSON.stringify({ source: "remote", remote: { preset: "custom", baseUrl: "http://localhost:5399/v1", apiKey: "harness", model: "stub" } }),
      );
    });
    await page.goto("http://localhost:5193/?today=2026-09-01&fresh=1&as=user-nora", { waitUntil: "load" });
    await page.waitForFunction(() => "__todoReady" in window, null, { timeout: 60_000 });
    await page.waitForTimeout(900);
    await profile();
    await page.click('[data-testid="studio-place"]');
    await page.waitForSelector('[data-testid="studio"]', { timeout: 20_000 });
    await page.waitForTimeout(900);
    await page.click('[data-testid="studio-agent"]');
    await page.waitForSelector('[data-testid="studio-agent-panel"]', { timeout: 10_000 });
    await page.fill('[data-testid="studio-agent-draft"]', "add a Meal kind, with the name of the food and how many people it feeds");
    await page.click('[data-testid="studio-agent-send"]');
    await page.waitForTimeout(1500);

    const spoken = await page.evaluate(() => {
      const offers = [...document.querySelectorAll('[data-testid="studio-agent-offer"]')];
      return {
        acts: offers.map((offer) => offer.getAttribute("data-mutation")),
        keepable: offers.map((offer) => offer.querySelector('[data-testid="studio-agent-keep"]')?.disabled === false),
        checks: offers.map((offer) => offer.querySelector('[data-testid="studio-agent-check"]')?.textContent?.trim().slice(0, 60)),
      };
    });
    report.checks.aModelsAnswerBecomesSeveralFormsYouCanCorrect = {
      ...spoken,
      /* The prompt carried what is in the graph, so a model can name it. */
      /* The studio's own graph is the DECLARATION, so its names are the
         app's kinds — which is exactly what a model needs to name one. */
      promptNamedTheGraph: prompts.some((prompt) => prompt.includes("task") && prompt.includes("What is in the graph now")),
      promptOfferedTheReading: prompts.some((prompt) => prompt.includes("split it into several")),
      ok:
        spoken.acts.join(",") === "add-kind,add-field,add-field" &&
        /* The kind can be kept; the two fields on it cannot, yet. */
        spoken.keepable[0] === true &&
        spoken.keepable[1] === false &&
        spoken.checks[1]?.startsWith("Waiting on") === true &&
        prompts.length > 0 &&
        prompts.some((prompt) => prompt.includes("What is in the graph now")) &&
        prompts.some((prompt) => prompt.includes("split it into several")),
    };

    /* ---- and the ones that were waiting come alive when the first is kept */
    await page.locator('[data-testid="studio-agent-keep"]').first().click();
    await page.waitForTimeout(900);
    const afterFirst = await page.evaluate(() => {
      const offers = [...document.querySelectorAll('[data-testid="studio-agent-offer"]')];
      return {
        open: offers.length,
        keepable: offers.map((offer) => offer.querySelector('[data-testid="studio-agent-keep"]')?.disabled === false),
        kinds: offers.map((offer) => offer.querySelector('[data-testid="studio-agent-arg-kind"]')?.value ?? null),
      };
    });
    await page.locator('[data-testid="studio-agent-keep"]').first().click();
    await page.waitForTimeout(600);
    await page.locator('[data-testid="studio-agent-keep"]').first().click();
    await page.waitForTimeout(900);
    const written = await writtenSchemaNow(page);
    report.checks.aProposalWaitingOnAnotherComesAliveWhenItIsKept = {
      ...afterFirst,
      inTheSchema: written.includes('defineNode("meal"'),
      bothFields: written.includes("name:") && written.includes("serves:"),
      ok:
        /* The name the model used resolved the moment the kind existed. */
        afterFirst.kinds.every((kind) => kind === "declared:meal") &&
        afterFirst.keepable.every(Boolean) &&
        written.includes('defineNode("meal"') &&
        written.includes("serves:"),
    };
  } finally {
    provider.close();
  }

  /* ------------------------------------ and closing puts you back in the app */
  await page.click('[data-testid="studio-close"]');
  await page.waitForTimeout(600);
  const back = await page.evaluate(() => ({
    studioGone: document.querySelector('[data-testid="studio"]') === null,
    stillTheApp: document.querySelector('[data-graview-pick="t-deposit"]') !== null,
  }));
  report.checks.closingPutsYouBackWhereYouWere = { ...back, ok: back.studioGone && back.stillTheApp };

  report.pageErrors = errors;
  report.passed = Object.values(report.checks).every((check) => check.ok) && errors.length === 0;
} catch (error) {
  report.error = String(error);
  report.passed = false;
} finally {
  await browser?.close();
  app.stop();
}

writeFileSync(resolve(repoRoot, "docs/studio.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.checks, null, 1)}\n\nwrote docs/studio.json\n`);
process.exit(report.passed ? 0 : 1);
