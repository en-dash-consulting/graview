import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, refusalOf, Store, z, type AnySchema } from "../../src/index.js";

/**
 * AN ACT WRITTEN IN TYPESCRIPT TAKES ONLY THE KINDS IT NAMES: its subject's
 * (`subject.kinds`) and each record argument's (`nodeRef([...])`). Handed a
 * record of another kind, it is refused in the words a document's act on
 * the wrong kind is refused in, and nothing changes.
 */
const shelf = defineNode("shelf", { fields: z.object({ name: z.string(), note: z.string().optional() }), plural: "Shelves" });
const book = defineNode("book", { fields: z.object({ name: z.string(), note: z.string().optional() }), edges: { on: { to: ["shelf"], cardinality: "one" } }, plural: "Books" });
const schema = createSchema([shelf, book]);
const { defineMutation } = bindSchema(schema);

const noteShelf = defineMutation("note-shelf", {
  title: "Note the shelf",
  subject: { kinds: ["shelf"], arg: "id" },
  writes: ["note"],
  input: z.object({ id: nodeRef(["shelf"]), note: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { note: args.note });
  },
});
const shelve = defineMutation("shelve", {
  title: "Shelve the book",
  subject: { kinds: ["book"], arg: "id" },
  writes: [],
  input: z.object({ id: nodeRef(["book"]), shelf: nodeRef(["shelf"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "on", from: args.id, to: args.shelf });
  },
});
const anything = defineMutation("note-anything", {
  title: "Note anything",
  subject: { kinds: "*", arg: "id" },
  writes: ["note"],
  input: z.object({ id: nodeRef("*"), note: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { note: args.note });
  },
});

const store = () =>
  new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    mutations: [noteShelf, shelve, anything] as never,
    snapshot: { nodes: [{ id: "s1", kind: "shelf", name: "Top" }, { id: "b1", kind: "book", name: "Dune" }], edges: [] } as never,
  });
const said = (run: () => unknown) => {
  try {
    run();
    return "ran";
  } catch (error) {
    return refusalOf(error);
  }
};

describe("a declared act takes only the kinds it names", () => {
  it("refuses a subject of another kind, in words, and changes nothing", () => {
    const s = store();
    expect(said(() => s.apply({ name: "note-shelf", args: { id: "b1", note: "x" } }))).toEqual({ reason: "invalid", sentence: '"Note the shelf" acts on shelf, not on a book' });
    expect(s.graph.getNode("b1")).toEqual({ id: "b1", kind: "book", name: "Dune" });
  });

  it("refuses a record argument of another kind", () => {
    const s = store();
    expect(said(() => s.apply({ name: "shelve", args: { id: "b1", shelf: "b1" } }))).toMatchObject({ reason: "invalid", sentence: '"Shelve the book" acts on shelf, not on a book' });
  });

  it("takes the kinds it names, and any kind where it names every one", () => {
    const s = store();
    expect(said(() => s.apply({ name: "note-shelf", args: { id: "s1", note: "x" } }))).toBe("ran");
    expect(said(() => s.apply({ name: "shelve", args: { id: "b1", shelf: "s1" } }))).toBe("ran");
    expect(said(() => s.apply({ name: "note-anything", args: { id: "b1", note: "y" } }))).toBe("ran");
  });
});
