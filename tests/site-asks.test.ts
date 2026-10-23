import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { runWorkerViewHeadless } from "@graview/guest/headless";
import { nodeIsolate } from "@graview/guest/headless/node";
import { checkManifest, checkViewSource, type WorkerViewManifest } from "@graview/guest/host/views";
import { describe, expect, it } from "vitest";

/**
 * WHAT GRAVIEW.DEV SAYS IT ASKED FOR, IT GOT.
 *
 * The landing page claims the interface is generated from the declaration
 * and that changing it is a sentence. Its hero ends on a departures board
 * asked of the docs recipe, and the section under it reshapes a kids'
 * soccer season three ways. None of those views is a mockup: each is a
 * worker view recorded as the answer to the words the page shows
 * (apps/site/asks/turns.json), handed on the page to the same view host a
 * product's views run in. CI cannot ask a model, so it holds the recording:
 * every view passes the host's own checks, runs headless over its app's
 * records, and draws what the page's captions say it draws — the season's
 * one rule showing through every view, and the docs the hero's repair
 * writes reading WRITTEN on the board.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts: string[]) => readFileSync(resolve(repoRoot, ...parts), "utf8");
const json = <T>(...parts: string[]) => JSON.parse(read(...parts)) as T;
const CLI = resolve(repoRoot, "packages/graview/dist/cli.js");

interface Turn {
  readonly name: string;
  readonly app: "docs" | "season";
  readonly ask: string;
  readonly view: string;
  readonly manifest: WorkerViewManifest;
  readonly path: string;
}
const turns = json<{ turns: Turn[] }>("apps/site/asks/turns.json").turns;
const turn = (name: string) => turns.find((one) => one.name === name)!;
const page = read("apps/site/pages/index.html");
const built = read("docs/site/index.html");

const DOCUMENTS = {
  docs: { document: ["docs/site/recipes/docs/app.json"], seed: ["docs/site/recipes/docs/seed.json"] },
  season: { document: ["apps/site/asks/season/app.json"], seed: ["apps/site/asks/season/seed.json"] },
} as const;
function appOf(name: keyof typeof DOCUMENTS): GraviewApp<AnySchema> {
  const compiled = compileDocument(json(...DOCUMENTS[name].document));
  if (!compiled.ok) throw new Error(`${name} does not compile`);
  return compiled.app as GraviewApp<AnySchema>;
}
function storeOf(name: keyof typeof DOCUMENTS): Store<AnySchema> {
  const app = appOf(name);
  return new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, invariants: app.invariants ?? [], snapshot: json(...DOCUMENTS[name].seed) });
}
const reader: Principal = { kind: "human", id: "reader" };
const run = nodeIsolate();
async function drawn(name: string, store: Store<AnySchema>): Promise<string> {
  const one = turn(name);
  const result = await runWorkerViewHeadless({ manifest: one.manifest, source: read("apps/site/asks", one.view), store, principal: reader, run });
  if (!result.ok) throw new Error(`${name}: ${result.reason}: ${result.detail}`);
  expect(result.description.problems, name).toEqual([]);
  return result.description.text;
}

/** The three modules the docs seed leaves with no doc: the hero's repair writes a guide for each, as the page's script does. */
const GUIDES = [...page.matchAll(/\{ module: "([^"]+)", id: "([^"]+)", title: "([^"]+)", path: "([^"]+)" \}/g)].map((m) => ({ module: m[1]!, id: m[2]!, title: m[3]!, path: m[4]! }));
function repaired(day: string): Store<AnySchema> {
  const store = storeOf("docs");
  for (const guide of GUIDES) {
    store.apply({ name: "add-doc", args: { id: guide.id, title: guide.title, path: guide.path, section: "guide", lastReviewed: day } });
    store.apply({ name: "document-in", args: { id: guide.module, to: guide.id } });
  }
  return store;
}
const today = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

