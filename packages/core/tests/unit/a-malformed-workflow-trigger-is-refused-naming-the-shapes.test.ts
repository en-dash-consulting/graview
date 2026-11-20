import { describe, expect, it } from "vitest";
import type { GraviewDocument } from "../../src/document/schema.js";
import { documentWorkflowFindings } from "../../src/workflows.js";

/*
 * A MALFORMED TRIGGER IS REFUSED NAMING THE SHAPES (Roadmap
 * f-authoring-schemas-args-workflows). An agent writing its first
 * workflow said `"when": [{}]` and was told only "Invalid input": a
 * union's refusal names none of its branches. A trigger the checker cannot
 * read is now refused by saying what a trigger is, and one that names a
 * trigger and gets it wrong is told what is wrong with that one.
 */
const withWhen = (when: unknown) =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Home",
    kinds: { chore: { label: "{name}", fields: { name: { type: "string", required: true } } } },
    acts: { "add-chore": { title: "Add a chore", creates: "chore" } },
    workflows: { weekly: { title: "Add the weekly chore", when, steps: [{ act: "add-chore", args: { name: "Sweep" } }] } },
  }) as unknown as GraviewDocument;

const shapeFindings = (when: unknown) => documentWorkflowFindings(withWhen(when)).filter((finding) => finding.code === "workflow-shape");

describe("a workflow's trigger", () => {
  it("with nothing in it is refused naming every shape a trigger takes, never 'Invalid input'", () => {
    const [finding] = shapeFindings([{}]);
    expect(finding?.path).toBe("workflows.weekly.when.0");
    expect(finding?.message).not.toMatch(/Invalid input/);
    for (const shape of ['"every"', '"cron"', '"made"', '"changed"', '"synced"', '"byHand"']) expect(finding?.message).toContain(shape);
    expect(finding?.fix).toMatch(/\{ "every": "sunday 18:00" \}/);
  });

  it("naming a key no trigger has is refused naming the shapes too", () => {
    const [finding] = shapeFindings([{ at: "monday" }]);
    expect(finding?.message).not.toMatch(/Invalid input/);
    expect(finding?.message).toContain('"every"');
  });

  it("naming a trigger and getting it wrong is told what is wrong with that one", () => {
    const [finding] = shapeFindings([{ made: "Chore" }]);
    expect(finding?.path).toBe("workflows.weekly.when.0.made");
    expect(finding?.message).toMatch(/kebab-case/);
  });

  it("said soundly has nothing to say", () => {
    expect(shapeFindings([{ every: "sunday 18:00" }])).toEqual([]);
  });
});
