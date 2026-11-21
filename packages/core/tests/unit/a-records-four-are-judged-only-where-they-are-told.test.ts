import { describe, expect, it } from "vitest";
import { z } from "zod";
import "../../src/field-sight.js";
import { bindPerson, hostSeat, unbindPerson } from "../../src/binding.js";
import { compileDocument } from "../../src/check.js";
import * as check from "../../src/check.js";
import { aiContextOf } from "../../src/catalog.js";
import { evaluateExpr, parseExpr } from "../../src/document/index.js";
import { parseTemplate } from "../../src/document/template-parse.js";
import { renderTemplate } from "../../src/document/template.js";
import { shapesOfSchema } from "../../src/document/rules.js";
import { arrangeable } from "../../src/arrange.js";
import { BIND_PERSON, createSchema, defineNode, offersTouches, Store, touchedOf, touchesSaid, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * A RECORD'S FOUR ARE JUDGED ONLY WHERE THEY ARE TOLD (Graview HQ
 * feature:f-record-last-touched). A rule, an act's condition or a template
 * that reads when a record was made or touched reads them as the seat may
 * see them: for a seat told none of them, a rule is not reported and an act
 * says it cannot be judged; `graview check` says so of a declaration whose
 * policy keeps anything from a seat. Who touched a record is said as the
 * person, a binding since ended included, or as somebody — never a seat's
 * id — on the store's own side, in a template and to a model.
 */

const clock = (start = Date.UTC(2026, 10, 20, 12, 0)) => { let at = start; return () => new Date((at += 60_000)).toISOString(); };
const participant = defineNode("participant", { people: true, label: (n: { name: string }) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: { title: string }) => n.title, fields: z.object({ title: z.string() }) } as never);
const family = createSchema([participant, gift]);
const rules: Policy = {
  grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["owner"], mutations: [BIND_PERSON] }, { roles: ["member"], mutations: ["edit-gift", "add-gift", "remove-gift"] }],
  sees: [{ roles: ["owner"], kinds: ["participant", "gift"] }, { roles: ["member"], kinds: ["participant", "gift"] }],
};
const host = hostSeat({ id: "host" });
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const amy: Principal = { kind: "human", id: "acct-amy", roles: ["member"] };
const cal: Principal = { kind: "human", id: "acct-cal", roles: ["member"] };
const home = () => new Store<AnySchema>({ schema: family, policy: rules, now: clock(), snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }, { id: "participant:amy", kind: "participant", name: "Amy" }, { id: "gift:kite", kind: "gift", title: "A kite" }], edges: [] } } as never);

const guarded = { roles: ["member", "guest"], policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["member"], kinds: ["task"] }, { roles: ["guest"], kinds: ["task"], hide: ["note"] }] } };
const tasks = (extra: Record<string, unknown>) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "T",
  kinds: { task: { noun: "task", plural: "tasks", label: "{title}", fields: { title: { type: "string", required: true }, note: { type: "string" }, done: { type: "boolean" } } } },
  ...guarded,
  ...extra,
});
const gus: Principal = { kind: "human", id: "gus", roles: ["guest"] };
const ann: Principal = { kind: "human", id: "ann", roles: ["member"] };

describe("who touched a record is said as the person, on every side", () => {
  it("a rule over the store's graph reads an ended binding as the person, as a seat's view says it", () => {
    const store = home();
    bindPerson(store, amy, "participant:amy", { author: host });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    bindPerson(store, bud, "participant:bud", { author: host });
    unbindPerson(store, bud, { author: host });
    const node = store.graph.getNode("gift:kite")!;
    expect(touchedOf(store.seenBy(amy).graph.getNode("gift:kite")).updatedBy).toBe("participant:bud");
    expect(evaluateExpr(parseExpr("updatedBy"), { graph: store.graph as never, subject: node as never, kinds: shapesOfSchema(family) })).toBe("participant:bud");
  });

  it("a template says who as their record's label, or somebody, never a seat's id", () => {
    const store = home();
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    const say = () => renderTemplate(parseTemplate("Changed by {updatedBy}"), { node: store.graph.getNode("gift:kite")!, kinds: shapesOfSchema(family), graph: store.graph as never });
    expect(say()).toBe("Changed by someone");
    bindPerson(store, bud, "participant:bud", { author: host });
    expect(say()).toBe("Changed by Bud");
  });

  it("a model is told an account bound to nobody as somebody", () => {
    const store = home();
    bindPerson(store, amy, "participant:amy", { author: host });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: cal });
    expect(touchedOf(touchesSaid(store as never)(store.graph.getNode("gift:kite")!)).updatedBy).toBe("someone");
    const told = aiContextOf(store, { on: "record", id: "gift:kite" }, { principal: amy } as never) as { readonly target: { readonly record?: unknown } };
    expect(JSON.stringify(told.target.record)).not.toContain("acct-cal");
  });

  it("a checkpoint keeps whom each seat was bound to only where the app has people", () => {
    const task = defineNode("task", { fields: z.object({ label: z.string() }) });
    const store = new Store<AnySchema>({ schema: createSchema([task]), now: clock() } as never);
    store.applyPrimitives([{ op: "add-node", node: { id: "task:a", kind: "task", label: "A" } }] as never, { author: bud });
    expect(store.checkpoint({ seq: store.log.length })!.bound).toBeUndefined();
  });
});

