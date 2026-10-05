import { createSchema, defineNode, Store, z, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { recordFacts } from "../../src/index.js";

/**
 * FR-83: a record's page states its computed fields among its facts, in
 * their declared words, worked out from the store the page reads — the
 * seat's, so a seat that may not see the client reads no discount into it.
 */
const party = defineNode("party", { fields: z.object({ name: z.string(), role: z.enum(["prime", "client"]), discount: z.number().optional() }), plural: "Parties" });
const offer = defineNode("offer", { fields: z.object({ name: z.string(), list: z.number(), units: z.number() }) });
const pkg = defineNode("package", {
  fields: z.object({ name: z.string() }),
  edges: { includes: { to: ["offer"] } },
  label: (node) => node.name,
  computed: { net: { expr: "sum(out('includes'), list * units) * (100 - either(first(all('party') where role == 'client').discount, 0)) / 100", label: "After the discount" } },
});
const schema = createSchema([party, offer, pkg]);
const store = new Store({
  schema,
  mutations: [],
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["owner"], kinds: ["party", "offer", "package"] },
      { roles: ["partner"], kinds: ["offer", "package"] },
    ],
  },
  snapshot: {
    nodes: [
      { id: "acme", kind: "party", name: "Acme", role: "client", discount: 20 },
      { id: "build", kind: "offer", name: "Build", list: 20_000, units: 3 },
      { id: "middle", kind: "package", name: "The middle" },
    ] as never,
    edges: [{ kind: "includes", from: "middle", to: "build" }] as never,
  },
});
const owner: Principal = { kind: "human", id: "u:olu", roles: ["owner"] };
const partner: Principal = { kind: "human", id: "u:pat", roles: ["partner"] };

describe("a record says what it works out", () => {
  it("lists a computed field among the facts, under its label", () => {
    const facts = recordFacts(store.seenBy(owner), "middle", { principal: owner });
    expect(facts?.fields.find((field) => field.key === "net")).toMatchObject({ label: "After the discount", value: "48000" });
  });

  it("works it out from what the seat may see", () => {
    const facts = recordFacts(store.seenBy(partner), "middle", { principal: partner });
    expect(facts?.fields.find((field) => field.key === "net")?.value).toBe("60000");
  });
});
