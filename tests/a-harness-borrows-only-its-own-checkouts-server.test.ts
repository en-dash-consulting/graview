import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error — a plain module of the harness, with no types of its own.
import { holders, serving, vacant } from "../scripts/lib/serve.mjs";

/**
 * A HARNESS BORROWS ONLY THIS CHECKOUT'S SERVER. `pnpm verify` found
 * another project's vite on todo's port and another project's `graview
 * preview` on the gauntlet's, said "the harnesses will drive those", and
 * twenty-nine harnesses failed against the wrong app: the old guard asked
 * for `/@fs/…/apps/todo/index.html`, which a server that answers every
 * path with its own page answers too. A server that answers every path is
 * what these stand-ins are; only the directory it runs in says whose it is.
 */
const repoRoot = resolve(__dirname, "..");
const hasLsof = (() => {
  try {
    execFileSync("lsof", ["-v"], { stdio: "ignore" });
    return true;
  } catch (error) {
    // `lsof -v` exits non-zero on some systems while still being there.
    return (error as { code?: string }).code !== "ENOENT";
  }
})();

/** A server that answers every path with 200 and a page, run in `cwd`, on a port the system picks. */
const anyPathServer = (cwd: string) =>
  new Promise<{ child: ChildProcess; port: number }>((ready, fail) => {
    const child = spawn(
      process.execPath,
      ["-e", `const s = require("node:http").createServer((q, r) => r.end("<!doctype html><title>someone else's</title>")); s.listen(0, "127.0.0.1", () => console.log(s.address().port));`],
      { cwd, stdio: ["ignore", "pipe", "inherit"] },
    );
    child.stdout!.once("data", (chunk) => ready({ child, port: Number(String(chunk).trim()) }));
    child.once("error", fail);
  });

describe("a server already on a harness's port", () => {
  let elsewhere: string;
  let foreign: { child: ChildProcess; port: number };
  let ours: { child: ChildProcess; port: number };
  beforeAll(async () => {
    elsewhere = mkdtempSync(join(tmpdir(), "another-project-"));
    foreign = await anyPathServer(elsewhere);
    ours = await anyPathServer(resolve(repoRoot, "apps/todo"));
  });
  afterAll(() => {
    foreign.child.kill();
    ours.child.kill();
    rmSync(elsewhere, { recursive: true, force: true });
  });

  it("answers the old guard's question, so asking it by path never said whose it was", async () => {
    const asked = await fetch(`http://localhost:${foreign.port}/@fs${resolve(repoRoot, "apps/todo/index.html")}`);
    expect(asked.ok).toBe(true);
  });

  it("is not borrowed when it runs in another directory, and the refusal names it and the remedy", async () => {
    await expect(serving("todo", foreign.port, repoRoot)).rejects.toThrow(
      new RegExp(`port ${foreign.port} is held by pid ${foreign.child.pid} .* not this checkout's apps/todo; run with GRAVIEW_PORT_BASE=5600`),
    );
  });

  it.skipIf(!hasLsof)("is borrowed, and left running, when it is this checkout's server for that app", async () => {
    const borrowed = await serving("todo", ours.port, repoRoot);
    expect(borrowed).toMatchObject({ url: `http://localhost:${ours.port}`, borrowed: true });
    borrowed.stop();
    expect(ours.child.exitCode).toBeNull();
  });

  it("is never another app's, even in this checkout", async () => {
    await expect(serving("seedbed", ours.port, repoRoot)).rejects.toThrow(/not this checkout's apps\/seedbed/);
  });

  it("keeps a harness's own host page from listening beside it", async () => {
    await expect(vacant(foreign.port)).rejects.toThrow(new RegExp(`port ${foreign.port} is already held by pid ${foreign.child.pid}`));
  });

  it.skipIf(!hasLsof)("is told apart from this checkout's when the chain looks over every port first", async () => {
    const found = await holders([
      { name: "todo", port: foreign.port, app: resolve(repoRoot, "apps/todo") },
      { name: "todo", port: ours.port, app: resolve(repoRoot, "apps/todo") },
      { name: "brand-host", port: ours.port, app: null },
    ]);
    expect(found.map((one: { port: number; ours: boolean; holder: { cwd: string } | null }) => [one.port === foreign.port ? "foreign" : "ours", one.ours])).toEqual(
      expect.arrayContaining([
        ["foreign", false],
        ["ours", true],
        // A harness's own port is nobody's to borrow: anything on it is in the way.
        ["ours", false],
      ]),
    );
    expect(found.find((one: { port: number }) => one.port === foreign.port).holder.cwd).toContain("another-project-");
  });
});
