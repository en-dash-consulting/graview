import { describe, expect, it } from "vitest";
import { z } from "zod";
import "../../src/field-sight.js";
import { judgeWithLines } from "../../src/lines.js";
import { answerSeenBy } from "../../src/answer-seen.js";
import { blockContextFor, compileBlocks, resolveBlocks } from "../../src/blocks.js";
import { bindPerson, hostSeat } from "../../src/binding.js";
import { compileDocument } from "../../src/check.js";
import { BIND_PERSON, createSchema, defineNode, offersTouches, Store, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * A RECORD'S FOUR ARE SAID AND JUDGED ALIKE ON EVERY SURFACE (Graview HQ
 * feature:f-record-last-touched): a view spec's text says who as a template
 * does, a host's own store is offered them, a seat told none of them is not
 * judged by a rule that reads them however it reads them, a seat's graph
 * says only whom it may, and `graview check` warns wherever such a reading
 * cannot be judged for a seat.
 */
judgeWithLines();
const clock = (start = Date.UTC(2026, 10, 20, 12, 0)) => {
  let at = start;
  return () => new Date((at += 60_000)).toISOString();
};
const host = hostSeat({ id: "host" });

const participant = defineNode("participant", { people: true, label: (n: { name: string }) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: { title: string }) => n.title, fields: z.object({ title: z.string() }) } as never);
const family = createSchema([participant, gift]);
const familyRules: Policy = { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["owner"], mutations: [BIND_PERSON] }, { roles: ["member"], mutations: ["edit-gift"] }], sees: [{ roles: ["member"], kinds: ["participant", "gift"] }] };
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const amy: Principal = { kind: "human", id: "acct-amy", roles: ["member"] };
const familyStore = () =>
  new Store<AnySchema>({ schema: family, policy: familyRules, now: clock(), snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }, { id: "gift:kite", kind: "gift", title: "A kite" }], edges: [] } } as never);

const guarded = { roles: ["member", "guest"], policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["member"], kinds: ["task"] }, { roles: ["guest"], kinds: ["task"], hide: ["note"] }] } };
const taskDocument = (extra: Record<string, unknown>, kindExtra: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "T",
  kinds: { task: { noun: "task", plural: "tasks", label: "{title}", fields: { title: { type: "string", required: true }, note: { type: "string" }, done: { type: "boolean" } }, ...kindExtra } },
  ...guarded,
  ...extra,
});
const ann: Principal = { kind: "human", id: "ann", roles: ["member"] };
const gus: Principal = { kind: "human", id: "gus", roles: ["guest"] };
function opened(document: object) {
  const made = compileDocument(document as never);
  if (!made.ok) throw new Error(JSON.stringify(made.findings));
  const store = new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations, invariants: made.app.invariants, policy: made.app.policy, now: clock() } as never);
  store.applyPrimitives([{ op: "add-node", node: { id: "task:a", kind: "task", title: "A" } }] as never, { author: ann });
  return store;
}
const codesOf = (document: object) => {
  const made = compileDocument(document as never);
  return (made.findings ?? []).filter((finding) => finding.code === "touched-read-kept").map((finding) => finding.path);
};

describe("a view spec's text", () => {
  it("says who touched a record as the person's label, or someone, never the seat", () => {
    const store = familyStore();
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "Red" } }, { author: bud });
    const said = () => JSON.stringify(resolveBlocks(compileBlocks([{ text: "Changed by {updatedBy}" }] as never), blockContextFor(store as never, amy, { id: "gift:kite", kind: "gift" }, { slot: "page" })));
    expect(said()).toContain("Changed by someone");
    expect(said()).not.toContain("acct-bud");
    bindPerson(store, bud, "participant:bud", { author: host });
    expect(said()).toContain("Changed by Bud");
  });
});

describe("a store's offer of the four", () => {
  it("is made by a host's own store, given no seat, whatever its policy", () => {
    const schema = createSchema([defineNode("task", { fields: z.object({ label: z.string(), note: z.string().optional() }) })]);
    const policy = guarded.policy as unknown as Policy;
    expect(offersTouches(new Store<AnySchema>({ schema, policy } as never))).toBe(true);
    expect(offersTouches(new Store<AnySchema>({ schema, policy, principal: gus } as never))).toBe(false);
    expect(offersTouches(new Store<AnySchema>({ schema, policy, principal: ann } as never))).toBe(true);
  });

  it("is not worked out again while the log is as long", () => {
    const schema = createSchema([defineNode("task", { fields: z.object({ label: z.string() }) })]);
    const store = new Store<AnySchema>({ schema } as never);
    for (let at = 0; at < 2000; at++) store.applyPrimitives([{ op: "add-node", node: { id: `task:${at}`, kind: "task", label: "A" } }] as never, { author: ann });
    const all = store.log.all.bind(store.log);
    let read = 0;
    (store.log as { all: () => unknown }).all = () => ((read += 1), all());
    for (let at = 0; at < 50; at++) offersTouches(store);
    expect(read).toBeLessThanOrEqual(1);
  });
});

