import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { compileDocumentWithoutCheck } from "../../src/document/compile.js";
import { ActRefusal, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A DOCUMENT ACT CLEARS AN OPTIONAL FIELD WHEN ITS EFFECT SETS IT TO NULL
 * (Roadmap f-act-clears-optional-field). Unassigning, releasing and clearing
 * a date are ordinary: `"set": { "holder": null }` removes the value. A
 * required field cannot be cleared, and the refusal names the field.
 */
const lease = (acts: Record<string, unknown>) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Leases",
  description: "Who holds which piece of work.",
  kinds: {
    lease: {
      noun: "lease",
      plural: "leases",
      label: "{name}",
      description: "A hold on one piece of work.",
      fields: {
        name: { type: "string", required: true },
        holder: { type: "string" },
        expiresAt: { type: "datetime" },
      },
    },
  },
  acts,
});

const release = { title: "Release", on: "lease", effects: [{ set: { holder: null, expiresAt: null } }] };

function compiled(doc: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-11-08" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    snapshot: { nodes: [{ id: "lease-a", kind: "lease", name: "Build the page", holder: "worker-a", expiresAt: "2026-11-08T12:00:00.000Z" }], edges: [] } as never,
  });

describe("a document act clears an optional field when its effect sets it to null", () => {
  it("removes the value of each optional field its effect sets to null", () => {
    const store = storeOf(compiled(lease({ release })));
    store.apply({ name: "release", args: { id: "lease-a" } });
    const node = store.graph.getNode("lease-a") as Record<string, unknown>;
    expect(node["holder"]).toBeUndefined();
    expect(node["expiresAt"]).toBeUndefined();
    expect(Object.hasOwn(node, "holder")).toBe(false);
    expect(node["name"]).toBe("Build the page");
  });

  it("is taken back by an undo, the value it cleared restored", () => {
    const store = storeOf(compiled(lease({ release })));
    const result = store.apply({ name: "release", args: { id: "lease-a" } });
    store.undo(result.batch!);
    expect((store.graph.getNode("lease-a") as Record<string, unknown>)["holder"]).toBe("worker-a");
  });

  it("refuses a null set on a required field, in words that name the field", () => {
    // The checker refuses the act below (graview check, next); a page that compiles it without the checker still refuses the call.
    const unnamed = lease({ unname: { title: "Unname", on: "lease", effects: [{ set: { name: null } }] } });
    const result = compileDocument(unnamed, { today: () => "2026-11-08" });
    expect(result.ok).toBe(false);
    let error: unknown;
    try {
      const page = compileDocumentWithoutCheck(unnamed, { today: () => "2026-11-08" });
      if (!page.ok) throw new Error("the page compiles it");
      const store = storeOf(page.app as GraviewApp<AnySchema>);
      store.apply({ name: "unname", args: { id: "lease-a" } });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ActRefusal);
    expect((error as Error).message).toMatch(/Name/);
    expect((error as Error).message).toMatch(/Unname/);
  });
});

describe("graview check and a null set", () => {
  it("accepts a null set on an optional field", () => {
    const result = compileDocument(lease({ release }), { today: () => "2026-11-08" });
    expect(result.findings.filter((f) => f.code === "act-clears-required")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("flags one on a required field, at the effect's path, naming the field", () => {
    const result = compileDocument(lease({ unname: { title: "Unname", on: "lease", effects: [{ set: { name: null } }] } }), { today: () => "2026-11-08" });
    const found = result.findings.filter((f) => f.code === "act-clears-required");
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe("error");
    expect(found[0]!.path).toBe("acts.unname.effects.0.set.name");
    expect(found[0]!.message).toMatch(/name/);
  });

  it("flags one in a shorthand sets too", () => {
    const result = compileDocument(lease({ unname: { title: "Unname", on: "lease", sets: { name: null } } }), { today: () => "2026-11-08" });
    expect(result.findings.filter((f) => f.code === "act-clears-required").map((f) => f.path)).toEqual(["acts.unname.set.name"]);
  });
});
