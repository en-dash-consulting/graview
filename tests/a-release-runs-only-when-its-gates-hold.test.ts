import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module of the scripts, with no declarations.
import { compatibilityOf, decide, firstSentence, newer, nightlyOnTree, scaffoldRecord, UNWRITTEN, withRecord } from "../scripts/lib/release.mjs";

/**
 * A RELEASE RUNS ONLY WHEN ITS GATES HOLD. A batch carries its own release
 * (`pnpm release:prepare`), and a push to main publishes it with no Version
 * packages pull request between: so what decides a publish is what this
 * holds. A changeset pending on main still opens a Version packages pull
 * request, so nothing merged outside a batch is stranded; a version npm
 * lacks is published only when a green Nightly ran on the tree main has;
 * and the publish itself still waits for the npm environment's approval.
 */
const root = resolve(import.meta.dirname, "..");
const REPO = "en-dash-consulting/graview";
const TREE = "a".repeat(40);
type Run = { id: number; url: string; event: string; conclusion: string | null; repository: string; headSha: string; tree: string };
const green = (over: Partial<Run> = {}): Run => ({
  id: 1,
  url: "https://github.com/en-dash-consulting/graview/actions/runs/1",
  event: "workflow_dispatch",
  conclusion: "success",
  repository: REPO,
  headSha: "b".repeat(40),
  tree: TREE,
  ...over,
});
const fourteen = (version: string) => Array.from({ length: 14 }, () => version);

describe("which path a push to main takes", () => {
  it("opens the Version packages pull request while a changeset is pending, and publishes nothing", () => {
    const decision = decide({ versions: fourteen("0.2.4"), pending: ["a-fix.md"], unpublished: ["graview"], nightly: green() });
    expect(decision.path).toBe("version-pr");
  });

  it("does nothing when nothing is pending and npm has every package", () => {
    expect(decide({ versions: fourteen("0.2.4"), pending: [], unpublished: [], nightly: null }).path).toBe("nothing");
  });

  it("publishes a version npm lacks when a green Nightly ran on this tree", () => {
    const decision = decide({ versions: fourteen("0.2.5"), pending: [], unpublished: ["graview", "@graview/core"], nightly: green() });
    expect(decision).toMatchObject({ path: "publish", version: "0.2.5" });
  });

  it("publishes what a partial publish left, since one package npm lacks is enough", () => {
    expect(decide({ versions: fourteen("0.2.5"), pending: [], unpublished: ["@graview/skills"], nightly: green() }).path).toBe("publish");
  });

  it("is blocked without a green Nightly on this tree, and says to dispatch one on main", () => {
    const decision = decide({ versions: fourteen("0.2.5"), pending: [], unpublished: ["graview"], nightly: null });
    expect(decision.path).toBe("blocked");
    expect(decision.reason).toContain("Dispatch Nightly on main");
    expect(decision.reason).toContain("gh workflow run nightly.yml --ref main");
  });

  it("never publishes a version older than npm's latest, as a stale run re-run after a newer release would", () => {
    const facts = { versions: fourteen("0.2.5"), pending: [], unpublished: ["@graview/skills"], nightly: green() };
    expect(decide({ ...facts, latest: "0.2.6" }).path).toBe("stale");
    expect(decide({ ...facts, latest: "0.10.0" }).path).toBe("stale");
    expect(decide({ ...facts, latest: "0.2.5" }).path).toBe("publish");
    expect(decide({ ...facts, latest: "0.2.4" }).path).toBe("publish");
    expect(newer("0.10.0", "0.9.9")).toBe(true);
    expect(newer("0.2.5", "0.2.5")).toBe(false);
  });

  it("refuses packages that do not share one version, whatever else holds", () => {
    const versions = [...fourteen("0.2.5").slice(1), "0.2.4"];
    expect(decide({ versions, pending: [], unpublished: ["graview"], nightly: green() }).path).toBe("broken");
    expect(decide({ versions, pending: ["a.md"], unpublished: [], nightly: null }).path).toBe("broken");
  });
});

