import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { answerSeenBy } from "../../src/answer.js";
import { compileDocument } from "../../src/check.js";
import { bindSchema, createSchema, defineNode, isWithheld, nodeRef, Store, WITHHELD_INTENT, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * A CHANGE'S SENTENCE FOLLOWS SIGHT (FR-55). A seat was served a change's
 * records and ops as its sight allows, and its sentence whole: "Draw a
 * match: Ann gives to Bo" reached a participant who may not see that
 * match, from the answer to their own act, and a caller's sentence for a
 * whole batch rode on the ops of it the seat was served. Now a change the
 * seat is served none of says only that a change it cannot see happened; a
 * change it is served part of is said from the ops it is served; and a seat
 * that sees everything is told the sentence as it was written.
 */
const santa = JSON.parse(readFileSync(new URL("../document/fixtures/secret-santa.gdd.json", import.meta.url), "utf8"));
// A draw a participant may make too, so a seat's own act can make what its sight does not reach.
santa.policy.grants.push({ roles: ["participant"], mutations: ["draw"] });
const compiled = compileDocument(santa);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app;
const organizer: Principal = { kind: "human", id: "p_org", roles: ["organizer"] };
const ann: Principal = { kind: "human", id: "p_ann", roles: ["participant"] };
const cy: Principal = { kind: "human", id: "p_cy", roles: ["participant"] };

function party() {
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    policy: app.policy!,
    snapshot: {
      nodes: [
        { id: "p_ann", kind: "participant", name: "Ann" },
        { id: "p_bo", kind: "participant", name: "Bo" },
        { id: "p_cy", kind: "participant", name: "Cy" },
      ] as never,
      edges: [],
    },
  });
}

const draw = (note: string, giver: string, receiver: string) => ({ name: "draw", args: { note, giver, receiver } });

describe("a change's sentence, over a sight via a relation (Secret Santa)", () => {
  it("is a change the seat cannot see when the seat's own act made only what it may not see", () => {
    const store = party();
    const answer = answerSeenBy(store, cy, store.apply(draw("Ann gives to Bo", "p_ann", "p_bo"), { author: cy }));
    expect(answer.intent).toBe(WITHHELD_INTENT);
    expect(JSON.stringify(answer)).not.toContain("Ann gives to Bo");
  });

  it("is said from the ops the seat is served when it may see part of what its act made", () => {
    const store = party();
    const made = store.applyAll([draw("Ann for Cy", "p_ann", "p_cy"), draw("Bo for Cy", "p_bo", "p_cy")], { author: ann });
    expect(made.intent).toBe("Draw a match: Ann for Cy; Draw a match: Bo for Cy");
    expect(answerSeenBy(store, ann, made).intent).toBe("Draw a match: Ann for Cy");
  });

  it("never carries a caller's sentence for a batch into a log the seat sees only part of", () => {
    const store = party();
    store.applyAll([draw("Ann for Bo", "p_ann", "p_bo"), draw("Bo for Ann", "p_bo", "p_ann")], { author: organizer, intent: "Draw: Ann for Bo, Bo for Ann" });
    const log = store.seenBy(ann).log.all();
    expect(log.map(isWithheld)).toEqual([false, true]);
    expect(JSON.stringify(log)).not.toContain("Bo for Ann");
    expect(store.seenBy(ann).batches().map((batch) => batch.intent)).toEqual(["Draw a match: Ann for Bo"]);
  });

  it("is told whole to a seat that sees everything: the act's own sentence and the caller's", () => {
    const store = party();
    const made = store.applyAll([draw("Ann for Bo", "p_ann", "p_bo"), draw("Bo for Ann", "p_bo", "p_ann")], { author: organizer, intent: "Draw: Ann for Bo, Bo for Ann" });
    expect(answerSeenBy(store, organizer, made).intent).toBe("Draw: Ann for Bo, Bo for Ann");
    expect(store.seenBy(organizer).batches().map((batch) => batch.intent)).toEqual(["Draw: Ann for Bo, Bo for Ann"]);
    expect(store.seenBy(organizer).log.all().map((op) => op.batchIntent)).toEqual(["Draw: Ann for Bo, Bo for Ann", "Draw: Ann for Bo, Bo for Ann"]);
  });
});