describe("the asks graview.dev replays", () => {
  it("are recorded once each, the hero's and the season's, every one shown on the page in the words it was asked", () => {
    expect(turns.map((one) => one.name)).toEqual(["departures", "remaining-games", "courier"]);
    for (const one of turns) expect(built.replace(/&rsquo;/g, "’").replace(/’/g, "'"), one.name).toContain(one.ask.replace(/’/g, "'"));
  });

  for (const one of turns) {
    it(`${one.name}: the view host would take its manifest and its script`, () => {
      expect(checkViewSource(read("apps/site/asks", one.view))).toEqual([]);
      expect(checkManifest(one.manifest, storeOf(one.app))).toEqual([]);
      // The manifest the script opens with is the one the page registers.
      expect(read("apps/site/asks", one.view)).toContain(`name: "${one.manifest.name}"`);
    });
  }

  it("asks of a season that passes graview check --document with no warning", () => {
    const said = execFileSync(process.execPath, [CLI, "check", "--document", resolve(repoRoot, "apps/site/asks/season/app.json")], { cwd: repoRoot, encoding: "utf8" });
    expect(said.split("\n").filter((line) => line.startsWith("!"))).toEqual([]);
  });
});

describe("the season's one rule shows through every view", () => {
  it("finds exactly one problem in the season: the Brookside Bears game, which nobody brings snacks to", () => {
    const problems = storeOf("season").violations();
    expect(problems.map((problem) => problem.message)).toEqual(["Nobody is bringing snacks to the Brookside Bears game"]);
  });

  it("is the row with Sign up in the list a person asked for", async () => {
    const text = await drawn("remaining-games", storeOf("season"));
    expect(text).toContain("4 games left this season. One still needs snacks.");
    const rows = text.split("\n- ").slice(1);
    expect(rows).toHaveLength(4);
    expect(rows.filter((row) => row.includes("Sign up")).map((row) => row.split("\n")[0])).toEqual(["at Brookside Bears"]);
  });

  it("is a WANTED ad in the newspaper", async () => {
    const text = await drawn("courier", storeOf("season"));
    expect(text).toContain("The Comets Courier");
    expect(text).toContain("WANTED");
    expect(text).toContain("Brookside Bears game");
  });

  it("is gone from both once a family signs up, since every view draws the same records", async () => {
    const store = storeOf("season");
    store.apply({ name: "bring-snacks", args: { id: "game-bears", to: "family-patel" } });
    expect(store.violations()).toEqual([]);
    expect(await drawn("remaining-games", store)).not.toContain("Sign up");
    const paper = await drawn("courier", store);
    expect(paper).not.toContain("WANTED");
    expect(paper).toContain("No want ads this week");
  });
});

describe("the hero's run", () => {
  it("says what the docs recipe declares, and repairs the modules its seed leaves with no doc", () => {
    const document = json<{ kinds: object; acts: object; rules: object }>("docs/site/recipes/docs/app.json");
    expect(page).toContain(`Declared ${Object.keys(document.kinds).length} kinds, ${Object.keys(document.acts).length} acts and ${Object.keys(document.rules).length} rules.`);
    const undocumented = storeOf("docs")
      .violations()
      .filter((problem) => problem.invariant === "module-has-doc")
      .map((problem) => problem.nodeIds[0])
      .sort();
    expect(GUIDES.map((guide) => guide.module).sort()).toEqual(undocumented);
    expect(undocumented).toHaveLength(3);
  });

  it("ends on the departures board, the three docs the repair just wrote reading WRITTEN", async () => {
    const before = await drawn("departures", storeOf("docs"));
    expect(before.match(/, no doc$/gm) ?? []).toHaveLength(3);
    expect(before).not.toContain(", written");
    const after = await drawn("departures", repaired(today()));
    const written = after.split("\n").filter((line) => line.endsWith(", written"));
    expect(written.map((line) => line.slice(2).split(",")[0]).sort()).toEqual(["packages/search", "packages/shared-types", "packages/telemetry"]);
    expect(after).toContain("WRITTEN 3 docs written today.");
    expect(after.split("\n").filter((line) => line.startsWith("- packages/") || line.startsWith("- services/") || line.startsWith("- tools/"))).toHaveLength(16);
  });

  it("is said in the subhead too: the interface is generated, and a different one is asked for", () => {
    expect(built).toMatch(/Graview generates the interface, the rules\s+and an agent&rsquo;s tools from it/);
    expect(built).toContain("Want it different? Say so.");
    expect(built).toContain("The interface is generated.");
    expect(built).toContain("You never build the UI. You ask for the one you want.");
  });
});
