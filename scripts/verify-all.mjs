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
import { writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Straight to the descriptor, so a watcher sees each line as it happens. */
const say = (text) => writeSync(1, text);

/**
 * The chain, cheapest first, so a broken build says so in seconds rather
 * than after ten minutes of screenshots.
 */
const CHAIN = [
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
  ["remember", "verify-remember.mjs"],
  ["pages", "verify-pages.mjs"],
  ["panning", "verify-panning.mjs"],
  ["survey", "survey-ui.mjs"],
  ["audit", "audit-ui.mjs"],
];

const asked = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
if (process.argv.includes("--list")) {
  say(`${CHAIN.map(([name]) => name).join("\n")}\n`);
  process.exit(0);
}
const chain = asked.length > 0 ? CHAIN.filter(([name]) => asked.includes(name)) : CHAIN;
const unknown = asked.filter((name) => !CHAIN.some(([known]) => known === name));
if (unknown.length > 0) {
  say(`No harness called ${unknown.join(", ")}. Known: ${CHAIN.map(([n]) => n).join(", ")}\n`);
  process.exit(2);
}

/** The last line a harness printed that says anything — its own summary. */
const gist = (text) => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines[lines.length - 1]?.slice(0, 72) ?? "";
};

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
  results.push({ name, code, took, gist: gist(output), output });
  say(
    `${code === 0 ? "ok  " : "FAIL"} ${name.padEnd(12)} ${String(took).padStart(4)}s  ${gist(output)}\n`,
  );
}

const broken = results.filter((one) => one.code !== 0);
if (broken.length > 0) {
  say(`\n${"—".repeat(60)}\n`);
  for (const one of broken) {
    // The whole of a failing harness's output, so the verdict is actionable
    // without knowing which file to open — which was the point.
    say(`\n${one.name}:\n${one.output.trimEnd().split("\n").slice(-25).join("\n")}\n`);
  }
}
const spent = results.reduce((sum, one) => sum + one.took, 0);
say(
  `\n${results.length - broken.length} of ${results.length} harnesses hold (${Math.round(spent / 60)}m)\n`,
);
process.exit(broken.length > 0 ? 1 : 0);
