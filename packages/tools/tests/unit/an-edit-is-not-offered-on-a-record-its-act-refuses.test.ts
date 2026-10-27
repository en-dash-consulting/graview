import { describe, expect, it } from "vitest";
import { ActRefusal, bindSchema, createSchema, defineNode, Store, z, type AnySchema } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import type { GraviewApp } from "@graview/core";
import { editableFields } from "../../src/edit.js";

/**
 * AN EDIT IS NOT OFFERED ON A RECORD ITS ACT REFUSES. The field a record
 * offers to change in place is changed through an act that writes it, and
 * a keystroke into it rides the same act: where that act would refuse the
 * record now — its `allowedWhen`, its `allowedOn`, or the `ActRefusal` its
 * `apply` throws for a published note — the store refuses the edit and
 * the typing alike, so nothing offers it.
 */
const note = defineNode("note", {
  fields: z.object({ title: z.string(), published: z.boolean().optional(), body: z.string().max(5000).optional() }),
  plural: "Notes",
});
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const revise = defineMutation("revise", {
  title: "Revise",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["body"],
  input: z.object({ id: z.string(), body: z.string().max(5000) }),
  apply(ctx, args) {
    if (ctx.graph.getNode(args.id)?.published === true) throw new ActRefusal("A published note can't be edited");
    ctx.patchNode(args.id, { body: args.body });
  },
});
const offered = (store: Store<AnySchema>, id: string) => editableFields(store, id).map((field) => `${field.mutation}:${field.field}`);

describe("the fields a record offers to change in place", () => {
  it("leave out a field whose TypeScript act refuses the record, and keep it where the act would run", () => {
    const store = new Store<AnySchema>({
      schema: schema as never,
      mutations: [revise] as never,
      snapshot: {
        nodes: [
          { id: "note:locked", kind: "note", title: "Locked", published: true, body: "Kept" },
          { id: "note:open", kind: "note", title: "Open", body: "Kept" },
        ],
        edges: [],
      } as never,
    });
    expect(offered(store, "note:locked")).not.toContain("revise:body");
    expect(offered(store, "note:open")).toContain("revise:body");
  });

  it("leave out a field whose document act's condition does not hold for the record", () => {
    const compiled = compileDocument({
      format: "graview-document",
      formatVersion: 1,
      name: "Posts",
      kinds: { post: { label: "{title}", fields: { title: { type: "string", required: true }, status: { type: "enum", options: ["draft", "published"], required: true }, body: { type: "text" } } } },
      acts: { revise: { title: "Revise", on: "post", writes: ["body"], allowedWhen: "status == 'draft'" } },
    });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
    const app = compiled.app as GraviewApp<AnySchema>;
    const store = new Store<AnySchema>({
      schema: app.schema,
      mutations: (app.mutations ?? []) as never,
      snapshot: {
        nodes: [
          { id: "post:draft", kind: "post", title: "Draft", status: "draft", body: "Kept" },
          { id: "post:out", kind: "post", title: "Out", status: "published", body: "Kept" },
        ],
        edges: [],
      } as never,
    });
    expect(offered(store, "post:out")).not.toContain("revise:body");
    expect(offered(store, "post:draft")).toContain("revise:body");
  });
});
