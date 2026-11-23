/**
 * THE HARNESSES A BRANCH'S CHANGE CAN REACH (`pnpm verify --changed`, and
 * `pnpm verify` with no names on a branch).
 *
 * The files the branch changed since it left main, against what each
 * harness read the last time it ran (docs/watch/coverage.json, coverage.mjs):
 *
 *   - a file some harness read runs those harnesses;
 *   - a file that a file main changed since a harness's coverage was taken
 *     now names (imports) runs that harness when it read the importer: the
 *     coverage may be stale there;
 *   - a file the branch adds runs every harness that read a file beside it
 *     (in its directory), since a listing finds it as well as an import;
 *   - a file nothing read, and nothing changed since names, is no
 *     harness's: a module no page and no process loaded cannot change what a
 *     harness sees;
 *   - a change to what every harness stands on (the lockfile, a package's
 *     manifest and so its exports, the root's config) runs every harness;
 *   - a harness with no coverage yet always runs;
 *
 * and, whatever changed, a cheap SMOKE set (the watch made to fire on a
 * page of its own, the hosted page's budget, one app driven end to end),
 * so a branch that reaches nothing still proves the chain runs.
 *
 * Nightly runs every harness by name and is untouched by any of this.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { byHarness, readCoverage } from "./coverage.mjs";

/** Run on every change-aware run: a few seconds each, and between them the runner, the watch and a dev server. */
export const SMOKE = ["hosted", "device", "seat"];

/** What every harness stands on: changed, the whole chain runs. */
export const EVERYTHING = [
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^package\.json$/,
  /^\.npmrc$/,
  /^tsconfig[^/]*\.json$/,
  /^(packages|apps)\/[^/]+\/package\.json$/,
  /^(packages|apps)\/[^/]+\/tsconfig[^/]*\.json$/,
  /^\.github\/workflows\/(verify|nightly)\.yml$/,
];

/** The chain's own machinery: reaches how harnesses are run, not what they claim; the smoke set holds it. */
export const RUNNER = [/^scripts\/verify-all\.mjs$/, /^scripts\/lib\/(changed|coverage|coverage-hook|pool|timing|second-look|ledger|on-github)\.mjs$/, /^scripts\/verify-(shards|summary|on-github)\.mjs$/];

const git = (args, cwd) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

/** The branch checked out, or null when detached. */
export const currentBranch = (cwd) => {
  const name = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  return name && name !== "HEAD" ? name : null;
};

/** Where the branch left main: the merge base with origin/main, or main. */
export function forkPoint(cwd, base = null) {
  for (const ref of base ? [base] : ["origin/main", "main"]) {
    const at = git(["merge-base", "HEAD", ref], cwd);
    if (at) return at;
  }
  return null;
}

/**
 * The files changed since `from`: committed, staged, unstaged and untracked,
 * each with whether the branch added it.
 *
 * @returns {{ path: string, added: boolean }[]}
 */
