import { describe, expect, it } from "vitest";
import {
  bindSchema,
  createSchema,
  defineNode,
  FieldRevisions,
  markCollaborative,
  markdownField,
  refusalOf,
  Store,
  TYPE_TEXT,
  z,
  type AnySchema,
  type Policy,
  type Principal,
} from "../../src/index.js";
import "../../src/field-sight.js";
import { isCollaborativeField } from "../../src/typing.js";
import { compileDocument } from "../../src/check.js";
import { describeApp } from "../../src/cli/describe.js";

/**
 * COLLABORATIVE TEXT, PHASE 2: THE ACT AND ITS RULES (Roadmap f-collab-text).
 *
 * A field declared as prose is typed together: a keystroke is the built-in
 * `type-text` act, carried over whatever others typed since the revision
 * its sender read, and a whole value written over such a field — an edit,
 * an agent's rewrite — is merged into the text as a splice rather than
 * written over it. Undo takes back one person's typing and leaves the rest.
 */
const note = defineNode("note", {
  fields: z.object({
    title: z.string(),
    body: z.string().max(5000).optional(),
    memo: markdownField().optional(),
    code: markCollaborative(z.string().max(2000), false).optional(),
    secret: z.string().max(5000).optional(),
  }),
  plural: "Notes",
});
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const addNote = defineMutation("add-note", {
  title: "Add a note",
  creates: ["note"],
  input: z.object({ title: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.title, "note"), kind: "note", title: args.title });
  },
});
/** A declared act that writes one field: whoever may run it may type into that field, and no other. */
const setBody = defineMutation("set-body", {
  title: "Set the body",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["body"],
  input: z.object({ id: z.string(), body: z.string().max(5000) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { body: args.body });
  },
});

const ana: Principal = { kind: "human", id: "ana", roles: ["writer"] };
const ben: Principal = { kind: "human", id: "ben", roles: ["writer"] };
const agent: Principal = { kind: "agent", id: "drafter", roles: ["writer"] };
const reader: Principal = { kind: "human", id: "rae", roles: ["reader"] };
const editor: Principal = { kind: "human", id: "eve", roles: ["editor"] };
const policy: Policy = {
  roles: ["writer", "reader", "editor"],
  grants: [
    { roles: ["writer"], mutations: "*" },
    { roles: ["editor"], mutations: ["set-body"] },
  ],
  sees: [
    { roles: ["writer", "editor"], kinds: ["note"] },
    { roles: ["reader"], kinds: ["note"], hide: ["secret"] },
  ],
};

function store(fields: Record<string, unknown> = { body: "The quick fox" }): Store<AnySchema> {
  return new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    mutations: [addNote, setBody] as never,
    policy,
    snapshot: { nodes: [{ id: "note:one", kind: "note", title: "One", ...fields }], edges: [] } as never,
  });
}
const text = (s: Store<AnySchema>, field = "body") => (s.graph.getNode("note:one") as Record<string, unknown>)[field];
const rev = (s: Store<AnySchema>, field = "body") => FieldRevisions.of(s.log.all()).of("note:one", field);
const type = (s: Store<AnySchema>, author: Principal, args: { at: number; remove?: number; insert?: string; rev?: number; field?: string }) =>
  s.apply({ name: TYPE_TEXT, args: { node: "note:one", field: args.field ?? "body", at: args.at, remove: args.remove ?? 0, insert: args.insert ?? "", ...(args.rev !== undefined ? { rev: args.rev } : {}) } }, { author });

