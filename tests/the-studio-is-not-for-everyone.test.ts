import { bindSchema, createSchema, defineNode, Store, z, type Principal } from "@graview/core";
import { maySeeTheStudio } from "@graview/studio";
import { describe, expect, it } from "vitest";
import { createStore as discography } from "../apps/discography/src/domain/app.js";
import { SEATS as discographySeats } from "../apps/discography/src/ui/seats.js";
import { createStore as gauntlet } from "../apps/gauntlet/src/domain/app.js";
import { SEATS as gauntletSeats } from "../apps/gauntlet/src/ui/seats.js";

/**
 * THE STUDIO IS NOT FOR EVERYONE. A showroom with shoppers and staff and no
 * installation offered its own declaration — kinds, roles, rules, the
 * policy itself — to somebody browsing who may do nothing but sign up (the
 * seventh walk). Under a policy, it is offered to the seats that may do
 * everything; with none, to whoever is here.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const schema = createSchema([car]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-car", { title: "Put a car on sale", creates: ["car"], input: z.object({ label: z.string() }), apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "car"), kind: "car", label: args.label }) });
const browsing: Principal = { kind: "human", id: "browsing", roles: [] };

describe("who is offered the studio", () => {
  it("is everybody where there is no policy, and only who may do everything where there is", () => {
    expect(maySeeTheStudio(new Store({ schema, mutations: [add] }), browsing)).toBe(true);
    const guarded = new Store({ schema, mutations: [add], policy: { grants: [{ roles: ["manager"], mutations: "*" }, { roles: "*", mutations: ["add-car"] }] } });
    expect(maySeeTheStudio(guarded, browsing)).toBe(false);
    expect(maySeeTheStudio(guarded, { kind: "human", id: "rhian", roles: ["manager"] })).toBe(true);
  });

  it("in every example with a policy, never to a seat that may not do everything", () => {
    for (const [store, seats] of [[gauntlet(), gauntletSeats], [discography(), discographySeats]] as const) {
      for (const { principal } of seats) {
        const everything = (store.policy?.grants ?? []).some((grant) => grant.mutations === "*" && (grant.roles === "*" || (principal.roles ?? []).some((role) => (grant.roles as readonly string[]).includes(role))));
        if (store.modules.administered.size === 0) expect(maySeeTheStudio(store as never, principal), `${principal.id}`).toBe(everything);
      }
    }
  });
});