export function changedFiles(cwd, from) {
  const changed = new Map();
  const status = git(["diff", "--name-status", "--no-renames", from], cwd) ?? "";
  for (const line of status.split("\n").filter(Boolean)) {
    const [code, path] = line.split("\t");
    changed.set(path, { path, added: code === "A" });
  }
  for (const path of (git(["ls-files", "--others", "--exclude-standard"], cwd) ?? "").split("\n").filter(Boolean)) {
    if (!changed.has(path)) changed.set(path, { path, added: true });
  }
  return [...changed.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** The package or app a path lies in (`packages/core/`), or `scripts/` for the harnesses' own code and fixtures, or null. */
const homeOf = (path) => /^((?:packages|apps)\/[^/]+\/)/.exec(path)?.[1] ?? (path.startsWith("scripts/") ? "scripts/" : null);
const dirOf = (path) => path.slice(0, path.lastIndexOf("/") + 1);
const stemOf = (path) => path.slice(path.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The harnesses to run for `changes`, and why each one.
 *
 * @param {{ path: string, added: boolean }[]} changes
 * @param {{ chain: string[], kept?: ReturnType<typeof readCoverage>, movedSince?: (sha: string) => string[] | null, mentions?: (file: string, stem: string) => boolean, smoke?: string[] }} options
 *   `chain`: every harness, in order. `movedSince(sha)`: the files main changed between that commit and the fork point, or null when that cannot be said.
 *   `mentions(file, stem)`: whether that file, as it is now, names a module by that stem (an import of it).
 * @returns {{ names: string[], why: Map<string, string[]>, everything: string | null, unreached: string[] }}
 */
export function selectHarnesses(changes, { chain, kept = readCoverage(), movedSince = () => [], mentions = () => false, smoke = SMOKE }) {
  const why = new Map();
  const because = (name, reason) => {
    if (!chain.includes(name)) return;
    if (!why.has(name)) why.set(name, []);
    if (why.get(name).length < 3) why.get(name).push(reason);
  };
  const files = byHarness(kept);
  const everything = changes.find((one) => EVERYTHING.some((pattern) => pattern.test(one.path)))?.path ?? null;
  if (everything) {
    for (const name of chain) because(name, `${everything} is what every harness stands on`);
    return { names: [...chain], why, everything, unreached: [] };
  }
  for (const name of smoke) because(name, "the smoke set");
  for (const name of chain) if (!files.has(name) || files.get(name).size === 0) because(name, "no coverage recorded for it yet");

  /** Each harness that read `file`, or, when nobody did, anything of its home (a whole package said for a bundle included). */
  const readersOf = (file) => {
    const said = (kept.files[file] ?? []).map((index) => kept.harnesses[index]?.name).filter(Boolean);
    if (said.length > 0) return said;
    // A test no harness runs reaches nobody; a module nobody read yet (main added it) stands for what of its home they read.
    if (/(^|\/)tests?\/|\.test\.[a-z]+$/.test(file)) return [];
    const home = homeOf(file);
    return home ? kept.harnesses.filter((one) => [...files.get(one.name)].some((read) => read.startsWith(home))).map((one) => one.name) : [];
  };
  /*
   * WHAT MAIN MOVED SINCE A HARNESS'S COVERAGE: a file main changed after it
   * was recorded may import a module it did not then, and a harness that
   * read that file reaches the module now. So for each file changed here,
   * every file main moved since a harness's record that names it (by its
   * stem) counts as read by whoever read that file, for the harnesses whose
   * record is that old. A commit this clone cannot compare with is as old as
   * can be: everything that names the file counts.
   */
  const moved = new Map();
  const movedFor = (sha) => {
    if (!moved.has(sha)) moved.set(sha, sha ? movedSince(sha) : null);
    return moved.get(sha);
  };
  const unreached = [];
  for (const { path, added } of changes) {
    if (RUNNER.some((pattern) => pattern.test(path))) continue;
    let reached = false;
    const readers = kept.files[path];
    if (readers?.length) {
      for (const index of readers) because(kept.harnesses[index]?.name, path);
      reached = true;
    }
    // A whole package said for a bundle nobody could map file by file.
    const home = homeOf(path);
    const wholes = home ? kept.files[home] : undefined;
    if (wholes?.length) {
      for (const index of wholes) because(kept.harnesses[index]?.name, `${path} (all of ${home})`);
      reached = true;
    }
    // A file this branch adds is reached through a file it changed, or by a listing of its directory: whoever read beside it.
    if (added) {
      const dir = dirOf(path);
      for (const one of kept.harnesses) if ([...files.get(one.name)].some((read) => dirOf(read) === dir)) {
        because(one.name, `${path} (new beside what it read)`);
        reached = true;
      }
    }
    const stem = stemOf(path);
    const importersBy = new Map();
    for (const one of kept.harnesses) {
      const since = movedFor(one.sha);
      if (!importersBy.has(one.sha)) importersBy.set(one.sha, (since ?? Object.keys(kept.files)).filter((file) => file !== path && mentions(file, stem)));
      const importers = importersBy.get(one.sha);
      for (const importer of importers) {
        if (!readersOf(importer).includes(one.name)) continue;
        because(one.name, `${path} (named by ${importer}${since === null ? "" : ", which main changed since its coverage"})`);
        reached = true;
      }
    }
    if (!reached) unreached.push(path);
  }
  return { names: chain.filter((name) => why.has(name)), why, everything: null, unreached };
}

/** Whether a file of the checkout, as it is now, names a module by `stem`: `from "./sort.js"`, `import("../sort")`. Read once each. */
export const mentionsIn = (cwd) => {
  const texts = new Map();
  return (file, stem) => {
    if (!/\.(m?[jt]sx?|cjs)$/.test(file)) return false;
    if (!texts.has(file)) {
      try {
        texts.set(file, readFileSync(resolve(cwd, file), "utf8"));
      } catch {
        texts.set(file, "");
      }
    }
    return new RegExp(`["'/]${escaped(stem)}(\\.[a-z]+)?["']`).test(texts.get(file));
  };
};

/** The files main changed between `sha` and `to`, for `selectHarnesses`'s `movedSince`. */
export const movedBetween = (cwd, to) => (sha) => {
  if (!sha || !to) return null;
  if (sha === to) return [];
  const said = git(["diff", "--name-only", sha, to], cwd);
  return said === null ? null : said.split("\n").filter(Boolean);
};

/** The commit checked out, for a coverage record. */
export const headSha = (cwd) => git(["rev-parse", "HEAD"], cwd);
