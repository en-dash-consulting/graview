#!/usr/bin/env node
/**
 * THE HARNESSES, ON GITHUB'S MACHINES, FROM HERE.
 *
 *   pnpm verify:github one-face pages            these, on the current branch
 *   pnpm verify:github                           the whole chain (as Nightly runs it)
 *   pnpm verify:github one-face --quick          fewer widths, schemes and seats
 *   pnpm verify:github one-face --ref <branch>   on a branch that is not checked out
 *   pnpm verify:github one-face --slow 4         every page's CPU throttled, as GRAVIEW_SLOW
 *   pnpm verify:github renderer --renderer gpu   in the pinned Google Chrome, on the GPU path
 *   pnpm verify:github --shards 4                at most four runners
 *
 * Dispatches `.github/workflows/verify.yml` on the branch (pushed: the run
 * checks out what GitHub has, not this checkout), finds the run by a token
 * put in its name, waits for it, downloads each shard's verdicts into
 * docs/ — every docs/<name>.json, docs/watch/*.json and shot the run wrote,
 * but not the shard's own last-run, ledger and flakes, which would
 * overwrite this checkout's — and prints each harness's verdict with every
 * claim that failed, by name. Exits 1 when any harness failed or the run
 * did not succeed, 2 when it could not be started.
 *
 * The laptop stays free: it runs `gh`, and waits.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allHeld, askedHarnesses, SHARD_OWN, terminalLines } from "./lib/on-github.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW = "verify.yml";
const say = (text) => process.stdout.write(`${text}\n`);
const stop = (text, code = 2) => {
  process.stderr.write(`${text}\n`);
  process.exit(code);
};
const sh = (command, args, options = {}) => execFileSync(command, args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
const gh = (...args) => sh("gh", args);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// The arguments: names, and the flags that take a value.
const args = process.argv.slice(2);
const valueOf = (flag) => {
  const at = args.indexOf(flag);
  if (at === -1) return undefined;
  const value = args[at + 1];
  if (value === undefined || value.startsWith("--")) stop(`${flag} takes a value`);
  args.splice(at, 2);
  return value;
};
const ref = valueOf("--ref");
const slow = valueOf("--slow");
const renderer = valueOf("--renderer") ?? "dom";
const shards = valueOf("--shards");
const minutes = Number(valueOf("--minutes") ?? 180);
const quick = args.includes("--quick");
const unknownFlags = args.filter((arg) => arg.startsWith("-") && arg !== "--quick");
if (unknownFlags.length > 0) stop(`Not a flag verify:github takes: ${unknownFlags.join(", ")}`);
if (slow !== undefined && !/^\d+(\.\d+)?$/.test(slow)) stop(`--slow takes a number, not ${slow}`);
if (!["dom", "gpu"].includes(renderer)) stop(`--renderer is dom or gpu, not ${renderer}`);
if (shards !== undefined && !/^\d+$/.test(shards)) stop(`--shards takes a whole number, not ${shards}`);

const chain = sh("node", [resolve(repoRoot, "scripts/verify-all.mjs"), "--list"]).split("\n").filter(Boolean);
let names;
try {
  names = askedHarnesses(args.filter((arg) => !arg.startsWith("-")).join(" "), chain);
} catch (error) {
  stop(error.message);
}
const named = args.some((arg) => !arg.startsWith("-"));

try {
  gh("auth", "status");
} catch {
  stop("gh is not signed in: gh auth login");
}

/*
 * WHAT GITHUB WILL CHECK OUT. The run checks out the branch as GitHub has
 * it, so a commit not pushed is a commit not verified: say so, rather than
 * report a verdict on code that is not this checkout's.
 */
const branch = ref ?? sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch === "HEAD") stop("This checkout is on no branch: check one out, or name it with --ref <branch>");
let remoteSha;
try {
  remoteSha = sh("git", ["ls-remote", "--exit-code", "origin", `refs/heads/${branch}`]).split(/\s+/)[0];
} catch {
  stop(`origin has no branch ${branch}: push it first (git push -u origin ${branch})`);
}
if (!ref) {
  const local = sh("git", ["rev-parse", "HEAD"]);
  if (local !== remoteSha) stop(`${branch} here is ${local.slice(0, 8)} and origin has ${remoteSha.slice(0, 8)}: push it first (git push origin ${branch}), so the run verifies this checkout's commit`);
  if (sh("git", ["status", "--porcelain", "--untracked-files=no"]) !== "") say(`note  this checkout has changes not committed; the run verifies ${remoteSha.slice(0, 8)} as pushed, without them`);
}

