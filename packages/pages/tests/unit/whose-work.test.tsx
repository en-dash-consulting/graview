import { bindSchema, createSchema, defineNode, Store, type Principal } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/** The routed face's "Recently" and a record's history name the other seat, and say "you" only to the author. */
const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items" });
const schema = createSchema([item]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-item", {
  title: "Add an item",
  description: "Bring one in.",
  creates: ["item"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "item"), kind: "item", label: args.label });
  },
});
const keeper: Principal = { kind: "human", id: "kai", roles: ["keeper"] };
const helper: Principal = { kind: "human", id: "hana", roles: ["helper"] };

describe("whose work the pages say it is", () => {
  const store = new Store({ schema, mutations: [add], invariants: [], policy: { roles: ["keeper", "helper"], grants: [{ roles: ["keeper"], mutations: "*" }] } as never });
  store.apply({ name: "add-item", args: { label: "Pay the deposit" } }, { author: keeper });
  const home = (principal: Principal) => renderToStaticMarkup(<PagesApp context={{ store, principal }} initialPath="/" />);
  it("names the keeper's work to the helper", () => {
    expect(home(helper)).toContain("Add Pay the deposit</span> — kai");
  });
  it("says \"you\" to the keeper about her own", () => {
    expect(home(keeper)).toContain("Add Pay the deposit</span> — you");
  });
});
