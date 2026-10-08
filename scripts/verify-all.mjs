#!/usr/bin/env node
/**
 * Every browser harness, one verdict.
 *
 * `pnpm test` is green whatever the harnesses say, and each of them is its
 * own command that somebody has to know to run. That is how three of them
 * came to be failing on main with nobody being told: `verify-menu` waited
 * for a control the design had removed, and two audit states waited for
 * elements nothing produced, and all of it sat in `docs/*.json` where a
 * report recorded its own errors as though they were the weather.
 *
 * So: one command, one exit code, and a line per harness saying what it
 * cost and whether it holds.
 *
 *   node scripts/verify-all.mjs              every harness
 *   node scripts/verify-all.mjs menu pages   only these
 *   node scripts/verify-all.mjs --list       the names, and nothing else
 *   node scripts/verify-all.mjs --except=shrunk   every harness but these
 *   node scripts/verify-all.mjs --failed     only what failed last time
 *   node scripts/verify-all.mjs --quick      fewer widths where a harness sweeps them (iteration)
 *   node scripts/verify-all.mjs --jobs=1     one at a time, as it used to be
 *
 * Run in series on purpose: they drive the same dev servers on the same
 * ports, and a parallel run is a harness measuring another harness's app.
 *
 * Every line is written with `writeSync` rather than `process.stdout.write`.
 * Node block-buffers stdout when it is not a terminal, so piped to a file or
 * read by a watching process this printed nothing at all for twenty minutes
 * and then everything at once — which is the failure this command exists to
 * fix, reproduced by the command itself.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { updateLedger } from "./lib/ledger.mjs";
import { serving } from "./lib/serve.mjs";
import { watchFile } from "./lib/watch.mjs";
import { portFor } from "./lib/ports.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Straight to the descriptor, so a watcher sees each line as it happens. */
const say = (text) => writeSync(1, text);

/**
 * The chain, cheapest first, so a broken build says so in seconds rather
 * than after ten minutes of screenshots.
 */
const CHAIN = [
  // First: the watch that judges every other harness's screens, made to fire.
  ["watch", "verify-watch.mjs"],
  // No browser: what Cloud's hosted page carries before the app draws, from esbuild's metafile (FR-57).
  ["hosted", "verify-hosted-page.mjs"],
  // Guest views, hostile, in a frame (three engines) and in a worker inside Claude's and ChatGPT's widgets (FR-04, FR-68–FR-71).
  ["guest", "guest-sandbox.mjs"],
  ["site", "verify-site.mjs"],
  // The awkward example in every face, width, scheme and seat — long, so it starts early.
  ["gauntlet", "verify-gauntlet.mjs"],
  ["lines", "verify-lines.mjs"],
  ["shrunk", "verify-shrunk.mjs"],
  ["navigation", "verify-navigation.mjs"],
  ["menu", "verify-menu.mjs"],
  ["companion", "verify-companion.mjs"],
  ["chat", "verify-chat.mjs"],
  ["seat", "verify-seat.mjs"],
  ["who", "verify-who.mjs"],
  ["calendar", "verify-calendar.mjs"],
  ["desk", "verify-desk.mjs"],
  ["rota", "verify-rota.mjs"],
  ["studio", "verify-studio.mjs"],
  // The embed's chrome as one family: every popover over everything, the host's actions, the seat put away, the host's notices (FR-72, FR-75–FR-78).
  ["chrome", "verify-chrome.mjs"],
  // Fewer pills and no name cut off, on Cloud's two apps, in three engines (FR-113, FR-117, FR-118).
  ["quiet", "verify-chrome-quiet.mjs"],
  // The whole brand from the document — logo, faces, shape, scheme, icon, the line under the name — on both faces, in three engines (FR-124, FR-125).
  ["brand", "verify-brand.mjs"],
  // A document's declared lenses drawn as places on both faces, and its arrangement honored, with no view of the host's (FR-79, FR-80).
  ["declared", "verify-declared.mjs"],
  // A record's long text keeps its paragraphs and lists, spans the record under its label, is edited in a text area, and its facts follow the declared or the page's order, in three engines (FR-146–FR-148).
  ["long-text", "verify-long-text.mjs"],
  // A host whose page is the app hands the routed face the address bar, in three engines; an article's embed never touches it (FR-106).
  ["address", "verify-address.mjs"],
  // The studio's whole path, on a scratch copy of seedbed: said, rewritten, written, compiled, migrated.
  ["rehearsal", "rehearse-studio.mjs"],
  ["remember", "verify-remember.mjs"],
  ["pages", "verify-pages.mjs"],
  // Whether a person can do each app's core jobs on both faces, and what it costs; fails only on a regression.
  ["journeys", "verify-journeys.mjs"],
  ["panning", "verify-panning.mjs"],
  // A real catalog, built for production: what a person can read, at sixty frames a second.
  ["scale", "verify-scale.mjs"],
  // The example built to be awkward, driven into every face, width, scheme and seat it has.
  ["survey", "survey-ui.mjs"],
  ["audit", "audit-ui.mjs"],
  /*
   * Last, because it packs every package and installs a project three ways:
   * what a stranger gets from `graview create`. It sat outside this chain,
   * and a scaffold that failed its own checker went unheard for a week.
   */
  ["create", "smoke-create.mjs"],
];

