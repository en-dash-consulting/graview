#!/usr/bin/env node
/**
 * THE SHARDS OF A RUN ON GITHUB (verify.yml's `plan` job).
 *
 * Reads the harnesses asked for from VERIFY_HARNESSES (space-separated
 * names as `pnpm verify` takes them, or empty for the whole chain but what
 * a runner cannot run) and how many runners from VERIFY_SHARDS, and writes
 * the matrix to GITHUB_OUTPUT as `matrix`. A name the chain does not know
 * fails the run here, before any runner installs a browser.
 *
 *   VERIFY_HARNESSES="one-face pages" node scripts/verify-shards.mjs
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { askedHarnesses, planShards } from "./lib/on-github.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chain = execFileSync("node", [resolve(repoRoot, "scripts/verify-all.mjs"), "--list"], { cwd: repoRoot, encoding: "utf8" }).split("\n").filter(Boolean);

let names;
try {
  names = askedHarnesses(process.env.VERIFY_HARNESSES ?? "", chain);
} catch (error) {
  process.stdout.write(`::error title=No such harness::${error.message}\n`);
  process.exit(2);
}
const shards = Number.parseInt(process.env.VERIFY_SHARDS ?? "8", 10);
const plan = planShards(names, { shards: Number.isFinite(shards) && shards > 0 ? Math.min(shards, 20) : 8, order: chain });
const matrix = JSON.stringify({ include: plan.map(({ names, label }) => ({ names, label })) });
for (const shard of plan) process.stdout.write(`${shard.label}  (~${Math.round(shard.seconds / 60)} min)\n`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${matrix}\n`);
else process.stdout.write(`${matrix}\n`);
