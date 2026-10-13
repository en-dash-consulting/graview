// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, type Policy } from "@graview/core";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * AN ARCHIVED RECORD SAYS SO ON ITS OWN PAGE, AND COMES BACK (FR-173). Its
 * kind's list leaves it out and says how many are set aside, a link away;
 * its page still opens, says it is archived, names the record a merge put
 * it into, and offers "Bring it back" to a seat that may.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string().min(1) }), plural: "Vendors", label: (node) => node.label });
const schema = createSchema([vendor]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-vendor", {
  title: "Add a vendor",
  creates: ["vendor"],
  input: z.object({ label: z.string().min(1) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "vendor"), kind: "vendor", label: args.label }),
});
const shop = (policy?: Policy) => {
  const store = new Store({
    schema,
    mutations: [add],
    ...(policy ? { policy } : {}),
    snapshot: {
      nodes: [
        { id: "bloom", kind: "vendor", label: "Bloom florist" },
        { id: "bloom-2", kind: "vendor", label: "Bloom" },
        { id: "petal", kind: "vendor", label: "Petal" },
      ] as never,
      edges: [],
    },
  });
  const host = { author: { kind: "system" as const, id: "host" } };
  store.apply({ name: "merge-vendor", args: { id: "bloom-2", into: "bloom" } }, host);
  store.apply({ name: "archive-vendor", args: { id: "petal" } }, host);
  return store;
};
async function open(store: Store<typeof schema>, path: string, principal?: PageContext<typeof schema>["principal"]) {
  const context: PageContext<typeof schema> = { store, views: createViews(schema), ...(principal ? { principal } : {}) };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath={path} />));
  return { host, close: async () => (await act(async () => root.unmount()), host.remove()) };
}

describe("an archived record", () => {
  it("is out of its kind's list, which says how many are set aside", async () => {
    const page = await open(shop(), "/vendors");
    const rows = page.host.querySelector("[data-testid='records']")?.textContent ?? "";
    expect(rows).toContain("Bloom florist");
    expect(rows).not.toContain("Petal");
    expect(page.host.querySelector("[data-testid='archived-link']")?.textContent).toBe("+2 archived");
    await page.close();
  });

  it("says so on its own page, names what it was merged into, and comes back", async () => {
    const store = shop();
    const merged = await open(store, "/vendors/bloom-2");
    const said = merged.host.querySelector("[data-testid='record-archived']")?.textContent ?? "";
    expect(said).toContain("Archived.");
    expect(said).toContain("Merged into Bloom florist.");
    await merged.close();

    const page = await open(store, "/vendors/petal");
    expect(page.host.querySelector("[data-testid='record-archived']")?.textContent).not.toContain("Merged into");
    await act(async () => page.host.querySelector<HTMLButtonElement>("[data-testid='bring-it-back']")!.click());
    expect(store.graph.isArchived("petal")).toBe(false);
    expect(page.host.querySelector("[data-testid='record-archived']")).toBeNull();
    await page.close();
  });

  it("offers the way back only to a seat that may take it", async () => {
    const policy: Policy = { roles: ["buyer", "guest"], grants: [{ roles: ["buyer"], mutations: "*" }] };
    const page = await open(shop(policy), "/vendors/petal", { kind: "human", id: "g", roles: ["guest"] });
    expect(page.host.querySelector("[data-testid='record-archived']")).not.toBeNull();
    expect(page.host.querySelector("[data-testid='bring-it-back']")).toBeNull();
    await page.close();
  });
});