describe("text is typed together", () => {
  it("is decided by the declaration, never by the value: prose and Markdown are typed together, a short string and a field marked otherwise are not", () => {
    const shape = note.fields.shape;
    expect(isCollaborativeField(shape.body)).toBe(true);
    expect(isCollaborativeField(shape.memo)).toBe(true);
    expect(isCollaborativeField(shape.title)).toBe(false);
    expect(isCollaborativeField(shape.code)).toBe(false);
    expect(isCollaborativeField(markCollaborative(z.string()))).toBe(true);
    const s = store({});
    expect(s.collaborative("note:one", "body")).toBe(true);
    expect(s.collaborative("note:one", "title")).toBe(false);
  });

  it("types a keystroke as one splice, and no list of acts offers it", () => {
    const s = store();
    const previewed = s.previewAll([{ name: TYPE_TEXT, args: { node: "note:one", field: "body", at: 4, remove: 5, insert: "slow" } }], { author: ana });
    expect(previewed.primitives).toEqual([{ op: "splice-text", id: "note:one", field: "body", at: 4, removed: "quick", inserted: "slow" }]);
    expect(text(s)).toBe("The quick fox");
    const made = type(s, ana, { at: 4, remove: 5, insert: "slow" });
    expect(made.ops[0]!.primitives).toEqual([{ op: "splice-text", id: "note:one", field: "body", at: 4, removed: "quick", inserted: "slow" }]);
    expect(text(s)).toBe("The slow fox");
    expect(s.allMutations().map((one) => one.name)).not.toContain(TYPE_TEXT);
    expect(s.permittedMutations(ana).map((one) => one.name)).not.toContain(TYPE_TEXT);
  });

  it("carries a keystroke made against an older text over what others typed since, so both keep their words", () => {
    const s = store();
    const read = rev(s);
    type(s, ana, { at: 0, remove: 3, insert: "A", rev: read });
    type(s, ben, { at: 13, insert: " jumps", rev: read });
    expect(text(s)).toBe("A quick fox jumps");
  });

  it("an agent's whole write merges with concurrent typing (three-way)", () => {
    const s = store();
    const read = rev(s);
    // Ana types at the end while the agent rewrites the start from what it read.
    type(s, ana, { at: 13, insert: " ran", rev: read });
    s.apply({ name: "set-body", args: { id: "note:one", body: "A quick fox" } }, { author: agent, base: [{ node: "note:one", field: "body", rev: read }] });
    expect(text(s)).toBe("A quick fox ran");
    const written = s.log.all().at(-1)!.primitives;
    expect(written).toEqual([{ op: "splice-text", id: "note:one", field: "body", at: 0, removed: "The", inserted: "A" }]);
  });

  it("without a base, a whole write is diffed against the text now: the range it differs over is its own", () => {
    const s = store();
    type(s, ana, { at: 13, insert: " ran" });
    s.apply({ name: "set-body", args: { id: "note:one", body: "The quick cat ran" } }, { author: ben });
    expect(text(s)).toBe("The quick cat ran");
    expect(s.log.all().at(-1)!.primitives).toEqual([{ op: "splice-text", id: "note:one", field: "body", at: 10, removed: "fox", inserted: "cat" }]);
  });

  it("writes a whole value over a field that is not typed together as a patch, as before", () => {
    const s = store({ memo: "Notes" });
    s.apply({ name: "edit-note", args: { id: "note:one", title: "Two", memo: "Notes!" } }, { author: ana });
    const [patch, splice] = s.log.all().at(-1)!.primitives;
    expect(patch).toEqual({ op: "patch-node", id: "note:one", before: { title: "One" }, after: { title: "Two" } });
    expect(splice).toEqual({ op: "splice-text", id: "note:one", field: "memo", at: 5, removed: "", inserted: "!" });
  });

  it("first keystroke into an empty field is a patch, then splices", () => {
    const s = store({});
    type(s, ana, { at: 0, insert: "H" });
    type(s, ana, { at: 1, insert: "i" });
    const [first, second] = s.log.all().map((op) => op.primitives[0]);
    expect(first).toMatchObject({ op: "patch-node", id: "note:one", after: { body: "H" } });
    expect(second).toEqual({ op: "splice-text", id: "note:one", field: "body", at: 1, removed: "", inserted: "i" });
    expect(text(s)).toBe("Hi");
    // Into no text, a keystroke is the whole text wherever it said it was.
    const anywhere = store({});
    type(anywhere, ana, { at: 2, insert: "x" });
    expect(text(anywhere)).toBe("x");
  });

  it("undo out of order takes back only that person's run", () => {
    const s = store({ body: "Plan: " });
    const anas = [type(s, ana, { at: 6, insert: "water" }).batch, type(s, ana, { at: 11, insert: " beds" }).batch];
    type(s, ben, { at: 6, insert: "Ben: " });
    type(s, ben, { at: (text(s) as string).length, insert: "." });
    expect(text(s)).toBe("Plan: Ben: water beds.");
    expect(s.canUndo(anas).ok).toBe(true);
    const previewed = s.previewUndo(anas);
    expect(previewed.ok && previewed.primitives.map((one) => one.op)).toEqual(["splice-text", "splice-text"]);
    s.undo(anas, { author: ana });
    expect(text(s)).toBe("Plan: Ben: .");
    // Redo is the undo of the undo: Ana's words come back where they were, Ben's stay.
    s.undo(s.batches().at(-1)!.id, { author: ana });
    expect(text(s)).toBe("Plan: Ben: water beds.");
  });

  it("undoing typing somebody has since deleted part of takes back only what is left of it", () => {
    const s = store({ body: "" });
    const first = type(s, ana, { at: 0, insert: "abc" }).batch; // a patch: the first keystroke
    const mine = type(s, ana, { at: 3, insert: "XYZ" }).batch;
    type(s, ben, { at: 4, remove: 1 }); // Ben deletes the Y
    expect(text(s)).toBe("abcXZ");
    s.undo(mine, { author: ana });
    expect(text(s)).toBe("abc");
    // The first keystroke wrote the field whole: typing on top of it stands in its way.
    expect(s.canUndo(first).ok).toBe(false);
  });

  it("a later whole write or a removal still blocks an undo of typing", () => {
    const cleared = store();
    const typed = type(cleared, ana, { at: 13, insert: "!" }).batch;
    // Written whole by something that read nothing: an import, a host's own primitives.
    cleared.applyPrimitives([{ op: "patch-node", id: "note:one", before: { body: "The quick fox!" }, after: { body: undefined } }]);
    expect(cleared.canUndo(typed).ok).toBe(false);
    const removed = store();
    const mine = type(removed, ana, { at: 13, insert: "!" }).batch;
    removed.apply({ name: "remove-note", args: { id: "note:one" } }, { author: ben });
    expect(removed.canUndo(mine).ok).toBe(false);
  });

  it("refuses a splice over the field's max as invalid, and judges required on the text that results", () => {
    const s = store({ body: "x".repeat(4999) });
    expect(refusalOf(catching(() => type(s, ana, { at: 0, insert: "yy" })))).toMatchObject({ reason: "invalid" });
    expect(text(s)).toHaveLength(4999);
    const required = new Store<AnySchema>({
      schema: createSchema([defineNode("essay", { fields: z.object({ body: z.string().min(1).max(5000) }) })]) as unknown as AnySchema,
      snapshot: { nodes: [{ id: "essay:a", kind: "essay", body: "ab" }], edges: [] } as never,
    });
    expect(refusalOf(catching(() => required.apply({ name: TYPE_TEXT, args: { node: "essay:a", field: "body", at: 0, remove: 2, insert: "" } })))).toMatchObject({ reason: "invalid" });
    required.apply({ name: TYPE_TEXT, args: { node: "essay:a", field: "body", at: 0, remove: 1, insert: "" } });
    expect((required.graph.getNode("essay:a") as unknown as { body: string }).body).toBe("b");
  });

  it("a non-collaborative field refuses type-text", () => {
    const s = store({ code: "abc" });
    for (const field of ["title", "code", "nothing"]) {
      const refused = refusalOf(catching(() => type(s, ana, { field, at: 0, insert: "x" })));
      expect(refused).toMatchObject({ reason: "invalid" });
      expect(refused.sentence).toMatch(/not text typed together/);
    }
  });

  it("is permitted to whoever may write that field of that record, and to nobody else", () => {
    const s = store({ body: "The quick fox", memo: "Notes" });
    // Eve may run "Set the body", which writes the body and nothing else.
    type(s, editor, { at: 13, insert: "!" });
    expect(text(s)).toBe("The quick fox!");
    // Rae may run nothing that writes a note.
    expect(refusalOf(catching(() => type(s, reader, { at: 0, insert: "x" })))).toMatchObject({ reason: "forbidden" });
    expect(refusalOf(catching(() => type(s, reader, { field: "memo", at: 0, insert: "x" })))).toMatchObject({ reason: "forbidden" });
    expect(text(s)).toBe("The quick fox!");
  });

  it("a kept field is refused alike whatever it held", () => {
    const answers = [{ secret: "the code is 1234" }, { secret: "" }, {}].flatMap((held) =>
      [{ at: 0, insert: "x" }, { at: 7, remove: 2, insert: "" }].map((keystroke) => {
        const s = new Store<AnySchema>({
          schema: schema as unknown as AnySchema,
          mutations: [addNote, setBody] as never,
          policy: { ...policy, grants: [{ roles: "*", mutations: "*" }] },
          snapshot: { nodes: [{ id: "note:one", kind: "note", title: "One", ...held }], edges: [] } as never,
        });
        return JSON.stringify(refusalOf(catching(() => type(s, reader, { field: "secret", ...keystroke }))));
      }),
    );
    expect(new Set(answers).size).toBe(1);
    expect(answers[0]).toContain('does not take \\"secret\\"');
    expect(answers[0]).toContain('"reason":"invalid"');
  });
});

