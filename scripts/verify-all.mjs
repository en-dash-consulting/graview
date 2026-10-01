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
import { existsSync, readFileSync, writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { watchFile } from "./lib/watch.mjs";

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
  ["site", "verify-site.mjs"],
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
  // The studio's whole path, on a scratch copy of seedbed: said, rewritten, written, compiled, migrated.
  ["rehearsal", "rehearse-studio.mjs"],
  ["remember", "verify-remember.mjs"],
  ["pages", "verify-pages.mjs"],
  ["panning", "verify-panning.mjs"],
  // A real catalogue, built for production: what a person can read, at sixty frames a second.
  ["scale", "verify-scale.mjs"],
  ["survey", "survey-ui.mjs"],
  ["audit", "audit-ui.mjs"],
  /*
   * Last, because it packs every package and installs a project three ways:
   * what a stranger gets from `graview create`. It sat outside this chain,
   * and a scaffold that failed its own checker went unheard for a week.
   */
  ["create", "smoke-create.mjs"],
];

const asked = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
if (process.argv.includes("--list")) {
  say(`${CHAIN.map(([name]) => name).join("\n")}\n`);
  process.exit(0);
}
/*
 * `--except=shrunk,scale` leaves those out: the nightly runner has no Chrome
 * Canary for the GPU capture path, and says so here rather than failing it.
 */
const except = (process.argv.find((arg) => arg.startsWith("--except="))?.slice("--except=".length) ?? "").split(",").filter(Boolean);
const chain = (asked.length > 0 ? CHAIN.filter(([name]) => asked.includes(name)) : CHAIN).filter(([name]) => !except.includes(name));
const unknown = [...asked, ...except].filter((name) => !CHAIN.some(([known]) => known === name));
if (unknown.length > 0) {
  say(`No harness called ${unknown.join(", ")}. Known: ${CHAIN.map(([n]) => n).join(", ")}\n`);
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
const APP_PORTS = [5178, 5190, 5191, 5192, 5193, 5194, 5195, 5196];
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

const results = [];
for (const [name, file] of chain) {
  const began = Date.now();
  say(`… ${name}\r`);
  const { code, output } = await new Promise((done) => {
    const child = spawn("node", [resolve(repoRoot, "scripts", file)], { cwd: repoRoot });
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
  results.push({ name, code: failed, took, gist: said, output });
  say(`${failed === 0 ? "ok  " : "FAIL"} ${name.padEnd(12)} ${String(took).padStart(4)}s  ${said}\n`);
}

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
const spent = results.reduce((sum, one) => sum + one.took, 0);
say(
  `\n${results.length - broken.length} of ${results.length} harnesses hold (${Math.round(spent / 60)}m)\n`,
);
process.exit(broken.length > 0 ? 1 : 0);
