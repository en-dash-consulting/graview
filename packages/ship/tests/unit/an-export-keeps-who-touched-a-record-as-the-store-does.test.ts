import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BIND_PERSON, createSchema, defineNode, Store, touchedOf, type AnySchema, type Policy, type Principal } from "@graview/core";
import { bindPerson, hostSeat } from "@graview/core/binding";
import { exportBundle } from "../../src/export.js";

/**
 * AN EXPORT KEEPS WHO TOUCHED A RECORD AS THE STORE DOES (Graview HQ
 * feature:f-record-last-touched): its records, and the checkpoint it begins
 * at, keep when each was made and last touched, and who as the store keeps
 * it, the acting seat, as each op's author is kept; whom each seat was bound
 * to stays in the installation. Restored from its snapshot and log, from its
 * log alone or from its checkpoint and log, a record says the same four.
 */
const clock = (start = Date.UTC(2026, 10, 20, 12, 0)) => {
  let at = start;
  return () => new Date((at += 60_000)).toISOString();
};
const participant = defineNode("participant", { people: true, label: (n: { name: string }) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: { title: string }) => n.title, fields: z.object({ title: z.string() }) } as never);
const family = createSchema([participant, gift]);
const rules: Policy = { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["owner"], mutations: [BIND_PERSON] }, { roles: ["member"], mutations: ["edit-gift"] }], sees: [{ roles: ["member"], kinds: ["participant", "gift"] }] };
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const host = hostSeat({ id: "host" });

type Bundle = { checkpoint?: { bound?: object; base: { nodes: { id: string }[] } }; snapshot: { nodes: { id: string }[]; edges: object[] }; log: { author?: { id?: string } }[] };

function touchedByBud(): Store<AnySchema> {
  const store = new Store<AnySchema>({ schema: family, policy: rules, now: clock() } as never);
  store.applyPrimitives([{ op: "add-node", node: { id: "participant:bud", kind: "participant", name: "Bud" } }, { op: "add-node", node: { id: "gift:kite", kind: "gift", title: "A kite" } }] as never, { author: host });
  bindPerson(store, bud, "participant:bud", { author: host });
  store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "Red" } }, { author: bud });
  return store;
}
const kiteIn = (nodes: readonly { id: string }[]) => touchedOf(nodes.find((node) => node.id === "gift:kite"));
const bundleOf = (store: Store<AnySchema>) => exportBundle({ name: "fam", schema: family } as never, store) as unknown as Bundle;

describe("an export", () => {
  it("keeps who touched each record as the seat that did, as its log keeps that op's author", () => {
    const bundle = bundleOf(touchedByBud());
    expect(kiteIn(bundle.snapshot.nodes).updatedBy).toBe("acct-bud");
    expect(bundle.log.some((op) => op.author?.id === "acct-bud")).toBe(true);
    expect(bundle.checkpoint?.bound).toBeUndefined();
  });

  it("of a compacted store keeps the seat in the checkpoint it begins at, and nothing of whom each seat was bound to", () => {
    const store = touchedByBud();
    store.compact(store.checkpoint({ seq: store.log.length })!);
    const bundle = bundleOf(store);
    expect(kiteIn(bundle.checkpoint!.base.nodes).updatedBy).toBe("acct-bud");
    expect(kiteIn(bundle.snapshot.nodes).updatedBy).toBe("acct-bud");
    expect(bundle.checkpoint?.bound).toBeUndefined();
  });

  it("restored from its snapshot and log, from its log alone, or from its checkpoint and log, says the four the store said", () => {
    const store = touchedByBud();
    const kept = touchedOf(store.graph.getNode("gift:kite"));
    expect(kept.updatedBy).toBe("acct-bud");
    const whole = bundleOf(store);
    const fromSnapshot = new Store<AnySchema>({ schema: family, policy: rules, snapshot: whole.snapshot, log: whole.log } as never);
    const fromLog = new Store<AnySchema>({ schema: family, policy: rules, log: whole.log } as never);
    store.compact(store.checkpoint({ seq: store.log.length })!);
    const compacted = bundleOf(store);
    const fromCheckpoint = new Store<AnySchema>({ schema: family, policy: rules, log: compacted.log, epochs: [compacted.checkpoint] } as never);
    for (const restored of [fromSnapshot, fromLog, fromCheckpoint]) expect(touchedOf(restored.graph.getNode("gift:kite"))).toEqual(kept);
  });
});
