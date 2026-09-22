import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { stillNeeded } from "../../src/index.js";

/**
 * AN ACT THE RESPONDER HAS UNDER-SPECIFIED IS AN ASK, NOT A REFUSAL.
 *
 * The seat already refuses to OFFER what the policy withholds, because the
 * responder proposes from the graph and knows nothing of the policy. It
 * knows just as little about what an act NEEDS, and nothing checked: a model
 * told "i want a new shift called soup kitchen" answered `add-shift` with no
 * arguments at all, the chat applied it, and what reached the person was the
 * validator talking to itself —
 *
 *   Refused: Invalid arguments for mutation "add-shift" label: Invalid
 *   input: expected string, received undefined; on: Invalid input: expected
 *   string, received undefined; place: … day: … from: … until: …
 *
 * Six clauses of machine grammar for an act that was never impossible, only
 * unfinished. This is what the chat asks instead, so the questions can be
 * put to the person the way the actions strip already puts them.
 */
const place = defineNode("place", { fields: z.object({ label: z.string() }), plural: "Places" });
const shift = defineNode("shift", {
  fields: z.object({ label: z.string(), day: z.string(), from: z.number(), until: z.number() }),
  plural: "Shifts",
});
const schema = createSchema([place, shift]);
const bound = bindSchema(schema);

const addShift = bound.defineMutation("add-shift", {
  title: "Add a shift",
  input: z.object({
    label: z.string(),
    place: nodeRef(["place"]),
    day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    from: z.number(),
    until: z.number(),
    note: z.string().optional(),
  }),
  creates: ["shift"],
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({
      id: `shift-${String(args.label).toLowerCase().replace(/\W+/g, "-")}`,
      kind: "shift",
      label: args.label,
      day: args.day,
      from: args.from,
      until: args.until,
    } as never);
  },
});

const store = () =>
  new Store({
    schema,
    mutations: [addShift],
    snapshot: { nodes: [{ id: "hall", kind: "place", label: "The hall" }] as never, edges: [] },
  });

describe("an act the responder under-specified", () => {
  it("names every argument the model did not answer", () => {
    const owed = stillNeeded(store(), { mutation: "add-shift", args: {} });
    expect(owed.map((one) => one.name).sort()).toEqual(["day", "from", "label", "place", "until"]);
  });

  it("does not ask again for what the model did answer", () => {
    // The real case: it got the label from the sentence and nothing else.
    const owed = stillNeeded(store(), { mutation: "add-shift", args: { label: "Soup kitchen" } });
    expect(owed.map((one) => one.name)).not.toContain("label");
    expect(owed.map((one) => one.name).sort()).toEqual(["day", "from", "place", "until"]);
  });

  it("leaves optional arguments alone", () => {
    // `note` may be left out, so it is not a question anybody has to answer.
    expect(stillNeeded(store(), { mutation: "add-shift", args: {} }).map((one) => one.name)).not.toContain("note");
  });

  it("counts an empty string as unanswered", () => {
    /*
     * A model asked for JSON fills in every key it was shown, and fills the
     * ones it does not know with "". Taken as an answer, that is a shift
     * called nothing, placed nowhere — worse than the refusal, because it
     * succeeds.
     */
    const owed = stillNeeded(store(), { mutation: "add-shift", args: { label: "", place: null } });
    expect(owed.map((one) => one.name)).toContain("label");
    expect(owed.map((one) => one.name)).toContain("place");
  });

  it("says nothing is owed when the call is complete", () => {
    const owed = stillNeeded(store(), {
      mutation: "add-shift",
      args: { label: "Soup kitchen", place: "hall", day: "tue", from: 1080, until: 1200 },
    });
    expect(owed).toEqual([]);
  });

  it("offers the graph's own nodes for an argument that names one", () => {
    // So the ask can put real places in front of somebody rather than a
    // free-text box they have to guess the id for.
    const owed = stillNeeded(store(), { mutation: "add-shift", args: {} });
    const asked = owed.find((one) => one.name === "place");
    expect(asked).toBeDefined();
  });

  it("asks nothing of a mutation it has never heard of", () => {
    expect(stillNeeded(store(), { mutation: "not-a-mutation", args: {} })).toEqual([]);
  });
});
