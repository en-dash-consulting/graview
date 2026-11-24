/**
 * WHAT A HARNESS COST, said by the harness's own process and read by the
 * chain (verify-all.mjs).
 *
 * The chain was documented as about ten minutes and ran an hour and a half,
 * and nothing in it said where the time went: a harness's line said its
 * wall time and nothing of what was spent before its first browser opened,
 * how many dev servers it waited for, or how long it sat in fixed waits. So
 * each harness notes those as it goes — `noteTiming` appends a line to the
 * file the chain hands it in GRAVIEW_TIMING_FILE, from the harness's own
 * process and from every process it starts (a `graview preview`, a vite) —
 * and the chain reads them back with the CPU the harness and its children
 * spent (`cpuOf`, from the shell's `times`), into the harness's verdict and
 * docs/watch/last-run.json.
 *
 * Nothing here runs unless the chain asked: a harness run by hand writes no
 * timing file and costs nothing.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const TIMING_ENV = "GRAVIEW_TIMING_FILE";

/** When this process began, as the clock `Date.now()` reads. */
const processBegan = Date.now() - Math.round(process.uptime() * 1000);

/** One line of what this harness cost, when the chain is listening. Never throws. */
export function noteTiming(entry) {
  const file = process.env[TIMING_ENV];
  if (!file) return;
  try {
    appendFileSync(file, `${JSON.stringify({ ...entry, pid: process.pid, sinceStart: Date.now() - processBegan })}\n`);
  } catch {
    // A timing note is never worth a harness.
  }
}

/*
 * FIXED WAITS, summed: every `page.waitForTimeout` a watched page made
 * (watch.mjs), written once when the process ends — with the line of the
 * harness that asked for each, so the run's record says which waits cost
 * the time and a build replacing them knows where to start.
 *
 * And, as `settledWaits`, the time spent in waits on a condition
 * (settled.mjs: `settled`, `until`), so a wait that became one is still
 * counted for what it really took rather than dropping out of the record.
 */
const tallies = { waited: { ms: 0, count: 0, at: new Map() }, settled: { ms: 0, count: 0, at: new Map() } };
let wiredWaits = false;
function tally(kind, ms) {
  if (!process.env[TIMING_ENV]) return;
  const spent = Number(ms) || 0;
  const one = tallies[kind];
  one.ms += spent;
  one.count += 1;
  const at = waitSite(new Error().stack);
  const site = one.at.get(at) ?? { at, ms: 0, count: 0 };
  site.ms += spent;
  site.count += 1;
  one.at.set(at, site);
  if (!wiredWaits) {
    wiredWaits = true;
    process.on("exit", () => {
      for (const [name, { ms: total, count, at: sites }] of Object.entries(tallies)) if (count > 0) noteTiming({ kind: name, ms: total, count, sites: [...sites.values()] });
    });
  }
}
/** A fixed wait a watched page sat through. */
export const noteWait = (ms) => tally("waited", ms);
/** A wait on a condition, and what it took. */
export const noteSettled = (ms) => tally("settled", ms);

/**
 * The harness line a wait was asked for at, from a stack: the first frame
 * under scripts/ that is not the watch or this module, as `file:line`
 * relative to scripts/ (never a home directory), or "elsewhere".
 */
export function waitSite(stack) {
  for (const line of String(stack ?? "").split("\n").slice(1)) {
    const found = /scripts\/((?:[\w.-]+\/)*[\w.-]+\.m?[jt]s):(\d+)/.exec(line);
    if (!found) continue;
    if (found[1] === "lib/watch.mjs" || found[1] === "lib/timing.mjs" || found[1] === "lib/settled.mjs") continue;
    return `${found[1]}:${found[2]}`;
  }
  return "elsewhere";
}

/** The waits of every process, by the line that asked: the costliest twelve, most first. */
function waitSites(waitedLines) {
  const byAt = new Map();
  for (const site of waitedLines.flatMap((one) => one.sites ?? [])) {
    const kept = byAt.get(site.at) ?? { at: site.at, ms: 0, count: 0 };
    kept.ms += site.ms;
    kept.count += site.count;
    byAt.set(site.at, kept);
  }
  return [...byAt.values()].sort((a, b) => b.ms - a.ms).slice(0, 12);
}

