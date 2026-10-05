import { createSchema, defineApp, defineNode, Store, z, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { registerDefaultViews, registerViewSpecs } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewProps } from "@graview/react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * FR-83: a computed field is drawn by a view spec like a stored one — a
 * `field` block shows it, a template reads it — worked out from the graph
 * the view is handed, which for a seat is the graph that seat may see.
 */
const party = defineNode("party", { fields: z.object({ name: z.string(), role: z.enum(["prime", "client"]), discount: z.number().optional() }), plural: "Parties" });
const offer = defineNode("offer", { fields: z.object({ name: z.string(), list: z.number(), units: z.number() }) });
const pkg = defineNode("package", {
  fields: z.object({ name: z.string() }),
  edges: { includes: { to: ["offer"] } },
  computed: { net: { expr: "sum(out('includes'), list * units) * (100 - either(first(all('party') where role == 'client').discount, 0)) / 100", label: "After the discount" } },
});
const schema = createSchema([party, offer, pkg]);
const app = defineApp({
  name: "Proposal",
  schema,
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["owner"], kinds: ["party", "offer", "package"] },
      { roles: ["partner"], kinds: ["offer", "package"] },
    ],
  },
  viewSpecs: {
    package: {
      card: [
        { title: "{name}" },
        { field: "net", as: "money" },
        { text: "{count(out('includes')) | words} {count(out('includes')) | plural: 'offer'}: {out('includes') | and}" },
      ],
    },
  },
});

const store = () =>
  new Store({
    schema,
    mutations: [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: {
      nodes: [
        { id: "acme", kind: "party", name: "Acme", role: "client", discount: 20 },
        { id: "workshop", kind: "offer", name: "Workshop", list: 10_000, units: 1 },
        { id: "build", kind: "offer", name: "Build", list: 20_000, units: 3 },
        { id: "middle", kind: "package", name: "The middle" },
      ] as never,
      edges: [
        { id: "e1", kind: "includes", from: "middle", to: "workshop" },
        { id: "e2", kind: "includes", from: "middle", to: "build" },
      ] as never,
    },
  });

const owner: Principal = { kind: "human", id: "u:olu", roles: ["owner"] };
const partner: Principal = { kind: "human", id: "u:pat", roles: ["partner"] };

/** The package's card, drawn for one seat: the provider reads the store as that seat sees it (FR-55). */
function card(principal: Principal) {
  const s = store();
  const registry = registerViewSpecs(registerDefaultViews(schema, createViews(schema)), schema, app.viewSpecs);
  const View = registry.lookup("package", { cardinality: "one", fidelity: "summary" }) as ComponentType<ViewProps<typeof schema>>;
  return renderToStaticMarkup(
    <GraviewProvider store={s} views={registry} initialView={EMPTY_VIEW} principal={principal}>
      <View node={s.graph.getNode("middle") as never} cardinality="one" fidelity="summary" mode="scene" selected={false} />
    </GraviewProvider>,
  );
}

describe("a computed field, drawn", () => {
  it("a field block shows it under its label, and a template says the count and the list in words", () => {
    const html = card(owner);
    expect(html).toContain('data-graview-field="net"');
    expect(html).toContain("After the discount");
    expect(html).toContain("56,000");
    expect(html).toContain("two offers: Workshop and Build");
  });

  it("a seat that may not see the client is drawn the price before the discount, and nothing of the client", () => {
    const html = card(partner);
    expect(html).toContain("70,000");
    expect(html).not.toContain("56,000");
    expect(html).not.toContain("Acme");
  });
});
