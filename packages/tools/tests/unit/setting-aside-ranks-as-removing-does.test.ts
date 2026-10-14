import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances } from "../../src/index.js";

/**
 * SETTING ASIDE RANKS AS REMOVING DOES (FR-173). Archive and merge are
 * offered on every record, settled to one press, and so ranked FIRST — on
 * the studio's kind, "Archive the kind" led and pushed "Add a field" past
 * the rows a strip shows. They come after a record's own acts and its edit,
 * just ahead of remove; and a kind that says `archives: false` is given
 * none of them.
 */
const list = defineNode("list", { fields: z.object({ label: z.string(), note: z.string().optional() }) });
const part = defineNode("part", { fields: z.object({ label: z.string() }), archives: false });
const schema = createSchema([list, part]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename-list", {
  title: "Rename it",
  subject: { kinds: ["list"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["list"]), label: z.string() }),
  apply: (ctx, args) => ctx.patchNode(args.id, { label: args.label }),
});
const close = defineMutation("close-list", {
  title: "Close it",
  subject: { kinds: ["list"], arg: "id" },
  writes: ["note"],
  input: z.object({ id: nodeRef(["list"]) }),
  apply: (ctx, args) => ctx.patchNode(args.id, { note: "closed" }),
});
const make = defineMutation("add-part", {
  title: "Add a part",
  creates: ["part", "list"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => ctx.addNode({ id: ctx.freshId(args.label), kind: "part", label: args.label }),
});
const store = () =>
  new Store({
    schema,
    mutations: [rename, close, make],
    snapshot: {
      nodes: [
        { id: "a", kind: "list", label: "A" },
        { id: "b", kind: "list", label: "B" },
        { id: "p", kind: "part", label: "P" },
      ] as never,
      edges: [],
    },
  });

describe("archive and merge in the offers", () => {
  it("come after the record's own acts and its edit, just ahead of remove", () => {
    const offered = deriveAffordances(store(), ["a"], { focus: "a" }).affordances.map((affordance) => affordance.mutation);
    expect(offered.slice(-4)).toEqual(["archive-list", "leave-alone-list", "merge-list", "remove-list"]);
    expect(offered.indexOf("close-list")).toBeLessThan(offered.indexOf("archive-list"));
    expect(offered.indexOf("rename-list")).toBeLessThan(offered.indexOf("archive-list"));
  });

  it("are not given to a kind that says its records are not set aside", () => {
    const names = store().allMutations().map((mutation) => mutation.name);
    expect(names).toContain("remove-part");
    expect(names).not.toContain("archive-part");
    expect(names).not.toContain("unarchive-part");
    expect(names).not.toContain("merge-part");
    expect(names).toContain("archive-list");
  });
});
