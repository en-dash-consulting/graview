/**
 * A BYTE BUDGET THAT IS OVER, ON A PULL REQUEST: A WARNING, RAISED ON THE BATCH.
 *
 * Every pull request wrote its own raise (`scripts/budget-raises/`) for the
 * bytes it added over main as it measured itself. Batched, the raises did
 * not sum to what the branches added together — two changes that each
 * pulled one module into a chunk paid for it once between them, a third
 * that moved it paid twice — so the 0.2.4 batch needed five raises more,
 * and #608, #612 and #614 each went red on a budget before anything else.
 *
 * So a pull request that is not a batch, into main, runs with
 * `GRAVIEW_BUDGET=warn` (ci.yml): a byte ceiling it is over is said — the
 * entry, the bytes over minified and gzipped — as a warning in the job's
 * summary and as an annotation, and does not fail. The raise is written
 * once, on the `batch/*` branch, for what the branches add together, and
 * there (and on main, in Nightly and in the release, where nothing sets
 * it) a byte ceiling fails as it always has.
 *
 * ONLY THE BYTES. What guards a mistake a pull request can fix itself
 * fails everywhere, whatever this says: a package a bundle must not carry
 * (`lacks`), one left in a lazy chunk that must load at once (`lazyLacks`),
 * the studio in a page's first load, a compiler or a rule parser up front,
 * zod over what it may carry, a chunk count. Those are claims about where
 * code is, not how much of it there is.
 */
import { appendFileSync } from "node:fs";

/** The modes `GRAVIEW_BUDGET` takes: unset is `fail`. */
export const BUDGET_MODES = ["fail", "warn"];

/** How a byte ceiling that is over is taken here: `fail` unless `GRAVIEW_BUDGET=warn`; anything else is refused, so a typo never turns a budget off. */
export function budgetMode(env = process.env) {
  const said = String(env.GRAVIEW_BUDGET ?? "").trim();
  if (said === "" || said === "fail") return "fail";
  if (said === "warn") return "warn";
  throw new Error(`GRAVIEW_BUDGET is "${said}": it is "warn" (a pull request's byte ceilings warn) or "fail", or unset to fail`);
}

/** How many bytes a measure is over its budget, minified and gzipped: 0 for a size within it, or one the budget does not hold. */
export function bytesOver({ minified, gzipped, budget }) {
  return {
    minified: budget.minified === undefined ? 0 : Math.max(0, Math.ceil(minified - budget.minified)),
    gzipped: budget.gzipped === undefined || gzipped === undefined ? 0 : Math.max(0, Math.ceil(gzipped - budget.gzipped)),
  };
}

const n = (bytes) => Math.round(bytes).toLocaleString("en-US");

/** A byte ceiling that is over, said in a sentence: the entry, what it is over by, what it measured against what it may. */
export function overSentence(measure, over = bytesOver(measure)) {
  const by = [over.minified > 0 ? `${n(over.minified)} B minified` : null, over.gzipped > 0 ? `${n(over.gzipped)} B gzipped` : null].filter(Boolean).join(" and ");
  const measured = measure.gzipped === undefined ? `${n(measure.minified)} B` : `${n(measure.minified)} / ${n(measure.gzipped)} B`;
  const may = measure.budget.gzipped === undefined ? `${n(measure.budget.minified)} B` : `${n(measure.budget.minified)} / ${n(measure.budget.gzipped)} B`;
  return `${measure.name} is ${by} over its budget: ${measured} against ${may}`;
}

/**
 * A byte ceiling held: an empty list when the measure is within it, or
 * when it is over and this run warns (the warning said and kept); the
 * sentence that fails it otherwise. Only ever a byte ceiling: a guard
 * against a mistake is held where it is measured, not here.
 */
export function holdBytes(measure, { env = process.env, warn = reportOver } = {}) {
  const over = bytesOver(measure);
  if (over.minified === 0 && over.gzipped === 0) return [];
  if (budgetMode(env) === "warn") {
    warn({ ...measure, over }, env);
    return [];
  }
  return [overSentence(measure, over)];
}

/**
 * A warning, where CI shows one: a line kept in `GRAVIEW_BUDGET_REPORT`
 * when it names a file, or an annotation on the step when it does not. The
 * tests run in workers whose output the runner may not read as
 * annotations, and two shards may measure one entry, so ci.yml keeps the
 * file and reads it after them (`scripts/budget-report.mjs`), saying each
 * over once, in the summary and as an annotation.
 */
export function reportOver(record, env = process.env) {
  const over = record.over ?? bytesOver(record);
  if (env.GRAVIEW_BUDGET_REPORT) {
    appendFileSync(env.GRAVIEW_BUDGET_REPORT, `${JSON.stringify({ name: record.name, minified: record.minified, gzipped: record.gzipped, budget: record.budget, over })}\n`);
  } else {
    process.stdout.write(`${annotation({ ...record, over })}\n`);
  }
}

/** One over as a GitHub annotation. */
export const annotation = (record) => `::warning title=Over a byte budget: ${record.name}::${overSentence(record, record.over)}. A pull request warns; the batch raises it (scripts/budget-raises/).`;

/** The kept warnings, one per entry (the largest over when it was measured twice). */
export function keptOvers(text) {
  const byName = new Map();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const one = JSON.parse(line);
    const was = byName.get(one.name);
    if (!was || one.over.minified + one.over.gzipped > was.over.minified + was.over.gzipped) byName.set(one.name, one);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The kept warnings as the job's summary shows them. */
export function oversMarkdown(overs) {
  if (overs.length === 0) return "";
  const lines = [
    "### Over a byte budget, as a warning",
    "",
    "A pull request that is not a batch warns; the `batch/*` branch writes the raise in `scripts/budget-raises/` for what the branches add together, and fails while it is over.",
    "",
    "| Entry | Over, minified | Over, gzipped | Measured | Budget |",
    "|---|---:|---:|---:|---:|",
  ];
  for (const one of overs) {
    const pair = (a, b) => (b === undefined ? n(a) : `${n(a)} / ${n(b)}`);
    lines.push(`| ${one.name} | ${n(one.over.minified)} | ${n(one.over.gzipped)} | ${pair(one.minified, one.gzipped)} | ${pair(one.budget.minified, one.budget.gzipped)} |`);
  }
  return `${lines.join("\n")}\n`;
}
