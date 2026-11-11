import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { refusalOf, Store, type AnySchema, type Principal } from "../../src/index.js";

/**
 * A KIND'S OWN ACTS TAKE ONLY THAT KIND'S RECORDS. Every kind is given acts
 * of its own — an edit, a remove, an archive, a bring-back, a merge, a
 * leave-alone and its undoing, and, for a kind with a date that repeats,
 * skip, detach and split — each on a record of that kind. Handed a record of
 * another kind, at its subject or at any other record it names, each is
 * refused in words, as a document's act on the wrong kind is, and the record
 * stays as it was: alone, or within a batch.
 */
const app = () => {
  const compiled = compileDocument(
    {
      format: "graview-document",
      formatVersion: 1,
      name: "Keys",
      roles: ["keyholder", "runner", "maker"],
      kinds: {
        vault: { fields: { name: { type: "string", required: true } } },
        errand: { fields: { name: { type: "string", required: true } } },
        meeting: { fields: { name: { type: "string", required: true }, startsAt: { type: "datetime", required: true, repeats: true } } },
        shift: { fields: { name: { type: "string", required: true }, startsAt: { type: "datetime", required: true, repeats: true } } },
      },
      acts: {
        "add-vault": { title: "Add a vault", creates: "vault" },
        "add-errand": { title: "Add an errand", creates: "errand" },
        "add-meeting": { title: "Add a meeting", creates: "meeting" },
      },
      policy: {
        grants: [
          {
            roles: ["keyholder"],
            mutations: [
              "add-vault",
              "remove-vault",
              "archive-vault",
              "unarchive-vault",
              "merge-vault",
              "edit-vault",
              "add-meeting",
              "edit-meeting",
              "skip-meeting",
              "detach-meeting",
              "split-meeting",
            ],
          },
          { roles: ["runner"], mutations: ["add-errand"] },
          { roles: ["maker"], mutations: ["add-vault"] },
        ],
      },
    } as never,
    { today: () => "2026-10-21" },
  );
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app;
};

const keyholder: Principal = { kind: "human", id: "kim", roles: ["keyholder"] };
const runner: Principal = { kind: "human", id: "ray", roles: ["runner"] };
const maker: Principal = { kind: "human", id: "mo", roles: ["maker"] };

function setUp(): Store<AnySchema> {
  const a = app();
  const store = new Store<AnySchema>({
    schema: a.schema,
    mutations: a.mutations ?? [],
    ...(a.policy ? { policy: a.policy } : {}),
    // 2026-10-20 is a Tuesday: the meeting and the shift are every Tuesday.
    snapshot: {
      nodes: [
        { id: "meeting:weekly", kind: "meeting", name: "Weekly", startsAt: "2026-10-20T09:00", startsAtRepeat: { every: "week", on: ["tue"] } },
        { id: "shift:late", kind: "shift", name: "Late", startsAt: "2026-10-20T18:00", startsAtRepeat: { every: "week", on: ["tue"] } },
      ],
      edges: [],
    } as never,
  });
  store.apply({ name: "add-vault", args: { name: "Main vault" } }, { author: keyholder });
  store.apply({ name: "add-vault", args: { name: "Side vault" } }, { author: keyholder });
  store.apply({ name: "add-errand", args: { name: "Post" } }, { author: runner });
  return store;
}
const first = (store: Store<AnySchema>, kind: string) => (store.graph.nodesOfKind(kind as never)[0] as unknown as { id: string }).id;
const said = (run: () => unknown) => {
  try {
    run();
    return "ran";
  } catch (error) {
    return refusalOf(error);
  }
};
const refusedAs = (record: string) => ({ reason: "invalid", sentence: expect.stringContaining(`not on ${record}`) });

