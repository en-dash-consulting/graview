import { createSchema, defineNode, Store, z, type Policy, type Principal } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A STRANGER IS SHOWN NOBODY. A showroom's routed face listed every
 * shopper — name and email — on its home page and under every car they
 * had shortlisted, to whoever opened it (the seventh walk). Under a policy
 * that says who sees whom, every page is drawn from the store as the seat
 * may see it.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const shopper = defineNode("shopper", {
  fields: z.object({ label: z.string(), email: z.string() }),
  plural: "Shoppers",
  edges: { shortlisted: { to: ["car"], description: "the cars on their shortlist", inverse: "the shoppers who shortlisted it" } },
});
const schema = createSchema([car, shopper]);
const policy: Policy = {
  grants: [{ roles: ["staff"], mutations: "*" }],
  sees: [
    { roles: ["staff"], kinds: ["shopper"] },
    { roles: ["shopper"], kinds: ["shopper"], own: true },
  ],
};
const store = new Store({
  schema,
  policy,
  snapshot: {
    nodes: [
      { id: "car:golf", kind: "car", label: "2021 Volkswagen Golf" },
      { id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo", email: "bethan@mail.example" },
      { id: "shopper:freya", kind: "shopper", label: "Freya Davies", email: "freya@mail.example" },
    ] as never,
    edges: [
      { kind: "shortlisted", from: "shopper:bethan", to: "car:golf" },
      { kind: "shortlisted", from: "shopper:freya", to: "car:golf" },
    ],
  },
});
const at = (path: string, principal: Principal) => renderToStaticMarkup(<PagesApp context={{ store, principal }} initialPath={path} />);

describe("the routed face, under a policy that says who sees whom", () => {
  it("shows somebody browsing the cars and no customer, on the home page or a car's", () => {
    const browsing: Principal = { kind: "human", id: "browsing", roles: [] };
    for (const html of [at("/", browsing), at("/cars/car:golf", browsing)]) {
      expect(html).toContain("2021 Volkswagen Golf");
      expect(html).not.toMatch(/Bethan|Freya|mail\.example/);
    }
  });

  it("shows a signed-in shopper themselves under the car, and nobody else", () => {
    const html = at("/cars/car:golf", { kind: "human", id: "shopper:bethan", roles: ["shopper"] });
    expect(html).toContain("Bethan Okonkwo");
    expect(html).not.toContain("Freya");
  });

  it("shows the store everybody", () => {
    const html = at("/cars/car:golf", { kind: "human", id: "staff:rhian", roles: ["staff"] });
    expect(html).toContain("Bethan Okonkwo");
    expect(html).toContain("Freya Davies");
  });
});
