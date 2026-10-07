import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compileDocument } from "../../src/check.js";
import { columnMoves } from "../../src/columns.js";
import { ActRefusal, createSchema, defineMutation, defineNode, nodeRef, REFUSAL_REASONS, refusalOf, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * FR-119. A RULE'S REFUSAL SAYS SO.
 *
 * From Graview Cloud: `ActRefusal`'s reason defaulted to `invalid`, and an
 * `allowedWhen` refusal ("{name} is already resolved") kept that default —
 * the same reason as "Nothing to change". A host could not tell "the rules
 * say no" from "you sent the wrong thing", so Cloud said "refused" for both.
 *
 * A refusal an act's own logic makes — a document act's `allowedWhen`, a
 * TypeScript mutation that throws an `ActRefusal` — is `refused`. `invalid`
 * stays for the call as sent: its arguments, and a call that changes nothing.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const seed = read("org.seed.json");
/** The org document, with `resolve-question` guarded as Cloud's En Dash Org guards it. */
const org = (() => {
  const doc = read("org.gdd.json");
  doc.acts["resolve-question"] = { ...doc.acts["resolve-question"], allowedWhen: "status != 'resolved'", refusal: "{name} is already resolved" };
  return doc;
})();

function compiled(doc: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-07" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>, snapshot: unknown = seed) => new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: structuredClone(snapshot) as never });
const refused = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected a refusal");
};

describe("a rule's refusal says so", () => {
  it("is a sixth code, refused, beside the five the wire already says", () => {
    expect([...REFUSAL_REASONS]).toEqual(["forbidden", "missing", "invalid", "limit", "unavailable", "refused"]);
  });

  it("resolve-question on a resolved question refuses with reason refused, in the act's own words", () => {
    const store = storeOf(compiled(org));
    store.apply({ name: "resolve-question", args: { id: "q-finance-timing" } });
    const error = refused(() => store.apply({ name: "resolve-question", args: { id: "q-finance-timing" } }));
    expect(error).toBeInstanceOf(ActRefusal);
    expect(refusalOf(error)).toEqual({ reason: "refused", sentence: "When is finance ready to hand off? is already resolved" });
  });

  it("edit-person { id } refuses with invalid: the call changes nothing", () => {
    const store = storeOf(compiled(org));
    expect(refusalOf(refused(() => store.apply({ name: "edit-person", args: { id: "person-john" } }))).reason).toBe("invalid");
  });

  it("a guard with no refusal sentence of its own says refused too", () => {
    const doc = structuredClone(org);
    delete doc.acts["resolve-question"].refusal;
    const store = storeOf(compiled(doc));
    store.apply({ name: "resolve-question", args: { id: "q-finance-timing" } });
    expect(refusalOf(refused(() => store.apply({ name: "resolve-question", args: { id: "q-finance-timing" } }))).reason).toBe("refused");
  });

  it("a preview judges the rule as the apply does, and says refused", () => {
    const store = storeOf(compiled(org));
    store.apply({ name: "resolve-question", args: { id: "q-finance-timing" } });
    expect(refusalOf(refused(() => store.preview({ name: "resolve-question", args: { id: "q-finance-timing" } }))).reason).toBe("refused");
  });

  it("a status board does not offer the move a rule refuses, and offers it where the rule holds", () => {
    const store = storeOf(compiled(org));
    const owner: Principal = { kind: "human", id: "nick" };
    const open = store.graph.getNode("q-finance-timing")!;
    expect(columnMoves(store, owner, open, "status").map((move) => move.call.name)).toContain("resolve-question");
    store.apply({ name: "resolve-question", args: { id: "q-finance-timing" } });
    const resolved = store.graph.getNode("q-finance-timing")!;
    expect(columnMoves(store, owner, resolved, "status").map((move) => move.call.name)).not.toContain("resolve-question");
  });
});

describe("a TypeScript mutation's own refusal", () => {
  const question = defineNode("question", { fields: z.object({ name: z.string(), resolved: z.boolean() }) });
  const resolve = defineMutation("resolve", {
    title: "Resolve",
    subject: { kinds: ["question"], arg: "id" },
    writes: ["resolved"],
    input: z.object({ id: nodeRef(["question"]) }),
    apply(ctx, args) {
      const node = ctx.graph.getNode(args.id) as { name: string; resolved: boolean } | undefined;
      if (node?.resolved) throw new ActRefusal(`${node.name} is already resolved`);
      ctx.patchNode(args.id, { resolved: true });
    },
  });
  const store = () =>
    new Store({
      schema: createSchema([question]),
      mutations: [resolve],
      snapshot: { nodes: [{ id: "q1", kind: "question", name: "Who hands off first?", resolved: true }], edges: [] } as never,
    });

  it("is refused when it throws an ActRefusal from its own logic, without naming a reason", () => {
    expect(refusalOf(refused(() => store().apply({ name: "resolve", args: { id: "q1" } })))).toEqual({ reason: "refused", sentence: "Who hands off first? is already resolved" });
  });

  it("keeps the reason it names, and a bare Error stays invalid: the framework cannot tell a rule from a slip", () => {
    expect(refusalOf(new ActRefusal("Nothing to change.", "invalid")).reason).toBe("invalid");
    expect(refusalOf(new Error("A task cannot wait for itself")).reason).toBe("invalid");
  });
});
