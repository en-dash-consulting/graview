#!/usr/bin/env node
/**
 * THE STUDIO, REHEARSED END TO END ON A REAL CHECKOUT.
 *
 * "People should be assigned to plants, not plots" — said to the studio's
 * seat over seedbed, kept, applied — and then everything a person would
 * otherwise have done by hand is checked as done: the relation moved in
 * schema.ts with its comment, `tend` and the caretaker rule rewritten, the
 * app's version moved on with a migration beside it, the whole thing
 * compiling and passing `graview check`, and a garden that was already
 * stored opening with its caretakers carried onto its plantings.
 *
 * On a SCRATCH COPY of seedbed (apps/.studio-rehearsal), never the repo's
 * own — the point is that the studio really writes. The model is a stub on
 * localhost that answers what a model would, so the run is repeatable; the
 * path between the person and it is the shipping one.
 *
 *   node scripts/rehearse-studio.mjs [--headed] [--keep]
 */
import { execFileSync, spawn } from "node:child_process";
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchEngine } from "./lib/engine.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = resolve(repoRoot, "apps/.studio-rehearsal");
const PORT = 5297;
const MODEL_PORT = 5398;
const report = { at: new Date().toISOString(), checks: {} };

/* ------------------------------------------------ what the model answers */

const TEND = `{
  title: "Name a caretaker",
  // Standing on the gardener, naming them the caretaker of a planting is them taking one on.
  fromTheOtherEnd: "Take on a planting",
  description: "Say who looks after a planting.",
  subject: { kinds: ["planting"], arg: "plantingId" },
  connects: ["tended-by"],
  severs: ["tended-by"],
  input: z.object({ plantingId: nodeRef(["planting"]), gardenerId: nodeRef(["gardener"]) }),
  describe: (args, graph) =>
    \`\${nameOf(graph as Reader, args.gardenerId)} takes on \${nameOf(graph as Reader, args.plantingId)}\`,
  apply(ctx, args) {
    // One caretaker per planting: naming a new one is a handover, not a committee.
    for (const current of ctx.graph.out(args.plantingId, "tended-by")) {
      if (current.id === args.gardenerId) return;
      ctx.removeEdge({ kind: "tended-by", from: args.plantingId, to: current.id });
    }
    ctx.addEdge({ kind: "tended-by", from: args.plantingId, to: args.gardenerId });
  },
}`;

const RULE = `{
  scope: { kind: "rule", match: (node) => node.spec.type === "every-plot-tended" },
  label: "Every planting has a caretaker",
  description: "Each growing planting must have someone tending it.",
  repairs: ["tend"],
  evaluate({ graph, subject }) {
    const reader = graph as Reader;
    const gardeners = [...reader.allNodes()].filter((node) => node.kind === "gardener");
    const violations: Violation[] = [];
    for (const candidate of reader.allNodes()) {
      if (candidate.kind !== "planting" || candidate["status"] !== "growing") continue;
      if (reader.out(candidate.id, "tended-by").length > 0) continue;
      const repairs: Repair[] = gardeners.map(
        (gardener): Repair => ({
          mutation: "tend",
          args: { plantingId: candidate.id, gardenerId: gardener.id },
          label: \`\${labelOf(gardener)} takes on \${labelOf(candidate)}\`,
        }),
      );
      violations.push({
        invariant: "every-plot-tended",
        subjectId: subject.id,
        label: subject.label,
        message: \`Nobody tends \${labelOf(candidate)}\`,
        nodeIds: [candidate.id],
        repairs,
      });
    }
    return violations;
  },
}`;

const prompts = [];
const model = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
    if (request.method === "OPTIONS") {
      response.writeHead(204, cors).end();
      return;
    }
    const prompt = JSON.parse(body || "{}").messages?.at(-1)?.content ?? "";
    prompts.push(prompt);
    let content;
    if (prompt.includes("You are rewriting one declaration")) {
      content = prompt.includes('The act "tend"') ? `Here it is:\n\`\`\`ts\n${TEND}\n\`\`\`` : RULE;
    } else {
      content = JSON.stringify({
        say: "Moving caretakers from plots to plantings.",
        proposals: [
          { mutation: "remove-edge", args: { id: "tended-by" }, why: "a plot is no longer what somebody tends" },
          {
            mutation: "add-edge",
            args: { kind: "planting", label: "tended-by", to: "gardener", description: "who looks after it", inverse: "what they look after" },
            why: "a planting is",
          },
        ],
      });
    }
    response.writeHead(200, { ...cors, "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
});

/* ----------------------------------------------------------- the garden */

