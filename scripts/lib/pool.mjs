/**
 * THE CHAIN'S WORKERS: how many, on which ports, and in what order they
 * take the harnesses.
 *
 * Three harnesses at a time shared one block of ports and four dev
 * servers, and thirteen that time something ran after them one at a time:
 * an hour and a half on the 0.1.74 batch, an hour of it in the line of
 * thirteen. Now each worker has a block of a hundred ports of its own
 * (GRAVIEW_PORT_BASE, lib/ports.mjs), so its harnesses drive its own
 * servers, which it starts once and keeps for the run; the workers are as
 * many as the machine has room for; the harnesses that time something run
 * beside the others but never beside each other; and the longest go first.
 */
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { listeners } from "./serve.mjs";
import { PORT_FLOOR, PORT_SPAN } from "./ports.mjs";

/**
 * A worker a core, up to sixteen. A harness spends most of its time waiting
 * on its page: twelve workers on a twelve-core laptop kept 3.6 cores busy on
 * average (9,208 s of CPU in a 43-minute run), 44% of all harness time in
 * fixed waits. Eighteen there loaded the machine past seventy and every
 * harness ran slower, journeys and create twice as slow. GRAVIEW_VERIFY_JOBS
 * says otherwise.
 */
export function defaultJobs({ cores = cpus().length, env = process.env } = {}) {
  const said = Number(env["GRAVIEW_VERIFY_JOBS"]);
  if (Number.isInteger(said) && said > 0) return said;
  return Math.max(1, Math.min(16, cores));
}

/*
 * THE BLOCKS A POOL'S OTHER WORKERS TAKE. The first worker keeps the run's
 * own block (GRAVIEW_PORT_BASE, or the one the ports are written in). The rest take hundreds from
 * 6000, above the 5600–5999 a machine's build slots use (slot N is
 * 5600 + 100 N, .ndx/rex/workflow.md), each one free of any listener and
 * locked for the run, so two chains on one machine never take the same
 * one. GRAVIEW_POOL_BASES names others (`6000,6100`).
 */
export const POOL_BASES = Array.from({ length: 30 }, (_, step) => 6000 + step * 100);
const LOCKS = join(tmpdir(), "graview-port-blocks");

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
};

/** Takes the lock on block `base` for this process, or says it cannot. A lock whose process is gone is taken over. */
export function lockBlock(base, { dir = LOCKS, pid = process.pid } = {}) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${base}.lock`);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(path, "wx");
      writeSync(fd, String(pid));
      closeSync(fd);
      return () => {
        try {
          if (readFileSync(path, "utf8").trim() === String(pid)) rmSync(path, { force: true });
        } catch {
          // Already gone.
        }
      };
    } catch {
      let holder = 0;
      try {
        holder = Number(readFileSync(path, "utf8").trim());
      } catch {
        // Gone between the two calls: try again.
      }
      if (holder && alive(holder)) return null;
      rmSync(path, { force: true });
    }
  }
  return null;
}

/**
 * The blocks for `count` workers: the run's own first, then free, locked
 * hundreds. Fewer than asked when the machine has fewer free: the pool is
 * then that much smaller, and says so.
 *
 * @returns {{ bases: (number | null)[], release: () => void }} `null` is the run's own block, unmoved
 */
export function claimBlocks(count, { own = process.env["GRAVIEW_PORT_BASE"] ? Number(process.env["GRAVIEW_PORT_BASE"]) : null, candidates = poolBases(), busy = (base) => (listeners(base, base + PORT_SPAN - 1)?.size ?? 0) > 0, dir = LOCKS } = {}) {
  const bases = [own];
  const releases = [];
  for (const base of candidates) {
    if (bases.length >= count) break;
    const overlaps = (start) => base < start + PORT_SPAN && base + PORT_SPAN > start;
    if (overlaps(own ?? PORT_FLOOR) || overlaps(PORT_FLOOR)) continue;
    const release = lockBlock(base, { dir });
    if (!release) continue;
    if (busy(base)) {
      release();
      continue;
    }
    releases.push(release);
    bases.push(base);
  }
  return { bases, release: () => releases.forEach((one) => one()) };
}

function poolBases(env = process.env) {
  const said = String(env["GRAVIEW_POOL_BASES"] ?? "")
    .split(/[\s,]+/)
    .map(Number)
    .filter((base) => Number.isInteger(base) && base >= 1024);
  return said.length > 0 ? said : POOL_BASES;
}

/**
 * The order the harnesses are taken in: longest first, by what each took
 * the last time it ran (`took`, last-run.json), or `guess` for one never
 * timed, so the long ones are not what is left at the end.
 */
export function longestFirst(names, { took = new Map(), guess = () => 60 } = {}) {
  const seconds = (name) => took.get(name) ?? guess(name);
  return [...names].sort((a, b) => seconds(b) - seconds(a) || names.indexOf(a) - names.indexOf(b));
}

/**
 * The next harness a free worker takes: the first in `queue` it may run now.
 * A harness that times something (`timing`) waits while another one runs;
 * everything else runs beside anything.
 */
export function nextFor(queue, { timing, timingRunning }) {
  const at = queue.findIndex((name) => !(timing.has(name) && timingRunning));
  return at === -1 ? null : queue.splice(at, 1)[0];
}

/**
 * The pool, run: `jobs` workers, each taking the next harness it may run
 * and calling `run(name, worker)`; a worker with nothing it may run waits
 * for another to finish. Resolves with every result, in the order they ended.
 */
export async function runPool(names, { jobs, timing = new Set(), run }) {
  const queue = [...names];
  const results = [];
  let timingRunning = false;
  let wake = () => {};
  const changed = () => {
    const was = wake;
    wake = () => {};
    was();
  };
  const worker = async (index) => {
    while (queue.length > 0) {
      const name = nextFor(queue, { timing, timingRunning });
      if (name === null) {
        await new Promise((resolve) => {
          const before = wake;
          wake = () => {
            before();
            resolve(undefined);
          };
        });
        continue;
      }
      const times = timing.has(name);
      if (times) timingRunning = true;
      try {
        results.push(await run(name, index));
      } finally {
        if (times) timingRunning = false;
        changed();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, names.length)) }, (_, index) => worker(index)));
  return results;
}
