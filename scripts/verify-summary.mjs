#!/usr/bin/env node
/**
 * WHAT A SHARD OF A RUN ON GITHUB FOUND (verify.yml, after the harnesses).
 *
 * Every file under docs/ the shard wrote since VERIFY_SINCE (the moment
 * before its harnesses began, in epoch milliseconds) is copied into the
 * directory named first, at the same paths, with `verify-summary.json`
 * beside them: each harness's verdict, how long it took, the files it wrote
 * and every claim that failed, by name. The same is written to the job's
 * summary. `pnpm verify:github` downloads that directory and reads it.
 *
 *   VERIFY_SINCE=… VERIFY_NAMES="one-face pages" node scripts/verify-summary.mjs <out-dir> [label]
 *
 * It never fails the job: the harness step already says whether it held.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyInto, summarizeShard, summaryMarkdown, writtenSince } from "./lib/on-github.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(process.argv[2] ?? "verdicts");
const label = process.argv[3] ?? process.env.VERIFY_NAMES ?? "the harnesses";
const since = Number(process.env.VERIFY_SINCE ?? 0);
const asked = (process.env.VERIFY_NAMES ?? "").split(/\s+/).filter(Boolean);

const lastRunFile = resolve(repoRoot, "docs/watch/last-run.json");
const lastRun = existsSync(lastRunFile) ? JSON.parse(readFileSync(lastRunFile, "utf8")) : null;
const written = writtenSince(repoRoot, since);
const { harnesses } = summarizeShard({ root: repoRoot, since, asked, lastRun, written });

mkdirSync(out, { recursive: true });
copyInto(repoRoot, written.map((file) => file.path), out);
const summary = { label, sha: process.env.GITHUB_SHA ?? null, harnesses };
writeFileSync(join(out, "verify-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

const markdown = summaryMarkdown(summary);
process.stdout.write(markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
for (const one of harnesses.filter((harness) => harness.verdict !== "held" && harness.verdict !== "flaky")) {
  process.stdout.write(`::error title=${one.name} failed::${one.claims.join("; ").replace(/\r?\n/g, " ").slice(0, 900)}\n`);
}
