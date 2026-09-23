import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { seedbedApp } from "../../../../apps/seedbed/src/domain/app.js";
import { editDeclaration } from "../../../ship/src/source-edit.js";
import { createStudio, writeInPlace } from "../../src/index.js";

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
    const edge = [...studio.store.graph.nodesOfKind("edge" as never)].find((node) => node["label"] === "tended-by")!;
    studio.store.apply({ name: "remove-edge", args: { id: edge.id } }, as);
    studio.store.apply(
      {
        name: "add-edge",
        args: { kind: "declared:planting", label: "tended-by", to: "declared:gardener", description: "who looks after it", inverse: "what they look after" },
      },
      as,
    );
    const { changes, unwritten } = studio.sourceChanges();
    expect(changes).toContainEqual({ what: "move-edge", edge: "tended-by", from: "plot", to: "planting", targets: '["gardener"]' });
    // The act that makes the tie and the rule that judges it are code: said, not silently left behind.
    expect(unwritten.join(" ")).toContain('"tend"');
  });

  it("has nothing to say when nothing changed", () => {
    expect(createStudio(seedbedApp).sourceChanges()).toEqual({ changes: [], unwritten: [] });
  });
});

describe("Apply, through the dev server's studio door", () => {
  it("sends the change and reports what was written", async () => {
    const studio = createStudio(seedbedApp);
    studio.store.apply({ name: "add-field", args: { kind: "declared:gardener", label: "phone", type: "string", required: false } }, as);
    const sent: unknown[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (_path: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return { json: async () => ({ written: ["src/domain/schema.ts"], diff: [] }) };
    }) as never;
    try {
      expect(await writeInPlace(studio as never, null)).toEqual({ state: "written", paths: ["src/domain/schema.ts"] });
      expect(sent).toEqual([{ changes: studio.sourceChanges().changes }]);
    } finally {
      globalThis.fetch = real;
    }
  });

  it("writes nothing while any part of the change cannot be written in place, and says why", async () => {
    const studio = createStudio(seedbedApp);
    studio.store.apply({ name: "add-field", args: { kind: "declared:gardener", label: "phone", type: "string", required: false } }, as);
    const answer = await writeInPlace(studio as never, "plot tended-by edges go");
    expect(answer.state).toBe("not-written");
    expect(answer.state === "not-written" && answer.reasons.join(" ")).toContain("migration");
  });
});
