#!/usr/bin/env node
/**
 * WHAT NO SHARD COULD JUDGE (verify.yml, after the shards).
 *
 * A harness run in parts on several runners (lib/parts.mjs) has no runner
 * that sees the whole of it: a claim no part made is false only once every
 * part's verdict is read together. Given the directory the shards' verdicts
 * were downloaded into, this merges the harnesses whose every part is there
 * and held, and fails by name on what the whole says and no part did. A
 * part that failed has already failed its own shard.
 *
 *   node scripts/verify-whole.mjs <dir of verdicts-*>
 */
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { missedByTheWhole, partPath, PARTS, splitUnit, writeMerged } from "./lib/parts.mjs";

const from = resolve(process.argv[2] ?? "verdicts");
const shards = existsSync(from) ? readdirSync(from).map((name) => join(from, name)) : [];
const root = mkdtempSync(join(tmpdir(), "graview-verify-whole-"));
mkdirSync(join(root, "docs"));
const said = shards.map((dir) => join(dir, "verify-summary.json")).filter(existsSync).flatMap((path) => JSON.parse(readFileSync(path, "utf8")).harnesses);
let broken = 0;
for (const [name, { verdict, parts }] of Object.entries(PARTS)) {
  for (const { part } of parts) {
    const found = shards.map((dir) => join(dir, partPath(verdict, part))).find(existsSync);
    if (found) copyFileSync(found, join(root, partPath(verdict, part)));
  }
  if (said.some((one) => splitUnit(one.name).name === name && one.verdict !== "held" && one.verdict !== "flaky")) continue;
  if (!writeMerged(root, name)) continue;
  const missed = missedByTheWhole(root, name);
  process.stdout.write(`${missed.length === 0 ? "ok  " : "FAIL"} ${name}, made of its ${parts.length} parts${missed.length > 0 ? `: ${missed.join(", ")}` : ""}\n`);
  if (missed.length === 0) continue;
  broken += 1;
  process.stdout.write(`::error title=${name} failed::${missed.join("; ")}\n`);
}
process.exit(broken > 0 ? 1 : 0);
