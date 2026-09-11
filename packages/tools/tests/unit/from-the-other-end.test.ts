import { bindSchema, checkApp, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances, defaultProviders } from "../../src/index.js";

/**
 * AN ACT READ FROM THE END IT IS OFFERED AT.
 *
 * A mutation that declares what it connects or severs is offered from either
 * endpoint — standing on the owner, "give this one something to do" is the
 * natural thing to say. The button there was labelled with `title`, which is
 * written from the SUBJECT's side: "Hand it to someone", offered on the
 * owner, reads as handing the owner to someone. The same shape as
 * `edge-without-inverse` one layer up — the relation has two readings and
 * the act had one.
 */
const item = defineNode("item", {
  description: "A thing.",
  fields: z.object({ label: z.string() }),
  plural: "Items",
  label: (node) => node.label,
  edges: {
    "kept-by": { to: ["owner"], description: "who is seeing to it", inverse: "what they are seeing to" },
  },
});
const owner = defineNode("owner", {
  description: "Someone.",
  fields: z.object({ label: z.string() }),
  plural: "Owners",
  label: (node) => node.label,
});
const schema = createSchema([item, owner]);
const { defineMutation } = bindSchema(schema);

const addItem = defineMutation("add-item", {
  title: "Add an item",
  creates: ["item"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "item"), kind: "item", label: args.label });
  },
});
const addOwner = defineMutation("add-owner", {
  title: "Add an owner",
  creates: ["owner"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "owner"), kind: "owner", label: args.label });
  },
});
const keep = (extra: { fromTheOtherEnd?: string } = {}) =>
  defineMutation("keep-item", {
    title: "Hand it to someone",
    subject: { kinds: ["item"], arg: "id" },
    connects: ["kept-by"],
    severs: ["kept-by"],
    input: z.object({ id: nodeRef(["item"]), owner: nodeRef(["owner"]) }),
    ...extra,
    apply(ctx, args) {
      for (const held of ctx.graph.out(args.id, "kept-by")) {
        ctx.removeEdge({ kind: "kept-by", from: args.id, to: held.id });
      }
      ctx.addEdge({ kind: "kept-by", from: args.id, to: args.owner });
    },
  });

const stocked = (act: ReturnType<typeof keep>) => {
  const store = new Store({ schema, mutations: [addItem, addOwner, act], invariants: [] });
  store.apply({ name: "add-item", args: { label: "Pay the deposit" } });
  store.apply({ name: "add-owner", args: { label: "Ana" } });
  return store;
};
const labelsOn = (store: Store<typeof schema>, id: string) =>
  deriveAffordances(store, [id], { providers: defaultProviders() }).affordances.map((a) => a.label);

describe("a tie act offered on the far end of its tie", () => {
  it("uses the words written for that end", () => {
    const store = stocked(keep({ fromTheOtherEnd: "Take on an item" }));
    const ana = store.graph.nodesOfKind("owner" as never)[0]!.id;
    expect(labelsOn(store, ana)).toContain("Take on an item");
    expect(labelsOn(store, ana)).not.toContain("Hand it to someone");
  });

  it("still uses the subject's own words where the subject is", () => {
    const store = stocked(keep({ fromTheOtherEnd: "Take on an item" }));
    const thing = store.graph.nodesOfKind("item" as never)[0]!.id;
    expect(labelsOn(store, thing)).toContain("Hand it to someone");
    expect(labelsOn(store, thing)).not.toContain("Take on an item");
  });

  it("falls back to the subject's words rather than dropping the offer", () => {
    const store = stocked(keep());
    const ana = store.graph.nodesOfKind("owner" as never)[0]!.id;
    expect(labelsOn(store, ana)).toContain("Hand it to someone");
  });
});

describe("the checker", () => {
  const app = (act: ReturnType<typeof keep>) => ({
    name: "Walk",
    schema,
    mutations: [addItem, addOwner, act],
    invariants: [],
  });
  const codes = (act: ReturnType<typeof keep>) =>
    checkApp(app(act) as never).findings.map((finding) => finding.code);

  it("names the end an act has no words for", () => {
    const found = checkApp(app(keep()) as never).findings.find(
      (finding) => finding.code === "act-without-far-end-reading",
    );
    expect(found?.severity).toBe("warning");
    expect(found?.message).toContain("an owner");
    expect(found?.message).toContain("Hand it to someone");
    expect(found?.fix).toContain("fromTheOtherEnd");
  });

  it("says nothing once the act has them", () => {
    expect(codes(keep({ fromTheOtherEnd: "Take on an item" }))).not.toContain(
      "act-without-far-end-reading",
    );
  });

  it("says nothing about an act whose two ends are the same kind", () => {
    const dependsOn = defineMutation("link-item", {
      title: "Depends on",
      subject: { kinds: ["item"], arg: "id" },
      connects: ["depends-on"],
      input: z.object({ id: nodeRef(["item"]), dependsOn: nodeRef(["item"]) }),
      apply() {},
    });
    const found = checkApp({
      name: "Walk",
      schema,
      mutations: [addItem, addOwner, dependsOn],
      invariants: [],
    } as never).findings.map((finding) => finding.code);
    expect(found).not.toContain("act-without-far-end-reading");
  });
});
