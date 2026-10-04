import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { argShape, defineNode, descriptionOf, formFields, mutationToolSchema, nodeRef, nodeRefArgs, z } from "../../src/index.js";
import { compileDocument, readDocument } from "../../src/document/index.js";

/**
 * A COMPILED DOCUMENT IS READ LIKE A DECLARED ONE. The framework builds a
 * document's schemas in zod/mini, so a page that compiles one in the browser
 * does not carry classic zod whole; a product's own declaration is classic.
 * Everything that reads a schema — forms, the tool surface, node references,
 * descriptions, the document's findings — reads both the same.
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument({
  ...vendors,
  kinds: { ...vendors.kinds, vendor: { ...vendors.kinds.vendor, fields: { ...vendors.kinds.vendor.fields, seats: { type: "integer", description: "how many it seats" } } } },
});
if (!compiled.ok) throw new Error("the vendors fixture should compile");
const { app } = compiled;
const vendor = app.schema.definition("vendor");
const act = (name: string) => app.mutations!.find((one) => one.name === name)!;

describe("a compiled document", () => {
  it("is built without classic zod's methods, and parses as classic did", () => {
    const quote = vendor.fields.shape["quote"] as unknown as Record<string, unknown>;
    expect(typeof quote["optional"]).toBe("undefined");
    expect(vendor.fields.safeParse({ name: "Bloom", status: "booked" }).success).toBe(true);
    expect(vendor.fields.safeParse({ name: "Bloom", status: "eloped" }).success).toBe(false);
    expect(vendor.fields.safeParse({ name: "Bloom", status: "booked", seats: 1.5 }).success).toBe(false);
  });

  it("says what a field is for, as a classic `.describe()` says it", () => {
    const due = vendor.fields.shape["due"];
    expect(descriptionOf((due as unknown as { _zod: { def: { innerType: unknown } } })._zod.def.innerType)).toBe("when they need an answer");
    expect(descriptionOf(z.string().describe("said classically"))).toBe("said classically");
  });

  it("asks for an integer, a date and a choice as a declared kind's would be asked for", () => {
    const declared = defineNode("vendor", { fields: z.object({ status: z.enum(["researching", "contacted", "booked", "declined"]), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), seats: z.number().int().optional() }) });
    for (const field of ["status", "due", "seats"]) expect(argShape(vendor.fields, field)).toEqual(argShape(declared.fields, field));
    expect(formFields(act("set-quote").input).map((field) => field.control)).toEqual(["node", "number"]);
  });

  it("names the records an act takes, as `nodeRef` does", () => {
    expect(nodeRefArgs(act("file-under").input)).toEqual([
      { name: "id", kinds: ["vendor"], optional: false },
      { name: "to", kinds: ["category"], optional: false },
    ]);
    expect(nodeRefArgs(z.object({ who: nodeRef(["person"]).optional() }))).toEqual([{ name: "who", kinds: ["person"], optional: true }]);
  });

  it("gives an agent the tool schema it always gave", () => {
    const tool = mutationToolSchema(act("set-quote"));
    expect(tool.inputSchema).toMatchObject({ type: "object", properties: { id: { type: "string", minLength: 1 }, quote: { type: "number" } }, required: ["id", "quote"] });
    expect(tool.nodeRefs).toEqual([{ name: "id", kinds: ["vendor"], optional: false }]);
  });

  it("is refused in English sentences, as it was when the document format was classic", () => {
    const read = readDocument({ ...vendors, name: "", kinds: { ...vendors.kinds, vendor: { ...vendors.kinds.vendor, noun: "x".repeat(41) } } });
    expect(read.findings.map((finding) => finding.message)).toEqual(
      expect.arrayContaining(["Too small: expected string to have >=1 characters", "Too big: expected string to have <=40 characters"]),
    );
  });
});
