import { createSchema, defineNode, linkedRecordField, Store, type AnySchema, type Principal } from "@graview/core";
import { linkedRecordsOver } from "@graview/core/linked";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime } from "../../src/index.js";

/**
 * A SEAT ACTING FOR A PERSON READS ANOTHER APP AS THAT PERSON (FR-171,
 * FR-06). In its own app an agent acting for somebody may see what both
 * may, and a system seat acting for somebody is not the system. Reading
 * another app's records dropped who it acted for, so the far app judged the
 * agent by its own roles and the system seat as the system: a deal only
 * finance may see was read whole by an agent sitting with somebody in sales.
 */
const deal = defineNode("deal", { fields: z.object({ title: z.string(), margin: z.number().optional() }), label: (node: { title: string }) => node.title });
const crm = new Store<AnySchema>({
  schema: createSchema([deal]) as AnySchema,
  policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["finance"], kinds: ["deal"] }] } as never,
  snapshot: { nodes: [{ id: "d1", kind: "deal", title: "Quiet deal", margin: 42 }], edges: [] } as never,
});
const note = defineNode("note", { fields: z.object({ name: z.string(), about: linkedRecordField("@acme/crm/deal").optional() }) });
const notes = () => new Store<AnySchema>({ schema: createSchema([note]) as AnySchema, snapshot: { nodes: [{ id: "n1", kind: "note", name: "Call", about: "deal:d1" }], edges: [] } as never });
const host = linkedRecordsOver({ "@acme/crm": { store: crm, name: "CRM" } });
const ref = { address: "@acme/crm", kind: "deal", id: "d1" };

const pat: Principal = { kind: "human", id: "pat", roles: ["sales"] };
const agentFor: Principal = { kind: "agent", id: "bot", roles: ["finance", "sales"], onBehalfOf: pat };
const systemFor = { kind: "system", id: "job", onBehalfOf: pat } as Principal;
const finance: Principal = { kind: "human", id: "fay", roles: ["finance"] };

describe("a seat acting for a person reads another app as that person", () => {
  for (const [who, seat] of [
    ["an agent", agentFor],
    ["a system seat", systemFor],
  ] as const) {
    it(`tells ${who} acting for somebody in sales nothing of a deal only finance sees`, async () => {
      expect(await host.resolve(ref, seat)).toBeNull();
      expect(await host.find({ address: "@acme/crm", kinds: ["deal"], query: "", limit: 5 }, seat)).toEqual([]);
      const read = await createToolRuntime(notes(), { author: seat, linked: host }).call("find_linked", { relation: "about", of: "n1" });
      expect(JSON.stringify(read)).not.toContain("Quiet deal");
      const found = await createToolRuntime(notes(), { author: seat, linked: host }).call("find_linked", { relation: "about", query: "" });
      expect(JSON.stringify(found)).not.toContain("Quiet deal");
    });
  }

  it("reads the deal for somebody in finance, and for an agent acting for them", async () => {
    expect(await host.resolve(ref, finance)).toMatchObject({ label: "Quiet deal" });
    const read = await createToolRuntime(notes(), { author: { kind: "agent", id: "bot", onBehalfOf: finance }, linked: host }).call("find_linked", { relation: "about", of: "n1" });
    expect(JSON.stringify(read)).toContain("Quiet deal");
  });
});