/*
 * ALONE: the harnesses that time something — frames, a presence
 * time-to-live, an animation settling — or that load the machine on their
 * own (create installs three projects). They run after the others, one at a
 * time, on a quiet machine. Everything else shares the dev servers, which
 * hold no state of a harness's (each opens its own browser context), and
 * runs side by side.
 */
const ALONE = new Set(["lines", "panning", "scale", "who", "journeys", "create"]);

/** Where the last run's verdicts are kept, for `--failed`. */
const LAST_RUN = resolve(repoRoot, "docs/watch/last-run.json");

/*
 * AN APP OF ONE'S OWN. A walk builds its app beside the framework
 * (`../walk7`), and the kick-off says to run the journeys "with the app
 * named" — but every name here was a harness, so the walk's own app could
 * not be named at all. An argument that is a path is an app, handed to the
 * harnesses that drive one they are told about (TAKES_AN_APP).
 */
const isPath = (arg) => arg.includes("/") || arg.startsWith(".");
const TAKES_AN_APP = new Set(["journeys"]);
const appPaths = process.argv.slice(2).filter((arg) => !arg.startsWith("-") && isPath(arg)).map((arg) => resolve(arg));
const asked = process.argv.slice(2).filter((arg) => !arg.startsWith("-") && !isPath(arg));
if (process.argv.includes("--list")) {
  say(`${CHAIN.map(([name]) => name).join("\n")}\n`);
  process.exit(0);
}
/*
 * `--except=shrunk,scale` leaves those out: the nightly runner has no Chrome
 * Canary for the GPU capture path, and says so here rather than failing it.
 */
const except = (process.argv.find((arg) => arg.startsWith("--except="))?.slice("--except=".length) ?? "").split(",").filter(Boolean);
/*
 * `--failed`: what failed last time, and nothing else. Iterating on a fix
 * reran the whole chain — twenty-three minutes — to learn whether the two
 * harnesses that had failed now held.
 */
const lastFailed = process.argv.includes("--failed") && existsSync(LAST_RUN)
  ? JSON.parse(readFileSync(LAST_RUN, "utf8")).results.filter((one) => one.code !== 0).map((one) => one.name)
  : null;
