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
 * WHAT GRAVIEW.DEV ASKED FOR, IT GOT.
 *
 * Graview.dev's front page used to end its hero on a departures board asked
 * of the docs recipe, and reshape a kids' soccer season three ways under it.
 * The home that replaced it (look behind the screen) draws its story on one
 * canvas and replays none of them, so what this held about the page is
 * retired with that page. What it holds about the recordings themselves
 * (apps/site/asks/turns.json, still bundled into docs/site/chapters.js)
 * stays true and stays held: each is a worker view the view host would take,
 * runs headless over its app's records, and draws what its ask said, the
 * season's one rule showing through every view and the docs the repair
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

/** The three modules the docs seed leaves with no doc, and the guide the repair writes for each. */
const GUIDES = [
  { module: "module-packages-search", id: "doc:guide-search", title: "Search", path: "docs/guides/search.md" },
  { module: "module-packages-shared-types", id: "doc:guide-shared-types", title: "Shared types", path: "docs/guides/shared-types.md" },
  { module: "module-packages-telemetry", id: "doc:guide-telemetry", title: "Telemetry", path: "docs/guides/telemetry.md" },
];
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
  it("are recorded once each, the board's and the season's, each with the words it was asked", () => {
    expect(turns.map((one) => one.name)).toEqual(["departures", "remaining-games", "courier"]);
    for (const one of turns) expect(one.ask.length, one.name).toBeGreaterThan(20);
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

describe("the docs recipe's board", () => {
  it("repairs the modules its seed leaves with no doc", () => {
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

});
