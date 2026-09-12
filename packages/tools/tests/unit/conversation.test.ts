import { bindSchema, createSchema, defineNode, nodeRef, Store, type Violation } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { graphResponder, llmResponder } from "../../src/index.js";

/**
 * The conversation is the intelligence contract given a voice: words in,
 * something to read plus validated proposals out — and the graph-native
 * responder holds a useful conversation before any key exists.
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: { "assigned-to": { to: ["duty"], description: "who does the run" } },
});
const duty = defineNode("duty", {
  fields: z.object({ label: z.string(), minutes: z.number() }),
  plural: "Runs",
});
const schema = createSchema([person, duty]);
const bound = bindSchema(schema);

const reassign = bound.defineMutation("reassign", {
  title: "Reassign the run",
  description: "Give a run to someone else.",
  subject: { kinds: ["duty"], arg: "dutyId" },
  input: z.object({ dutyId: nodeRef(["duty"]), toPersonId: nodeRef(["person"]) }),
  apply(ctx, args) {
    ctx.setSingleSource("assigned-to", args.dutyId, args.toPersonId);
  },
});
const shorten = bound.defineMutation("shorten", {
  title: "Shorten it",
  description: "Cut a run to half an hour.",
  subject: { kinds: ["duty"], arg: "dutyId" },
  input: z.object({ dutyId: nodeRef(["duty"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.dutyId, { minutes: 30 });
  },
});
const tooLong = bound.defineInvariant("too-long", {
  scope: { kind: "duty" },
  evaluate: ({ subject }): Violation[] =>
    subject.minutes > 60
      ? [
          {
            invariant: "too-long",
            subjectId: subject.id,
            label: "Too long",
            message: `${subject.label} runs over an hour`,
            nodeIds: [subject.id],
            repairs: [{ mutation: "shorten", args: { dutyId: subject.id }, label: "Shorten it" }],
          },
        ]
      : [],
});

const store = () =>
  new Store({
    schema,
    mutations: [reassign, shorten],
    invariants: [tooLong],
    snapshot: {
      nodes: [
        { id: "ana", kind: "person", label: "Ana" },
        { id: "bo", kind: "person", label: "Bo" },
        { id: "school", kind: "duty", label: "School run", minutes: 75 },
      ] as never,
      edges: [{ kind: "assigned-to", from: "ana", to: "school" }],
    },
  });

describe("the graph answers for itself", () => {
  it("states the standing and proposes the rules' own repairs", async () => {
    const reply = await graphResponder()(store(), "what's wrong?");
    expect(reply.say).toContain("1 problem");
    expect(reply.say).toContain("School run runs over an hour");
    expect(reply.proposals).toEqual([
      { mutation: "shorten", args: { dutyId: "school" }, why: "School run runs over an hour" },
    ]);
  });

  /*
   * A SENTENCE THAT MATCHES THE LIST UNDER IT.
   *
   * "The repairs below come from the rules themselves" was said whenever
   * anything was broken, and only COMPLETE repairs are ever proposed — a
   * repair still needing an argument chosen is not something a seat may
   * guess at. So a rule whose repair asks for one thing ("hand it to
   * someone": which someone is precisely the decision the rule declined to
   * make) produced a promise of repairs over an empty list. And what it
   * wants is named the way every other picker is: by the kind it picks.
   */
  it("says what a repair still wants, rather than promising repairs it has none of", async () => {
    const asking = new Store({
      schema,
      mutations: [reassign, shorten],
      invariants: [
        bound.defineInvariant("unclaimed", {
          scope: { kind: "duty" },
          repairs: ["reassign"],
          evaluate: ({ subject }): Violation[] => [
            {
              invariant: "unclaimed",
              subjectId: subject.id,
              label: "Unclaimed",
              message: `${subject.label} is nobody's`,
              nodeIds: [subject.id],
              repairs: [
                {
                  mutation: "reassign",
                  args: { dutyId: subject.id },
                  missing: ["toPersonId"],
                  label: "Give it to someone",
                },
              ],
            },
          ],
        }),
      ],
      snapshot: {
        nodes: [
          { id: "ana", kind: "person", label: "Ana" },
          { id: "school", kind: "duty", label: "School run", minutes: 30 },
        ] as never,
        edges: [],
      },
    });
    const reply = await graphResponder()(asking, "what's wrong?");
    expect(reply.proposals).toEqual([]);
    expect(reply.say).not.toContain("The repairs below");
    // Named by what it picks — "a person", never the argument "toPersonId".
    expect(reply.say).toContain("it needs a person chosen");
    expect(reply.say).not.toContain("to person id");
  });

  it("states a named thing's facts, relations in the declared words, and its trouble", async () => {
    const reply = await graphResponder()(store(), "tell me about the School run");
    expect(reply.say).toContain("School run — a duty");
    // The relation summary speaks the declaration's own sentence.
    expect(reply.say).toContain("who does the run: Ana");
    expect(reply.say).toContain("runs over an hour");
    expect(reply.proposals[0]?.mutation).toBe("shorten");
    expect(reply.grounded).toBe(true);
  });

  it("puts a NAMED thing ahead of the standing selection", async () => {
    // Asking about the School run while Bo is selected is about the run.
    const reply = await graphResponder()(store(), "tell me about the School run", {
      selection: ["bo"],
    });
    expect(reply.say).toContain("School run — a duty");
  });

  it('treats the selection as what "this" means', async () => {
    const reply = await graphResponder()(store(), "what is this?", { selection: ["ana"] });
    expect(reply.say).toContain("Ana — a person");
    expect(reply.say).toContain("Nothing about it is broken");
  });

  it("proposes a mutation said in its own words, endpoints from the referents", async () => {
    const reply = await graphResponder()(store(), "reassign the run to Bo", {
      selection: ["school"],
    });
    expect(reply.proposals).toEqual([
      {
        mutation: "reassign",
        args: { dutyId: "school", toPersonId: "bo" },
        why: "you asked in words",
      },
    ]);
  });

  it("asks for what it cannot honestly fill rather than guessing", async () => {
    const reply = await graphResponder()(store(), "reassign the run please");
    // "the run" is not a node label; nothing is selected; both refs missing.
    expect(reply.proposals).toEqual([]);
    expect(reply.say).toContain("needs");
  });

  it("finds a name across spacing and punctuation — 'child 2' is child2", async () => {
    const spaced = new Store({
      schema,
      mutations: [reassign, shorten],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "c2", kind: "person", label: "child2" },
          { id: "nap", kind: "duty", label: "child2 nap", minutes: 30 },
        ] as never,
        edges: [],
      },
    });
    const reply = await graphResponder()(spaced, "when does child 2 nap?");
    // The longest matching name wins: the nap block, not just the child.
    expect(reply.say).toContain("child2 nap — a duty");
    expect(reply.say).toContain("minutes 30");
    // Token alignment still keeps "Bo" out of "elbow".
    const noFalse = await graphResponder()(store(), "my elbow hurts");
    expect(noFalse.say).toContain("This graph holds");
  });

  it("answers WHEN from the declared field roles, spoken by display.format", async () => {
    const clock = (v) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
    const block = defineNode("block", {
      fields: z.object({ label: z.string(), start: z.number(), end: z.number(), days: z.array(z.string()) }),
      plural: "Blocks",
      display: { format: { start: clock, end: clock } },
      fieldRoles: { start: "start", end: "end", days: "days" },
    });
    const soloPerson = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
    const timedSchema = createSchema([soloPerson, block]);
    const timed = new Store({
      schema: timedSchema,
      mutations: [],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "c1", kind: "person", label: "child1" },
          { id: "sch", kind: "block", label: "child1 school", start: 510, end: 780, days: ["mon", "tue"] },
        ],
        edges: [],
      },
    });
    const reply = await graphResponder()(timed, "when does child 1 school start?");
    expect(reply.say).toBe("child1 school runs 08:30–13:00 on mon, tue.");
  });

  it("answers WHO by following the edges whose own descriptions say who", async () => {
    const dutySchema = createSchema([
      defineNode("person", {
        fields: z.object({ label: z.string() }),
        plural: "People",
        edges: {
          "assigned-to": { to: ["run"], description: "who does the run" },
          "rides-in": { to: ["run"], description: "who is along for it" },
        },
      }),
      defineNode("run", {
        fields: z.object({ label: z.string(), day: z.string() }),
        plural: "Runs",
        fieldRoles: { start: "day", day: "day" },
      }),
    ]);
    const week = new Store({
      schema: dutySchema,
      mutations: [],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "c1", kind: "person", label: "child1" },
          { id: "p2", kind: "person", label: "parent2" },
          { id: "tue-run", kind: "run", label: "tue school drop-off", day: "tue" },
          { id: "wed-run", kind: "run", label: "wed school drop-off", day: "wed" },
        ],
        edges: [
          { kind: "rides-in", from: "c1", to: "tue-run" },
          { kind: "rides-in", from: "c1", to: "wed-run" },
          { kind: "assigned-to", from: "p2", to: "tue-run" },
        ],
      },
    });
    const reply = await graphResponder()(week, "who drives child1 to school on tuesday?");
    // The day named picked the right run; the edge's own sentence answers.
    expect(reply.say).toContain("tue school drop-off");
    expect(reply.say).toContain("who does the run: parent2");
    expect(reply.say).toContain("who is along for it: child1");
  });

  it("answers WHO whichever side declared the edge", async () => {
    // The who-relation declared on the TIMED kind, pointing at people —
    // the direction that used to fall through to the generic summary.
    const flipped = createSchema([
      defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" }),
      defineNode("run", {
        fields: z.object({ label: z.string() }),
        plural: "Runs",
        edges: { "driven-by": { to: ["person"], description: "who does the run" } },
      }),
    ]);
    const store2 = new Store({
      schema: flipped,
      mutations: [],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "p1", kind: "person", label: "Edna" },
          { id: "r1", kind: "run", label: "school run" },
        ],
        edges: [{ kind: "driven-by", from: "r1", to: "p1" }],
      },
    });
    const reply = await graphResponder()(store2, "who drives the school run?");
    expect(reply.say).toContain("who does the run: Edna");
  });

  it("falls back to the shape of the graph, and how to ask", async () => {
    const reply = await graphResponder()(store(), "hello");
    expect(reply.say).toContain("2 People");
    expect(reply.say).toContain("1 Runs");
  });
});

describe("a model holds the conversation through the same gate", () => {
  it("threads history and selection into the prompt and validates the reply", async () => {
    const model = llmResponder({
      may: ["shorten"],
      complete: async (prompt) => {
        expect(prompt).toContain("Person: and now?");
        expect(prompt).toContain("Person: earlier words");
        expect(prompt).toContain('what "this" means');
        expect(prompt).toContain("School run");
        return '{"say":"Cutting it.","proposals":[{"mutation":"shorten","args":{"dutyId":"school"},"why":"over an hour"},{"mutation":"reassign","args":{},"why":"not allowed"}]}';
      },
    });
    const reply = await model(store(), "and now?", {
      selection: ["school"],
      history: [{ role: "person", text: "earlier words" }],
    });
    expect(reply.say).toBe("Cutting it.");
    // The allowlist filtered the second proposal — same gate as everywhere.
    expect(reply.proposals).toHaveLength(1);
    expect(reply.proposals[0]?.mutation).toBe("shorten");
  });

  it("degrades an unparseable answer to words, never to guesses", async () => {
    const model = llmResponder({ complete: async () => "I would rather chat." });
    const reply = await model(store(), "hm");
    expect(reply).toEqual({ say: "I would rather chat.", proposals: [] });
  });
});