describe("a document field says whether it is typed together", () => {
  const doc = (fields: Record<string, unknown>) => ({
    format: "graview-document",
    formatVersion: 1,
    name: "Notes",
    kinds: { note: { label: "title", fields: { title: { type: "string", required: true }, ...fields } } },
  });

  it("a document field's collaborative key compiles and checks", () => {
    const compiled = compileDocument(doc({ body: { type: "text" }, short: { type: "string", collaborative: true }, plain: { type: "text", collaborative: false } }));
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const shape = (compiled.app.schema.tryDefinition("note") as unknown as { fields: { shape: Record<string, unknown> } }).fields.shape;
    expect(isCollaborativeField(shape["body"])).toBe(true);
    expect(isCollaborativeField(shape["short"])).toBe(true);
    expect(isCollaborativeField(shape["plain"])).toBe(false);
    expect(isCollaborativeField(shape["title"])).toBe(false);
    const findings = compileDocument(doc({ count: { type: "number", collaborative: true } })).findings;
    expect(findings.find((one) => one.code === "field-collaborative")).toMatchObject({ severity: "error", path: "kinds.note.fields.count.collaborative" });
    expect(compileDocument(doc({ body: { type: "text", collaborative: false } })).findings.filter((one) => one.code === "field-collaborative")).toEqual([]);
  });

  it("describe says which fields are typed together", () => {
    const compiled = compileDocument(doc({ body: { type: "text" }, plain: { type: "text", collaborative: false } }));
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const app = compiled.app;
    expect(describeApp(app)).toMatch(/note's body is typed together/i);
    expect(describeApp(app)).not.toMatch(/plain is typed together/);
  });
});

function catching(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected a refusal");
}