const chain = (asked.length > 0 ? CHAIN.filter(([name]) => asked.includes(name)) : lastFailed ? CHAIN.filter(([name]) => lastFailed.includes(name)) : CHAIN).filter(([name]) => !except.includes(name));
const jobs = process.argv.includes("--serial") ? 1 : Number(process.argv.find((arg) => arg.startsWith("--jobs="))?.slice("--jobs=".length) ?? 3);
const quick = process.argv.includes("--quick");
const unknown = [...asked, ...except].filter((name) => !CHAIN.some(([known]) => known === name));
if (unknown.length > 0) {
  say(`No harness called ${unknown.join(", ")}. Known: ${CHAIN.map(([n]) => n).join(", ")}\n`);
  process.exit(2);
}
const missing = appPaths.filter((path) => !existsSync(resolve(path, "vite.config.ts")));
if (missing.length > 0) {
  say(`No app at ${missing.join(", ")} (an app is a directory with a vite.config.ts)\n`);
  process.exit(2);
}
if (appPaths.length > 0 && !chain.some(([name]) => TAKES_AN_APP.has(name))) {
  say(`An app was named, and only ${[...TAKES_AN_APP].join(", ")} drives one it is told about: pnpm verify journeys ${process.argv.slice(2).filter(isPath).join(" ")}\n`);
  process.exit(2);
}

/** The last line a harness printed that says anything — its own summary. */
const gist = (text) => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines[lines.length - 1]?.slice(0, 72) ?? "";
};

/*
 * SAY WHAT WAS ALREADY RUNNING.
 *
 * The harnesses borrow a dev server that is already answering their port —
 * deliberately, because a harness you cannot run while the app is open is a
 * harness nobody runs. The cost is that a stale or foreign server silently
 * changes what is under test, and a machine busy serving six of them
 * changes how long everything takes.
 *
 * That is how a clean thirteen-minute chain became forty-seven minutes with
 * three failures in it — a presence check that waits on a time-to-live, a
 * click that waits for an animation to settle, and a seat harness thirty
 * times slower than usual. All three passed on a quiet machine a minute
 * later. Nothing in the report said the machine had not been quiet.
 *
 * So it says so now, at the top, before any of it runs.
 */
const APP_PORTS = ["linked", "gauntlet", "todo", "seedbed", "rota", "served", "launcher"].map(portFor);
const answering = [];
for (const port of APP_PORTS) {
  try {
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(400) });
    answering.push(port);
  } catch {
    // Nothing there, which is what a quiet machine looks like.
  }
}
if (answering.length > 0) {
  say(
    `note  ${answering.length} dev server${answering.length === 1 ? "" : "s"} already running (${answering.join(", ")}).\n` +
      `      The harnesses will drive those rather than starting their own, and the\n` +
      `      machine is busier than it would be otherwise. Timing-sensitive checks —\n` +
      `      presence time-to-live, animations settling — are the ones that mind.\n\n`,
  );
}

/*
 * THE SHARED SERVERS, started once. Every harness borrows a server already
 * answering its port (lib/serve.mjs), so starting them here is what lets
 * harnesses run side by side instead of racing to start the same vite.
 */
const SHARED = [
  "todo",
  "seedbed",
  "rota",
  "launcher",
];
const servers = [];
if (chain.length > 1) {
  for (const app of SHARED) {
    const port = portFor(app);
    try {
      servers.push(await serving(app, port, repoRoot));
    } catch (error) {
      say(`note  ${app} did not start on ${port} (${error.message}); its harnesses will try themselves.\n`);
    }
  }
}

