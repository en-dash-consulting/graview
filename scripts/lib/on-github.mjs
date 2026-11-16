/**
 * THE HARNESSES, RUN ON GITHUB'S MACHINES.
 *
 * A build agent ran the browser harnesses on the laptop it was started
 * from, three at a time beside two other agents doing the same: the load
 * climbed past ten and sometimes past a hundred, a wait that held on a quiet
 * machine timed out and read as a failure, and one full harness took four
 * and a half hours. `.github/workflows/verify.yml` runs the same chain on
 * runners of their own, sharded the way Nightly shards it, and
 * `scripts/verify-on-github.mjs` (`pnpm verify:github <names>`) dispatches
 * it on the current branch, waits, and brings the verdicts back into
 * `docs/` with each failing claim said by name.
 *
 * This module is the part of both that can be held by a test: how the
 * names are split across runners, which files a harness wrote, which of a
 * verdict's claims are false, and how a run is said.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** A harness name as `pnpm verify` takes one, and nothing a shell would read as more. */
export const HARNESS_NAME = /^[a-z][a-z0-9-]*$/;

/*
 * What Nightly leaves out of the whole chain, and so does a run that names
 * nothing: shrunk needs Chrome Canary for the GPU capture path, and panning
 * and scale time frames against a GPU the runner does not have. Named, they
 * run anyway.
 */
export const NOT_ON_A_RUNNER = ["shrunk", "panning", "scale"];

/*
 * ROUGHLY HOW LONG EACH TAKES ON A RUNNER, in seconds, from Nightly's run on
 * main of 2026-10-18 (its comment in nightly.yml; journeys there is four
 * apps of the five, so here it is more). A harness not listed is
 * taken to be two minutes. It only has to be good enough to keep one
 * runner from holding every long harness.
 */
export const RUNNER_SECONDS = { site: 823, gauntlet: 721, journeys: 1500, a11y: 261, audit: 221, pages: 198, lines: 179, survey: 200, create: 300, quiet: 900 };
const secondsOf = (name) => RUNNER_SECONDS[name] ?? 120;

/**
 * The names split across at most `shards` runners, longest first onto the
 * runner with the least so far, each runner's names kept in the chain's
 * order (`order`, verify-all's own), so a shard runs them as `pnpm verify`
 * would.
 */
export function planShards(names, { shards = 8, order = names } = {}) {
  const unique = [...new Set(names)];
  const count = Math.max(1, Math.min(shards, unique.length));
  const bins = Array.from({ length: count }, () => ({ names: [], seconds: 0 }));
  for (const name of [...unique].sort((a, b) => secondsOf(b) - secondsOf(a) || a.localeCompare(b))) {
    const lightest = bins.reduce((least, bin) => (bin.seconds < least.seconds ? bin : least));
    lightest.names.push(name);
    lightest.seconds += secondsOf(name);
  }
  const at = (name) => (order.includes(name) ? order.indexOf(name) : Number.MAX_SAFE_INTEGER);
  return bins
    .filter((bin) => bin.names.length > 0)
    .map((bin) => {
      const sorted = [...bin.names].sort((a, b) => at(a) - at(b));
      return { names: sorted.join(" "), label: sorted.join(", "), seconds: bin.seconds };
    });
}

/**
 * The harnesses a run asked for: the names it was given, each one a harness
 * the chain knows, or the whole chain but what a runner cannot run. Throws
 * with the names it does not know.
 */
