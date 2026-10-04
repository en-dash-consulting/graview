import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { seedbedApp } from "../../../../apps/seedbed/src/domain/app.js";
import { editDeclaration } from "../../../ship/src/source-edit.js";
import { declaredCode } from "../../../ship/src/source-edit.js";
import { codeTouched, createStudio, rewriteCode } from "../../src/index.js";

/**
 * WHAT THE STUDIO SENDS THE CHECKOUT is the change a person made, said the
 * way the source must receive it — and what it cannot say that way yet is
 * said as a reason, so nothing half-written ever reaches the files.
 */
const schemaPath = fileURLToPath(new URL("../../../../apps/seedbed/src/domain/schema.ts", import.meta.url));
const as = { author: { kind: "human" as const, id: "tester" } };

describe("the change, as the checkout's source receives it", () => {
  it("says a field added as one edit, which lands inside the kind's own z.object", async () => {
    const studio = createStudio(seedbedApp);
    studio.store.apply({ name: "add-field", args: { kind: "declared:gardener", label: "phone", type: "string", required: false } }, as);
    const { changes, unwritten } = studio.sourceChanges();
    expect(unwritten).toEqual([]);
    expect(changes).toEqual([{ what: "add-field", kind: "gardener", field: "phone", zod: "z.string().min(1).optional()" }]);

    const edited = editDeclaration(ts, [{ path: "src/domain/schema.ts", text: await readFile(schemaPath, "utf8") }], changes);
    expect(edited.ok && edited.files[0]!.text).toContain("fields: z.object({ label: z.string().min(1), phone: z.string().min(1).optional() }),");
  });

  it("reads an edge removed from one kind and declared on another as one relation moved", () => {
    const studio = createStudio(seedbedApp);
    const edge = [...studio.store.graph.nodesOfKind("edge")].find((node) => node["label"] === "tended-by")!;
    studio.store.apply({ name: "remove-edge", args: { id: edge.id } }, as);
    studio.store.apply(
      {
        name: "add-edge",
        args: { kind: "declared:planting", label: "tended-by", to: "declared:gardener", description: "who looks after it", inverse: "what they look after" },
      },
      as,
    );
    const { changes, rewrite, unwritten } = studio.sourceChanges();
    expect(changes).toContainEqual({ what: "move-edge", edge: "tended-by", from: "plot", to: "planting", targets: '["gardener"]' });
    // The act that makes the tie changed its declaration: it is named for rewriting, not left behind.
    expect(unwritten).toEqual([]);
    expect(rewrite.map((one) => one.name)).toContain("tend");
    // And the graph somebody already has is carried across: the caretakers move to the plantings.
    expect(changes).toContainEqual({
      what: "add-migration",
      version: 2,
      text: 'stepsMigration({ from: 1, to: 2, steps: [{ what: "move-edge", kind: "plot", edge: "tended-by", to: "planting" }] })',
      import: { name: "stepsMigration", from: "@graview/ship/browser" },
    });
  });

  it("judges a set of changes by what they make together", () => {
    const studio = createStudio(seedbedApp);
    const edge = [...studio.store.graph.nodesOfKind("edge")].find((node) => node["label"] === "tended-by")!;
    const remove = { name: "remove-edge", args: { id: edge.id } };
    const add = { name: "add-edge", args: { kind: "declared:planting", label: "tended-by", to: "declared:gardener" } };
    // Alone, taking the edge away leaves `tend` connecting something nobody declares.
    const alone = studio.would(remove);
    expect(alone.ok && alone.check.errors).toBeGreaterThan(0);
    // With its other half, it is whole.
    const together = studio.would([remove, add]);
    expect(together.ok && together.check.errors).toBe(0);
  });

  it("has nothing to say when nothing changed", () => {
    expect(createStudio(seedbedApp).sourceChanges()).toEqual({ changes: [], rewrite: [], unwritten: [] });
  });
});

describe("the code a change leaves saying something untrue", () => {
  const code = async () =>
    declaredCode(ts, [
      { path: "src/domain/mutations.ts", text: await readFile(fileURLToPath(new URL("../../../../apps/seedbed/src/domain/mutations.ts", import.meta.url)), "utf8") },
      { path: "src/domain/invariants.ts", text: await readFile(fileURLToPath(new URL("../../../../apps/seedbed/src/domain/invariants.ts", import.meta.url)), "utf8") },
    ]);

  it("finds every act and rule that mentions what moved, and no other", async () => {
    const touched = codeTouched([{ what: "move-edge", edge: "tended-by", from: "plot", to: "planting", targets: '["gardener"]' }], await code());
    expect(touched.map((one) => `${one.sort}:${one.name}`).sort()).toEqual(["act:tend", "rule:every-plot-tended"]);
    expect(touched[0]!.why).toContain('"tended-by" moved from plot to planting');
  });

  it("takes the seat's draft as the object it was asked for, whatever it was wrapped in", async () => {
    const drafted = await rewriteCode(
      async () => 'Here you go:\n```ts\n{\n  title: "Name a caretaker",\n  describe: (args) => `${args.label} {braces}`,\n}\n```\nHope that helps.',
      { sort: "act", name: "tend", why: "it moved", text: "{}", changes: [] },
    );
    expect(drafted).toBe('{\n  title: "Name a caretaker",\n  describe: (args) => `${args.label} {braces}`,\n}');
  });
});
