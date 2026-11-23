import { describe, expect, it } from "vitest";
import { bindPerson, hostSeat } from "../../src/binding.js";
import { aiContextOf } from "../../src/catalog.js";
import { CHANGED, changedOnce, changedWords } from "../../src/words.js";
import { bindSchema, createSchema, defineNode, nodeRef, Store, TOUCHED_FIELDS, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * A RECORD'S LAST CHANGE IS SAID ONCE TO A MODEL (Graview HQ
 * feature:f-touched-size-on-agent-read-surfaces): `changed: "3 days ago by
 * Ann"` in place of the four, the person by name where the reader may see
 * them and "someone" where not, and the record as it was where it says
 * none of them or keeps a `changed` of its own.
 */
const NOW = "2026-11-23T12:00:00.000Z";
const at = (hoursAgo: number) => new Date(Date.parse(NOW) - hoursAgo * 3_600_000).toISOString();

describe("a record's last change, said once", () => {
  const record = { id: "gift:kite", kind: "gift", title: "A kite", createdAt: at(100), createdBy: "participant:ann", updatedAt: at(75), updatedBy: "participant:ann" };
  const name = (who: string) => (who === "participant:ann" ? "Ann" : undefined);

  it("says when and by whom, by name, in place of the four", () => {
    const said = changedOnce(record, { now: NOW, name });
    expect(said).toEqual({ id: "gift:kite", kind: "gift", title: "A kite", [CHANGED]: "3 days ago by Ann" });
    expect(JSON.stringify(said).length - JSON.stringify({ id: "gift:kite", kind: "gift", title: "A kite" }).length).toBeLessThan(40);
  });

  it("says somebody nothing names by what they are, never by the id", () => {
    expect(changedWords({ ...record, updatedBy: "user_ann" }, { now: NOW, name })).toBe("3 days ago by someone");
    expect(changedWords({ ...record, updatedAt: at(0.5), updatedBy: "agent" }, { now: NOW })).toBe("30 minutes ago by an agent");
    expect(changedWords({ ...record, updatedBy: undefined }, { now: NOW })).toBe("3 days ago");
  });

  it("leaves a record that says none of the four, or keeps a changed of its own, as it was", () => {
    const plain = { id: "gift:top", kind: "gift", title: "A top" };
    expect(changedOnce(plain, { now: NOW })).toBe(plain);
    const own = { ...record, changed: "yes" };
    expect(changedOnce(own, { now: NOW })).toBe(own);
  });
});

const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }) } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const renameGift = defineMutation("rename-gift", {
  subject: { kinds: ["gift"], arg: "id" },
  input: z.object({ id: nodeRef(["gift"]), title: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id as string, { title: args.title });
  },
});
const policy: Policy = { grants: [{ roles: ["member", "guest"], mutations: ["rename-gift"] }], sees: [{ roles: ["member"], kinds: ["participant", "gift"] }, { roles: ["guest"], kinds: ["gift"] }] };
const host = hostSeat({ id: "host" });
const ann: Principal = { kind: "human", id: "acct-ann", roles: ["member"] };

describe("the record a model is told of", () => {
  it("says when and by whom it was last changed once, by the person's name, beside its fields", () => {
    const store = new Store<AnySchema>({ schema, mutations: [renameGift], policy, snapshot: { nodes: [{ id: "participant:ann", kind: "participant", name: "Ann" }, { id: "gift:kite", kind: "gift", title: "A kite" }], edges: [] } } as never);
    bindPerson(store, ann, "participant:ann", { author: host });
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: ann });
    for (const principal of [host, ann]) {
      const record = aiContextOf(store, { on: "record", id: "gift:kite" }, { principal }).target.record!;
      expect(record.changed, principal.id).toBe("just now by Ann");
      for (const field of TOUCHED_FIELDS) expect(record.fields, principal.id).not.toHaveProperty(field);
      expect(JSON.stringify(record), principal.id).not.toContain("acct-ann");
    }
    // A seat that may not see the people is told none of the four, so nothing of who or when.
    const guest = aiContextOf(store, { on: "record", id: "gift:kite" }, { principal: { kind: "human", id: "acct-gus", roles: ["guest"] } }).target.record!;
    expect(guest).not.toHaveProperty("changed");
    expect(JSON.stringify(guest)).not.toMatch(/Ann|acct-ann/);
  });
});
