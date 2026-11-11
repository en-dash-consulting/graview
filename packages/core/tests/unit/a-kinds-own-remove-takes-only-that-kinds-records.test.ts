import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { refusalOf, Store, type AnySchema, type Principal } from "../../src/index.js";

/**
 * A KIND'S OWN ACTS TAKE ONLY THAT KIND'S RECORDS. Every kind is given a
 * remove, an archive, a bring-back, a merge, a leave-alone and an edit of
 * its own, each on a record of that kind; handed a record of another kind,
 * each is refused in words, as a document's act on the wrong kind is.
 */
const app = () => {
  const compiled = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: "Keys",
    roles: ["keyholder", "runner"],
    kinds: {
      vault: { fields: { name: { type: "string", required: true } } },
      errand: { fields: { name: { type: "string", required: true } } },
    },
    acts: {
      "add-vault": { title: "Add a vault", creates: "vault" },
      "add-errand": { title: "Add an errand", creates: "errand" },
    },
    policy: {
      grants: [
        { roles: ["keyholder"], mutations: ["add-vault", "remove-vault", "archive-vault", "unarchive-vault", "merge-vault", "edit-vault"] },
        { roles: ["runner"], mutations: ["add-errand"] },
      ],
    },
  } as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app;
};

const keyholder: Principal = { kind: "human", id: "kim", roles: ["keyholder"] };
const runner: Principal = { kind: "human", id: "ray", roles: ["runner"] };

function setUp(): Store<AnySchema> {
  const a = app();
  const store = new Store<AnySchema>({ schema: a.schema, mutations: a.mutations ?? [], ...(a.policy ? { policy: a.policy } : {}) });
  store.apply({ name: "add-vault", args: { name: "Main vault" } }, { author: keyholder });
  store.apply({ name: "add-vault", args: { name: "Side vault" } }, { author: keyholder });
  store.apply({ name: "add-errand", args: { name: "Post" } }, { author: runner });
  return store;
}
const ids = (store: Store<AnySchema>) => ({
  vault: (store.graph.nodesOfKind("vault" as never)[0] as unknown as { id: string }).id,
  errand: (store.graph.nodesOfKind("errand" as never)[0] as unknown as { id: string }).id,
});
const said = (run: () => unknown) => {
  try {
    run();
    return "ran";
  } catch (error) {
    return refusalOf(error);
  }
};

describe("a kind's own remove takes only that kind's records", () => {
  for (const [act, args] of [
    ["remove-vault", {}],
    ["archive-vault", {}],
    ["edit-vault", { name: "Renamed" }],
  ] as const) {
    it(`${act} is refused a record of another kind, and the record stays as it was`, () => {
      const store = setUp();
      const { errand } = ids(store);
      const before = store.graph.getNode(errand);
      expect(said(() => store.apply({ name: act, args: { id: errand, ...args } }, { author: keyholder }))).toMatchObject({ reason: "invalid", sentence: expect.stringContaining("not on an errand") });
      expect(store.graph.getNode(errand)).toEqual(before);
    });
  }

  it("merge-vault is refused a record of another kind, at either end", () => {
    const store = setUp();
    const { vault, errand } = ids(store);
    expect(said(() => store.apply({ name: "merge-vault", args: { id: errand, into: vault } }, { author: keyholder }))).toMatchObject({ reason: "invalid" });
    expect(said(() => store.apply({ name: "merge-vault", args: { id: vault, into: errand } }, { author: keyholder }))).toMatchObject({ reason: "invalid" });
    expect(store.graph.getNode(errand)).toBeDefined();
  });

  it("an edit that rides the making of a kind changes only records of that kind", () => {
    const store = setUp();
    const { errand } = ids(store);
    const maker: Principal = { kind: "human", id: "mo", roles: ["keyholder"] };
    expect(said(() => store.apply({ name: "edit-vault", args: { id: errand, name: "Renamed" } }, { author: maker }))).toMatchObject({ reason: "invalid" });
    expect(store.graph.getNode(errand)?.["name"]).toBe("Post");
  });

  it("still takes the kind's own records", () => {
    const store = setUp();
    const { vault } = ids(store);
    expect(said(() => store.apply({ name: "archive-vault", args: { id: vault } }, { author: keyholder }))).toBe("ran");
    expect(said(() => store.apply({ name: "unarchive-vault", args: { id: vault } }, { author: keyholder }))).toBe("ran");
    expect(said(() => store.apply({ name: "remove-vault", args: { id: vault } }, { author: keyholder }))).toBe("ran");
  });
});