describe("a seat told none of the four", () => {
  it("is not answered with a rule that reads them, as its violations are not", () => {
    const store = opened(taskDocument({ rules: { fresh: { title: "Fresh", over: "task", require: "present(updatedAt)", says: "{title} has no time" } }, acts: { finish: { title: "Finish", on: "task", effects: [{ set: { done: true } }] } } }));
    const answer = answerSeenBy(store as never, gus, store.apply({ name: "finish", args: { id: "task:a" } }, { author: gus }) as never) as { violationsAfter?: { invariant: string }[]; introduces?: { invariant: string }[] };
    expect((answer.violationsAfter ?? []).map((one) => one.invariant)).not.toContain("fresh");
    expect((answer.introduces ?? []).map((one) => one.invariant)).not.toContain("fresh");
  });

  it("is not judged by a rule that only says them, nor by one that reads them through a computed value", () => {
    const store = opened(
      taskDocument(
        { rules: { said: { title: "Said", over: "task", require: "done == true", says: "{title} last changed by {updatedBy}" }, through: { title: "Through", over: "task", require: "present(when)" } } },
        { computed: { when: { expr: "updatedAt" } } },
      ),
    );
    const names = store.seenBy(gus).violations().map((one) => one.invariant);
    expect(names).not.toContain("said");
    expect(names).not.toContain("through");
    expect(store.seenBy(ann).violations().map((one) => one.invariant)).toContain("said");
  });

  it("is told an act whose condition reads them through a computed value cannot be judged for it", () => {
    const store = opened(taskDocument({ acts: { finish: { title: "Finish", on: "task", allowedWhen: "stale", effects: [{ set: { done: true } }] } } }, { computed: { stale: { expr: "present(updatedAt)" } } }));
    expect(() => store.apply({ name: "finish", args: { id: "task:a" } }, { author: gus })).toThrow(/cannot be judged for you/);
    expect(() => store.apply({ name: "finish", args: { id: "task:a" } }, { author: ann })).not.toThrow();
  });
});

describe("a seat's graph", () => {
  it("hands out no seat's binding, and says whom another seat is only as a record it is served", () => {
    const store = familyStore();
    bindPerson(store, bud, "participant:bud", { author: host });
    const told = store.seenBy(amy).graph as unknown as { everBound?: unknown; personSaidFor(seat: string): string | undefined };
    expect(told.everBound).toBeUndefined();
    expect(told.personSaidFor("acct-bud")).toBe("participant:bud");
    const policy: Policy = { ...familyRules, sees: [{ roles: ["member"], kinds: ["gift"] }] };
    const narrow = new Store<AnySchema>({ schema: family, policy, now: clock(), snapshot: store.snapshot() } as never);
    bindPerson(narrow, bud, "participant:bud", { author: host });
    expect((narrow.seenBy(amy).graph as unknown as { personSaidFor(seat: string): string | undefined }).personSaidFor("acct-bud")).toBeUndefined();
  });

  it("says an account's profile as someone where the account is bound, as a seat's view does", () => {
    const store = familyStore();
    bindPerson(store, bud, "participant:bud", { author: host });
    expect(store.graph.personSaidFor("acct-bud~work")).toBe("someone");
  });
});

describe("graview check", () => {
  it("warns of a reading of the four that a role seeing nothing, a rule's words or a job cannot be judged by", () => {
    const blind = { ...taskDocument({ rules: { old: { title: "Old", over: "task", require: "present(updatedAt)" } } }), policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["member"], kinds: ["task"] }] } };
    expect(codesOf(blind)).toContain("rules.old.require");
    expect(codesOf(taskDocument({ rules: { said: { title: "Said", over: "task", require: "done == true", says: "by {updatedBy}" } } }))).toContain("rules.said.says");
    expect(codesOf(taskDocument({ purpose: { jobs: [{ name: "Stale", kind: "task", where: "present(updatedAt)" }] } }))).toContain("purpose.jobs.0.where");
  });
});
