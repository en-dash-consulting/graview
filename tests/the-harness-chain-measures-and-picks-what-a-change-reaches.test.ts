import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error — plain modules of the harness, with no types of their own.
import { cpuOf, stampVerdicts, summarizeTiming, waitSite } from "../scripts/lib/timing.mjs";
// @ts-expect-error — as above.
import { byHarness, mergeCoverage, normalized, PREVIEW, withHook, withoutHook } from "../scripts/lib/coverage.mjs";
// @ts-expect-error — as above.
import { EVERYTHING, selectHarnesses, SMOKE } from "../scripts/lib/changed.mjs";
// @ts-expect-error — as above.
import { claimBlocks, defaultJobs, lockBlock, longestFirst, nextFor, runPool } from "../scripts/lib/pool.mjs";
// @ts-expect-error — as above.
import { falseClaims } from "../scripts/lib/on-github.mjs";
// @ts-expect-error — as above.
import { chooseSteps, mergeParts, partPath, PARTS, splitUnit, unitsOf } from "../scripts/lib/parts.mjs";
// @ts-expect-error — as above.
import { settled, until } from "../scripts/lib/settled.mjs";

/**
 * THE HARNESS CHAIN SAYS WHAT EACH HARNESS COST, RUNS SIDE BY SIDE ON PORTS
 * OF ITS OWN, AND ON A BRANCH RUNS WHAT THE CHANGE CAN REACH.
 *
 * `pnpm verify` was documented as ten minutes and ran an hour and a half on
 * the 0.1.74 batch, with nothing in its record to say where the time went.
 * These hold the parts that can be held without a browser: what a verdict
 * is told it cost, which harnesses a change reaches, and how the pool takes
 * its ports and its harnesses.
 */
const repo = resolve(__dirname, "..");

