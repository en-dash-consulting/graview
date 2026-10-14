import { afterEach, describe, expect, it } from "vitest";
import { FIELD_SIGHT, Store, type AnySchema, type Principal } from "../../src/index.js";
import { seesEveryRecord } from "../../src/seen.js";
import { MUTATIONS, parent, schema, world } from "../support/hidden-phones.js";

/**
 * A SIGHT THAT HIDES A FIELD FAILS CLOSED UNTIL IT CAN BE JUDGED (Roadmap
 * f-field-sight). Judging one is `@graview/core/field-sight`'s, which a
 * host that serves seats loads (`@graview/ship`'s server entry)
 * and a hosted page does not carry up front. A store without it
 * cannot keep a field, so it keeps the record: a sight with `hide` or
 * `fields` shows nothing — never the whole record. A store whose host
 * already served it what one seat may see (`openRemote`'s) is a mirror and
 * shows what it was served — that store, and no other store on the same
 * page. This file never loads field sight.
 */
afterEach(() => {
  delete FIELD_SIGHT.on;
});

/** A seat that may read contacts' names and do nothing: it may begin no contact, so a kind it cannot see is kept from it. */
const reader: Principal = { kind: "human", id: "person:rex", roles: ["reader"] };
const readOnly = (): Store<AnySchema> =>
  new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    mutations: MUTATIONS as never,
    policy: { roles: ["reader"], grants: [], sees: [{ roles: ["reader"], kinds: ["contact"], fields: ["name"] }] },
    snapshot: { nodes: [{ id: "contact:doc", kind: "contact", name: "Doc", phone: "555 0101" }], edges: [] } as never,
  });

describe("a sight that hides a field, not yet judged", () => {
  it("is not loaded here", () => {
    expect(FIELD_SIGHT.lens).toBeUndefined();
  });

  it("shows nothing: the parent is served no player only that sight shows — never one with its phone number", () => {
    const view = world("555 0101").seenBy(parent);
    expect(view.graph.getNode("player:ann")).toBeUndefined();
    expect(JSON.stringify(view.snapshot())).not.toContain("555 0101");
    expect(JSON.stringify(view.log.all())).not.toContain("555 0101");
    // A record another sight shows whole is shown: Pat's own child.
    expect(view.graph.getNode("player:bea")).toMatchObject({ phone: "444 0303" });
  });

  it("in a mirror of what a host served, shows what it holds: the host judged it", () => {
    const mirror = world(undefined);
    FIELD_SIGHT.served.add(mirror);
    expect(mirror.seenBy(parent).graph.getNode("player:ann")).toMatchObject({ name: "Annie" });
  });

  it("trusts the mirror alone: a whole store on the same page still serves the parent no player only that sight shows", () => {
    const mirror = world(undefined);
    FIELD_SIGHT.served.add(mirror);
    const whole = world("555 0101");
    expect(mirror.seenBy(parent).graph.getNode("player:ann")).toBeDefined();
    expect(whole.seenBy(parent).graph.getNode("player:ann")).toBeUndefined();
    expect(JSON.stringify(whole.seenBy(parent).snapshot())).not.toContain("555 0101");
    expect(FIELD_SIGHT.on).toBeUndefined();
  });

  it("keeps the kind and says the seat does not see every record of it, as the records themselves are kept", () => {
    const store = readOnly();
    expect(store.seenBy(reader).graph.getNode("contact:doc")).toBeUndefined();
    expect([...store.kindsKeptFrom(reader)]).toContain("contact");
    expect(seesEveryRecord(store, reader)("contact")).toBe(false);
    FIELD_SIGHT.served.add(store);
    expect([...store.kindsKeptFrom(reader)]).not.toContain("contact");
    expect(seesEveryRecord(store, reader)("contact")).toBe(true);
  });
});
