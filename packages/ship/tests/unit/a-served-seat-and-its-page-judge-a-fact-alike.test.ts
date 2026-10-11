import { createMemoryAdapter, Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createStoreHandler, seatHeaders } from "../../src/index.js";

/**
 * A SERVED SEAT AND ITS PAGE JUDGE A RULE THAT READS A FACT ALIKE (FR-55).
 * A page served only what its seat sees judges its rules over that, so a
 * guest's page counted the one proposal it was sent, while the store's own
 * reading for the seat — the one its tools and a host read — counted three.
 * The store now judges a seat over what it sees, so the two agree, and the
 * records the guest may not see never reach either.
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
  rules: {
    "too-many-proposed": { over: "graph", require: "fact('proposed') <= 2", says: "{fact('proposed')} proposed, and at most two may be" },
    "none-proposed": { title: "Nothing proposed", over: "graph", require: "fact('proposed') < 1" },
  },
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["owner"], kinds: ["person", "proposal"] },
      { roles: ["guest"], kinds: ["person", "proposal"], own: true },
    ],
  },
};
const guest: Principal = { kind: "human", id: "person-gus", roles: ["guest"] };
const proposals = [
  { id: "mine", by: "person-gus" },
  { id: "theirs-1", by: "person-ola" },
  { id: "theirs-2", by: "person-ola" },
];
const seed = {
  nodes: [{ id: "person-ola", kind: "person", name: "Ola" }, { id: "person-gus", kind: "person", name: "Gus" }, ...proposals.map((p) => ({ id: p.id, kind: "proposal", title: p.id, proposed: true }))],
  edges: proposals.map((p) => ({ kind: "by", from: p.id, to: p.by })),
};

describe("a served seat and its page", () => {
  it("judge a rule that reads a fact over what the seat sees, and say it in the same words", async () => {
    const compiled = compileDocument(DOCUMENT);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
    const app = compiled.app as GraviewApp<AnySchema>;
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const words = (store: Pick<Store<AnySchema>, "violations">) => store.violations().map((violation) => violation.message);
    // The store's own judgment counts three.
    expect(words(handler.store)).toEqual(["3 proposed, and at most two may be", "Nothing proposed — proposed 3 ≥ 1"]);
    // The page, holding what the guest is sent, and the store reading for the guest, count one.
    const response = await handler.handle(new Request("https://store.example/graview/state", { headers: { "content-type": "application/json", ...seatHeaders(guest) } }));
    const state = (await response.json()) as { snapshot: unknown };
    const page = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: state.snapshot as never });
    expect(words(page)).toEqual(["Nothing proposed — proposed 1 ≥ 1"]);
    expect(words(handler.store.seenBy(guest))).toEqual(words(page));
  });
});