describe("what a harness cost", () => {
  it("is the CPU its processes spent, read from the shell's `times`", () => {
    expect(cpuOf("0m0.010s 0m0.004s\n2m3.500s 0m10.250s\n")).toEqual({ user: 123.5, system: 10.3, total: 133.8 });
    expect(cpuOf("")).toBeNull();
  });

  it("is each server it waited for, its set-up before the first browser, and its fixed waits", () => {
    const timing = summarizeTiming(
      [
        { kind: "server", name: "todo", port: 5703, ms: 2400, borrowed: false, pid: 1, sinceStart: 2500 },
        { kind: "server", name: "seedbed", port: 5704, ms: 3, borrowed: true, pid: 1, sinceStart: 2510 },
        { kind: "browser", engine: "chromium", ms: 600, pid: 1, sinceStart: 4000 },
        { kind: "browser", engine: "webkit", ms: 900, pid: 1, sinceStart: 60000 },
        { kind: "waited", ms: 12000, count: 40, pid: 1, sinceStart: 70000 },
      ],
      { harnessPid: 1 },
    );
    expect(timing).toMatchObject({ serverStartup: 2400, beforeFirstBrowser: 3400, browsers: 2, browserLaunch: 1500, fixedWaits: 12000, fixedWaitCount: 40 });
    expect(timing.servers).toHaveLength(2);
  });

  it("names the harness line each fixed wait was asked for at, costliest first, across its processes", () => {
    const timing = summarizeTiming([
      { kind: "waited", ms: 900, count: 3, sites: [{ at: "verify-menu.mjs:40", ms: 600, count: 2 }, { at: "lib/journeys.mjs:12", ms: 300, count: 1 }], pid: 1, sinceStart: 10 },
      { kind: "waited", ms: 500, count: 1, sites: [{ at: "lib/journeys.mjs:12", ms: 500, count: 1 }], pid: 2, sinceStart: 20 },
    ]);
    expect(timing.fixedWaitSites).toEqual([
      { at: "lib/journeys.mjs:12", ms: 800, count: 2 },
      { at: "verify-menu.mjs:40", ms: 600, count: 2 },
    ]);
    const stack = ["Error", "    at noteWait (/home/x/repo/scripts/lib/timing.mjs:50:3)", "    at page.waitForTimeout (/home/x/repo/scripts/lib/watch.mjs:954:9)", "    at async look (/home/x/repo/scripts/verify-site.mjs:120:5)"].join("\n");
    expect(waitSite(stack)).toBe("verify-site.mjs:120");
    expect(waitSite("Error\n    at somewhere (node:internal/x:1:1)")).toBe("elsewhere");
  });

  it("is kept in the verdict beside its claims, and adds no claim that reads as failed", () => {
    const dir = mkdtempSync(join(tmpdir(), "timing-"));
    try {
      mkdirSync(join(dir, "docs"));
      writeFileSync(join(dir, "docs/menu.json"), JSON.stringify({ checks: { opens: true, closes: false } }));
      writeFileSync(join(dir, "docs/list.json"), JSON.stringify([1, 2]));
      const timing = { wall: 12, cpu: 30.5, serverStartup: 0, servers: [{ name: "todo", ms: 1, borrowed: false }], beforeFirstBrowser: 800 };
      expect(stampVerdicts(dir, ["docs/menu.json", "docs/list.json"], timing)).toEqual(["docs/menu.json"]);
      const verdict = JSON.parse(readFileSync(join(dir, "docs/menu.json"), "utf8"));
      expect(verdict.timing).toEqual(timing);
      expect(falseClaims(verdict)).toEqual(["closes"]);
      expect(JSON.parse(readFileSync(join(dir, "docs/list.json"), "utf8"))).toEqual([1, 2]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("a wait on what it means", () => {
  /** A page that answers the looks it is asked, one after another, the last one from then on. */
  const pageSaying = (looks: { quietFor: number; busy: boolean }[]) => {
    let at = 0;
    return { on: () => undefined, isClosed: () => false, evaluate: async () => looks[Math.min(at++, looks.length - 1)] };
  };

  it("ends once the page has been still and nothing is on its way, well before the wait it replaced", async () => {
    const began = Date.now();
    expect(await settled(pageSaying([{ quietFor: 0, busy: true }, { quietFor: 50, busy: false }, { quietFor: 250, busy: false }]), { most: 5_000 })).toBe(true);
    expect(Date.now() - began).toBeLessThan(1_000);
  });

  it("never waits longer than the wait it replaced, on a page that never stops", async () => {
    const began = Date.now();
    expect(await settled(pageSaying([{ quietFor: 0, busy: true }]), { most: 300 })).toBe(false);
    const took = Date.now() - began;
    expect(took).toBeGreaterThanOrEqual(290);
    expect(took).toBeLessThan(800);
  });

  it("asks a claim that goes in its own time until it has gone, and no longer than its time", async () => {
    let asked = 0;
    expect(await until(() => ++asked >= 3, { most: 5_000 })).toBe(true);
    expect(asked).toBe(3);
    expect(await until(() => false, { most: 150 })).toBe(false);
  });
});

describe("what a harness read", () => {
  it("is kept relative to the checkout, built output mapped to its source", () => {
    expect(normalized(join(repo, "packages/core/dist/address.js"))).toBe("packages/core/src/address.ts");
    expect(normalized(`file://${join(repo, "packages/core/dist/address.js")}`)).toBe("packages/core/src/address.ts");
    expect(normalized(join(repo, "packages/core/dist/no-such-module.js"))).toBe("packages/core/");
    expect(normalized(join(repo, "scripts/lib/ports.mjs?v=12"))).toBe("scripts/lib/ports.mjs");
    expect(normalized(join(repo, "packages/graview/dist/preview/page.js"))).toBe(PREVIEW);
  });

  it("leaves out what is no input: dependencies, verdicts, generated files, other directories", () => {
    expect(normalized(join(repo, "node_modules/react/index.js"))).toBeNull();
    expect(normalized(join(repo, "docs/menu.json"))).toBeNull();
    expect(normalized(join(repo, "apps/todo/.generated/told.json"))).toBeNull();
    expect(normalized("/somewhere/else/file.ts")).toBeNull();
    // The site a harness serves is an input.
    expect(normalized(join(repo, "docs/site/index.html"))).toBe("docs/site/index.html");
  });

  it("is merged run by run: a harness that ran is replaced, one that did not is kept", () => {
    const first = mergeCoverage({ harnesses: [], files: {} }, new Map([["menu", ["a.ts", "b.ts"]], ["pages", ["b.ts"]]]), { sha: "one", at: "t1" });
    const second = mergeCoverage(first, new Map([["menu", ["c.ts"]]]), { sha: "two", at: "t2" });
    const files = byHarness(second);
    expect([...files.get("menu")]).toEqual(["c.ts"]);
    expect([...files.get("pages")]).toEqual(["b.ts"]);
    expect(second.harnesses.find((one: { name: string }) => one.name === "pages").sha).toBe("one");
    expect(second.harnesses.find((one: { name: string }) => one.name === "menu").sha).toBe("two");
  });

  it("adds a look at part of a harness to its record, keeping the commit it was taken whole on", () => {
    const first = mergeCoverage({ harnesses: [], files: {} }, new Map([["quiet", ["a.ts"]]]), { sha: "one", at: "t1" });
    const part = mergeCoverage(first, new Map([["quiet", ["b.ts"]]]), { sha: "two", at: "t2", whole: new Set() });
    expect([...byHarness(part).get("quiet")].sort()).toEqual(["a.ts", "b.ts"]);
    expect(part.harnesses[0].sha).toBe("one");
  });

  it("is every module a process loads, every checkout file it reads and every input of a bundle it builds", () => {
    const dir = mkdtempSync(join(tmpdir(), "coverage-"));
    try {
      const file = join(dir, "read.cov");
      const script = join(dir, "harness.mjs");
      writeFileSync(
        script,
        [
          `import { createRequire } from "node:module";`,
          `import { readFileSync } from "node:fs";`,
          `await import(${JSON.stringify(join(repo, "scripts/lib/ports.mjs"))});`,
          `readFileSync(${JSON.stringify(join(repo, "scripts/fixtures"))} + "/../lib/deadline.mjs", "utf8");`,
          `const esbuild = createRequire(${JSON.stringify(join(repo, "package.json"))})("esbuild");`,
          `const built = await esbuild.build({ entryPoints: [${JSON.stringify(join(repo, "packages/core/src/address.ts"))}], bundle: true, write: false, logLevel: "silent" });`,
          `if (built.metafile) throw new Error("a metafile nobody asked for");`,
        ].join("\n"),
      );
      execFileSync("node", [script], { env: { ...process.env, NODE_OPTIONS: withHook(""), GRAVIEW_COVERAGE_FILE: file }, stdio: "pipe" });
      const read = readFileSync(file, "utf8").split("\n");
      expect(read).toContain("scripts/lib/ports.mjs");
      expect(read).toContain("scripts/lib/deadline.mjs");
      expect(read).toContain("packages/core/src/address.ts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is counted in every process a harness starts, through one NODE_OPTIONS entry", () => {
    const once = withHook("--max-old-space-size=4096");
    expect(withHook(once)).toBe(once);
    expect(withoutHook(once)).toBe("--max-old-space-size=4096");
  });
});

describe("the harnesses a change reaches", () => {
  const chain = ["hosted", "device", "seat", "menu", "pages", "create", "studio"];
  const kept = mergeCoverage(
    { harnesses: [], files: {} },
    new Map([
      ["hosted", ["scripts/verify-hosted-page.mjs"]],
      ["device", ["scripts/verify-device.mjs"]],
      ["seat", ["scripts/verify-seat.mjs", "packages/core/src/app.ts"]],
      ["menu", ["scripts/verify-menu.mjs", "packages/core/src/app.ts", "packages/primitives/src/menu.tsx"]],
      ["pages", ["scripts/verify-pages.mjs", "packages/core/src/app.ts", "packages/pages/src/home.tsx"]],
      ["create", ["scripts/smoke-create.mjs", "packages/graview/"]],
      ["studio", ["scripts/verify-studio.mjs", "packages/studio/src/studio.ts"]],
    ]),
    { sha: "recorded" },
  );
  const pick = (paths: string[], options = {}) => selectHarnesses(paths.map((path) => ({ path, added: false })), { chain, kept, ...options });

  it("is every harness that read a file the change touched, and the smoke set", () => {
    const { names, why } = pick(["packages/primitives/src/menu.tsx"]);
    expect(names).toEqual(["hosted", "device", "seat", "menu"]);
    expect(why.get("menu")).toEqual(["packages/primitives/src/menu.tsx"]);
    expect(SMOKE.every((name: string) => names.includes(name))).toBe(true);
  });

  it("is every harness that read anything of a package it holds whole", () => {
    expect(pick(["packages/graview/src/cli.ts"]).names).toContain("create");
  });

  it("is nobody beyond the smoke set for a file nothing read, where the coverage is current", () => {
    const { names, unreached } = pick(["packages/core/src/checker-only.ts", "docs/process.md", "tests/a.test.ts"]);
    expect(names).toEqual(["hosted", "device", "seat"]);
    expect(unreached).toEqual(["packages/core/src/checker-only.ts", "docs/process.md", "tests/a.test.ts"]);
  });

  it("is every reader of a file main changed since the coverage was taken that now imports it, read or not", () => {
    const mentions = (file: string, stem: string) => file === "packages/pages/src/home.tsx" && stem === "sort";
    // sort.ts was read only by menu when the coverage was taken; main has since made the pages' home import it.
    const read = mergeCoverage(kept, new Map([["menu", ["scripts/verify-menu.mjs", "packages/core/src/sort.ts"]]]), { sha: "recorded", whole: new Set() });
    const picked = (movedSince: () => string[] | null) => selectHarnesses([{ path: "packages/core/src/sort.ts", added: false }], { chain, kept: read, movedSince, mentions }).names;
    expect(picked(() => ["packages/pages/src/home.tsx"])).toEqual(["hosted", "device", "seat", "menu", "pages"]);
    // Main changed nothing that names it: only its readers.
    expect(picked(() => [])).toEqual(["hosted", "device", "seat", "menu"]);
    // And when the commit cannot be compared with at all, every file that names it counts.
    expect(picked(() => null)).toEqual(["hosted", "device", "seat", "menu", "pages"]);
  });

  it("is every harness that read beside a file the branch adds, since a listing finds it too", () => {
    const { names } = selectHarnesses([{ path: "packages/primitives/src/new.tsx", added: true }], { chain, kept });
    expect(names).toEqual(["hosted", "device", "seat", "menu"]);
  });

  it("is every harness for what every harness stands on", () => {
    for (const path of ["pnpm-lock.yaml", "packages/core/package.json", "tsconfig.base.json"]) {
      expect(EVERYTHING.some((pattern: RegExp) => pattern.test(path))).toBe(true);
      expect(pick([path]).names).toEqual(chain);
    }
  });

  it("is the smoke set alone for a change to the chain's own machinery", () => {
    expect(pick(["scripts/verify-all.mjs", "scripts/lib/pool.mjs"]).names).toEqual(["hosted", "device", "seat"]);
  });

  it("always includes a harness with no coverage yet", () => {
    expect(selectHarnesses([], { chain: [...chain, "brand-new"], kept }).names).toContain("brand-new");
  });
});

describe("the pool", () => {
  it("is a worker a core, up to sixteen, unless told", () => {
    expect(defaultJobs({ cores: 12, env: {} })).toBe(12);
    expect(defaultJobs({ cores: 2, env: {} })).toBe(2);
    expect(defaultJobs({ cores: 64, env: {} })).toBe(16);
    expect(defaultJobs({ cores: 12, env: { GRAVIEW_VERIFY_JOBS: "2" } })).toBe(2);
  });

  const locks: string[] = [];
  afterEach(() => {
    for (const dir of locks.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("locks a block of ports for one run at a time, and takes over a lock whose run is gone", () => {
    const dir = mkdtempSync(join(tmpdir(), "blocks-"));
    locks.push(dir);
    const release = lockBlock(6400, { dir });
    expect(release).toBeTypeOf("function");
    expect(lockBlock(6400, { dir })).toBeNull();
    release();
    expect(lockBlock(6400, { dir })).toBeTypeOf("function");
    writeFileSync(join(dir, "6500.lock"), "999999999");
    expect(lockBlock(6500, { dir })).toBeTypeOf("function");
  });

  it("gives the first worker the run's own block and the rest free hundreds outside 5190–5289 and the run's own", () => {
    const dir = mkdtempSync(join(tmpdir(), "blocks-"));
    locks.push(dir);
    const { bases, release } = claimBlocks(3, { own: 5700, candidates: [5200, 5700, 6000, 6100, 6200], busy: (base: number) => base === 6000, dir });
    try {
      expect(bases).toEqual([5700, 6100, 6200]);
    } finally {
      release();
    }
  });

  it("takes the longest first, by what each took last time", () => {
    expect(longestFirst(["a", "b", "c"], { took: new Map([["a", 10], ["c", 500]]), guess: () => 60 })).toEqual(["c", "b", "a"]);
  });

  it("never runs two harnesses that time something at once, and holds nothing else back", async () => {
    const queue = ["one-face", "journeys", "menu"];
    expect(nextFor(queue, { timing: new Set(["one-face", "journeys"]), timingRunning: true })).toBe("menu");
    expect(nextFor(["journeys"], { timing: new Set(["journeys"]), timingRunning: true })).toBeNull();

    let timingAtOnce = 0;
    let most = 0;
    let atOnce = 0;
    let widest = 0;
    const timing = new Set(["t1", "t2", "t3"]);
    const ran = await runPool(["t1", "t2", "t3", "a", "b", "c", "d"], {
      jobs: 3,
      timing,
      run: async (name: string) => {
        atOnce += 1;
        widest = Math.max(widest, atOnce);
        if (timing.has(name)) most = Math.max(most, ++timingAtOnce);
        await new Promise((done) => setTimeout(done, timing.has(name) ? 30 : 10));
        if (timing.has(name)) timingAtOnce -= 1;
        atOnce -= 1;
        return name;
      },
    });
    expect([...ran].sort()).toEqual(["a", "b", "c", "d", "t1", "t2", "t3"]);
    expect(most).toBe(1);
    expect(widest).toBe(3);
  });
});

describe("Nightly and a run on GitHub", () => {
  it("name every harness they run, so a branch's change-aware default never narrows them", () => {
    const nightly = readFileSync(resolve(repo, ".github/workflows/nightly.yml"), "utf8");
    const runs = [...nightly.matchAll(/run: "(node scripts\/verify-[a-z-]+\.mjs[^"]*)"/g)].map((match) => match[1]);
    expect(runs.length).toBeGreaterThan(5);
    for (const run of runs) {
      expect(run).not.toMatch(/--changed/);
      // verify-all is always handed names; the journeys take their apps.
      if (run.includes("verify-all.mjs")) expect(run.replace(/--[a-z]+(=\S+)?/g, "").split(/\s+/).filter(Boolean).length).toBeGreaterThan(2);
    }
    const verify = readFileSync(resolve(repo, ".github/workflows/verify.yml"), "utf8");
    expect(verify).toMatch(/node scripts\/verify-all\.mjs --serial \$NAMES/);
    expect(verify).not.toMatch(/--changed/);
  });
});

describe("a harness run in parts", () => {
  it("is each of its parts when named, and one part when that is named", () => {
    const quiet = unitsOf(["menu", "quiet"]);
    expect(quiet[0]).toBe("menu");
    expect(quiet).toHaveLength(1 + 3 * 6);
    expect(quiet).toContain("quiet.firefox-rest");
    expect(unitsOf(["address"])).toEqual(["address.chromium", "address.webkit", "address.firefox"]);
    expect(unitsOf(["quiet.webkit"])).toEqual(["quiet.webkit"]);
    expect(unitsOf(["journeys"])).toEqual(["journeys.todo", "journeys.seedbed", "journeys.discography", "journeys.gauntlet-scene", "journeys.gauntlet-pages", "journeys.rest"]);
    expect(splitUnit("quiet.chromium-steady")).toEqual({ name: "quiet", part: "chromium-steady" });
    expect(partPath("/r/docs/address.json", "webkit")).toBe("/r/docs/address.part-webkit.json");
    expect(partPath("/r/docs/address.json", "")).toBe("/r/docs/address.json");
  });

  it("holds a claim only where every part held it, and fails when a part wrote nothing", () => {
    const merged = mergeParts([
      { part: "chromium", verdict: { at: "a", passed: true, checks: { fits: { ok: true, seen: [1] }, quiet: { ok: true } } } },
      { part: "webkit", verdict: { at: "b", passed: false, checks: { fits: { ok: false, seen: [2] } } } },
    ]);
    expect(falseClaims(merged)).toEqual(["fits"]);
    expect(merged.checks.quiet.ok).toBe(true);
    expect(merged.passed).toBe(false);
    const short = mergeParts([
      { part: "chromium", verdict: { at: "a", passed: true, checks: { fits: { ok: true } } } },
      { part: "firefox", verdict: null },
    ]);
    expect(falseClaims(short)).toEqual(["everyPartWroteAVerdict"]);
    expect(short.checks.everyPartWroteAVerdict.missing).toEqual(["firefox"]);
  });

  it("takes every step of the whole between its parts, each once: what no part names, its rest takes", () => {
    const listed = (file: string, args: string[]) =>
      execFileSync(process.execPath, [resolve(repo, "scripts", file), "--list-steps", ...args], { encoding: "utf8", timeout: 30_000 }).trim().split("\n");
    for (const [name, file] of [["journeys", "verify-journeys.mjs"], ["site", "verify-site.mjs"], ["one-face", "verify-one-face.mjs"]] as const) {
      const whole = listed(file, []);
      expect(whole.length).toBeGreaterThan(10);
      const parts = PARTS[name].parts.map(({ args }: { args: string[] }) => listed(file, args));
      for (const part of parts) expect(part.filter(Boolean).length).toBeGreaterThan(0);
      expect(parts.flat().sort()).toEqual([...whole].sort());
      expect(new Set(whole).size).toBe(whole.length);
    }
  }, 60_000);

  it("compares a job's pointer with its keyboard in one part, so a part alone holds it to twice", () => {
    const faces = PARTS.journeys.parts.flatMap(({ args }: { args: string[] }) => args);
    expect(faces.some((arg: string) => /pointer|keyboard|1440|390/.test(arg))).toBe(false);
  });

  it("refuses a part that names a step the harness does not have, which nothing would run", () => {
    const steps = [{ name: "desk/bar" }, { name: "phone/bar" }, { name: "phone-later/bar" }];
    expect(chooseSteps(steps, ["--steps=phone"])).toEqual([{ name: "phone/bar" }]);
    expect(chooseSteps(steps, ["--not=phone"])).toEqual([{ name: "desk/bar" }, { name: "phone-later/bar" }]);
    expect(chooseSteps(steps, [])).toEqual(steps);
    expect(() => chooseSteps(steps, ["--not=phones"])).toThrow(/No step called phones/);
  });

  it("makes every claim the whole made: one that no part had anything to judge is false, and one another part made is that part's", () => {
    const merged = mergeParts([
      { part: "desk", verdict: { passed: true, checks: { bar: { ok: true } }, unmade: ["pinch", "duplicate"] } },
      { part: "phone", verdict: { passed: true, checks: { bar: { ok: true }, pinch: { ok: true } }, unmade: ["duplicate"] } },
    ]);
    expect(merged.checks.pinch.ok).toBe(true);
    expect(falseClaims(merged)).toEqual(["duplicate"]);
    expect(merged.passed).toBe(false);
    const criteria = mergeParts([
      { part: "page", verdict: { passed: true, criteria: { everyViewportIsClean: true } } },
      { part: "rest", verdict: { passed: true, criteria: { forced: true }, unmade: ["everyViewportIsClean"] } },
    ]);
    expect(falseClaims(criteria)).toEqual([]);
    expect(criteria.passed).toBe(true);
  });
});
