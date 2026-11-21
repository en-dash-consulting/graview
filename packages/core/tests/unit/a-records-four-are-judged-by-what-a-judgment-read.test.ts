import { describe, expect, it } from "vitest";
import { z } from "zod";
import "../../src/field-sight.js";
import { judgeWithLines } from "../../src/lines.js";
import { blockContextFor, compileBlocks, resolveBlocks } from "../../src/blocks.js";
import { bindPerson, hostSeat } from "../../src/binding.js";
import { compileDocument } from "../../src/check.js";
import { BIND_PERSON, createSchema, defineNode, markServed, offersTouches, Store, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * A RECORD'S FOUR ARE JUDGED BY WHAT A JUDGMENT READ (Graview HQ
 * feature:f-record-last-touched): for a seat told none of them, an act's
 * condition, its refusal, a value it works out and a rule are withheld
 * exactly when judging them read one of the four — by a member, a relation,
 * an aggregate, a computed value or a fact, however it was named — and
 * judged as for anyone else when they did not. A seat's view acts and asks
 * as its seat, and a page says who as the person wherever it reads who.
 */
judgeWithLines();
const clock = (start = Date.UTC(2026, 10, 20, 12, 0)) => {
  let at = start;
  return () => new Date((at += 60_000)).toISOString();
};
const ann: Principal = { kind: "human", id: "ann", roles: ["member"] };
const gus: Principal = { kind: "human", id: "gus", roles: ["guest"] };
const UNJUDGED = /cannot be judged for you/;

const listDocument = (extra: Record<string, unknown>, task: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "L",
  kinds: {
    list: { noun: "list", plural: "lists", label: "{title}", fields: { title: { type: "string", required: true }, done: { type: "boolean" }, copy: { type: "string" } } },
    task: { noun: "task", plural: "tasks", label: "{title}", fields: { title: { type: "string", required: true }, note: { type: "string" } }, ...task },
  },
  roles: ["member", "guest"],
  policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["member"], kinds: ["list", "task"] }, { roles: ["guest"], kinds: ["list", "task"], hide: ["note"] }] },
  ...extra,
});
function opened(extra: Record<string, unknown>, task: Record<string, unknown> = {}) {
  const made = compileDocument(listDocument(extra, task) as never);
  if (!made.ok) throw new Error(JSON.stringify(made.findings));
  const store = new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations, invariants: made.app.invariants, policy: made.app.policy, now: clock() } as never);
  store.applyPrimitives([{ op: "add-node", node: { id: "list:l", kind: "list", title: "L" } }, { op: "add-node", node: { id: "task:t", kind: "task", title: "T" } }] as never, { author: ann });
  return { store, findings: made.findings ?? [] };
}
const tried = (store: Store<AnySchema>, name: string, who: Principal): string => {
  try {
    store.apply({ name, args: { id: "list:l" } } as never, { author: who });
    return "applied";
  } catch (error) {
    return (error as Error).message;
  }
};
const warned = (findings: readonly { readonly code: string; readonly path?: string }[]) => findings.filter((finding) => finding.code === "touched-read-kept").map((finding) => finding.path);
const fresh = { computed: { fresh: { expr: "count(all('task') where present(updatedAt)) > 0" } } };

describe("an act's condition, for a seat told none of the four", () => {
  it("cannot be judged when it reads them through a fact it names by a string it works out", () => {
    const { store, findings } = opened({ ...fresh, acts: { close: { title: "Close", on: "list", allowedWhen: "!fact(concat('fre', 'sh'))", effects: [{ set: { done: true } }] } } });
    expect(tried(store, "close", gus)).toMatch(UNJUDGED);
    expect(store.graph.getNode("list:l")).not.toMatchObject({ done: true });
    expect(tried(store, "close", ann)).toMatch(/is not allowed/);
    expect(warned(findings)).toContain("computed.fresh");
  });

  it("cannot be judged when it reads a far record's through a relation", () => {
    const { store } = opened(
      { acts: { close: { title: "Close", on: "list", allowedWhen: "count(in('list') where present(updatedAt)) == 0", effects: [{ set: { done: true } }] } } },
      { edges: { list: { to: ["list"], cardinality: "one" } } },
    );
    store.applyPrimitives([{ op: "add-edge", edge: { from: "task:t", to: "list:l", kind: "list" } }] as never, { author: ann });
    expect(tried(store, "close", gus)).toMatch(UNJUDGED);
    expect(tried(store, "close", ann)).toMatch(/is not allowed/);
  });

  it("is judged as for anyone when it reads none of them, though it names a word another kind's computed value is called", () => {
    const { store } = opened({ acts: { close: { title: "Close", on: "list", allowedWhen: "title != 'stale'", effects: [{ set: { done: true } }] } } }, { computed: { stale: { expr: "present(updatedAt)" } } });
    expect(tried(store, "close", gus)).toBe("applied");
    expect(store.seenBy(gus).wouldDo([{ name: "close", args: { id: "list:l" } }] as never)[0]).toBe("nothing");
  });

  it("refuses in its plain words where its own words would say them", () => {
    const { store, findings } = opened({ acts: { shut: { title: "Shut", on: "list", allowedWhen: "done == true", refusal: "last changed {updatedAt} by {updatedBy}", effects: [{ set: { done: true } }] } } });
    expect(tried(store, "shut", gus)).toBe(`"Shut" is not allowed for L right now`);
    expect(tried(store, "shut", ann)).toMatch(/^last changed .* by someone$/);
    expect(warned(findings)).toContain("acts.shut.refusal");
  });
});

