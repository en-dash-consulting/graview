import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { compareViewRevision } from "@graview/core/revisions";
import { describe, expect, it } from "vitest";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { runWorkerViewHeadless, type HeadlessDescribed } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";

/*
 * A REVISED VIEW SAYS WHAT IT STOPPED STYLING (Roadmap
 * f-revisions-say-what-broke). Homeflow's home was rewritten whole by a
 * chat: "This week" kept its markup and lost the rules that laid it out
 * (`.hf-week`, `.hf-wk-*`), and the first-screen picture looked as it had.
 * Here both versions are run headless, as Cloud runs a proposed view, and
 * what each run drew and styled is handed to `compareViewRevision`.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("lifelogics.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the LifeLogics fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("lifelogics.seed.json", fixtures), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const manifest: WorkerViewManifest = { name: "home", attach: "home", cardinality: "many" };
const source = (name: string) => readFileSync(new URL(`../fixtures/revisions/${name}.js`, import.meta.url), "utf8");
const run = nodeIsolate();

async function drawn(name: string): Promise<HeadlessDescribed> {
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
  const result = await runWorkerViewHeadless({ store, principal: owner, run, manifest, source: source(name), audit: true, drawing: true });
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result;
}

describe("a revised view, run headless beside the version it replaces", () => {
  it("names the classes it still draws that a rule styled before and none styles now, and the section it no longer draws", async () => {
    const [before, after] = [await drawn("home-before"), await drawn("home-after")];
    const revision = compareViewRevision(
      { source: source("home-before"), css: before.css, drawing: before.drawing!.root, height: 2_400 },
      { source: source("home-after"), css: after.css, drawing: after.drawing!.root, height: 1_100 },
    );
    expect(revision.read).toEqual({ before: "drawing", after: "drawing" });
    expect(revision.unstyled.map((one) => one.class).sort()).toEqual(["hf-week", "hf-wk-day"]);
    expect(revision.selectorsRemoved.map((one) => one.selector)).toContain(".hf-wk-day h3");
    expect(revision.sectionsMissing).toEqual([{ name: "Dinner", as: "section" }]);
    expect(revision.height).toEqual({ before: 2_400, after: 1_100, change: -1_300, ratio: -0.542 });
    expect(revision.regressed).toBe(true);
    expect(revision.text).toContain(".hf-week, .hf-wk-day");
    expect(revision.text).toContain('"Dinner"');
    expect(revision.text).toContain("down from 2,400px");
  });

  it("never says a class that was never styled — a hook the view listens on — nor one still styled", async () => {
    const [before, after] = [await drawn("home-before"), await drawn("home-after")];
    const revision = compareViewRevision({ source: source("home-before"), css: before.css, drawing: before.drawing!.root }, { source: source("home-after"), css: after.css, drawing: after.drawing!.root });
    const said = revision.unstyled.map((one) => one.class);
    expect(said).not.toContain("js-pick");
    expect(said).not.toContain("hf-home");
    expect(said).not.toContain("hf-hello");
  });

  it("says the same from the two sources alone, where the host ran neither", () => {
    const revision = compareViewRevision({ source: source("home-before") }, { source: source("home-after") });
    expect(revision.read).toEqual({ before: "source", after: "source" });
    expect(revision.unstyled.map((one) => one.class).sort()).toEqual(["hf-week", "hf-wk-day"]);
    expect(revision.sectionsMissing.map((one) => one.name)).toEqual(["Dinner"]);
  });

  it("says nothing of a view run against itself", async () => {
    const before = await drawn("home-before");
    const revision = compareViewRevision({ source: source("home-before"), css: before.css, drawing: before.drawing!.root }, { source: source("home-before"), css: before.css, drawing: before.drawing!.root });
    expect(revision.regressed).toBe(false);
    expect(revision.said).toEqual([]);
  });
});
