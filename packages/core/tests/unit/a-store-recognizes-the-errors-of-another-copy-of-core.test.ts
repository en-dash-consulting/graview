import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ExprEvalError } from "../../src/document/expr/evaluate.js";
import { ActRefusal, GraphError, InvalidArguments, MissingRecordError, PermissionDeniedError, refusalOf, SchemaError, Store, createSchema, defineNode } from "../../src/index.js";

/**
 * A STORE RECOGNIZES THE ERRORS OF ANOTHER COPY OF CORE (Roadmap
 * f-light-composer). Graview Cloud lends its owner and editor pages a
 * composer bundled apart from the shell, and the app it composed carried
 * that bundle's own `@graview/core`: the shell's store rehearsed a plan over
 * a schema whose `SchemaError` was not the shell's, so a record of a kind the
 * schema lacks was read as a field that did not fit, and an act's refusal
 * as an invalid call. The errors the store and `refusalOf` read are known
 * by what they are, from whichever copy made them.
 */
async function anotherCopy(): Promise<typeof import("../../src/index.js")> {
  vi.resetModules();
  const copy = await import("../../src/index.js");
  vi.resetModules();
  return copy;
}

describe("the errors of another copy of core", () => {
  it("are a separate copy's classes, so the test means what it says", async () => {
    const twin = await anotherCopy();
    expect(twin.SchemaError).not.toBe(SchemaError);
  });

  it("are known by this copy's instanceof: a schema error, a missing record, an act's arguments refused, a rule that could not be read, a refusal", async () => {
    const twin = await anotherCopy();
    expect(new twin.SchemaError("no such kind")).toBeInstanceOf(SchemaError);
    const missing = new twin.MissingRecordError("t1", "That record is not there to change.");
    expect(missing).toBeInstanceOf(MissingRecordError);
    expect(missing).toBeInstanceOf(GraphError);
    expect(new twin.ActRefusal("Not on a Sunday.")).toBeInstanceOf(ActRefusal);
    const invalid = new twin.InvalidArguments("finish", [{ path: ["taskId"], message: "Required" }]);
    expect(invalid).toBeInstanceOf(InvalidArguments);
    expect(invalid).toBeInstanceOf(GraphError);
    expect(invalid).not.toBeInstanceOf(MissingRecordError);
    vi.resetModules();
    const twinRules = await import("../../src/document/expr/evaluate.js");
    vi.resetModules();
    expect(twinRules.ExprEvalError).not.toBe(ExprEvalError);
    expect(new twinRules.ExprEvalError("no such field", 0)).toBeInstanceOf(ExprEvalError);
    expect(refusalOf(missing).reason).toBe("missing");
    expect(refusalOf(new twin.ActRefusal("Not on a Sunday."))).toEqual({ reason: "refused", sentence: "Not on a Sunday." });
  });

  it("are not taken for one another: a graph error is no missing record, a schema error no graph error", async () => {
    const twin = await anotherCopy();
    expect(new twin.GraphError("a slip")).not.toBeInstanceOf(MissingRecordError);
    expect(new twin.SchemaError("no such kind")).not.toBeInstanceOf(GraphError);
    expect(new twin.SchemaError("no such kind")).not.toBeInstanceOf(PermissionDeniedError);
    expect(new Error("plain")).not.toBeInstanceOf(SchemaError);
    expect({ name: "SchemaError", message: "lookalike" }).not.toBeInstanceOf(SchemaError);
  });

  it("let this copy's store refuse a record of a kind the other copy's schema lacks with the schema's own error", async () => {
    const twin = await anotherCopy();
    const task = twin.defineNode("task", { fields: z.object({ label: z.string() }), label: (node) => node.label });
    const store = new Store({ schema: twin.createSchema([task]) as never, mutations: [] });
    let thrown: unknown;
    try {
      store.graph.preview([{ op: "add-node", node: { id: "p1", kind: "person", label: "Ada" } } as never]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SchemaError);
    // And the same store over this copy's schema says the same.
    const own = new Store({ schema: createSchema([defineNode("task", { fields: z.object({ label: z.string() }), label: (node) => node.label })]), mutations: [] });
    expect(() => own.graph.preview([{ op: "add-node", node: { id: "p1", kind: "person", label: "Ada" } } as never])).toThrow(SchemaError);
  });
});