describe("a value an act works out, for a seat told none of the four", () => {
  it("is refused where it reads them, and nothing is written where others read it", () => {
    const { store, findings } = opened({ acts: { stamp: { title: "Stamp", on: "list", effects: [{ set: { copy: { expr: "concat(updatedBy, ' ', updatedAt)" } } }] } } });
    expect(tried(store, "stamp", gus)).toMatch(UNJUDGED);
    expect(store.graph.getNode("list:l")).not.toHaveProperty("copy");
    expect(tried(store, "stamp", ann)).toBe("applied");
    expect(warned(findings).some((path) => path?.startsWith("acts.stamp.effects"))).toBe(true);
  });
});

describe("a rule, for a seat told none of the four", () => {
  it("is not reported where it reads them through a fact it names by a string it works out", () => {
    const { store } = opened({ ...fresh, rules: { none: { title: "None fresh", over: "graph", require: "!fact(concat('fre','sh'))" } } });
    expect(store.seenBy(ann).violations().map((one) => one.invariant)).toContain("none");
    expect(store.seenBy(gus).violations().map((one) => one.invariant)).not.toContain("none");
  });

  it("is reported as to anyone where it reads none of them", () => {
    const { store } = opened({ rules: { named: { title: "Named", over: "list", require: "title == 'stale'" } } }, { computed: { stale: { expr: "present(updatedAt)" } } });
    expect(store.seenBy(gus).violations().map((one) => one.invariant)).toContain("named");
  });
});

describe("a seat's view", () => {
  const roles = () => {
    const made = compileDocument({
      format: "graview-document",
      formatVersion: 1,
      name: "R",
      kinds: { task: { noun: "task", plural: "tasks", label: "{title}", fields: { title: { type: "string", required: true } } } },
      roles: ["owner", "guest"],
      policy: { grants: [{ roles: ["owner"], mutations: "*" }], sees: [{ roles: ["owner", "guest"], kinds: ["task"] }] },
    } as never);
    if (!made.ok) throw new Error(JSON.stringify(made.findings));
    return made.app;
  };
  const owner: Principal = { kind: "human", id: "own", roles: ["owner"] };
  const guest: Principal = { kind: "human", id: "gst", roles: ["guest"] };

  it("acts and asks as its seat, an author left undefined included, and writes no primitives", () => {
    const app = roles();
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations, invariants: app.invariants, policy: app.policy, principal: owner, now: clock() } as never);
    store.applyPrimitives([{ op: "add-node", node: { id: "task:b", kind: "task", title: "B" } }] as never);
    const view = store.seenBy(guest);
    expect(() => view.apply({ name: "edit-task", args: { id: "task:b", title: "Y" } } as never, { author: undefined } as never)).toThrow(/Not permitted/);
    expect(() => view.applyPrimitives([{ op: "remove-node", node: store.graph.getNode("task:b") }] as never)).toThrow(/only by its acts/);
    expect(store.graph.has("task:b")).toBe(true);
    expect(view.permittedMutations().length).toBe(store.permittedMutations(guest).length);
    expect(view.permittedMutations().length).toBeLessThan(store.permittedMutations(owner).length);
  });

  it("says the same of an account bound to a record it is not served as of one bound to nobody", () => {
    const participant = defineNode("participant", { people: true, label: (n: { name: string }) => n.name, fields: z.object({ name: z.string() }) } as never);
    const gift = defineNode("gift", { label: (n: { title: string }) => n.title, fields: z.object({ title: z.string() }) } as never);
    const schema = createSchema([participant, gift]);
    const policy: Policy = { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["owner"], mutations: [BIND_PERSON] }], sees: [{ roles: ["member"], kinds: ["gift"] }] };
    const store = new Store<AnySchema>({ schema, policy, now: clock(), snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }, { id: "gift:kite", kind: "gift", title: "A kite" }], edges: [] } } as never);
    bindPerson(store, { kind: "human", id: "acct-bud", roles: ["member"] }, "participant:bud", { author: hostSeat({ id: "host" }) });
    const graph = store.seenBy({ kind: "human", id: "acct-amy", roles: ["member"] }).graph as unknown as { personSaidFor(seat: string): string | undefined };
    expect(graph.personSaidFor("acct-bud")).toBe(graph.personSaidFor("acct-nobody"));
  });
});

describe("a page", () => {
  it("says who touched a record as the person wherever it reads who, through a relation too", () => {
    const made = compileDocument(listDocument({ roles: ["member"], policy: { grants: [{ roles: "*", mutations: "*" }] } }, { edges: { list: { to: ["list"], cardinality: "one" } } }) as never);
    if (!made.ok) throw new Error(JSON.stringify(made.findings));
    const store = new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations, invariants: made.app.invariants, policy: made.app.policy, now: clock() } as never);
    store.applyPrimitives([{ op: "add-node", node: { id: "list:l", kind: "list", title: "L" } }, { op: "add-node", node: { id: "task:t", kind: "task", title: "T" } }, { op: "add-edge", edge: { from: "task:t", to: "list:l", kind: "list" } }] as never, { author: ann });
    const said = JSON.stringify(resolveBlocks(compileBlocks([{ text: "List by {list.updatedBy}; {concat('by ', updatedBy)}" }] as never), blockContextFor(store as never, ann, { id: "task:t", kind: "task" }, { slot: "page" })));
    expect(said).toContain("List by someone; by someone");
    expect(said).not.toContain("ann");
  });

  it("holding what a seat is served answers as it was told, and a copy of it as the store it copies", () => {
    const { store } = opened({});
    const copy = (told?: boolean) => markServed(new Store<AnySchema>({ schema: store.schema, policy: store.policy, snapshot: store.seenBy(gus).graph.snapshot() as never } as never), told);
    expect(offersTouches(copy(false))).toBe(false);
    expect(offersTouches(copy(true))).toBe(true);
    expect(offersTouches(copy())).toBe(false);
  });
});
