import { describe, expect, it } from "vitest";
import { countSteps, primitivesForSteps, sayStep, type MigrationStep } from "../../src/index.js";
import { applyToSnapshot } from "../../src/snapshot.js";

/** FR-22: a renamed field keeps every value; a retyped one keeps what converts and counts what it cannot. */
const stored = {
  nodes: [
    { id: "a", kind: "vendor", label: "Bloom", quote: "2,400", notes: "call back" },
    { id: "b", kind: "vendor", label: "Petal", quote: "1800", notes: "nice" },
    { id: "c", kind: "vendor", label: "Sad Cakes", quote: "ask later" },
    { id: "f", kind: "category", label: "Florist" },
  ],
  edges: [{ kind: "fills", from: "a", to: "f" }, { kind: "fills", from: "b", to: "f" }],
};

describe("migrations that keep data", () => {
  it("a renamed field keeps every value, and the migration's words say renamed", () => {
    const steps: MigrationStep[] = [{ what: "rename-field", kind: "vendor", field: "notes", to: "remarks" }];
    const after = applyToSnapshot(stored, primitivesForSteps(steps, stored));
    expect(after.nodes.find((node) => node.id === "a")).toMatchObject({ remarks: "call back" });
    expect(after.nodes.find((node) => node.id === "a")).not.toHaveProperty("notes");
    expect(after.nodes.find((node) => node.id === "b")).toMatchObject({ remarks: "nice" });
    expect(sayStep(steps[0]!)).toMatch(/renamed remarks, its values kept/);
    expect(countSteps(steps, stored)[0]).toMatchObject({ moved: 2, cleared: 0 });
  });

  it("a text→number coercion keeps the values that parse and counts the ones it clears", () => {
    const steps: MigrationStep[] = [{ what: "coerce-field", kind: "vendor", field: "quote", from: "string", to: { type: "number" } }];
    const after = applyToSnapshot(stored, primitivesForSteps(steps, stored));
    expect(after.nodes.find((node) => node.id === "a")).toMatchObject({ quote: 2400 });
    expect(after.nodes.find((node) => node.id === "b")).toMatchObject({ quote: 1800 });
    expect(after.nodes.find((node) => node.id === "c")).not.toHaveProperty("quote");
    expect(countSteps(steps, stored)[0]).toMatchObject({ converted: 2, cleared: 1 });
  });

  it("a renamed relation keeps every link", () => {
    const steps: MigrationStep[] = [{ what: "rename-edge", edge: "fills", to: "covers" }];
    const after = applyToSnapshot(stored, primitivesForSteps(steps, stored));
    expect(after.edges.map((edge) => edge.kind)).toEqual(["covers", "covers"]);
    expect(countSteps(steps, stored)[0]).toMatchObject({ moved: 2, removed: 0 });
  });
});
