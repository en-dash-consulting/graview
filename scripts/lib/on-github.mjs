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
import { allUnits, unitsOf } from "./parts.mjs";

/** A harness name as `pnpm verify` takes one, or one part of one (`quiet.webkit`, lib/parts.mjs), and nothing a shell would read as more. */
export const HARNESS_NAME = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)?$/;

/*
 * What Nightly leaves out of the whole chain, and so does a run that names
 * nothing: shrunk needs Chrome Canary for the GPU capture path, and panning
 * and scale time frames against a GPU the runner does not have. Named, they
 * run anyway.
 */
export const NOT_ON_A_RUNNER = ["shrunk", "panning", "scale"];

/*
 * ROUGHLY HOW LONG EACH TAKES ON A RUNNER, in seconds, from the whole chain
 * run on main on 2026-11-23 (verify.yml, run 45108152203, one at a time a
 * shard): every harness over a minute and a half. quiet took 2,909 s whole,
 * and runs as a part per engine and section (lib/parts.mjs), guessed here
 * from what each part took on a laptop; address, scene-hands and
 * drawn-once a part per engine; journeys took 1,357 s two runs at a time,
 * and runs four. A harness not listed is taken to be a minute. It only has
 * to be good enough to keep one runner from holding every long harness.
 */
export const RUNNER_SECONDS = {
  ...Object.fromEntries(
    ["chromium", "webkit", "firefox"].flatMap((engine) =>
      Object.entries({ steady: engine === "chromium" ? 250 : 100, standing: 110, picks: 60, boxes: 180, notices: 150, rest: 330 }).map(([section, seconds]) => [`quiet.${engine}-${section}`, seconds]),
    ),
  ),
  journeys: 750,
  gauntlet: 732,
  "one-face": 699,
  "address.chromium": 260, "address.webkit": 200, "address.firefox": 200,
  "scene-hands.chromium": 320, "scene-hands.webkit": 300,
  site: 611,
  guest: 459,
  "drawn-once.chromium": 140, "drawn-once.webkit": 130, "drawn-once.firefox": 130,
  a11y: 362,
  drawn: 303,
  chrome: 297,
  "long-text": 286,
  pages: 271,
  declared: 270,
  growing: 228,
  lines: 223,
  "first-load": 180,
  menu: 177,
  audit: 153,
  brand: 146,
  viewport: 144,
  create: 138,
  survey: 128,
  "kind-stop": 127,
  files: 124,
  "page-better": 122,
  facts: 120,
  navigation: 114,
  playback: 101,
  "screen-reader": 95,
  watch: 93,
};
const secondsOf = (name) => RUNNER_SECONDS[name] ?? 60;

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
  const known = allUnits(chain);
  const unknown = names.filter((name) => !known.includes(name));
  if (unknown.length > 0) throw new Error(`No harness called ${unknown.join(", ")}. Known: ${known.join(", ")}`);
  if (names.length > 0) return [...new Set(names)];
  return chain.filter((name) => !NOT_ON_A_RUNNER.includes(name));
}

/**
 * What a run's shards take: each harness asked, a harness run in parts as
 * each of its parts (lib/parts.mjs), so one long harness is not one runner's
 * whole run.
 */
export function shardUnits(names) {
  return [...new Set(unitsOf(names))];
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
/** The harnesses whose verdict is named otherwise than the script (verify-pages.mjs writes docs/pages-face.json). */
export const VERDICT_NAMES = { pages: ["pages-face"], lines: ["lines-check"], shrunk: ["shrunk-interface"], watch: ["watch-check"], site: ["site-check"], notion: ["notion-stub"] };

/** Whether a path under docs/ is harness `name`'s own: docs/<name>.*, docs/<name>/…, its watch; never docs/<name>-* by itself, which is another harness's (chrome-quiet beside chrome). */
export const ownedBy = (name, path) =>
  path === `docs/watch/verify-${name}.json` || (!path.startsWith("docs/watch/") && [name, ...(VERDICT_NAMES[name] ?? [])].some((one) => [".", "/"].some((after) => path.startsWith(`docs/${one}${after}`))));

/** The harness a first look's copy (docs/first-look/…) was kept for, or null. */
const firstLookOf = (path) => {
  const original = `docs/${path.slice("docs/first-look/".length)}`;
  const script = /^docs\/watch\/verify-(.+)\.json$/.exec(original)?.[1];
  if (script) return script;
  const head = original.slice("docs/".length).split(/[./]/)[0];
  return Object.entries(VERDICT_NAMES).find(([, names]) => names.includes(head))?.[0] ?? head;
};

export const SHARD_OWN = ["docs/watch/last-run.json", "docs/watch/ledger.json", "docs/flakes.json", "docs/watch/times.json", "docs/watch/coverage.json"];

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
            // A first look kept beside the second (docs/first-look/) is this harness's by its path, never by when it was copied.
            // Kept by its script's name (verify-hosted-page.mjs is the chain's `hosted`), which the run's record says.
            const script = result.file ? result.file.replace(/^verify-/, "").replace(/\.mjs$/, "") : name;
            const kept = written.filter((file) => file.path.startsWith("docs/first-look/") && firstLookOf(file.path) === script);
            return [...kept, ...written.filter((file) => file.at >= began - 1000 && file.at < next && !SHARD_OWN.includes(file.path) && !file.path.startsWith("docs/first-look/"))].map((file) => file.path);
          })();
    const claims = new Set(result.verdict === "held" ? [] : (result.missed ?? []));
    if (result.verdict !== "held") {
      // A first look kept beside the second (docs/first-look/, lib/second-look.mjs) is listed with its files, and its claims are already `missed`.
      for (const file of files.filter((path) => path.endsWith(".json") && !path.startsWith("docs/first-look/"))) {
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
