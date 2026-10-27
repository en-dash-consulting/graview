import { describe, expect, it } from "vitest";
import "../../src/field-sight.js";
import { checkApp, compileDocument } from "../../src/check.js";
import type { GraviewDocument } from "../../src/document/index.js";
import { importRows } from "../../src/import/index.js";
import { bindSchema, compileMutation, createSchema, defineNode, Graph, Store, z, type AnySchema, type GraviewApp, type Policy, type Principal } from "../../src/index.js";

/**
 * AN ID NEVER QUOTES A FIELD A SIGHT KEEPS (Roadmap f-field-sight, FR-55). A
 * record's id is served wherever the record is — its snapshot, the log, a
 * link that names it — and field sight keeps fields, not ids. An act that
 * made a tip minted its id from its title (`tip:secret-merger-plan`), so a
 * role the title is kept from read it in the id. Now a kind whose name
 * field some sight keeps from a role mints its ids from the kind's name.
 */
const tips = (sight: Record<string, unknown>): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Tips",
    kinds: {
      person: { noun: "person", plural: "people", people: true, fields: { title: { type: "string", required: true } } },
      tip: { noun: "tip", plural: "tips", fields: { title: { type: "string" }, votes: { type: "number" } } },
      topic: { noun: "topic", plural: "topics", fields: { title: { type: "string" } } },
    },
    acts: { "add-tip": { title: "Add a tip", creates: "tip" }, "add-topic": { title: "Add a topic", creates: "topic" } },
    roles: ["staff", "public"],
    policy: {
      grants: [{ roles: "*", mutations: "*" }],
      sees: [{ roles: ["staff"], kinds: ["tip", "person", "topic"] }, { roles: ["public"], kinds: ["person", "topic"] }, { roles: ["public"], kinds: ["tip"], ...sight }],
    },
  }) as unknown as GraviewDocument;

const staff: Principal = { kind: "human", id: "person:s", roles: ["staff"] };
const pub: Principal = { kind: "human", id: "person:p", roles: ["public"] };

const open = (document: GraviewDocument) => {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error("the tips document does not compile");
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: { nodes: [{ id: "person:s", kind: "person", title: "S" }, { id: "person:p", kind: "person", title: "P" }] as never, edges: [] },
  });
};

describe("an id never quotes a field a sight keeps", () => {
  for (const [said, sight] of [
    ["hide", { hide: ["title"] }],
    ["fields", { fields: ["votes"] }],
  ] as const) {
    it(`mints a tip's id from its kind, not its title, where a sight's ${said} keeps the title from a role`, () => {
      const store = open(tips(sight));
      store.apply({ name: "add-tip", args: { title: "Secret Merger Plan", votes: 1 } }, { author: staff });
      store.apply({ name: "add-tip", args: { title: "Other Secret", votes: 2 } }, { author: staff });
      const view = store.seenBy(pub);
      const ids = view.snapshot().nodes.filter((node: { kind: string }) => node.kind === "tip").map((node: { id: string }) => node.id);
      expect(ids).toHaveLength(2);
      const served = JSON.stringify([view.snapshot(), view.log.all()]).toLowerCase();
      for (const word of ["secret", "merger", "other"]) expect(served).not.toContain(word);
    });
  }

  it("mints an imported tip's id from its kind, not its title", () => {
    const store = open(tips({ hide: ["title"] }));
    importRows(store, "tip", [{ Title: "Secret Merger Plan", Votes: "3" }], { Title: "title", Votes: "votes" } as never, { by: staff });
    const ids = store.snapshot().nodes.filter((node: { kind: string }) => node.kind === "tip").map((node: { id: string }) => node.id);
    expect(ids).toHaveLength(1);
    expect(ids.join(" ")).not.toMatch(/secret|merger/);
  });

  it("still mints a topic's id from its title, which no sight keeps", () => {
    const store = open(tips({ hide: ["title"] }));
    store.apply({ name: "add-topic", args: { title: "Budget" } }, { author: staff });
    expect(store.graph.has("topic:budget")).toBe(true);
  });

  it("mints from the kind's name where an act of the app's own hands freshId a kept field", () => {
    const note = defineNode("note", { fields: z.object({ label: z.string().optional(), body: z.string().optional() }), label: (node) => node.label ?? "a note" });
    const schema = createSchema([note]);
    const { defineMutation } = bindSchema(schema);
    const jot = defineMutation("jot", {
      title: "Jot",
      creates: ["note"],
      input: z.object({ label: z.string(), body: z.string().optional() }),
      apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "note"), kind: "note", label: args.label }),
    });
    const policy: Policy = { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["staff"], kinds: ["note"] }, { roles: ["public"], kinds: ["note"], hide: ["label"] }] };
    const store = new Store({ schema, mutations: [jot], policy });
    store.apply({ name: "jot", args: { label: "Layoffs Friday" } }, { author: staff });
    expect(JSON.stringify(store.seenBy(pub).snapshot()).toLowerCase()).not.toContain("layoffs");
  });

  /** Tips whose title every role sees and whose client the public does not: a title that names the client quotes it. */
  const clients = (): GraviewDocument => {
    const document = tips({ hide: ["client"] }) as unknown as { kinds: Record<string, { fields: Record<string, unknown> }> };
    document.kinds["tip"]!.fields["client"] = { type: "string" };
    return document as unknown as GraviewDocument;
  };

  it("mints a document act's id from its kind where the name quotes a kept field among other words", () => {
    const store = open(clients());
    store.apply({ name: "add-tip", args: { title: "Acme renewal at risk", client: "Acme" } }, { author: staff });
    const ids = store.snapshot().nodes.filter((node: { kind: string }) => node.kind === "tip").map((node: { id: string }) => node.id);
    // The title is the public's to read; the id says no more of the client than it does.
    expect(ids).toEqual(["tip:tip"]);
  });

  it("mints a document act's id from its kind outside a store too, judged by the document's own policy", () => {
    for (const [document, args] of [
      [tips({ hide: ["title"] }), { title: "Secret Merger Plan" }],
      [clients(), { title: "Acme renewal at risk", client: "Acme" }],
    ] as const) {
      const compiled = compileDocument(document);
      if (!compiled.ok) throw new Error("the tips document does not compile");
      const app = compiled.app as GraviewApp<AnySchema>;
      const act = (app.mutations ?? []).find((mutation) => mutation.name === "add-tip")!;
      const made = compileMutation(new Graph(app.schema), act, args);
      const ids = made.primitives.flatMap((primitive) => ("node" in primitive && primitive.node ? [String((primitive.node as { id: string }).id)] : []));
      expect(ids).toEqual(["tip:tip"]);
    }
  });

  it("says, of a label that reads a kept field, that no id is minted from it", () => {
    const compiled = compileDocument({ ...tips({ hide: ["title"] }), kinds: { ...tips({}).kinds, tip: { ...(tips({}).kinds as Record<string, object>)["tip"], label: "{title}" } } } as never);
    if (!compiled.ok) throw new Error("the tips document does not compile");
    const findings = checkApp(compiled.app as GraviewApp<AnySchema>).findings.filter((finding) => finding.code === "sight-hides-a-labeled-field");
    expect(findings.map((finding) => finding.message).join("\n")).toMatch(/\bid\b/);
  });
});
