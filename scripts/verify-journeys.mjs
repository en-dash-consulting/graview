#!/usr/bin/env node
/**
 * CAN A PERSON DO THE JOBS, AND WHAT DOES IT COST THEM?
 *
 * Six walks and a chain of browser harnesses kept finding the same small,
 * mechanical faults — focus, wording, overflow — and the watch (lib/watch.mjs)
 * now catches those on every screen. What nothing measured was whether a
 * person can actually do an app's core jobs, or how much effort they take.
 *
 * This derives the jobs from each app's declaration (lib/journeys.mjs:
 * planJobs) — make one of every kind that has a creating act, find one by
 * part of its name, change its name in place, relate two through a declared
 * act, take the last change back, get from a broken rule to its repair, and
 * be told an act is not yours before pressing it — and drives each as a
 * person would, in a real browser, on both faces (the scene and the routed
 * pages), at 1440 and 390 wide, with the pointer and from the keyboard only.
 * Each run records whether it got done (and where it dead-ended, in a
 * sentence), the presses it took, the time, and whatever the watch saw
 * during it.
 *
 * docs/journeys.json holds the verdict, and its `friction` list — ranked
 * not done, then done with a rule broken on the way, then far more presses
 * than the cheapest way anybody found — is the backlog. Friction does not
 * fail the run. A REGRESSION does: a job that was done in the committed
 * verdict and now is not, or that now costs more than 30% more presses.
 *
 *   node scripts/verify-journeys.mjs                 every app
 *   node scripts/verify-journeys.mjs todo rota       only these
 *   GRAVIEW_PORT_BASE=5600 node scripts/verify-journeys.mjs
 *                                                    every port moved onto the base, as every
 *                                                    harness's is (scripts/lib/ports.mjs), so
 *                                                    two checkouts can run harnesses at once
 *   GRAVIEW_JOURNEYS_PARALLEL=4                      how many runs at once (6)
 *
 * Every run is its own process with its own browser, so the watch's
 * `takeViolations()` after each job attributes what it saw to that job and
 * nothing else; each job is its own browser context, so it starts from the
 * example and not from the last job's residue.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineName, launchEngine } from "./lib/engine.mjs";
import { appsNamed, DeadEnd, frictionOf, inStore, JOBS, Person, planJobs, readDeclaration, regressionsOf, storeHookInPage, VARIANTS, variantKey } from "./lib/journeys.mjs";
import { serving } from "./lib/serve.mjs";
import { takeViolations } from "./lib/watch.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = engineName();
const OUT = resolve(repoRoot, "docs/journeys.json");

/**
 * The apps, and what each needs said in its address. Seedbed opens on the
 * example garden, whose plots are all tended; the jobs that need a problem
 * with a repair get one first, through the declaration's own acts (an
 * untended plot), and a garden a person emptied is planted the way its
 * first chapters plant it. Untimed.
 */
const APPS = [
  { dir: "todo", query: { today: "2026-09-01" } },
  {
    dir: "seedbed",
    query: {},
    arrange: (store) => {
      if (store.graph.allNodes().some((node) => node.kind === "plot" && node.label === "Plot 4")) return;
      if (store.graph.allNodes().length > 0) {
        // The example garden keeps its agreement; an untended plot is a problem with a repair.
        store.apply({ name: "add-plot", args: { label: "Plot 4", beds: 2 } });
        return;
      }
      store.apply({ name: "add-gardener", args: { label: "June" } });
      store.apply({ name: "add-gardener", args: { label: "Ravi" } });
      store.apply({ name: "add-plot", args: { label: "Plot 1", beds: 4 } });
      store.apply({ name: "add-plot", args: { label: "Plot 2", beds: 2 } });
      const plot = store.graph.allNodes().find((node) => node.kind === "plot");
      store.apply({ name: "sow", args: { label: "Beans", plotId: plot.id, sown: "2026-04-04" } });
      // The garden's agreement, so an untended plot is a problem with a repair.
      store.apply({ name: "adopt-rule", args: {} });
    },
  },
  { dir: "rota", query: { today: "2026-09-14" } },
  { dir: "discography", query: {} },
  // The awkward example, built in parallel: driven when it is here, skipped when it is not.
  { dir: "gauntlet", query: {} },
];

