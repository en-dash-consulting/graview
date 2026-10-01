/**
 * THE LEDGER: one line per PROBLEM, kept across runs.
 *
 * The watch's first run reported forty-odd violations that were eight
 * problems: one tooltip naming `plannedAt` was found by three harnesses on
 * three screens, one seat act by two. Each run reported all of them again,
 * whether or not anything had changed, and nothing said which were new,
 * which were still there and which a change had fixed — so every run was
 * read from scratch, and the same problem cost the same attention twice.
 *
 * So a violation is reduced to its SIGNATURE — the rule and what it was
 * about, without the harness, the screen's address or a count in its text —
 * and the ledger (docs/watch/ledger.json) keeps one entry per signature:
 * where it was seen, when it was first and last seen, and whether this run
 * still sees it. A run says what is new, what is still open and what was
 * fixed since the run before, each problem once.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** What a violation is about, the same however many screens showed it. */
export const signatureOf = (violation) =>
  `${violation.rule}|${violation.detail
    // A count in the words ("Move 1 overdue") is the same control with other data.
    .replace(/\d+/g, "#")
    // Where it was drawn helps a person find it, not tell two problems apart.
    .replace(/ in \[data-testid="[^"]*"\]| in view "[^"]*"| \(it (was|is) [a-z ]+\)/g, "")}`;

/**
 * Reads every harness's watch report written since `since`, folds it into
 * the ledger, writes the ledger, and returns what changed.
 */
export function updateLedger(repoRoot, { since, ran }) {
  const dir = resolve(repoRoot, "docs/watch");
  const file = resolve(dir, "ledger.json");
  const before = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { problems: {} };
  const problems = { ...before.problems };
  const now = new Date().toISOString();
  const seen = new Map();
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    if (!name.endsWith(".json") || name === "ledger.json") continue;
    const report = JSON.parse(readFileSync(resolve(dir, name), "utf8"));
    if (!report.at || Date.parse(report.at) < since) continue;
    for (const violation of report.violations ?? []) {
      if (violation.acknowledged) continue;
      const signature = signatureOf(violation);
      const entry = seen.get(signature) ?? { rule: violation.rule, detail: violation.detail, harnesses: new Set(), at: violation.at };
      entry.harnesses.add(report.harness);
      seen.set(signature, entry);
    }
  }
  const fresh = [];
  const still = [];
  const flapping = [];
  for (const [signature, entry] of seen) {
    const was = problems[signature];
    const harnesses = [...entry.harnesses].sort();
    // Back after it was fixed: a flap, not a new problem — said apart, because it is about the check or the timing.
    if (was?.status === "fixed") flapping.push({ ...entry, harnesses });
    else if (!was) fresh.push({ ...entry, harnesses });
    else still.push({ ...entry, harnesses, since: was.firstSeen });
    problems[signature] = {
      rule: entry.rule,
      detail: entry.detail,
      at: entry.at,
      harnesses,
      firstSeen: was ? was.firstSeen : now,
      flaps: (was?.flaps ?? 0) + (was?.status === "fixed" ? 1 : 0),
      lastSeen: now,
      status: "open",
    };
  }
  /*
   * Fixed means a harness that saw it ran again and did not. A problem whose
   * harnesses were not in this run is neither: it stays as it was.
   */
  const fixed = [];
  for (const [signature, entry] of Object.entries(problems)) {
    if (entry.status !== "open" || seen.has(signature)) continue;
    const rerun = entry.harnesses.every((harness) => ran.has(harness));
    if (!rerun) continue;
    problems[signature] = { ...entry, status: "fixed", fixedAt: now };
    fixed.push(entry);
  }
  const open = Object.values(problems).filter((entry) => entry.status === "open");
  writeFileSync(file, `${JSON.stringify({ at: now, open: open.length, problems }, null, 2)}\n`);
  return { fresh, still, fixed, flapping, open };
}