describe("the Nightly that stands for a tree", () => {
  it("is a green run on the same tree, though on another commit: a batch's run counts for the merge of it", () => {
    expect(nightlyOnTree(TREE, [green({ headSha: "c".repeat(40) })], REPO)?.headSha).toBe("c".repeat(40));
  });

  it("is never a run on another tree, a red one or one still running", () => {
    expect(nightlyOnTree(TREE, [green({ tree: "d".repeat(40) })], REPO)).toBeNull();
    expect(nightlyOnTree(TREE, [green({ conclusion: "failure" })], REPO)).toBeNull();
    expect(nightlyOnTree(TREE, [green({ conclusion: null })], REPO)).toBeNull();
  });

  it("is only one this repository's schedule or its people started, never a pull request's or a fork's", () => {
    expect(nightlyOnTree(TREE, [green({ event: "pull_request" })], REPO)).toBeNull();
    expect(nightlyOnTree(TREE, [green({ event: "pull_request_target" })], REPO)).toBeNull();
    expect(nightlyOnTree(TREE, [green({ repository: "someone/graview" })], REPO)).toBeNull();
    expect(nightlyOnTree(TREE, [green({ event: "schedule" })], REPO)).not.toBeNull();
  });

  it("is the newest that matches, and none for an empty tree", () => {
    const runs = [green({ id: 3, tree: "e".repeat(40) }), green({ id: 2 }), green({ id: 1 })];
    expect(nightlyOnTree(TREE, runs, REPO)?.id).toBe(2);
    expect(nightlyOnTree("", runs, REPO)).toBeNull();
  });
});

describe("the release record a batch scaffolds", () => {
  const changesets = [
    {
      name: "a-host-can-end-a-binding.md",
      text: '---\n"@graview/core": patch\n---\n\nA host can end a person\'s binding. More words follow.\n\nCompatibility: the JavaScript API is additive (`unbindPerson`).\n',
    },
    {
      name: "a-rename.md",
      text: '---\n"@graview/pages": patch\n---\n\nThe gutter variable is renamed, e.g. in a view.\n\nCompatibility: breaks a view that reads `--graview-page-gutter`.\n',
    },
  ];
  const record = scaffoldRecord("0.2.5", changesets, "2026-11-15");

  it("says each changeset's first sentence and leads its compatibility with what breaks", () => {
    expect(record.summary).toBe("- A host can end a person's binding.\n- The gutter variable is renamed, e.g. in a view.");
    const compat = record.compatibility as string;
    expect(compat.indexOf("breaks a view")).toBeLessThan(compat.indexOf("additive"));
    expect(record).toMatchObject({ version: "0.2.5", date: "2026-11-15", published: true });
  });

  it("says it is unwritten in its headline and compatibility, which the releases test refuses", () => {
    expect(record.headline).toContain(UNWRITTEN);
    expect(record.compatibility).toContain(UNWRITTEN);
    const test = readFileSync(resolve(root, "tests/the-releases-page-says-what-each-version-brought.test.ts"), "utf8");
    expect(test).toContain(`"${UNWRITTEN}"`);
  });

  it("keeps a record a person already wrote, and otherwise goes first", () => {
    const written = { version: "0.2.5", headline: "Written.", summary: "- Written.", published: true };
    expect(withRecord([written], record)).toEqual({ records: [written], added: false });
    expect(withRecord([{ version: "0.2.4" }], record).records.map((one: { version: string }) => one.version)).toEqual(["0.2.5", "0.2.4"]);
  });

  it("reads a changeset's line and sentence as the changesets write them", () => {
    expect(compatibilityOf("Body.\n\nCompatibility: unchanged.")).toBe("unchanged.");
    expect(compatibilityOf("Body.")).toBeNull();
    expect(firstSentence("Security and reliability fixes. A declared act may no longer…")).toBe("Security and reliability fixes.");
  });
});

describe("the release workflow", () => {
  const workflow = readFileSync(resolve(root, ".github/workflows/release.yml"), "utf8");
  const publish = workflow.slice(workflow.indexOf("\n  publish:"));
  const version = workflow.slice(workflow.indexOf("\n  version:"), workflow.indexOf("\n  publish:"));

  it("publishes only on the publish path, in the npm environment, asking the gate before anything is installed", () => {
    expect(publish).toContain("if: needs.version.outputs.path == 'publish'");
    expect(publish).toContain("environment: npm");
    expect(publish.indexOf("release-state.mjs --gate")).toBeGreaterThan(0);
    expect(publish.indexOf("release-state.mjs --gate")).toBeLessThan(publish.indexOf("release-publish.mjs"));
    expect(publish.indexOf("release-state.mjs --gate")).toBeLessThan(publish.indexOf("pnpm install"));
  });

  it("holds the OIDC token to the publish job alone, and runs only on a push to main", () => {
    expect(publish).toContain("id-token: write");
    expect(version).not.toContain("id-token");
    expect(workflow).toMatch(/on:\n {2}push:\n {4}branches: \[main\]\n\n/);
  });
});
