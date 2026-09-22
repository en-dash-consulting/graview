#!/usr/bin/env node
/**
 * The products that are built on this, and whether they still build.
 *
 * Every one of them links the packages by path, so a change here lands in
 * all of them the moment it is saved — and nothing reports which of them
 * survived it. `AgentSeat` gained a required `who` when robots became
 * things other people can see, and two products had not typechecked since;
 * nobody found out until somebody happened to open one. A framework whose
 * consumers are a separate checkout each has no CI in the ordinary sense,
 * so this is the smallest thing that works: run their own commands, in
 * their own repositories, and give one verdict.
 *
 *   node scripts/verify-products.mjs                 every product
 *   node scripts/verify-products.mjs squad homeflow  only these
 *   node scripts/verify-products.mjs --typecheck     the quick half
 *
 * Writes docs/products.json.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Where the products live, beside this repository. */
const shelf = resolve(repoRoot, "..");
const say = (text) => writeSync(1, text);
/*
 * Progress only where something can overwrite it. A carriage return does
 * nothing in a file or a pipe, so the "…" lines smeared across the verdict
 * they were meant to be replaced by — which is how `verify-all` learned the
 * same lesson about buffering.
 */
const progress = (text) => {
  if (process.stdout.isTTY) writeSync(1, text);
};

/*
 * Named rather than discovered. A glob over the parent directory would pick
 * up half-finished spikes and other people's checkouts, and a verdict that
 * changes with what happens to be on the disk is not a verdict.
 */
const PRODUCTS = ["squad", "homeflow", "proposal", "groundskeeper"];

const asked = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const onlyTypecheck = process.argv.includes("--typecheck");
const wanted = asked.length > 0 ? asked : PRODUCTS;

const run = (cwd, script) =>
  new Promise((done) => {
    const child = spawn("pnpm", ["run", script], { cwd });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("exit", (code) => done({ code: code ?? 1, output }));
    child.on("error", (error) => done({ code: 1, output: String(error) }));
  });

const report = { at: new Date().toISOString(), products: [] };
for (const name of wanted) {
  const cwd = resolve(shelf, `${name}-graview`);
  if (!existsSync(cwd)) {
    say(`??  ${name.padEnd(14)} no checkout at ${cwd}\n`);
    report.products.push({ name, missing: true });
    continue;
  }
  const steps = onlyTypecheck ? ["typecheck"] : ["typecheck", "test"];
  const results = {};
  let broke = null;
  for (const step of steps) {
    const began = Date.now();
    progress(`…   ${name} ${step}\r`);
    const { code, output } = await run(cwd, step);
    results[step] = { ok: code === 0, seconds: Math.round((Date.now() - began) / 1000) };
    if (code !== 0 && !broke) broke = { step, output };
    // A product that does not typecheck will not usefully test either.
    if (code !== 0) break;
  }
  const ok = Object.values(results).every((one) => one.ok);
  report.products.push({ name, ok, ...results, ...(broke ? { failed: broke.step } : {}) });
  const took = Object.values(results).reduce((sum, one) => sum + one.seconds, 0);
  say(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(14)} ${String(took).padStart(4)}s  ${Object.entries(results)
      .map(([step, one]) => `${step} ${one.ok ? "ok" : "FAILED"}`)
      .join(" · ")}\n`,
  );
  if (broke) {
    /*
     * The lines that are not simply progress. A `tsc` failure is three lines
     * in a hundred of pnpm noise, and the point of one verdict is not having
     * to go and find them.
     */
    const lines = broke.output.trimEnd().split("\n");
    const wrong = lines.filter((line) => /error|Error|✕|×|FAIL|→/.test(line));
    /*
     * And each of them shortened. A failing assertion prints what it
     * received, and what a scene renders is one line of sixty thousand
     * characters — a verdict nobody can read is the same as no verdict.
     */
    const brief = (line) => (line.length > 160 ? `${line.slice(0, 160)}…` : line);
    say(`${(wrong.length > 0 ? wrong : lines).slice(-20).map((line) => `      ${brief(line)}`).join("\n")}\n`);
  }
}

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/products.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const broken = report.products.filter((one) => one.missing || !one.ok);
say(`\n${report.products.length - broken.length} of ${report.products.length} products still build\n`);
process.exit(broken.length > 0 ? 1 : 0);