describe("a seat told none of the four is judged as not knowing them", () => {
  it("a rule that reads them is not reported to it, and is to a seat told them", () => {
    const made = compileDocument(tasks({ rules: { old: { title: "Touched long ago", over: "task", require: "updatedAt < '2000-01-01T00:00:00Z'", says: "{title} was touched lately" } } }) as never);
    expect(made.ok, JSON.stringify(made.findings)).toBe(true);
    if (!made.ok) return;
    const store = new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations, invariants: made.app.invariants, policy: made.app.policy, now: clock() } as never);
    store.applyPrimitives([{ op: "add-node", node: { id: "task:a", kind: "task", title: "A" } }] as never, { author: ann });
    expect(store.seenBy(ann).violations().map((one) => one.invariant)).toEqual(["old"]);
    expect(store.seenBy(gus).violations()).toEqual([]);
  });

  it("an act whose condition reads them says it cannot be judged for it, and runs for a seat told them", () => {
    const made = compileDocument(tasks({ acts: { finish: { title: "Finish", on: "task", allowedWhen: "present(createdBy)", effects: [{ set: { done: true } }] } } }) as never);
    expect(made.ok, JSON.stringify(made.findings)).toBe(true);
    if (!made.ok) return;
    const store = new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations, policy: made.app.policy, now: clock() } as never);
    store.applyPrimitives([{ op: "add-node", node: { id: "task:a", kind: "task", title: "A" } }] as never, { author: ann });
    expect(() => store.apply({ name: "finish", args: { id: "task:a" } }, { author: gus })).toThrow(/cannot be judged for you/);
    store.apply({ name: "finish", args: { id: "task:a" } }, { author: ann });
    expect(store.graph.getNode("task:a")).toMatchObject({ done: true });
  });

  it("graview check says so of a rule, an act's condition and a computed value that read them, where the policy keeps anything", () => {
    const made = compileDocument(tasks({
      rules: { old: { title: "Old", over: "task", require: "present(updatedAt)" } },
      acts: { finish: { title: "Finish", on: "task", allowedWhen: "present(createdBy)", effects: [{ set: { done: true } }] } },
      kinds: { task: { noun: "task", plural: "tasks", label: "{title}", fields: { title: { type: "string", required: true }, note: { type: "string" }, done: { type: "boolean" } }, computed: { by: { expr: "updatedBy" } } } },
    }) as never);
    expect(made.findings.filter((one) => one.code === "touched-read-kept").map((one) => one.path).sort()).toEqual(["acts.finish.allowedWhen", "kinds.task.computed.by", "rules.old.require"]);
    expect(made.findings.filter((one) => one.code === "touched-read-kept").every((one) => one.severity === "warning")).toBe(true);
  });

  it("a page's own store, made from what such a seat is served, is offered none of them", () => {
    const task = defineNode("task", { fields: z.object({ label: z.string(), note: z.string().optional() }) });
    const schema = createSchema([task]);
    const policy = guarded.policy as Policy;
    const store = new Store<AnySchema>({ schema, policy, now: clock() } as never);
    store.applyPrimitives([{ op: "add-node", node: { id: "task:a", kind: "task", label: "A" } }] as never, { author: ann });
    const page = new Store<AnySchema>({ schema, policy, principal: gus, now: clock(), log: store.seenBy(gus).log.all() } as never);
    expect(offersTouches(page)).toBe(false);
    expect(arrangeable(schema, "task", { touched: offersTouches(page) }).sorts.map((offer) => offer.key)).not.toContain("updatedAt");
    expect(offersTouches(new Store<AnySchema>({ schema, now: clock() } as never))).toBe(true);
  });
});

describe("only the framework says when a record was made", () => {
  it("a host's op that removes a record and adds it again is not believed of when it was made", () => {
    const store = home();
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "Red" } }, { author: bud });
    store.append([{ author: { kind: "system", id: "host" }, intent: "Again", primitives: [
      { op: "remove-node", node: { id: "gift:kite", kind: "gift", title: "Red", createdAt: "1999-01-01T00:00:00.000Z", createdBy: "acct-amy" } },
      { op: "add-node", node: { id: "gift:kite", kind: "gift", title: "Red" } },
    ] } as never]);
    expect(touchedOf(store.graph.getNode("gift:kite")).createdAt).not.toBe("1999-01-01T00:00:00.000Z");
  });

  it("a rebase over a record a migration made leaves it as a fold of the settled log does", () => {
    const server = new Store<AnySchema>({ schema: family, now: clock() } as never);
    server.applyPrimitives([{ op: "add-node", node: { id: "gift:kite", kind: "gift", title: "A kite" } }] as never, { author: { kind: "system", id: "ship:migration" } });
    const client = new Store<AnySchema>({ schema: family, now: clock(Date.UTC(2026, 10, 20, 13)), log: server.log.all() } as never);
    const mine = client.apply({ name: "remove-gift", args: { id: "gift:kite" } }, { author: amy });
    client.rebase({ pending: [], drop: [mine.batch], confirmed: server.log.all() } as never);
    expect(touchedOf(client.graph.getNode("gift:kite"))).toEqual(touchedOf(server.graph.getNode("gift:kite")));
  });
});

describe("the checker's own entry says the four and their refusal", () => {
  it("names them, and the code a kind declaring one is refused with", () => {
    expect(check.TOUCHED_FIELDS).toEqual(["createdAt", "createdBy", "updatedAt", "updatedBy"]);
    expect([check.CREATED_AT, check.CREATED_BY, check.UPDATED_AT, check.UPDATED_BY]).toEqual(["createdAt", "createdBy", "updatedAt", "updatedBy"]);
    expect(check.TOUCHED_FIELD_TAKEN).toBe("touched-field-taken");
  });
});