/** A garden stored before the change: two caretakers on two plots, three plantings in them. */
const stored = {
  nodes: [
    { id: "erin", kind: "gardener", label: "Erin" },
    { id: "sam", kind: "gardener", label: "Sam" },
    { id: "back", kind: "plot", label: "Back bed", beds: 2 },
    { id: "front", kind: "plot", label: "Front bed", beds: 1 },
    { id: "kale", kind: "planting", label: "Kale", sown: "2026-04-02", status: "growing" },
    { id: "beans", kind: "planting", label: "Beans", sown: "2026-04-09", status: "growing" },
    { id: "chard", kind: "planting", label: "Chard", sown: "2026-05-01", status: "growing" },
  ],
  edges: [
    { kind: "tended-by", from: "back", to: "erin" },
    { kind: "tended-by", from: "front", to: "sam" },
    { kind: "grows-in", from: "kale", to: "back" },
    { kind: "grows-in", from: "beans", to: "back" },
    { kind: "grows-in", from: "chard", to: "front" },
  ],
};

let vite;
let browser;
try {
  rmSync(scratch, { recursive: true, force: true });
  // With its node_modules links: they are relative, and point at the same packages from the same depth.
  cpSync(resolve(repoRoot, "apps/seedbed"), scratch, { recursive: true, verbatimSymlinks: true, filter: (from) => !from.includes("/dist") && !from.endsWith(".tsbuildinfo") });

  await new Promise((ready) => model.listen(MODEL_PORT, ready));
  vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: scratch, stdio: ["ignore", "pipe", "pipe"], detached: true });
  await new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error("the rehearsal's vite did not start")), 60_000);
    vite.stdout.on("data", (chunk) => {
      if (String(chunk).includes(String(PORT))) {
        clearTimeout(timer);
        ready(undefined);
      }
    });
  });

  browser = await launchEngine("chromium", { headless: !process.argv.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  /*
   * The stored garden goes in BEFORE the app runs, once: written while the
   * page is up, the app's own save on the way out puts its empty garden
   * back over it.
   */
  await page.addInitScript(
    ({ stored, model }) => {
      if (sessionStorage.getItem("rehearsal:seeded")) return;
      sessionStorage.setItem("rehearsal:seeded", "1");
      localStorage.setItem("graview:seedbed:snapshot", JSON.stringify(stored));
      localStorage.setItem("graview:seedbed:log", "[]");
      localStorage.setItem("graview:seedbed:meta", JSON.stringify({ version: 1 }));
      localStorage.setItem(
        "graview:intelligence",
        JSON.stringify({ source: "remote", remote: { preset: "custom", baseUrl: model, apiKey: "rehearsal", model: "stub" } }),
      );
    },
    { stored, model: `http://localhost:${MODEL_PORT}/v1` },
  );
  await page.goto(`http://localhost:${PORT}/?remember=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 60_000 });
  const storedEdges = () => page.evaluate(() => (JSON.parse(localStorage.getItem("graview:seedbed:snapshot") ?? "{}").edges ?? []).length);
  report.debug = { afterSeeding: await storedEdges() };

  /* ------------------------------------------- said to the studio's seat */
  await page.click('[data-testid="profile-button"]');
  await page.click('[data-testid="studio-place"]');
  await page.waitForSelector('[data-testid="studio"]', { timeout: 20_000 });
  await page.click('[data-testid="studio-agent"]');
  await page.fill('[data-testid="studio-agent-draft"]', "people should be assigned to plants not plots");
  await page.click('[data-testid="studio-agent-send"]');
  await page.waitForSelector('[data-testid="studio-agent-apply-all"]', { timeout: 20_000 });
  await page.click('[data-testid="studio-agent-apply-all"]');
  await page.waitForTimeout(400);
  report.checks.theSeatsChangeIsKept = {
    kept: await page.locator('[data-testid="studio-agent-applied"]').count(),
    said: (await page.textContent('[data-testid="studio-agent-panel"] ol'))?.slice(0, 600),
    ok: (await page.locator('[data-testid="studio-agent-applied"]').count()) === 2,
  };
  if (!report.checks.theSeatsChangeIsKept.ok) throw new Error(`The seat's change was not kept: ${report.checks.theSeatsChangeIsKept.said}`);
  await page.keyboard.press("Escape");

  /* --------------------------------------- Apply: rewrite, then write */
  await page.click('[data-testid="studio-apply"]');
  await page.waitForSelector('[data-testid="studio-applied"]', { timeout: 20_000 });
  await page.waitForSelector('[data-testid="studio-rewrite"]', { timeout: 20_000 }).catch(async () => {
    // Whatever Apply said instead is the finding.
    throw new Error(`Apply did not ask for rewrites. It said: ${(await page.textContent('[data-testid="studio-applied"]'))?.slice(0, 800)}`);
  });
  const rewrites = await page.$$eval('[data-testid="studio-rewrite"]', (all) => all.map((one) => one.getAttribute("data-name")).sort());
  report.checks.theCodeTheChangeLeavesWrongIsNamed = { rewrites, ok: JSON.stringify(rewrites) === JSON.stringify(["every-plot-tended", "tend"]) };
  report.checks.theMigrationIsSaidBeforeItRuns = {
    said: await page.textContent('[data-testid="studio-carried"]'),
    ok: /tended-by edges move to the planting records/.test((await page.textContent('[data-testid="studio-carried"]')) ?? ""),
  };
  for (const name of rewrites) {
    await page.click(`[data-testid="studio-rewrite"][data-name="${name}"] [data-testid="studio-rewrite-ask"]`);
    await page.waitForFunction(
      (name) => !document.querySelector(`[data-testid="studio-rewrite"][data-name="${name}"] [data-testid="studio-rewrite-ask"]`)?.textContent?.includes("Asking"),
      name,
      { timeout: 20_000 },
    );
  }
  report.debug.beforeWriting = await storedEdges();
  await page.click('[data-testid="studio-write"]');
  /*
   * WRITTEN — said, or the page reloaded onto it. The dev server reloads as
   * soon as the files change, and on a fast write that reload can come
   * before the studio has said anything; either way what is on disk is
   * checked below.
   */
  const outcome = await Promise.race([
    page
      .waitForSelector('[data-testid="studio-written"], [data-testid="studio-not-written"]', { timeout: 120_000 })
      .then((found) => found.textContent()),
    page.waitForEvent("load", { timeout: 120_000 }).then(() => "written into the checkout; the page reloaded onto it"),
  ]);
  report.checks.itIsWrittenIntoTheCheckout = { outcome: outcome?.slice(0, 400), ok: /written into/.test(outcome ?? "") };

  /* ------------------------------------------------- what is on disk now */
  const file = (name) => readFileSync(resolve(scratch, "src/domain", name), "utf8");
  const schema = file("schema.ts");
  const planting = schema.slice(schema.indexOf('defineNode("planting"'), schema.indexOf('defineNode("rotation"'));
  const plot = schema.slice(schema.indexOf('defineNode("plot"'), schema.indexOf('defineNode("planting"'));
  report.checks.theRelationMovedWithItsWords = {
    ok: planting.includes('"tended-by"') && planting.includes("One edge, two readings") && !plot.includes("tended-by") && schema.includes("WHEN IT CAME IN"),
  };
  report.checks.tendTakesAPlanting = { ok: file("mutations.ts").includes('input: z.object({ plantingId: nodeRef(["planting"]), gardenerId: nodeRef(["gardener"]) })') };
  report.checks.theRuleReadsPlantings = { ok: file("invariants.ts").includes('candidate.kind !== "planting"') };
  report.checks.theAppCarriesItsGraphsForward = {
    ok: file("app.ts").includes("version: 2") && file("app.ts").includes('stepsMigration({ from: 1, to: 2, steps: [{ what: "move-edge"'),
  };

  /* ------------------------- the stored garden, opened on the new declaration */
  report.debug.rightAfterWriting = await storedEdges().catch(() => "reloading");
  await page.waitForTimeout(1500);
  report.debug.afterTheReload = await storedEdges().catch(() => "reloading");
  await page.goto(`http://localhost:${PORT}/?remember=1`, { waitUntil: "load" });
  await page.waitForFunction(() => "__seedbedReady" in window, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    snapshot: JSON.parse(localStorage.getItem("graview:seedbed:snapshot") ?? "null"),
    meta: JSON.parse(localStorage.getItem("graview:seedbed:meta") ?? "null"),
    log: JSON.parse(localStorage.getItem("graview:seedbed:log") ?? "[]"),
  }));
  const tended = (after.snapshot?.edges ?? []).filter((edge) => edge.kind === "tended-by").map((edge) => `${edge.from}->${edge.to}`).sort();
  report.checks.theCaretakersMovedOntoThePlantings = {
    version: after.meta?.version,
    tended,
    edges: (after.snapshot?.edges ?? []).map((edge) => `${edge.kind}:${edge.from}->${edge.to}`),
    log: after.log.slice(-3).map((op) => JSON.stringify(op).slice(0, 300)),
    ok: after.meta?.version === 2 && JSON.stringify(tended) === JSON.stringify(["beans->erin", "chard->sam", "kale->erin"]),
  };

  /* ------------------------------------------ and the checkout still builds */
  const run = (command, args) => {
    try {
      execFileSync(command, args, { cwd: repoRoot, stdio: "pipe" });
      return { ok: true };
    } catch (error) {
      return { ok: false, said: String(error.stdout ?? "").slice(0, 1200) + String(error.stderr ?? "").slice(0, 400) };
    }
  };
  report.checks.itCompiles = run("npx", ["tsc", "-p", scratch]);
  report.checks.graviewCheckPasses = report.checks.itCompiles.ok
    ? run("node", ["packages/graview/dist/cli.js", "check", resolve(scratch, "dist/domain/app.js")])
    : { ok: false, said: "it did not compile" };
  report.checks.nothingErroredInTheBrowser = { errors, ok: errors.length === 0 };
  report.prompts = prompts.length;
} finally {
  await browser?.close();
  model.close();
  if (vite) {
    try {
      process.kill(-vite.pid, "SIGTERM");
    } catch {
      vite.kill("SIGTERM");
    }
  }
  if (!process.argv.includes("--keep")) rmSync(scratch, { recursive: true, force: true });
}

writeFileSync(resolve(repoRoot, "docs/rehearsal.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...report.checks, debug: report.debug }, null, 1)}\n\nwrote docs/rehearsal.json\n`);
process.exitCode = Object.values(report.checks).every((check) => check.ok) ? 0 : 1;
