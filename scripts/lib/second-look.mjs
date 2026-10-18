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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** The claims a harness printed as false: `"name": false` lines, and `FAIL name` lines from a nested chain. */
export const missedClaims = (output) => {
  const claims = new Set();
  for (const line of output.split("\n")) {
    const said = /^\s*"([A-Za-z][\w-]*)":\s*false,?\s*$/.exec(line);
    if (said && said[1] !== "ok" && said[1] !== "passed") claims.add(said[1]);
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