/** The lines of a timing file, or none. */
export function readTimingLines(file) {
  if (!file || !existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

/**
 * What a harness cost, from its timing lines: each dev server it started or
 * borrowed and how long each took to answer, how long its own process ran
 * before the first browser opened (building its host pages, starting its
 * servers), how many browsers it launched and what that cost, and the fixed
 * waits its pages sat through.
 *
 * @param {object[]} lines what `noteTiming` wrote
 * @param {{ harnessPid?: number }} [options] the harness's own process, whose first launch says its set-up
 */
export function summarizeTiming(lines, { harnessPid } = {}) {
  const servers = lines.filter((one) => one.kind === "server").map(({ name, port, ms, borrowed }) => ({ name, port, ms, borrowed }));
  const launches = lines.filter((one) => one.kind === "browser");
  const own = harnessPid ? launches.filter((one) => one.pid === harnessPid) : launches;
  const first = (own.length > 0 ? own : launches).reduce((least, one) => (least === null || one.sinceStart - one.ms < least ? one.sinceStart - one.ms : least), null);
  const waitedLines = lines.filter((one) => one.kind === "waited");
  const settledLines = lines.filter((one) => one.kind === "settled");
  return {
    serverStartup: servers.filter((one) => !one.borrowed).reduce((sum, one) => sum + one.ms, 0),
    servers,
    beforeFirstBrowser: first,
    browsers: launches.length,
    browserLaunch: launches.reduce((sum, one) => sum + one.ms, 0),
    fixedWaits: waitedLines.reduce((sum, one) => sum + one.ms, 0),
    fixedWaitCount: waitedLines.reduce((sum, one) => sum + (one.count ?? 0), 0),
    fixedWaitSites: waitSites(waitedLines),
    settledWaits: settledLines.reduce((sum, one) => sum + one.ms, 0),
    settledWaitCount: settledLines.reduce((sum, one) => sum + (one.count ?? 0), 0),
    settledWaitSites: waitSites(settledLines),
  };
}

/**
 * The CPU a harness and the processes it waited for spent, in seconds, from
 * the two lines bash's `times` prints (the shell's own, then its children's):
 * `0m0.010s 0m0.020s` / `1m2.500s 0m3.250s`. Null when there is no such line,
 * as when the harness was stopped from outside.
 */
export function cpuOf(text) {
  const lines = String(text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+m[\d.]+s\s+\d+m[\d.]+s$/.test(line));
  const children = lines.at(-1);
  if (!children) return null;
  const seconds = (part) => {
    const [, minutes, rest] = /^(\d+)m([\d.]+)s$/.exec(part) ?? [];
    return Number(minutes) * 60 + Number(rest);
  };
  const [user, system] = children.split(/\s+/).map(seconds);
  return { user: Math.round(user * 10) / 10, system: Math.round(system * 10) / 10, total: Math.round((user + system) * 10) / 10 };
}

/**
 * THE TIMING, KEPT WITH THE VERDICT. Every verdict file the harness wrote
 * while it ran (docs/<name>.json and its others, `ownedBy`) gets a `timing`
 * key: what it cost beside what it claims. Only a verdict that is a JSON
 * object is touched, and only one written since the harness began.
 *
 * `timing` holds numbers and lists, never a `false`: a verdict's false
 * values are its failing claims (on-github.mjs's `falseClaims`).
 */
export function stampVerdicts(repoRoot, paths, timing) {
  const stamped = [];
  for (const path of paths) {
    const file = join(repoRoot, path);
    let verdict;
    try {
      verdict = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    if (verdict === null || typeof verdict !== "object" || Array.isArray(verdict)) continue;
    const { timing: _was, ...rest } = verdict;
    writeFileSync(file, `${JSON.stringify({ ...rest, timing }, null, 2)}\n`);
    stamped.push(path);
  }
  return stamped;
}
