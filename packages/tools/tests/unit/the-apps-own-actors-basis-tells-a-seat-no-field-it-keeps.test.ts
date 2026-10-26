import { createSchema, defineNode, Store, z, type AnySchema, type Policy, type Principal } from "@graview/core";
import "@graview/core/field-sight";
import { acceptSuggestion, declineSuggestion, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { dream } from "../../src/tidy.js";

/*
 * THE APP'S OWN ACTOR'S BASIS TELLS A SEAT NO FIELD IT KEEPS. The actor
 * judges as a system seat that sees every field, and says why in words:
 * "Both have the code dummy-code-7731", "Its notes names “Harbor
 * Catering”". A seat whose sight keeps the code, or the notes, may not be
 * told what they hold — not in its tray, not in the log it is served —
 * while a seat that sees them reads the suggestion as before. The fields a
 * basis read go on the change's lineage (`read`), and a seat that keeps
 * one is served the op withheld, as for an act's own sentence that read
 * one.
 */
const client = defineNode("client", { fields: z.object({ label: z.string(), code: z.string().optional() }) });
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }) });
const order = defineNode("order", { fields: z.object({ label: z.string(), notes: z.string().optional() }), edges: { vendor: { to: ["vendor"], cardinality: "one" } } });
const schema = createSchema([client, vendor, order]);
const policy: Policy = {
  roles: ["admin", "viewer"],
  grants: [{ roles: "*", mutations: "*" }],
  sees: [
    { roles: ["admin"], kinds: ["client", "vendor", "order"] },
    { roles: ["viewer"], kinds: ["client", "order"], hide: ["code", "notes"] },
    { roles: ["viewer"], kinds: ["vendor"] },
  ],
} as never;
const admin: Principal = { kind: "human", id: "person:ada", roles: ["admin"] };
const viewer: Principal = { kind: "human", id: "person:vic", roles: ["viewer"] };
const NOW = "2026-10-22T09:00:00.000Z";
const CODE = "DUMMY-CODE-7731";
const make = () =>
  new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    policy,
    now: () => NOW,
    snapshot: {
      nodes: [
        { id: "client:1", kind: "client", label: "North", code: CODE },
        { id: "client:2", kind: "client", label: "South", code: CODE },
        { id: "vendor:harbor", kind: "vendor", label: "Harbor Catering" },
        { id: "order:1", kind: "order", label: "Lunch", notes: "Booked with Harbor Catering for the offsite" },
      ],
      edges: [],
    } as never,
  });
const told = (value: unknown) => JSON.stringify(value).toLowerCase();

describe("a suggestion whose basis read a field a seat keeps", () => {
  it("is in the tray of a seat that sees the field, its basis whole", async () => {
    const store = make();
    await dream(store, { now: NOW });
    const tray = suggestions(store, admin);
    expect(tray.map((one) => one.lineage?.basis)).toEqual(expect.arrayContaining([expect.stringContaining(CODE.toLowerCase()), expect.stringContaining("Its notes")]));
  });

  it("is not in the tray of a seat that keeps the field, nor its value in the log that seat is served", async () => {
    const store = make();
    await dream(store, { now: NOW });
    expect(Object.keys(store.seenBy(viewer).graph.getNode("client:1") as object).sort()).toEqual(["id", "kind", "label"]);
    expect(told(suggestions(store, viewer))).not.toContain(CODE.toLowerCase());
    expect(told(suggestions(store, viewer))).not.toContain("its notes");
    expect(told(store.seenBy(viewer).log.all())).not.toContain(CODE.toLowerCase());
    expect(told(store.seenBy(viewer).log.all())).not.toContain("its notes");
  });

  it("tells a seat that keeps the field the same whatever the field holds", async () => {
    const trayWith = async (code: string) => {
      const store = new Store<AnySchema>({ schema: schema as unknown as AnySchema, policy, now: () => NOW, snapshot: { nodes: [{ id: "client:1", kind: "client", label: "North", code }, { id: "client:2", kind: "client", label: "South", code }], edges: [] } as never });
      await dream(store, { now: NOW });
      return suggestions(store, viewer).map((one) => one.lineage?.basis);
    };
    expect(await trayWith("AAA-111")).toEqual(await trayWith("BBB-222"));
  });

  it("applied on its own, accepted or declined, is served to a seat that keeps the field without its basis", async () => {
    const applied = make();
    await dream(applied, { now: NOW, applyAtLeast: 0.9 });
    expect(applied.log.all().some((op) => op.lineage?.basis.toLowerCase().includes(CODE.toLowerCase()) && !op.suggests)).toBe(true);
    expect(told(applied.seenBy(viewer).log.all())).not.toContain(CODE.toLowerCase());

    const accepted = make();
    await dream(accepted, { now: NOW });
    const merge = suggestions(accepted, admin).find((one) => one.lineage?.basis.toLowerCase().includes(CODE.toLowerCase()))!;
    acceptSuggestion(accepted, merge.id, { author: admin });
    expect(told(accepted.seenBy(viewer).log.all())).not.toContain(CODE.toLowerCase());

    const declinedStore = make();
    await dream(declinedStore, { now: NOW });
    const again = suggestions(declinedStore, admin).find((one) => one.lineage?.basis.toLowerCase().includes(CODE.toLowerCase()))!;
    declineSuggestion(declinedStore, again.id, { author: admin });
    expect(told(declinedStore.seenBy(viewer).log.all())).not.toContain(CODE.toLowerCase());
  });
});
