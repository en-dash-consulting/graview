import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, typed by its use here.
import { allHeld, askedHarnesses, falseClaims, NOT_ON_A_RUNNER, planShards, SHARD_OWN, summarizeShard, summaryMarkdown, terminalLines, writtenSince } from "../scripts/lib/on-github.mjs";

/**
 * THE HARNESSES RUN ON GITHUB'S MACHINES (HQ feature f-harnesses-run-on-github).
 * A build agent's harnesses ran on a power-limited laptop beside other
 * agents', and a wait that holds on a quiet machine read as a failure.
 * `pnpm verify:github` runs them on runners of their own (verify.yml) and
 * brings back each verdict with its failing claims by name.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHAIN = ["watch", "hosted", "site", "a11y", "gauntlet", "lines", "shrunk", "menu", "pages", "journeys", "panning", "scale", "one-face", "create"];
type Shard = { names: string; label: string; seconds: number };
type Harness = { name: string; verdict: string; took: number | null; claims: string[]; files: string[] };

describe("the names, split across runners", () => {
  it("puts each name on exactly one runner, no more runners than names or than asked, each runner's names in the chain's order", () => {
    const plan = planShards(["one-face", "pages", "site", "menu"], { shards: 3, order: CHAIN }) as Shard[];
    expect(plan).toHaveLength(3);
    expect(plan.flatMap((shard) => shard.names.split(" ")).sort()).toEqual(["menu", "one-face", "pages", "site"]);
    for (const shard of plan) {
      const names = shard.names.split(" ");
      expect(names).toEqual([...names].sort((a, b) => CHAIN.indexOf(a) - CHAIN.indexOf(b)));
    }
    expect(planShards(["one-face"], { shards: 8 })).toHaveLength(1);
  });

  it("keeps the long harnesses apart: site, journeys and gauntlet on three runners when there are three", () => {
    const plan = planShards(["site", "journeys", "gauntlet", "menu", "pages", "a11y"], { shards: 3, order: CHAIN }) as Shard[];
    const homes = ["site", "journeys", "gauntlet"].map((name) => plan.findIndex((shard) => shard.names.split(" ").includes(name)));
    expect(new Set(homes).size).toBe(3);
  });

  it("takes the names it was given, refuses one the chain does not know or a shell would read as more, and runs the whole chain but what a runner cannot when given none", () => {
    expect(askedHarnesses("one-face  pages,menu", CHAIN)).toEqual(["one-face", "pages", "menu"]);
    expect(() => askedHarnesses("one-face onefase", CHAIN)).toThrow(/No harness called onefase/);
    expect(() => askedHarnesses("one-face;rm", CHAIN)).toThrow(/Not a harness name/);
    const whole = askedHarnesses("", CHAIN) as string[];
    for (const name of NOT_ON_A_RUNNER) expect(whole).not.toContain(name);
    expect(whole).toContain("site");
    // Named, a harness a runner cannot hold still runs: whoever asked wants to see it.
    expect(askedHarnesses("scale", CHAIN)).toEqual(["scale"]);
  });
});

describe("a verdict's failing claims, by name", () => {
  it("reads the claims under checks, claims, criteria and steps, and a top-level claim, and never the verdict's own summary", () => {
    expect(falseClaims({ at: "x", checks: { theFaceOffersNoSwitch: { ok: true }, oneControlSaysTheLevel: { ok: false, held: [] } }, passed: false })).toEqual(["oneControlSaysTheLevel"]);
    expect(falseClaims({ claims: { aViewCannotReachTheNetwork: false, itDraws: true }, ok: false })).toEqual(["aViewCannotReachTheNetwork"]);
    expect(falseClaims({ criteria: { kit: { passed: false } }, wentDeeper: false, quick: false })).toEqual(["kit", "wentDeeper"]);
    expect(falseClaims({ steps: { opened: true } })).toEqual([]);
    expect(falseClaims([false])).toEqual([]);
  });

  it("reads a verdict's own booleans, a part's booleans and a list of named results", () => {
    expect(falseClaims({ verdict: { reachedEveryChapter: false, opened: true }, passed: false })).toEqual(["reachedEveryChapter"]);
    expect(falseClaims({ npm: { installed: false, built: true }, products: [{ name: "squad", ok: true }, { name: "pod", ok: false }] })).toEqual(["npm.installed", "products: pod"]);
  });

  it("reads every verdict in docs/ without throwing", () => {
    for (const file of writtenSince(repo, 0) as { path: string }[]) {
      if (!file.path.endsWith(".json")) continue;
      const verdict = JSON.parse(readFileSync(join(repo, file.path), "utf8"));
      expect(Array.isArray(falseClaims(verdict))).toBe(true);
    }
  });
});

describe("a shard's summary", () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const write = (path: string, body: unknown, at: number) => {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, JSON.stringify(body));
    utimesSync(full, at / 1000, at / 1000);
  };

  it("credits each harness with what it wrote while it ran, names the claims that failed, and says a harness that wrote no verdict", () => {
    root = mkdtempSync(join(tmpdir(), "verify-on-github-"));
    const since = Date.parse("2026-11-15T10:00:00Z");
    const began = { "one-face": since + 10_000, pages: since + 200_000 };
    write("docs/old.json", { passed: false, checks: { stale: false } }, since - 60_000);
    write("docs/one-face.json", { checks: { theFaceOffersNoSwitch: { ok: true } }, passed: true }, began["one-face"] + 90_000);
    write("docs/one-face/strip.png", {}, began["one-face"] + 80_000);
    write("docs/pages-face.json", { checks: { aPhoneReadsTheRecord: { ok: false }, theBarFits: { ok: true } }, passed: false }, began.pages + 30_000);
    write("docs/watch/verify-pages.json", { open: 2 }, began.pages + 31_000);
    write("docs/watch/last-run.json", {}, began.pages + 40_000);
    const lastRun = {
      at: new Date(since + 300_000).toISOString(),
      results: [
        { name: "one-face", code: 0, took: 100, began: new Date(began["one-face"]).toISOString(), verdict: "held" },
        { name: "pages", code: 1, took: 50, began: new Date(began.pages).toISOString(), verdict: "failed", missed: ["aPhoneReadsTheRecord"] },
      ],
    };
    const written = writtenSince(root, since) as { path: string; at: number }[];
    expect(written.map((file) => file.path)).not.toContain("docs/old.json");
    const { harnesses } = summarizeShard({ root, since, asked: ["one-face", "pages", "menu"], lastRun, written }) as { harnesses: Harness[] };
    const [face, pages, menu] = harnesses;
    expect(face).toMatchObject({ verdict: "held", claims: [], files: ["docs/one-face.json", "docs/one-face/strip.png"] });
    expect(pages!.verdict).toBe("failed");
    expect(pages!.claims).toEqual(["aPhoneReadsTheRecord", "the watch: 2 open in docs/watch/verify-pages.json"]);
    expect(pages!.files).not.toContain("docs/watch/last-run.json");
    expect(menu).toMatchObject({ verdict: "no verdict" });
    expect(allHeld(harnesses)).toBe(false);
    expect(allHeld([face])).toBe(true);
    expect(allHeld([{ ...face, verdict: "flaky" }])).toBe(true);

    const markdown = summaryMarkdown({ label: "one-face, pages, menu", harnesses }) as string;
    expect(markdown).toContain("| ✅ | `one-face` | held | 100s |");
    expect(markdown).toContain("- `aPhoneReadsTheRecord`");
    expect(terminalLines(harnesses).join("\n")).toMatch(/FAIL\s+pages[\s\S]*aPhoneReadsTheRecord/);
  });

  it("credits a first look kept beside the second to its own harness by its path, and takes no claim from it", () => {
    root = mkdtempSync(join(tmpdir(), "verify-on-github-"));
    const since = Date.parse("2026-11-15T10:00:00Z");
    // pages ran first and failed; its first look was copied just before its second, inside one-face's time.
    const began = { "one-face": since + 10_000, pages: since + 200_000 };
    write("docs/first-look/pages-face.json", { checks: { theBarFits: { ok: false } } }, since + 199_500);
    write("docs/first-look/watch/verify-pages.json", { open: 0 }, since + 199_500);
    write("docs/pages-face.json", { checks: { theBarFits: { ok: true } } }, began.pages + 30_000);
    const lastRun = {
      at: new Date(since + 300_000).toISOString(),
      results: [
        { name: "one-face", code: 1, took: 195, began: new Date(began["one-face"]).toISOString(), verdict: "failed", missed: ["noPageThrew"] },
        { name: "pages", code: 0, took: 50, began: new Date(began.pages).toISOString(), verdict: "flaky", missed: ["theBarFits"] },
      ],
    };
    const written = writtenSince(root, since) as { path: string; at: number }[];
    const [face, pages] = (summarizeShard({ root, since, asked: ["one-face", "pages"], lastRun, written }) as { harnesses: Harness[] }).harnesses;
    expect(face!.files).toEqual([]);
    expect(face!.claims).toEqual(["noPageThrew"]);
    expect(pages!.files).toEqual(["docs/first-look/pages-face.json", "docs/first-look/watch/verify-pages.json", "docs/pages-face.json"]);
    expect(pages!.claims).toEqual(["theBarFits"]);

    // A chain name its script does not share: `hosted` is verify-hosted-page.mjs, and its first look is kept by the script's name.
    write("docs/first-look/hosted-page.json", { ok: false }, since + 199_500);
    const hostedRun = { at: lastRun.at, results: [{ name: "hosted", file: "verify-hosted-page.mjs", code: 0, took: 50, began: new Date(began.pages).toISOString(), verdict: "flaky", missed: [] }] };
    const [hosted] = (summarizeShard({ root, since, asked: ["hosted"], lastRun: hostedRun, written: writtenSince(root, since) }) as { harnesses: Harness[] }).harnesses;
    expect(hosted!.files).toContain("docs/first-look/hosted-page.json");
  });

  it("takes no verdict from a last run older than the shard", () => {
    root = mkdtempSync(join(tmpdir(), "verify-on-github-"));
    const since = Date.now();
    const lastRun = { at: new Date(since - 86_400_000).toISOString(), results: [{ name: "one-face", code: 0, took: 1, verdict: "held" }] };
    const { harnesses } = summarizeShard({ root, since, asked: ["one-face"], lastRun, written: [] }) as { harnesses: Harness[] };
    expect(harnesses[0]!.verdict).toBe("no verdict");
    // A shard that stopped before its harnesses has no moment they began: the checkout's own last run is not its.
    const fresh = { at: new Date().toISOString(), results: lastRun.results };
    expect((summarizeShard({ root, since: 0, asked: ["one-face"], lastRun: fresh, written: [] }) as { harnesses: Harness[] }).harnesses[0]!.verdict).toBe("no verdict");
  });

  it("never brings back a shard's own record over the checkout's", () => {
    expect(SHARD_OWN).toEqual(expect.arrayContaining(["docs/watch/last-run.json", "docs/watch/ledger.json"]));
  });
});

describe("the workflow", () => {
  const workflow = readFileSync(resolve(repo, ".github/workflows/verify.yml"), "utf8");

  it("is dispatched with the harnesses, quick, slow and a token its dispatcher finds it by", () => {
    for (const input of ["harnesses:", "quick:", "slow:", "renderer:", "request:"]) expect(workflow).toContain(input);
    expect(workflow).toMatch(/run-name:.*inputs\.request/);
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("sets up as Nightly does: the engines Playwright pins, cached by Nightly's key, and Nightly's Chrome for the GPU path", () => {
    const nightly = readFileSync(resolve(repo, ".github/workflows/nightly.yml"), "utf8");
    expect(workflow).toContain("key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}");
    const pin = /CHROME_PIN: "([\d.]+)"/;
    expect(workflow.match(pin)?.[1]).toBe(nightly.match(pin)?.[1]);
  });

  it("hands the names to the shell through the environment, never through an expression in a script", () => {
    const runs = workflow.split("\n").filter((line) => /^\s+(run:|node |if \[|export )/.test(line));
    for (const line of runs) expect(line, line).not.toMatch(/\$\{\{\s*(inputs|matrix)\./);
  });

  it("is what pnpm verify:github dispatches", () => {
    const pkg = JSON.parse(readFileSync(resolve(repo, "package.json"), "utf8"));
    expect(pkg.scripts["verify:github"]).toBe("node scripts/verify-on-github.mjs");
    expect(readFileSync(resolve(repo, "scripts/verify-on-github.mjs"), "utf8")).toContain('const WORKFLOW = "verify.yml"');
  });
});
