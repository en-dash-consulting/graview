import { describe, expect, it } from "vitest";
import "../../src/field-sight.js";
import { compileDocument } from "../../src/check.js";
import { type GraviewDocument } from "../../src/document/index.js";
import { redact, seatLens, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { answerSeenBy } from "../../src/seat.js";
import { search } from "../../src/search.js";

/**
 * A SENDER WITH NO ROLE SEES THEIR OWN TICKET, MINUS WHAT THE SIGHT HIDES
 * (Roadmap f-sight-own-with-hide, request:sight-own-with-hide-drops-the-record).
 * Graview Public's `{ roles: "*", kinds: ["ticket"], own: true, hide:
 * ["triage"] }` — or the same with `fields` — shows a sender their own
 * ticket without its label: in the seat view, the log it is served, an
 * act's answer and a search, and never another sender's. The record drops
 * only where field sight is not loaded at all, which a host that opens a
 * store of its own must import (`a-sight-that-hides-a-field-fails-closed-until-it-can-judge`).
 */

const desk = (sight: object): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Desk",
    kinds: {
      ticket: {
        noun: "ticket",
        plural: "tickets",
        label: "{title}",
        fields: { title: { type: "string", required: true }, body: { type: "text" }, triage: { type: "enum", options: ["low", "high"] } },
      },
    },
    acts: { "file-ticket": { title: "File a ticket", creates: "ticket" } },
    roles: ["staff"],
    policy: {
      grants: [{ roles: "*", mutations: ["file-ticket"] }, { roles: ["staff"], mutations: "*" }],
      sees: [sight, { roles: ["staff"], kinds: ["ticket"] }],
    },
  }) as unknown as GraviewDocument;

function opened(document: GraviewDocument): Store<AnySchema> {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}) });
}

const sender: Principal = { kind: "human", id: "person:sam" };
const staff: Principal = { kind: "human", id: "person:ola", roles: ["staff"] };

describe("a sender with no role sees their own ticket, minus what the sight hides", () => {
  for (const [said, sight] of [
    ["own with hide", { roles: "*", kinds: ["ticket"], own: true, hide: ["triage"] }],
    ["own with fields", { roles: "*", kinds: ["ticket"], own: true, fields: ["title", "body"] }],
    ["own alone", { roles: "*", kinds: ["ticket"], own: true }],
  ] as const) {
    it(`${said}: the ticket they filed is served to them`, () => {
      const store = opened(desk(sight));
      const filed = store.apply({ name: "file-ticket", args: { title: "Printer jammed", body: "Again." } }, { author: sender });
      expect(filed.minted).toHaveLength(1);
      const id = filed.minted?.[0] as string;
      store.applyPrimitives([{ op: "patch-node", id, before: {}, after: { triage: "high" } }], { author: staff });
      const other = store.apply({ name: "file-ticket", args: { title: "Not mine" } }, { author: { kind: "human", id: "person:kim" } }).minted?.[0] as string;
      const seen = store.seenBy(sender).graph;
      const ticket = seen.getNode(id) as unknown as Record<string, unknown> | undefined;
      expect(ticket).toMatchObject({ id, title: "Printer jammed", body: "Again." });
      if (said !== "own alone") expect(ticket).not.toHaveProperty("triage");
      expect((seen.nodesOfKind("ticket") as { id: string }[]).map((one) => one.id)).toEqual([id]);
      expect(seen.getNode(other)).toBeUndefined();
      // The log it is served adds its ticket, and no op says the label.
      const served = redact(store.log.all(), seatLens(store, sender));
      expect(served.some((op) => op.primitives.some((p) => p.op === "add-node" && p.node.id === id))).toBe(true);
      if (said !== "own alone") expect(JSON.stringify(served)).not.toContain('"high"');
      // An act's answer and a search, as the sender.
      const again = store.apply({ name: "file-ticket", args: { title: "Printer jammed twice" } }, { author: sender });
      expect(answerSeenBy(store, sender, again).diff?.addedNodes.map((node: { id: string }) => node.id)).toEqual(again.minted);
      expect(search(store, "Printer", { principal: sender }).hits.flatMap((hit) => (hit.about === "node" ? [hit.id] : []))).toContain(id);
    });
  }
});
