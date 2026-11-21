import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BIND_PERSON, createSchema, defineNode, Store, touchedOf, type AnySchema, type Policy, type Principal } from "@graview/core";
import { bindPerson, hostSeat } from "@graview/core/binding";
import { exportBundle } from "../../src/export.js";

/**
 * AN EXPORT SAYS WHO TOUCHED A RECORD AS THE PERSON (Graview HQ
 * feature:f-record-last-touched): its records, and the checkpoint it begins
 * at, keep when each was made and last touched and say who as the record
 * of the people kind they are bound to; whom each seat was bound to stays
 * in the installation.
 */
const clock = (start = Date.UTC(2026, 10, 20, 12, 0)) => { let at = start; return () => new Date((at += 60_000)).toISOString(); };
const participant = defineNode("participant", { people: true, label: (n: { name: string }) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: { title: string }) => n.title, fields: z.object({ title: z.string() }) } as never);
const family = createSchema([participant, gift]);
const rules: Policy = { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["owner"], mutations: [BIND_PERSON] }, { roles: ["member"], mutations: ["edit-gift"] }], sees: [{ roles: ["member"], kinds: ["participant", "gift"] }] };
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };

describe("an export of a compacted store", () => {
  it("says who touched each record as the person, and carries nothing of whom each seat was bound to", () => {
    const store = new Store<AnySchema>({ schema: family, policy: rules, now: clock(), snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }, { id: "gift:kite", kind: "gift", title: "A kite" }], edges: [] } } as never);
    bindPerson(store, bud, "participant:bud", { author: hostSeat({ id: "host" }) });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "Red" } }, { author: bud });
    store.compact(store.checkpoint({ seq: store.log.length })!);
    const bundle = exportBundle({ name: "fam", schema: family } as never, store) as unknown as { checkpoint?: { bound?: object; base: { nodes: object[] } }; snapshot: { nodes: object[] } };
    expect(JSON.stringify(bundle)).not.toContain("acct-bud");
    expect(bundle.checkpoint?.bound).toBeUndefined();
    expect(touchedOf(bundle.snapshot.nodes.find((node) => (node as { id: string }).id === "gift:kite")).updatedBy).toBe("participant:bud");
  });
});