const address = (base, path, query, extra = {}, hash = "") => {
  const search = new URLSearchParams({ ...query, ...extra }).toString();
  return `${base}${path}${search ? `?${search}` : ""}${hash}`;
};

async function ready(page) {
  await page.waitForFunction(
    () => (window.__journeyStores?.length ?? 0) > 0 && Object.keys(window).some((key) => /^__\w*Ready$/.test(key)),
    null,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(600);
}

/** What every job of one app is told: its addresses, its records' names, its seats. */
function contextFor(setup, page, variant) {
  const { base, query, slugs, kinds, labels, refusal, refusalWhy, remember } = setup;
  const keep = remember ? { remember: "1" } : {};
  const recordUrl = (node, extra = {}) => {
    if (variant.face === "scene") {
      return address(base, "/", query, { ...keep, ...extra }, `#focus=${encodeURIComponent(node.id)}&sel=${encodeURIComponent(node.id)}`);
    }
    const kind = setup.kindOf[node.id];
    return address(base, `/pages/${slugs[kind] ?? kind}/${encodeURIComponent(node.id)}`, query, { ...keep, ...extra });
  };
  const homeAs = (extra = {}) => address(base, variant.face === "scene" ? "/" : "/pages", query, { ...keep, ...extra });
  return { page, ...variant, kinds, labels, refusal, refusalWhy, home: homeAs(), homeAs, recordUrl };
}

/* ------------------------------------------------------------------ */
/* One run: one app, one face, one width, one input.                   */
/* ------------------------------------------------------------------ */

async function runVariant({ setupFile, variant, out }) {
  const setup = JSON.parse(readFileSync(setupFile, "utf8"));
  const browser = await launchEngine(ENGINE, { headless: true });
  const results = {};
  try {
    for (const job of setup.plan.jobs) {
      const prep = setup.preps[job.id];
      if (prep?.skip) {
        results[job.id] = { skipped: prep.skip };
        continue;
      }
      takeViolations();
      const context = await browser.newContext({ viewport: { width: variant.width, height: variant.width === 390 ? 844 : 900 } });
      await context.addInitScript(storeHookInPage);
      const page = await context.newPage();
      const ctx = contextFor(setup, page, variant);
      let result;
      try {
        if (setup.arrange) {
          await page.goto(address(setup.base, "/", setup.query, { remember: "1", fresh: "1" }), { waitUntil: "load" });
          await ready(page);
          await inStore(page, setup.kinds, new Function(`return (${setup.arrange})`)());
        }
        await page.goto(JOBS[job.job].start(ctx, job, prep), { waitUntil: "load" });
        await ready(page);
        let arranged = prep;
        if (JOBS[job.job].arrange) arranged = { ...prep, ...(await JOBS[job.job].arrange(page, ctx, job, prep)) };
        if (arranged.skip) {
          result = { skipped: arranged.skip };
        } else {
          const person = new Person(page, variant.input);
          const began = Date.now();
          try {
            const said = await JOBS[job.job].run(person, ctx, job, arranged);
            result = { done: true, presses: person.presses, ms: Date.now() - began, steps: person.log, ...(said ?? {}) };
          } catch (error) {
            const said = String(error?.message ?? error).split("\n")[0];
            result = {
              done: false,
              presses: person.presses,
              ms: Date.now() - began,
              deadEnd: error instanceof DeadEnd ? said : `the harness could not drive it: ${said.slice(0, 160)}`,
              ...(error instanceof DeadEnd ? {} : { harness: true }),
              steps: person.log,
            };
          }
        }
      } catch (error) {
        result = { done: false, presses: 0, ms: 0, deadEnd: `the harness could not start it: ${String(error?.message ?? error).split("\n")[0].slice(0, 160)}`, harness: true };
      }
      // The watch judges a press a moment after it lands; give the last one its moment.
      await page.waitForTimeout(450).catch(() => {});
      await context.close().catch(() => {});
      results[job.id] = { ...result, violations: takeViolations().map(({ rule, detail, at }) => ({ rule, detail, at })) };
    }
  } finally {
    await browser.close();
  }
  writeFileSync(out, JSON.stringify(results));
}

/* ------------------------------------------------------------------ */
/* Setup: one app, read once — its records, its pages, its seats.      */
/* ------------------------------------------------------------------ */

async function setUp(browser, entry, declaration) {
  const port = portFor(entry.dir);
  const served = await serving(entry.dir, port, repoRoot);
  const plan = planJobs(declaration);
  const setup = {
    app: entry.name ?? entry.dir,
    base: served.url,
    query: entry.query,
    plan,
    kinds: plan.kinds.map((one) => one.kind),
    arrange: entry.arrange ? entry.arrange.toString() : null,
    remember: Boolean(entry.arrange),
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(storeHookInPage);
  const page = await context.newPage();
  const open = async (path, extra = {}) => {
    await page.goto(address(setup.base, path, setup.query, { ...(setup.remember ? { remember: "1", fresh: "1" } : {}), ...extra }), { waitUntil: "load" });
    await ready(page);
    if (setup.arrange) await inStore(page, setup.kinds, entry.arrange);
  };
  await open("/");
  const graph = await inStore(page, setup.kinds, (store) => store.graph.allNodes().map((node) => ({ id: node.id, kind: node.kind, label: window.__journeyName(store, node) })));
  setup.labels = graph.map((node) => node.label).filter(Boolean);
  setup.kindOf = Object.fromEntries(graph.map((node) => [node.id, node.kind]));

  const ctx = { page, kinds: setup.kinds, labels: setup.labels, input: "pointer", width: 1440 };
  setup.preps = {};
  for (const job of plan.jobs) setup.preps[job.id] = await JOBS[job.job].prepare(ctx, job);

  /* The seats the bar offers, and the first — from the last — that is refused something it can see. */
  if (plan.jobs.some((job) => job.job === "refused")) {
    const profile = page.locator('[data-testid="profile-button"]');
    const seats = (await profile.isVisible().catch(() => false))
      ? await (async () => {
          await profile.click();
          await page.waitForTimeout(300);
          return page.$$eval('button[data-testid^="seat-"][title^="Sit down as"]', (els) => els.map((el) => ({ id: el.dataset.testid.slice("seat-".length), label: el.textContent.trim() })));
        })()
      : [];
    const wanted = plan.jobs.filter((job) => job.act).map((job) => job.act);
    for (const seat of [...seats].reverse()) {
      await open("/", { as: seat.id });
      const choice = await inStore(page, setup.kinds, (store, { wanted, plurals }, sat) => {
        if (!sat) return null;
        const permitted = new Set(store.permittedMutations(sat).map((mutation) => mutation.name));
        const hidden = store.kindsKeptFrom(sat);
        const refused = store.allMutations().filter((mutation) => !permitted.has(mutation.name));
        // A refusal that is this seat's, before one that is everybody's (an act no grant names).
        const granted = (mutation) => (store.policy?.grants ?? []).some((grant) => grant.mutations === "*" || grant.mutations.includes(mutation.name));
        const rank = (mutation) => (!granted(mutation) ? 3 : wanted.includes(mutation.name) ? 0 : /^(edit|remove)-|^add:/.test(mutation.name) ? 2 : 1);
        for (const mutation of refused.sort((a, b) => rank(a) - rank(b))) {
          if (mutation.subject) {
            const kinds = mutation.subject.kinds === "*" ? store.schema.kinds : mutation.subject.kinds;
            const node = store.graph.allNodes().find((one) => kinds.includes(one.kind) && !hidden.has(one.kind) && window.__journeyName(store, one));
            if (node) return { seat: sat.id, act: mutation.name, title: mutation.title, subject: { id: node.id, label: window.__journeyName(store, node) }, kind: node.kind, plural: plurals[node.kind] };
          } else {
            const kind = (mutation.creates ?? []).find((one) => !hidden.has(one));
            if (kind) return { seat: sat.id, act: mutation.name, title: mutation.title, kind, plural: plurals[kind] };
          }
        }
        return null;
      }, { wanted, plurals: Object.fromEntries(plan.kinds.map((one) => [one.kind, one.plural])) });
      if (choice?.seat === seat.id) {
        setup.refusal = { ...choice, seatLabel: seat.label };
        break;
      }
    }
    if (!setup.refusal) setup.refusalWhy = seats.length === 0 ? "the bar offers no other seat to sit in" : "no seat the bar offers is refused anything it can see";
    setup.preps["refused"] = setup.refusal ?? { skip: setup.refusalWhy };
  }

  /* Where each kind's pages are: the routed face's own links, not a guess at a slug. */
  await open("/pages");
  const links = await page.$$eval('a[href^="/pages/"]', (els) => els.map((el) => ({ href: el.getAttribute("href"), text: (el.textContent ?? "").trim() })));
  setup.slugs = {};
  for (const { kind, plural } of plan.kinds) {
    const link = links.find((one) => one.text.startsWith(plural) && /^\/pages\/[^/]+$/.test(one.href));
    setup.slugs[kind] = link ? link.href.split("/")[2] : plural.toLowerCase().replace(/\s+/g, "-");
  }
  await context.close();
  takeViolations(); // Setup is not a job.
  return { setup, served };
}

/* ------------------------------------------------------------------ */
/* The whole run                                                       */
/* ------------------------------------------------------------------ */

async function main() {
  const began = Date.now();
  const entries = appsNamed(process.argv.slice(2), APPS);
  const scratch = mkdtempSync(join(tmpdir(), "journeys-"));
  const browser = await launchEngine(ENGINE, { headless: true });
  const report = { at: new Date().toISOString(), engine: ENGINE, apps: {} };
  const runs = [];
  const servers = [];
  const unbuilt = [];
  try {
    for (const entry of entries) {
      const declaration = existsSync(resolve(repoRoot, "apps", entry.dir)) ? await readDeclaration(repoRoot, entry.dir) : null;
      if (!declaration) {
        report.apps[entry.name ?? entry.dir] = { skipped: `${entry.name ? entry.dir : `apps/${entry.dir}`} is not built here (no dist/domain/app.js — pnpm build:domain)` };
        process.stdout.write(`skip  ${entry.name ?? entry.dir}: not here\n`);
        /*
         * ASKED FOR BY NAME IS NOT OPTIONAL. Run bare, an app missing from
         * this checkout is skipped; named, it is the run — and a nightly
         * shard whose apps were never built skipped four of five and said
         * "no regressions".
         */
        if (process.argv.slice(2).some((arg) => !arg.startsWith("-") && arg !== "--run")) unbuilt.push(entry.name ?? entry.dir);
        continue;
      }
      try {
        const { setup, served } = await setUp(browser, entry, declaration);
        servers.push(served);
        const key = entry.name ?? entry.dir;
        const setupFile = join(scratch, `${key}.json`);
        writeFileSync(setupFile, JSON.stringify(setup));
        report.apps[key] = {
          port: Number(new URL(setup.base).port),
          jobs: Object.fromEntries(setup.plan.jobs.map((job) => [job.id, { says: job.says, ...(job.act ? { act: job.act } : {}), runs: {} }])),
        };
        for (const variant of VARIANTS) runs.push({ app: key, setupFile, variant, out: join(scratch, `${key}-${variantKey(variant).replace(/\//g, "-")}.json`) });
        process.stdout.write(`ready ${key} on ${setup.base}: ${setup.plan.jobs.length} jobs × ${VARIANTS.length} ways\n`);
      } catch (error) {
        const key = entry.name ?? entry.dir;
        report.apps[key] = { failed: `could not set up: ${String(error?.message ?? error).split("\n")[0]}` };
        process.stdout.write(`FAIL  ${key}: ${report.apps[key].failed}\n`);
      }
    }
  } finally {
    await browser.close();
  }

  /* Every run in its own process, a few at a time. */
  const parallel = Number(process.env["GRAVIEW_JOURNEYS_PARALLEL"] ?? 6);
  const queue = [...runs];
  const self = fileURLToPath(import.meta.url);
  const worker = async () => {
    for (let run = queue.shift(); run; run = queue.shift()) {
      const child = spawn(process.execPath, [self, `--engine=${ENGINE}`, "--run", JSON.stringify(run)], { cwd: repoRoot, stdio: ["ignore", "ignore", "pipe"] });
      let errors = "";
      child.stderr.on("data", (chunk) => (errors += chunk));
      const code = await new Promise((done) => child.on("exit", done));
      const key = variantKey(run.variant);
      if (code !== 0 || !existsSync(run.out)) {
        for (const job of Object.values(report.apps[run.app].jobs)) job.runs[key] = { done: false, presses: 0, ms: 0, deadEnd: `the run crashed: ${errors.trim().split("\n").pop()?.slice(0, 160)}`, harness: true, violations: [] };
      } else {
        const results = JSON.parse(readFileSync(run.out, "utf8"));
        for (const [jobId, result] of Object.entries(results)) report.apps[run.app].jobs[jobId].runs[key] = result.skipped ? { skipped: result.skipped } : result;
      }
      process.stdout.write(`  ${run.app.padEnd(12)} ${key}\n`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, runs.length) }, worker));
  for (const served of servers) served.stop();

  /* The verdict: the friction, and what got worse since the last one committed. */
  const counted = structuredClone(report);
  for (const result of Object.values(counted.apps)) {
    for (const job of Object.values(result.jobs ?? {})) {
      for (const [key, run] of Object.entries(job.runs)) if (run.harness) delete job.runs[key];
    }
  }
  report.friction = frictionOf(counted);
  let previous = null;
  try {
    previous = JSON.parse(execFileSync("git", ["show", "HEAD:docs/journeys.json"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    // Nothing committed yet: the first verdict is the baseline, and nothing can have regressed against it.
    previous = null;
  }
  report.regressions = regressionsOf(previous, counted);
  report.took = Math.round((Date.now() - began) / 1000);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

  /* Said: per app, how many runs got done; the harness's own failures; the friction's head; the regressions. */
  process.stdout.write("\n");
  const harnessFaults = [];
  for (const [app, result] of Object.entries(report.apps)) {
    if (!result.jobs) {
      process.stdout.write(`${app.padEnd(12)} ${result.skipped ?? result.failed}\n`);
      continue;
    }
    let done = 0;
    let tried = 0;
    for (const [jobId, job] of Object.entries(result.jobs)) {
      for (const [key, run] of Object.entries(job.runs)) {
        if (run.skipped) continue;
        tried += 1;
        if (run.done) done += 1;
        if (run.harness) harnessFaults.push(`${app} ${jobId} ${key}: ${run.deadEnd}`);
      }
    }
    process.stdout.write(`${app.padEnd(12)} ${done} of ${tried} runs done\n`);
  }
  if (harnessFaults.length > 0) {
    process.stdout.write(`\n${harnessFaults.length} runs the harness could not drive (left out of friction and regressions):\n`);
    for (const line of harnessFaults.slice(0, 15)) process.stdout.write(`  ${line}\n`);
  }
  process.stdout.write(`\nfriction (${report.friction.length}), the first ten:\n`);
  for (const item of report.friction.slice(0, 10)) process.stdout.write(`  · ${item.says}\n`);
  if (report.regressions.length > 0) {
    process.stdout.write(`\n${report.regressions.length} regression${report.regressions.length === 1 ? "" : "s"}:\n`);
    for (const line of report.regressions) process.stdout.write(`  ✗ ${line}\n`);
  }
  if (unbuilt.length > 0) process.stdout.write(`\nnamed and not built here, so not walked: ${unbuilt.join(", ")} (pnpm typecheck builds every app)\n`);
  process.stdout.write(`\n${report.regressions.length === 0 ? "no regressions" : "regressed"} — docs/journeys.json (${report.took}s)\n`);
  process.exit(report.regressions.length > 0 || unbuilt.length > 0 ? 1 : 0);
}

const runAt = process.argv.indexOf("--run");
if (runAt >= 0) {
  await runVariant(JSON.parse(process.argv[runAt + 1]));
  process.exit(0);
} else {
  await main();
}