export function askedHarnesses(input, chain) {
  const names = String(input ?? "")
    .split(/[\s,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
  const malformed = names.filter((name) => !HARNESS_NAME.test(name));
  if (malformed.length > 0) throw new Error(`Not a harness name: ${malformed.join(", ")}`);
  const unknown = names.filter((name) => !chain.includes(name));
  if (unknown.length > 0) throw new Error(`No harness called ${unknown.join(", ")}. Known: ${chain.join(", ")}`);
  if (names.length > 0) return [...new Set(names)];
  return chain.filter((name) => !NOT_ON_A_RUNNER.includes(name));
}

/** Where claims are kept in a verdict, by the names the harnesses use for them. */
const CLAIM_HOLDERS = ["checks", "claims", "criteria", "steps", "verdict", "result"];
/** Keys that are a verdict's own summary, not one of its claims. */
const NOT_CLAIMS = new Set(["ok", "passed", "held", "quick"]);
const isFalse = (value) => value === false || (value !== null && typeof value === "object" && !Array.isArray(value) && (value.ok === false || value.passed === false));

/**
 * The claims a verdict says are false, by name: a key under `checks`,
 * `claims`, `criteria` or `steps` that is `false` or whose `ok` or `passed`
 * is, and a top-level key that is.
 */
export function falseClaims(verdict) {
  if (verdict === null || typeof verdict !== "object" || Array.isArray(verdict)) return [];
  const found = new Set();
  for (const [key, value] of Object.entries(verdict)) {
    if (NOT_CLAIMS.has(key)) continue;
    if (CLAIM_HOLDERS.includes(key) && value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [claim, held] of Object.entries(value)) if (!NOT_CLAIMS.has(claim) && isFalse(held)) found.add(claim);
    } else if (Array.isArray(value)) {
      // A list of `{ name, ok }`: each that failed, by its name.
      for (const [index, entry] of value.entries()) if (isFalse(entry) && typeof entry === "object") found.add(`${key}: ${entry.name ?? entry.id ?? entry.label ?? `#${index + 1}`}`);
    } else if (isFalse(value)) found.add(key);
    else if (value !== null && typeof value === "object") {
      // A part of the verdict whose own claims are said as booleans (`npm: { installed: false }`).
      for (const [claim, held] of Object.entries(value)) if (!NOT_CLAIMS.has(claim) && held === false) found.add(`${key}.${claim}`);
    }
  }
  return [...found];
}

/** Every file under `dir` (relative to `root`) changed at or after `since`, `docs/site` left out: what a run wrote. */
export function writtenSince(root, since, dir = "docs") {
  const found = [];
  const walk = (at) => {
    if (!existsSync(at)) return;
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      const rel = relative(root, path);
      if (rel === join("docs", "site")) continue;
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (stat.mtimeMs >= since) found.push({ path: rel, at: stat.mtimeMs });
    }
  };
  walk(join(root, dir));
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

/** Copied from `root` into `into`, at the same relative paths. */
export function copyInto(root, files, into) {
  for (const file of files) {
    const to = join(into, file);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(root, file), to);
  }
}

/*
 * A SHARD'S FILES THAT ARE NOT ONE HARNESS'S. Every shard writes the run's
 * own record, the ledger and the flakes; brought back from several shards
 * they would overwrite each other and the checkout's own `--failed`.
 */
export const SHARD_OWN = ["docs/watch/last-run.json", "docs/watch/ledger.json", "docs/flakes.json"];

/**
 * What one shard ran, harness by harness: its verdict, how long it took,
 * the files it wrote, and every claim that failed by name. A harness is
 * credited with the files written while it ran (exact, since a shard runs
 * one at a time); its claims are those its output said were false (`missed`)
 * and those its verdicts say are, and the watch's open problems.
 */
export function summarizeShard({ root, since, asked, lastRun, written }) {
  // No moment the harnesses began (the shard stopped before them) is no harness run, whatever the checkout's last run says.
  const ran = since > 0 && lastRun && Date.parse(lastRun.at) >= since ? lastRun.results : [];
  const starts = ran.map((one) => (one.began ? Date.parse(one.began) : null)).filter((at) => at !== null);
  const harnesses = asked.map((name) => {
    const result = ran.find((one) => one.name === name);
    if (!result) return { name, verdict: "no verdict", took: null, claims: ["wrote no verdict: the shard stopped before it ran or finished"], files: [] };
    const began = result.began ? Date.parse(result.began) : null;
    const files =
      began === null
        ? []
        : (() => {
            // Until the next harness began, or a little past its own end when it was the last.
            const next = Math.min(...starts.filter((at) => at > began), began + (result.took + 5) * 1000);
            return written.filter((file) => file.at >= began - 1000 && file.at < next && !SHARD_OWN.includes(file.path)).map((file) => file.path);
          })();
    const claims = new Set(result.verdict === "held" ? [] : (result.missed ?? []));
    if (result.verdict !== "held") {
      for (const file of files.filter((path) => path.endsWith(".json"))) {
        let verdict;
        try {
          verdict = JSON.parse(readFileSync(join(root, file), "utf8"));
        } catch {
          continue;
        }
        if (file.startsWith("docs/watch/")) {
          if (verdict.open > 0) claims.add(`the watch: ${verdict.open} open in ${file}`);
        } else for (const claim of falseClaims(verdict)) claims.add(claim);
      }
      if (claims.size === 0) claims.add(result.gist ? `no claim named; it said: ${result.gist}` : "no claim named");
    }
    return { name, verdict: result.verdict ?? (result.code === 0 ? "held" : "failed"), took: result.took, claims: [...claims], files };
  });
  return { harnesses };
}

/** A shard's summary as the job summary shows it: a line per harness, every failing claim beneath it. */
export function summaryMarkdown({ label, harnesses }, { run } = {}) {
  const mark = { held: "✅", flaky: "⚠️", failed: "❌", "no verdict": "❌" };
  const lines = [`### ${label}`, "", "| | Harness | Verdict | Took |", "|---|---|---|---|"];
  for (const one of harnesses) lines.push(`| ${mark[one.verdict] ?? "❌"} | \`${one.name}\` | ${one.verdict} | ${one.took === null ? "—" : `${one.took}s`} |`);
  const failing = harnesses.filter((one) => one.verdict !== "held");
  if (failing.length > 0) {
    lines.push("");
    for (const one of failing) {
      lines.push(`**${one.name}** ${one.verdict === "flaky" ? "failed once and held alone" : "failed"}:`);
      for (const claim of one.claims) lines.push(`- \`${claim}\``);
      lines.push("");
    }
  }
  if (run) lines.push("", run);
  return `${lines.join("\n")}\n`;
}

/** Whether a run's harnesses all held: a flake holds, a failure or a harness with no verdict does not. */
export const allHeld = (harnesses) => harnesses.length > 0 && harnesses.every((one) => one.verdict === "held" || one.verdict === "flaky");

/** The run's harnesses said in the terminal, a line each and every failing claim under it. */
export function terminalLines(harnesses) {
  const out = [];
  for (const one of harnesses) {
    const word = one.verdict === "held" ? "ok   " : one.verdict === "flaky" ? "flaky" : "FAIL ";
    out.push(`${word} ${one.name.padEnd(14)} ${one.took === null ? "    —" : `${String(one.took).padStart(4)}s`}`);
    if (one.verdict !== "held") for (const claim of one.claims) out.push(`        ${claim}`);
  }
  return out;
}
