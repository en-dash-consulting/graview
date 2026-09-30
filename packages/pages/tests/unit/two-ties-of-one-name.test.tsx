import { createSchema, defineNode, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp, recordFacts, type PageContext } from "../../src/index.js";

/**
 * TWO TIES OF ONE NAME ARE TOLD APART. A vehicle's record listed its
 * service appointments, and two were "2026 Tesla Model Y Performance ·
 * Check engine light on" — two links of one text to two records.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const service = defineNode("service", {
  fields: z.object({ label: z.string(), at: z.string() }),
  plural: "Services",
  edges: { services: { to: ["car"], description: "the car in for service", inverse: "its service appointments" } },
});
const schema = createSchema([car, service]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "c1", kind: "car", label: "Model Y" },
        { id: "s1", kind: "service", label: "Check engine light on", at: "2026-10-03T15:30" },
        { id: "s2", kind: "service", label: "Check engine light on", at: "2026-10-06T16:15" },
      ] as never,
      edges: [
        { kind: "services", from: "s1", to: "c1" },
        { kind: "services", from: "s2", to: "c1" },
      ],
    },
  });

describe("a record's ties", () => {
  it("carry what tells two of one name apart, and the page says it", () => {
    const facts = recordFacts(store(), "c1")!;
    const targets = facts.links[0]!.targets;
    expect(new Set(targets.map((target) => target.apart)).size).toBe(2);
    const context: PageContext<typeof schema> = { store: store() };
    const html = renderToStaticMarkup(<PagesApp context={context} initialPath="/cars/c1" />);
    expect(html).toContain("2026-10-03T15:30");
    expect(html).toContain("2026-10-06T16:15");
  });
});
