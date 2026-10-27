import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import "../../src/typing.js";
import { ActRefusal, bindSchema, createSchema, defineNode, refusalOf, Store, TYPE_TEXT, z, type AnySchema, type GraviewApp, type Policy, type Principal } from "../../src/index.js";

/**
 * A KEYSTROKE RIDES A TYPESCRIPT ACT ONLY WHERE THE ACT WOULD RUN.
 *
 * Typing into a field is permitted to whoever may run an act that writes it,
 * and only while that act could run on the record now. A document act says
 * so with its condition (`allowedWhen`); a TypeScript act's rule lives in its
 * `apply`, which throws `ActRefusal` — "a published note can't be edited".
 * Nothing asked it, so a seat refused "Revise" on a published note typed the
 * body over all the same. The act is asked now: run on the record, with the
 * field's own value, written nowhere.
 */
const note = defineNode("note", {
  fields: z.object({
    title: z.string(),
    published: z.boolean().optional(),
    body: z.string().max(5000).optional(),
  }),
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
/** A body the act refuses for what it says, not for the record: never a reason to keep typing out. */
const amend = defineMutation("amend", {
  title: "Amend",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["body"],
  input: z.object({ id: z.string(), body: z.string().max(5000) }),
  apply(ctx, args) {
    if (args.body === ctx.graph.getNode(args.id)?.body) throw new ActRefusal("Nothing to change", "invalid");
    ctx.patchNode(args.id, { body: args.body });
  },
});
/** The same rule said as `allowedOn`: believed, and the act not run. */
const redraft = defineMutation("redraft", {
  title: "Redraft",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["body"],
  input: z.object({ id: z.string(), body: z.string().max(5000) }),
  allowedOn: (graph, id) => graph.getNode(id)?.published !== true,
  apply() {
    throw new Error("never run to judge a keystroke");
  },
});

const policy: Policy = {
  roles: ["writer", "amender", "redrafter"],
  grants: [
    { roles: ["writer"], mutations: ["revise"] },
    { roles: ["amender"], mutations: ["amend"] },
    { roles: ["redrafter"], mutations: ["redraft"] },
  ],
};
const writer: Principal = { kind: "human", id: "wes", roles: ["writer"] };
const amender: Principal = { kind: "human", id: "amy", roles: ["amender"] };
const redrafter: Principal = { kind: "human", id: "red", roles: ["redrafter"] };

function make(): Store<AnySchema> {
  return new Store<AnySchema>({
    schema: schema as never,
    mutations: [revise, amend, redraft] as never,
    policy,
    snapshot: {
      nodes: [
        { id: "note:locked", kind: "note", title: "Locked", published: true, body: "Kept as it was" },
        { id: "note:open", kind: "note", title: "Open", body: "Kept as it was" },
        { id: "note:empty", kind: "note", title: "Empty" },
      ],
      edges: [],
    } as never,
  });
}
const keystroke = (node: string, remove = 14) => ({ name: TYPE_TEXT, args: { node, field: "body", at: 0, remove, insert: "Rewritten" } });

describe("a keystroke into a field a TypeScript act writes", () => {
  it("is refused on a record the act refuses, as the act is", () => {
    const store = make();
    expect(refusalOf(catching(() => store.apply({ name: "revise", args: { id: "note:locked", body: "x" } }, { author: writer })))).toMatchObject({ reason: "refused" });
    expect(store.permits(keystroke("note:locked"), writer).ok).toBe(false);
    expect(refusalOf(catching(() => store.apply(keystroke("note:locked"), { author: writer })))).toMatchObject({ reason: "forbidden" });
    expect(store.graph.getNode("note:locked")).toMatchObject({ body: "Kept as it was" });
  });

  it("is permitted on a record the act would run on, an empty field included", () => {
    const store = make();
    expect(store.permits(keystroke("note:open"), writer).ok).toBe(true);
    store.apply(keystroke("note:open"), { author: writer });
    expect(store.graph.getNode("note:open")).toMatchObject({ body: "Rewritten" });
    store.apply(keystroke("note:empty", 0), { author: writer });
    expect(store.graph.getNode("note:empty")).toMatchObject({ body: "Rewritten" });
    // Asking wrote nothing and logged nothing beyond the keystrokes themselves.
    expect(store.log.length).toBe(2);
  });

  it("is not refused for an answer the act calls invalid, which is about what it was handed", () => {
    const store = make();
    expect(store.permits(keystroke("note:open"), amender).ok).toBe(true);
    // Its rule is about the body it is handed, and holds of none: a published note is amended too.
    expect(store.permits(keystroke("note:locked"), amender).ok).toBe(true);
  });

  it("is judged by allowedOn where the act says it, without running the act", () => {
    const store = make();
    expect(store.permits(keystroke("note:locked"), redrafter).ok).toBe(false);
    expect(store.permits(keystroke("note:open"), redrafter).ok).toBe(true);
    store.apply(keystroke("note:open"), { author: redrafter });
    expect(store.graph.getNode("note:open")).toMatchObject({ body: "Rewritten" });
  });
});

describe("a keystroke into a field a document act writes", () => {
  it("rides the act's condition, as before", () => {
    const compiled = compileDocument({
      format: "graview-document",
      formatVersion: 1,
      name: "Posts",
      roles: ["author"],
      kinds: { post: { label: "{title}", fields: { title: { type: "string", required: true }, status: { type: "enum", options: ["draft", "published"], required: true }, body: { type: "text" } } } },
      acts: { revise: { title: "Revise", on: "post", writes: ["body"], allowedWhen: "status == 'draft'", refusal: "{title} is published" } },
      policy: { grants: [{ roles: ["author"], mutations: ["revise"] }] },
    });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
    const app = compiled.app as GraviewApp<AnySchema>;
    const author: Principal = { kind: "human", id: "ann", roles: ["author"] };
    const store = new Store<AnySchema>({
      schema: app.schema,
      mutations: (app.mutations ?? []) as never,
      policy: app.policy,
      snapshot: {
        nodes: [
          { id: "post:draft", kind: "post", title: "Draft", status: "draft", body: "Kept as it was" },
          { id: "post:out", kind: "post", title: "Out", status: "published", body: "Kept as it was" },
        ],
        edges: [],
      } as never,
    });
    const typing = (node: string) => ({ name: TYPE_TEXT, args: { node, field: "body", at: 0, remove: 14, insert: "Rewritten" } });
    expect(store.permits(typing("post:out"), author).ok).toBe(false);
    expect(store.permits(typing("post:draft"), author).ok).toBe(true);
  });
});

function catching(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("not refused");
}
