/**
 * A SECOND LOOK, ALONE.
 *
 * Six hundred fixed waits in the harnesses read a state a moment after
 * causing it, and on a starved runner the moment sometimes comes first:
 * three Nightlies in a row on 0.1.34's merge went red on one timing claim
 * each (navigation's mark at 900 ms, studio's scheme at 300 ms, who's
 * presence), each a different claim, each holding on the next run — and
 * each held a release. A harness that fails is run once more on its own;
 * failing twice is a failure, and holding the second time is a flake,
 * written down by name with the claims it missed so it is fixed rather
 * than forgotten. `--strict` (or GRAVIEW_STRICT=1) takes one look only.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ownedBy, writtenSince } from "./on-github.mjs";
import { splitUnit } from "./parts.mjs";

/** The claims a harness printed as false: `"name": false` lines, and `FAIL name` lines from a nested chain. */
export const missedClaims = (output) => {
  const claims = new Set();
  for (const line of output.split("\n")) {
    const said = /^\s*"([A-Za-z][\w-]*)":\s*false,?\s*$/.exec(line);
    if (said && said[1] !== "ok" && said[1] !== "passed") claims.add(said[1]);
    // `FAIL name`, as a harness that says each claim on a line of its own prints it (one-face, embed-one-face).
    const failed = /^FAIL\s+([A-Za-z][\w-]*)\s*$/.exec(line);
    if (failed) claims.add(failed[1]);
  }
  return [...claims];
};

/**
 * What the run makes of a harness it looked at twice: `held` and `failed`
 * from the first look stand; one that failed and then held is `flaky`.
 */
export const judge = (first, again) => {
  if (first.code === 0) return { ...first, verdict: "held" };
  if (!again) return { ...first, verdict: "failed" };
  if (again.code !== 0) return { ...again, verdict: "failed", missed: missedClaims(first.output) };
  return { ...again, verdict: "flaky", missed: missedClaims(first.output) };
};

/*
 * THE FIRST LOOK, KEPT BESIDE THE SECOND. A harness writes its verdict and
 * its frames to the same paths each time it runs, so the second look wrote
 * over the first: a run whose first look failed and whose second held kept
 * only the look that held, and the frames of the failure were gone
 * (one-face's pinch on 2a116268c). Before the second look, what the first
 * wrote of its own (docs/<name>.json, docs/<name>/…, and its (`ownedBy`, on-github.mjs)
 * watch) is copied under docs/first-look/ at the same paths, and an earlier
 * run's copy of that harness is cleared first.
 */
export const FIRST_LOOK = "docs/first-look";

/** The first look's own files copied under docs/first-look/, by path; `first` is runOne's answer (`file`, `began`). */
export const keepFirstLook = (repoRoot, first) => {
  const base = first.file.replace(/^verify-/, "").replace(/\.mjs$/, "");
  // A part keeps and clears its own files alone (lib/parts.mjs): another part of the harness may have failed beside it.
  const { part } = splitUnit(first.name ?? "");
  const own = (path) => ownedBy(base, path) && (!part || !path.includes(".part-") || path.includes(`.part-${part}.`));
  const copyOf = (path) => resolve(repoRoot, FIRST_LOOK, path.slice("docs/".length));
  // An earlier run's first look of this harness is not this run's.
  const earlier = writtenSince(repoRoot, 0, FIRST_LOOK).map((file) => `docs/${file.path.slice(FIRST_LOOK.length + 1)}`);
  for (const path of earlier.filter(own)) rmSync(copyOf(path), { force: true });
  const kept = writtenSince(repoRoot, Date.parse(first.began))
    .map((file) => file.path)
    .filter((path) => !path.startsWith(`${FIRST_LOOK}/`) && own(path));
  for (const path of kept) {
    mkdirSync(dirname(copyOf(path)), { recursive: true });
    copyFileSync(resolve(repoRoot, path), copyOf(path));
  }
  return kept.map((path) => `${FIRST_LOOK}/${path.slice("docs/".length)}`);
};

/** Kept across runs, newest first, a hundred at most: what flaked, where, and which claims. */
export const recordFlakes = (repoRoot, flakes, { sha = process.env.GITHUB_SHA ?? "", renderer = process.env.GRAVIEW_RENDERER ?? "" } = {}) => {
  if (flakes.length === 0) return [];
  const file = resolve(repoRoot, "docs/flakes.json");
  const kept = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  const at = new Date().toISOString();
  const fresh = flakes.map((one) => ({ harness: one.name, missed: one.missed ?? [], at, ...(sha ? { sha: sha.slice(0, 8) } : {}), ...(renderer ? { renderer } : {}) }));
  writeFileSync(file, `${JSON.stringify([...fresh, ...kept].slice(0, 100), null, 2)}\n`);
  return fresh;
};

/**
 * What a check that answers `{ ok, … }` (an engine matrix's cell) missed:
 * the screens or shots it names as errors, its own `false` claims, or its
 * error said once.
 */
export const missedOf = (result) => {
  const claims = Object.entries(result)
    .filter(([key, value]) => value === false && key !== "ok" && key !== "passed")
    .map(([key]) => key);
  const missed = [...(Array.isArray(result.errors) ? result.errors.map(String) : []), ...claims];
  return missed.length > 0 ? missed : typeof result.error === "string" ? [result.error.slice(0, 200)] : [];
};

/**
 * The same second look for a check that answers `{ ok, … }` rather than an
 * exit code: one that fails is looked at again alone (`look(2)`), and the
 * answer carries its `verdict` — `held`, `failed`, or `flaky` when it held
 * the second time, with the first look kept (`firstLook`) and what it
 * `missed`. Failing twice is `failed`, and `ok` stays false.
 */
export const lookTwice = async (look, { strict = false } = {}) => {
  const first = await look(1);
  if (first.ok) return { ...first, verdict: "held" };
  if (strict) return { ...first, verdict: "failed" };
  const again = await look(2);
  return { ...again, verdict: again.ok ? "flaky" : "failed", missed: missedOf(first), firstLook: first };
};