const request = randomBytes(4).toString("hex");
const fields = ["-f", `harnesses=${named ? names.join(" ") : ""}`, "-f", `quick=${quick}`, "-f", `renderer=${renderer}`, "-f", `request=${request}`];
if (slow !== undefined) fields.push("-f", `slow=${slow}`);
if (shards !== undefined) fields.push("-f", `shards=${shards}`);
try {
  gh("workflow", "run", WORKFLOW, "--ref", branch, ...fields);
} catch (error) {
  stop(`gh workflow run ${WORKFLOW} failed: ${(error.stderr || error.message).trim()}`);
}
say(`asked  ${named ? names.join(", ") : `the whole chain (${names.length} harnesses)`}${quick ? ", quick" : ""} on ${branch} at ${remoteSha.slice(0, 8)} [${request}]`);

// THE RUN, found by the token in its name: a dispatch answers with nothing to find it by.
let run;
for (let tries = 0; tries < 40 && !run; tries += 1) {
  await wait(3000);
  const listed = JSON.parse(gh("run", "list", "--workflow", WORKFLOW, "--branch", branch, "--event", "workflow_dispatch", "--limit", "30", "--json", "databaseId,displayTitle,url,headSha"));
  run = listed.find((one) => one.displayTitle.includes(`[${request}]`));
}
if (!run) stop(`The run dispatched as [${request}] did not appear in two minutes: gh run list --workflow ${WORKFLOW} --branch ${branch}`);
say(`run    ${run.url}`);

// WAITING, saying each job as it ends.
const deadline = Date.now() + minutes * 60_000;
const told = new Set();
let view;
for (;;) {
  try {
    view = JSON.parse(gh("run", "view", String(run.databaseId), "--json", "status,conclusion,jobs,headSha"));
  } catch {
    await wait(15_000);
    continue;
  }
  for (const job of view.jobs ?? []) {
    if (job.status === "completed" && !told.has(job.databaseId)) {
      told.add(job.databaseId);
      say(`${job.conclusion === "success" ? "done " : job.conclusion === "skipped" ? "skip " : "ended"}  ${job.name}: ${job.conclusion}`);
    }
  }
  if (view.status === "completed") break;
  if (Date.now() > deadline) stop(`Still running after ${minutes} minutes: ${run.url} (--minutes to wait longer)`, 1);
  await wait(30_000);
}

// THE VERDICTS, into docs/, each shard's summary read.
const into = mkdtempSync(join(tmpdir(), "graview-verify-on-github-"));
const harnesses = [];
try {
  try {
    gh("run", "download", String(run.databaseId), "--pattern", "verdicts-*", "--dir", into);
  } catch (error) {
    say(`note  no verdicts to download: ${(error.stderr || error.message).trim().split("\n")[0]}`);
  }
  const brought = [];
  for (const artifact of existsSync(into) ? readdirSync(into) : []) {
    const root = join(into, artifact);
    const summaryFile = join(root, "verify-summary.json");
    if (existsSync(summaryFile)) harnesses.push(...JSON.parse(readFileSync(summaryFile, "utf8")).harnesses);
    const walk = (at) => {
      for (const name of readdirSync(at)) {
        const path = join(at, name);
        if (statSync(path).isDirectory()) walk(path);
        else {
          const rel = relative(root, path);
          if (!rel.startsWith("docs/") || SHARD_OWN.includes(rel)) continue;
          mkdirSync(dirname(join(repoRoot, rel)), { recursive: true });
          cpSync(path, join(repoRoot, rel));
          brought.push(rel);
        }
      }
    };
    walk(root);
  }
  say(`\nbrought ${brought.length} file${brought.length === 1 ? "" : "s"} into docs/ from ${view.headSha?.slice(0, 8) ?? run.headSha.slice(0, 8)}\n`);
} finally {
  rmSync(into, { recursive: true, force: true });
}

// A harness asked for and in no shard's summary did not run: that is not a hold.
for (const name of names) if (!harnesses.some((one) => one.name === name)) harnesses.push({ name, verdict: "no verdict", took: null, claims: ["no shard said anything of it: read the run"], files: [] });
const ordered = names.map((name) => harnesses.find((one) => one.name === name));
for (const line of terminalLines(ordered)) say(line);
const held = allHeld(ordered) && view.conclusion === "success";
const broken = ordered.filter((one) => one.verdict !== "held" && one.verdict !== "flaky").length;
say(`\n${ordered.length - broken} of ${ordered.length} harnesses hold; the run ${view.conclusion}: ${run.url}`);
process.exit(held ? 0 : 1);
