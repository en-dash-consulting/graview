import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { describePlace } from "../../src/describe.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * A COVERAGE GRID IS SAID AT ABOUT THE COST OF ITS LINKS (FR-112).
 *
 * `describePlace` reads a coverage grid over a path itself, and it read it
 * in time that grew with the square of the grid: each step's adjacency was
 * rebuilt by copying a record's whole list of neighbours for every link it
 * had, and every row and every column searched every filled crossing. One
 * skill everybody is strong at is a single record with ten thousand links —
 * a normal org's "Communication" — and it took seconds to say. The lens
 * itself had already been fixed for exactly this (it pushes onto the list);
 * the words now read it the same way.
 *
 * Measured as a ratio, so a slow runner moves both sides: four times the
 * people should take about four times as long, never sixteen.
 */
const document = JSON.parse(readFileSync(new URL("./fixtures/org-strengths.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(document, { today: () => "2026-10-06" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

/** An org of `people`, every one strong at the one skill. */
function org(people: number): Store<AnySchema> {
  const nodes: Record<string, unknown>[] = [{ id: "s-communication", kind: "skill", label: "Communication" }];
  const edges: { kind: string; from: string; to: string }[] = [];
  for (let p = 0; p < people; p++) {
    nodes.push({ id: `p${p}`, kind: "person", label: `Person ${p}` }, { id: `st${p}`, kind: "strength", label: `Strength ${p}`, level: 3 });
    edges.push({ kind: "has", from: `p${p}`, to: `st${p}` }, { kind: "inSkill", from: `st${p}`, to: "s-communication" });
  }
  return new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes, edges } as never });
}

function timed(store: Store<AnySchema>): number {
  let best = Number.POSITIVE_INFINITY;
  for (let run = 0; run < 2; run++) {
    const started = performance.now();
    const result = describePlace(store, owner, "strengths", { app, width: 1440, today: "2026-10-06" });
    best = Math.min(best, performance.now() - started);
    if (!result.ok) throw new Error(result.error);
  }
  return best;
}

describe("a coverage grid over a path, described at scale", () => {
  it("takes about four times as long for four times the people, not sixteen", () => {
    const small = timed(org(2_000));
    const large = timed(org(8_000));
    expect(large / small).toBeLessThan(8);
  }, 120_000);

  it("still says every one of them", () => {
    const result = describePlace(org(3), owner, "strengths", { app, width: 1440, today: "2026-10-06" });
    if (!result.ok) throw new Error(result.error);
    expect(result.description.text).toContain("Person 2: Communication (Strength 2, level 3)");
    expect(result.description.text).toContain("Communication (3)");
  });
});