/** A desk where a helper may file a note on any ticket, sees only their own, and is kept from the ledger whole. */
const ticket = defineNode("ticket", { fields: z.object({ label: z.string(), note: z.string().optional() }), plural: "Tickets" });
const ledger = defineNode("ledger", { fields: z.object({ label: z.string() }), plural: "Ledgers" });
const schema = createSchema([ticket, ledger]);
const { defineMutation } = bindSchema(schema);
const annotate = defineMutation("annotate", {
  title: "Annotate",
  subject: { kinds: ["ticket"], arg: "id" },
  writes: ["note"],
  input: z.object({ id: nodeRef(["ticket"]), note: z.string() }),
  describe: (args, graph) => `Note on ${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id}: ${args.note}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { note: args.note });
  },
});
const enter = defineMutation("enter", {
  title: "Enter in the ledger",
  creates: ["ledger"],
  input: z.object({ label: z.string() }),
  describe: (args) => `Enter “${args.label}” in the ledger`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "ledger"), kind: "ledger", label: args.label });
  },
});
const open = defineMutation("open", {
  title: "Open a ticket",
  creates: ["ticket"],
  input: z.object({ label: z.string() }),
  describe: (args) => `Open “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "ticket"), kind: "ticket", label: args.label });
  },
});
const policy: Policy = {
  grants: [{ roles: ["helper", "clerk"], mutations: "*" }],
  sees: [
    { roles: ["helper"], kinds: ["ticket"], own: true },
    { roles: ["clerk"], kinds: ["ticket"] },
  ],
};
const helper: Principal = { kind: "human", id: "helper:rhian", roles: ["helper"] };
const clerk: Principal = { kind: "human", id: "clerk:sam", roles: ["clerk"] };

function desk() {
  const store = new Store({
    schema,
    mutations: [annotate, enter, open],
    policy,
    snapshot: { nodes: [{ id: "ticket:freyas-refund", kind: "ticket", label: "Freya's refund" }] as never, edges: [] },
  });
  store.apply({ name: "annotate", args: { id: "ticket:freyas-refund", note: "seen" } }, { author: clerk });
  return store;
}

describe("a change's sentence, over an own sight", () => {
  it("is a change the seat cannot see when the change wrote only a record that is not the seat's own", () => {
    const store = desk();
    const made = store.apply({ name: "annotate", args: { id: "ticket:freyas-refund", note: "refund twice" } }, { author: clerk });
    const answer = answerSeenBy(store, helper, made);
    expect(answer.intent).toBe(WITHHELD_INTENT);
    expect(JSON.stringify(answer)).not.toContain("Freya");
  });

  it("is said from the seat's own records of a batch, and never the caller's sentence for it", () => {
    const store = desk();
    const laptop = store.apply({ name: "open", args: { label: "Rhian's laptop" } }, { author: helper }).diff.addedNodes[0]!.id;
    const made = store.applyAll(
      [
        { name: "annotate", args: { id: laptop, note: "fixed" } },
        { name: "annotate", args: { id: "ticket:freyas-refund", note: "paid" } },
      ],
      { author: clerk, intent: "Close Rhian's laptop and Freya's refund" },
    );
    expect(answerSeenBy(store, helper, made).intent).toBe("Note on Rhian's laptop: fixed");
    const log = store.seenBy(helper).log.all();
    expect(JSON.stringify(log)).not.toContain("Freya");
    expect(store.seenBy(helper).batches().at(-1)!.intent).toBe("Note on Rhian's laptop: fixed");
  });

  it("is told whole to a seat that sees every ticket", () => {
    const store = desk();
    const laptop = store.apply({ name: "open", args: { label: "Rhian's laptop" } }, { author: helper }).diff.addedNodes[0]!.id;
    const made = store.applyAll(
      [
        { name: "annotate", args: { id: laptop, note: "fixed" } },
        { name: "annotate", args: { id: "ticket:freyas-refund", note: "paid" } },
      ],
      { author: clerk, intent: "Close Rhian's laptop and Freya's refund" },
    );
    expect(answerSeenBy(store, clerk, made).intent).toBe("Close Rhian's laptop and Freya's refund");
    expect(store.seenBy(clerk).batches().at(-1)!.intent).toBe("Close Rhian's laptop and Freya's refund");
  });
});

describe("a change's sentence, when sees hides a whole kind", () => {
  it("is a change the seat cannot see, applied or previewed, when all it made is of a kind the seat may not see", () => {
    const store = desk();
    const call = { name: "enter", args: { label: "Petty cash" } };
    const preview = answerSeenBy(store, clerk, store.preview(call, undefined, { author: clerk }));
    expect(preview.intent).toBe(WITHHELD_INTENT);
    expect(JSON.stringify(preview)).not.toContain("Petty cash");
    const made = answerSeenBy(store, clerk, store.apply(call, { author: clerk }));
    expect(made.intent).toBe(WITHHELD_INTENT);
    expect(JSON.stringify(made)).not.toContain("Petty cash");
  });

  it("is said from what the seat may see of a batch, never the caller's sentence for it", () => {
    const store = desk();
    const made = store.applyAll(
      [
        { name: "annotate", args: { id: "ticket:freyas-refund", note: "paid" } },
        { name: "enter", args: { label: "Refund to Freya" } },
      ],
      { author: clerk, intent: "Pay Freya's refund out of petty cash" },
    );
    const answer = answerSeenBy(store, clerk, made);
    expect(answer.intent).toBe("Note on Freya's refund: paid");
    expect(JSON.stringify(answer)).not.toContain("petty cash");
    const log = store.seenBy(clerk).log.all();
    expect(JSON.stringify(log)).not.toContain("petty cash");
    expect(JSON.stringify(log)).not.toContain("Refund to Freya");
    expect(store.seenBy(clerk).batches().at(-1)!.intent).toBe("Note on Freya's refund: paid");
  });
});