const results = [];
const runOne = async ([name, file]) => {
  const began = Date.now();
  const { code, output } = await new Promise((done) => {
    const child = spawn("node", [resolve(repoRoot, "scripts", file), ...(TAKES_AN_APP.has(name) ? appPaths : [])], {
      cwd: repoRoot,
      env: { ...process.env, ...(quick ? { GRAVIEW_QUICK: "1" } : {}) },
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("exit", (code) => done({ code: code ?? 1, output }));
  });
  const took = Math.round((Date.now() - began) / 1000);
  /*
   * AND THE WATCH'S VERDICT. A harness holds its own claims; the watch holds
   * the rules every screen it reached must keep (lib/watch.mjs). A harness
   * whose claims all pass over a screen that left the keyboard on <body>
   * does not hold.
   */
  const watch = watchFile(file.replace(/\.mjs$/, ""));
  const seen = existsSync(watch) ? JSON.parse(readFileSync(watch, "utf8")) : null;
  const open = seen && Date.parse(seen.at) >= began ? seen.open : 0;
  const failed = code !== 0 ? code : open > 0 ? 1 : 0;
  const said = open > 0 ? `watch: ${open} open — docs/watch/${watch.split("/").pop()}` : gist(output);
  results.push({ name, file, code: failed, took, gist: said, output });
  say(`${failed === 0 ? "ok  " : "FAIL"} ${name.padEnd(12)} ${String(took).padStart(4)}s  ${said}\n`);
};

const started = Date.now();
const together = chain.filter(([name]) => !ALONE.has(name));
const alone = chain.filter(([name]) => ALONE.has(name));
say(`${together.length} side by side (${jobs} at a time), then ${alone.length} alone${quick ? ", quick" : ""}\n`);
// Longest first, so the slow ones are not what is left at the end.
const queue = [...together];
await Promise.all(
  Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) await runOne(next);
  }),
);
for (const one of alone) await runOne(one);
for (const server of servers) server.stop();
const wall = Math.round((Date.now() - started) / 1000);

const broken = results.filter((one) => one.code !== 0);
if (broken.length > 0) {
  say(`\n${"—".repeat(60)}\n`);
  for (const one of broken) {
    /*
     * WHAT FAILED, not the last twenty-five lines.
     *
     * The tail was the first thing written here, and `verify-site` prints a
     * line per passing check — so its one failure scrolled off and the
     * report said nothing but `ok`, which is the exact shape of the problem
     * this command exists to fix, arrived at from the other direction.
     *
     * So: every line that is not a plain `ok`, and the tail as well when
     * there are none — some harnesses say what went wrong only at the end.
     */
    const lines = one.output.trimEnd().split("\n");
    const wrong = lines.filter((line) => !/^\s*ok\s/.test(line) && line.trim() !== "");
    const shown = wrong.length > 0 ? wrong : lines.slice(-25);
    say(`\n${one.name}:\n${shown.slice(-40).join("\n")}\n`);
  }
}
/*
 * THE PROBLEMS, ONCE EACH. A harness line says which harnesses failed; this
 * says what is wrong — each problem once however many screens showed it,
 * and whether it is new, still there, or fixed since the last run.
 */
const ledger = updateLedger(repoRoot, { since: started, ran: new Set(results.map((one) => one.file.replace(/\.mjs$/, ""))) });
const line = (entry) => `  ${entry.rule.padEnd(22)} ${entry.detail.slice(0, 150)}  (${entry.harnesses.join(", ")})\n`;
if (ledger.fresh.length + ledger.still.length + ledger.fixed.length + ledger.flapping.length > 0) {
  say(`\nproblems: ${ledger.fresh.length} new, ${ledger.still.length} still open, ${ledger.fixed.length} fixed, ${ledger.flapping.length} back after a fix\n`);
  if (ledger.fresh.length) say(`new\n${ledger.fresh.map(line).join("")}`);
  if (ledger.still.length) say(`still open\n${ledger.still.map(line).join("")}`);
  if (ledger.fixed.length) say(`fixed\n${ledger.fixed.map(line).join("")}`);
  if (ledger.flapping.length) say(`back after a fix — the check or its timing, before the product\n${ledger.flapping.map(line).join("")}`);
}
mkdirSync(resolve(repoRoot, "docs/watch"), { recursive: true });
writeFileSync(LAST_RUN, `${JSON.stringify({ at: new Date().toISOString(), results: results.map(({ name, code, took }) => ({ name, code, took })) }, null, 2)}\n`);
const spent = results.reduce((sum, one) => sum + one.took, 0);
say(
  `\n${results.length - broken.length} of ${results.length} harnesses hold (${Math.round(wall / 60)}m, ${Math.round(spent / 60)}m of harness time)\n`,
);
process.exit(broken.length > 0 ? 1 : 0);
