import { Store, type AnySchema, type GraviewApp, type Principal, type Violation } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createToolRuntime } from "../../src/index.js";

/**
 * A SEAT'S TOOLS SAY A RULE THAT READS A FACT AS THE SEAT SEES IT (FR-55).
 * A guest who sees one proposal was told, by get_violations, that "3
 * proposed" broke the limit of two: the fact was counted over the whole
 * graph. Its tools now judge each rule over what it sees, facts included,
 * and answer an act with what that act broke as the seat judges it.
 */
const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Proposals",
  roles: ["owner", "guest"],
  kinds: {
    person: { fields: { name: { type: "string", required: true } }, label: "{name}" },
    proposal: {
      fields: { title: { type: "string", required: true }, proposed: { type: "boolean" } },
      label: "{title}",
      edges: { by: { to: ["person"], cardinality: "one", description: "who wrote it", inverse: "what they proposed" } },
    },
  },
  computed: { proposed: "count(all('proposal') where proposed == true)" },
  rules: { "too-many-proposed": { over: "graph", require: "fact('proposed') <= 2", says: "{fact('proposed')} proposed, and at most two may be" } },
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["owner"], kinds: ["person", "proposal"] },
      { roles: ["guest"], kinds: ["person", "proposal"], own: true },
    ],
  },
};
const owner: Principal = { kind: "human", id: "person-ola", roles: ["owner"] };
const guest: Principal = { kind: "human", id: "person-gus", roles: ["guest"] };

function opened(hidden: number) {
  const result = compileDocument(DOCUMENT);
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((finding) => finding.severity === "error")));
  const app = result.app as GraviewApp<AnySchema>;
  const proposals = [
    { id: "mine", by: "person-gus", proposed: true },
    { id: "draft", by: "person-gus", proposed: false },
    ...Array.from({ length: 1 + hidden }, (_, i) => ({ id: `theirs-${i}`, by: "person-ola", proposed: true })),
  ];
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    policy: app.policy!,
    snapshot: {
      nodes: [{ id: "person-ola", kind: "person", name: "Ola" }, { id: "person-gus", kind: "person", name: "Gus" }, ...proposals.map((p) => ({ id: p.id, kind: "proposal", title: p.id, proposed: p.proposed }))],
      edges: proposals.map((p) => ({ kind: "by", from: p.id, to: p.by })),
    } as never,
  });
}
const messages = async (store: Store<AnySchema>, seat: Principal) => ((await createToolRuntime(store, { author: seat }).call("get_violations", {})) as { data: Violation[] }).data.map((v) => v.message);

describe("a seat's tools and a rule that reads a fact", () => {
  it("answer get_violations as the seat judges: the owner is told of three, the guest of none", async () => {
    expect(await messages(opened(1), owner)).toEqual(["3 proposed, and at most two may be"]);
    expect(await messages(opened(1), guest)).toEqual([]);
  });

  it("never change a guest's answer for proposals the guest may not see", async () => {
    for (const hidden of [1, 10]) expect(await messages(opened(hidden), guest)).toEqual([]);
  });

  it("answer a guest's act with what it broke as the guest judges it: two proposed is within the limit", async () => {
    // Two proposed, the guest's one and the owner's: the guest proposes its draft, and the whole graph holds three.
    const store = opened(0);
    expect(store.violations()).toEqual([]);
    const result = (await createToolRuntime(store, { author: guest }).call("edit-proposal", { id: "draft", proposed: true })) as { ok: boolean; data: { introduces: Violation[] } };
    expect(result.ok).toBe(true);
    expect(store.violations().map((v) => v.invariant)).toEqual(["too-many-proposed"]);
    expect(result.data.introduces).toEqual([]);
    // The owner, who sees all three, is told.
    expect(await messages(store, owner)).toEqual(["3 proposed, and at most two may be"]);
  });
});
