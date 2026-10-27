import { bindSchema, createSchema, defineApp, defineNode, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { toDocument, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio, declarationFiles, declarationToGraph, graphToDeclaration, migrationBetween, migrationSteps, sourceChanges } from "../../src/index.js";
import { fieldTypeOf } from "../../src/from-declaration.js";

/**
 * A CHOICE OF SEVERAL ROUND-TRIPS THROUGH THE STUDIO (Roadmap
 * f-multi-select-enum, FR-233). A declaration's `z.array(z.enum([...]))` is
 * a field of the studio's graph that is an enum and `multiple`, written
 * back as the same zod and the same source; a field made to take several
 * in the studio (`set-multiple`) is a document whose field says so and a
 * migration that keeps each record's one option as a list of one.
 */
const memo = defineNode("memo", { fields: z.object({ label: z.string(), recipients: z.array(z.enum(["cto", "qa"])).optional(), status: z.enum(["draft", "sent"]) }) });
const schema = createSchema([memo]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-memo", {
  title: "Add a memo",
  creates: ["memo"],
  input: z.object({ label: z.string(), recipients: z.array(z.enum(["cto", "qa"])).optional() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "memo"), kind: "memo", label: args.label, status: "draft", ...(args.recipients ? { recipients: args.recipients } : {}) });
  },
});
const memos = defineApp({ name: "memos", schema, mutations: [add], version: 1 });

const document: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Memos",
  kinds: { memo: { fields: { title: { type: "string", required: true }, status: { type: "enum", options: ["draft", "sent"] } } } },
  acts: { "add-memo": { title: "Add a memo", creates: "memo" } },
} as GraviewDocument;

describe("a choice that takes several options, in the studio", () => {
  it("is read as an enum that is multiple, and written back as the same zod", () => {
    const seed = declarationToGraph(memos);
    const field = seed.nodes.find((node) => node.id === "field:memo.recipients") as Record<string, unknown>;
    expect(field).toMatchObject({ type: "enum", multiple: true, options: ["cto", "qa"], required: false });
    expect(seed.nodes.find((node) => node.id === "field:memo.status")).not.toHaveProperty("multiple");
    const declared = graphToDeclaration(seed, { base: memos, name: memos.name }) as GraviewApp<AnySchema>;
    const shape = (declared.schema.tryDefinition("memo")?.fields as { shape: Record<string, unknown> }).shape;
    expect(fieldTypeOf(shape["recipients"])).toEqual({ type: "enum", required: false, options: ["cto", "qa"], multiple: true });
    expect(migrationBetween(memos, declared)).toBeNull();
    // A field that was one option is made several: the source lists them.
    const after = { ...seed, nodes: seed.nodes.map((node) => (node.id === "field:memo.status" ? { ...node, multiple: true } : node)) };
    expect(declarationFiles(after, { base: memos }).map((file) => file.contents).join("\n")).toContain('z.array(z.enum(["draft", "sent"]))');
    expect(JSON.stringify(sourceChanges(seed, after, memos))).toContain("multiple: true");
    expect(migrationSteps(seed, after)).toContainEqual(expect.objectContaining({ what: "coerce-field", kind: "memo", field: "status", to: { type: "enum", options: ["draft", "sent"], multiple: true } }));
  });

  it("made to take several by set-multiple, is a document whose field says so; a field that is no enum is refused", () => {
    const compiled = compileDocument(document);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const studio = createStudio(compiled.app as never);
    studio.store.apply({ name: "set-multiple", args: { id: "field:memo.status", multiple: true } } as never);
    const applied = studio.apply();
    if (!applied.ok) throw new Error(JSON.stringify(applied.check.findings));
    const written = toDocument(applied.app as never).document;
    expect(written.kinds["memo"]!.fields["status"]).toMatchObject({ type: "enum", multiple: true, options: ["draft", "sent"] });
    expect(() => studio.store.apply({ name: "set-multiple", args: { id: "field:memo.title", multiple: true } } as never)).toThrow(/only a choice/);
  });
});
