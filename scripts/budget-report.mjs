#!/usr/bin/env node
/**
 * THE BYTE BUDGETS A PULL REQUEST IS OVER, SAID ONCE (ci.yml, after the
 * tests and the tarballs).
 *
 * With `GRAVIEW_BUDGET=warn` (a pull request into main that is not a
 * `batch/*` branch) a byte ceiling that is over is kept as a line in the
 * file `GRAVIEW_BUDGET_REPORT` names rather than failing
 * (`lib/budget-mode.mjs`). This reads that file and says each entry once:
 * an annotation, and a table in the job's summary. It never fails: what
 * must fail already has.
 *
 *   node scripts/budget-report.mjs <file>
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { annotation, keptOvers, oversMarkdown } from "./lib/budget-mode.mjs";

const file = process.argv[2] ?? process.env.GRAVIEW_BUDGET_REPORT;
const overs = file && existsSync(file) ? keptOvers(readFileSync(file, "utf8")) : [];
if (overs.length === 0) {
  process.stdout.write("No byte budget is over.\n");
  process.exit(0);
}
for (const one of overs) process.stdout.write(`${annotation(one)}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, oversMarkdown(overs));