describe("a kind's own acts take only that kind's records", () => {
  for (const [act, args] of [
    ["remove-vault", {}],
    ["archive-vault", {}],
    ["unarchive-vault", {}],
    ["edit-vault", { name: "Renamed" }],
    ["leave-alone-vault", {}],
    ["allow-tidying-vault", {}],
  ] as const) {
    it(`${act} is refused a record of another kind, and the record stays as it was`, () => {
      const store = setUp();
      const errand = first(store, "errand");
      const before = store.graph.getNode(errand);
      expect(said(() => store.apply({ name: act, args: { id: errand, ...args } }, { author: keyholder }))).toMatchObject(refusedAs("an errand"));
      expect(store.graph.getNode(errand)).toEqual(before);
    });
  }

  for (const [act, args] of [
    ["skip-meeting", { on: "2026-10-27" }],
    ["detach-meeting", { on: "2026-10-27", name: "Moved" }],
    ["split-meeting", { on: "2026-11-03", name: "Moved" }],
  ] as const) {
    it(`${act} is refused a record of another kind that repeats too, and nothing is made or changed`, () => {
      const store = setUp();
      const before = store.graph.snapshot();
      expect(said(() => store.apply({ name: act, args: { id: "shift:late", ...args } }, { author: keyholder }))).toMatchObject(refusedAs("a shift"));
      expect(store.graph.snapshot()).toEqual(before);
    });

    it(`${act} is refused a record of another kind that does not repeat`, () => {
      const store = setUp();
      const errand = first(store, "errand");
      const before = store.graph.snapshot();
      expect(said(() => store.apply({ name: act, args: { id: errand, ...args } }, { author: keyholder }))).toMatchObject({ reason: expect.stringMatching(/invalid|refused/) });
      expect(store.graph.snapshot()).toEqual(before);
    });

    it(`${act} still takes the kind's own records`, () => {
      const store = setUp();
      expect(said(() => store.apply({ name: act, args: { id: "meeting:weekly", ...args } }, { author: keyholder }))).toBe("ran");
    });
  }

  it("merge-vault is refused a record of another kind, at either end", () => {
    const store = setUp();
    const vault = first(store, "vault");
    const errand = first(store, "errand");
    const before = store.graph.snapshot();
    expect(said(() => store.apply({ name: "merge-vault", args: { id: errand, into: vault } }, { author: keyholder }))).toMatchObject(refusedAs("an errand"));
    expect(said(() => store.apply({ name: "merge-vault", args: { id: vault, into: errand } }, { author: keyholder }))).toMatchObject(refusedAs("an errand"));
    expect(store.graph.snapshot()).toEqual(before);
  });

  it("an edit that rides the making of a kind changes only records of that kind", () => {
    const store = setUp();
    const errand = first(store, "errand");
    expect(said(() => store.apply({ name: "edit-vault", args: { id: errand, name: "Renamed" } }, { author: maker }))).not.toBe("ran");
    expect(store.graph.getNode(errand)?.["name"]).toBe("Post");
  });

  it("a batch with one call on a record of another kind is refused whole", () => {
    const store = setUp();
    const vault = first(store, "vault");
    const errand = first(store, "errand");
    const before = store.graph.snapshot();
    expect(
      said(() =>
        store.applyAll(
          [
            { name: "archive-vault", args: { id: vault } },
            { name: "remove-vault", args: { id: errand } },
          ],
          { author: keyholder },
        ),
      ),
    ).toMatchObject(refusedAs("an errand"));
    expect(store.graph.snapshot()).toEqual(before);
  });

  it("still takes the kind's own records", () => {
    const store = setUp();
    const vault = first(store, "vault");
    const side = (store.graph.nodesOfKind("vault" as never)[1] as unknown as { id: string }).id;
    expect(said(() => store.apply({ name: "edit-vault", args: { id: vault, name: "Renamed" } }, { author: keyholder }))).toBe("ran");
    expect(said(() => store.apply({ name: "leave-alone-vault", args: { id: vault } }, { author: keyholder }))).toBe("ran");
    expect(said(() => store.apply({ name: "allow-tidying-vault", args: { id: vault } }, { author: keyholder }))).toBe("ran");
    expect(said(() => store.apply({ name: "archive-vault", args: { id: vault } }, { author: keyholder }))).toBe("ran");
    expect(said(() => store.apply({ name: "unarchive-vault", args: { id: vault } }, { author: keyholder }))).toBe("ran");
    expect(said(() => store.apply({ name: "merge-vault", args: { id: side, into: vault } }, { author: keyholder }))).toBe("ran");
    expect(said(() => store.apply({ name: "remove-vault", args: { id: vault } }, { author: keyholder }))).toBe("ran");
  });
});
