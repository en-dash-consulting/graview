import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as tools from "../../src/index.js";
import * as frame from "../../src/frame.js";
import {
  ANSWERED_WITH_AI,
  completionDecide,
  decideFor,
  graphDecide,
  NO_AI,
  NO_AI_SAID,
  seatResponder,
  type Decide,
  type Question,
} from "../../src/index.js";

/**
 * THE HOST DECIDES THE AI, ONCE — AND A READER NEVER SEES A RUNG.
 *
 * There was a ladder a reader climbed under the seat's ⚙: "Graph only",
 * "Onboard AI", "Jev", "LLM", kept in their browser. What a seat may use
 * is the host's now (`HostAi`): the graph answers first, always; an open
 * question goes to the host's model when there is one, and with none the
 * seat says so in one plain sentence; a decision goes to the host's
 * decision provider, else the one the app declares, else the model.
 */
const thing = defineNode("thing", { fields: z.object({ label: z.string() }), plural: "Things" });
const schema = createSchema([thing]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename it",
  subject: { kinds: ["thing"], arg: "id" },
  input: z.object({ id: z.string(), label: z.string() }),
  apply: (ctx, args) => ctx.patchNode(args.id, { label: args.label }),
});
const named = defineInvariant("named", {
  scope: { kind: "thing" },
  description: "Every thing has a name.",
  repairs: ["rename"],
  evaluate: ({ subject }) =>
    subject.label
      ? []
      : [{ invariant: "named", subjectId: subject.id, label: "Unnamed", message: "It has no name.", nodeIds: [subject.id], repairs: [] }],
});
const store = () =>
  new Store({
    schema,
    mutations: [rename],
    invariants: [named],
    snapshot: { nodes: [{ id: "a", kind: "thing", label: "Widget" }, { id: "b", kind: "thing", label: "" }] as never, edges: [] },
  });

const ask = (say: string, proposals: unknown[] = []) => async (_prompt?: string) => JSON.stringify({ say, proposals });

describe("nothing for a reader to choose", () => {
  it("exports no ladder, no remembered rung and no rung's words", () => {
    for (const gone of ["RUNGS", "rungFor", "rungHonesty", "loadIntelligenceConfig", "saveIntelligenceConfig", "DEFAULT_INTELLIGENCE", "describeIntelligence", "configuredResponder"]) {
      expect(tools, gone).not.toHaveProperty(gone);
      expect(frame, gone).not.toHaveProperty(gone);
    }
    expect(Object.keys(frame).sort()).toEqual(["ANSWERED_WITH_AI", "NO_AI", "NO_AI_SAID", "aiTalks", "aiVia"]);
    for (const words of [NO_AI_SAID, ANSWERED_WITH_AI]) expect(words).not.toMatch(/graph-native|Graph only|Onboard|Jev|LLM|rung/);
  });
});

describe("with no model, an open question says so in one plain sentence", () => {
  it("answers what the graph knows as before, and an ask it cannot read with the sentence", async () => {
    const respond = seatResponder<typeof schema>(NO_AI);
    const fact = await respond(store(), "tell me about Widget");
    expect(fact.say).not.toContain(NO_AI_SAID);
    expect(fact.via).toBeUndefined();
    const open = await respond(store(), "should we repaint the hallway?");
    expect(open.say.startsWith("I can answer about what's in this app. Open questions need AI, which isn't on here.")).toBe(true);
    expect(open.via).toBeUndefined();
    expect(open.say).not.toMatch(/graph-native|Graph only|Onboard|Jev|LLM|rung/);
  });
});

describe("with the host's model, the open question is the model's — and says so quietly", () => {
  it("answers through the model, carrying the via its proposals are logged with", async () => {
    let asked = 0;
    const complete = async (prompt: string) => {
      asked += 1;
      return ask("Paint it blue.")(prompt);
    };
    const respond = seatResponder<typeof schema>({ complete, name: "stub" });
    const open = await respond(store(), "should we repaint the hallway?");
    expect(open.say).toBe("Paint it blue.");
    expect(open.via).toBe("ai:stub");
    expect(asked).toBe(1);
    // A fact is still the graph's, with nothing under it.
    const fact = await respond(store(), "tell me about Widget");
    expect(fact.via).toBeUndefined();
    expect(asked).toBe(1);
  });

  it("is recorded as `ai:model` when the host named it nothing", async () => {
    const reply = await seatResponder<typeof schema>({ complete: ask("Yes.") })(store(), "should we repaint the hallway?");
    expect(reply.via).toBe("ai:model");
  });
});

const questions: Record<string, Question> = {
  "rule:named:b": { type: "noul", instructions: "Every thing has a name. Is this so?" },
  "rule:named:a": { type: "noul", instructions: "Every thing has a name. Is this so?" },
  "repair:named:b": { type: "choice", instructions: "Which repair?", criteria: { rename: "Rename it", "rename:2": "Rename it otherwise" } },
  "field:thing.color": { type: "choice", instructions: "Which color?", criteria: { red: null, blue: null } },
};

describe("a decision, wherever it is answered", () => {
  it("is decided by the graph's own rules where it has them, and left unanswered where it has none", async () => {
    const decided = await graphDecide(store())({}, questions);
    expect(decided.answers["rule:named:b"]).toEqual({ type: "noul", noul: 0 });
    expect(decided.answers["rule:named:a"]).toEqual({ type: "noul", noul: 1 });
    expect(decided.answers["repair:named:b"]).toMatchObject({ type: "choice", choice: "rename", confidence: 1 });
    expect(decided.unanswered).toEqual(["field:thing.color"]);
  });

  it("is decided by a model behind the parse-and-refuse layer: held to the options, refused otherwise", async () => {
    const decide = completionDecide(async () =>
      'Sure: {"rule:named:b":{"noul":0.2},"rule:named:a":{"noul":0.9},"repair:named:b":{"choice":"rename","confidence":0.8},"field:thing.color":{"choice":"blue","confidence":0.7}}',
    );
    const decided = await decide({}, questions);
    expect(decided.answers["field:thing.color"]).toMatchObject({ type: "choice", choice: "blue", confidence: 0.7, probabilities: { blue: 0.7, red: expect.closeTo(0.3, 5) } });
    expect(decided.answers["rule:named:b"]).toEqual({ type: "noul", noul: 0.2 });
    const refusing = completionDecide(async () => '{"field:thing.color":{"choice":"green"}}');
    await expect(refusing({}, { "field:thing.color": questions["field:thing.color"]! })).rejects.toThrow(/did not answer "field:thing.color"/);
    const scoring = completionDecide(async () => '{"s":{"level":2,"confidence":0.6}}');
    const scored = await scoring({}, { s: { type: "score", instructions: "?", criteria: ["a", "b", "c"] } });
    expect(scored.answers["s"]).toMatchObject({ type: "score", legend: { "0": "a", "1": "b", "2": "c" } });
    expect((scored.answers["s"] as { score: number }).score).toBeCloseTo(0.2 * 0 + 0.2 * 1 + 0.6 * 2, 5);
  });

  it("is the host's decision provider exactly, else the declared one through the door, else the model, else the graph's", async () => {
    const hosts: Decide = async () => ({ answers: {}, usage: { inputTokens: 0, outputTokens: 0 } });
    expect(decideFor({ decide: hosts, complete: ask("x") })).toBe(hosts);
    expect(decideFor(NO_AI)).toBeUndefined();
    expect(decideFor({ complete: ask("x") })).toBeTypeOf("function");

    const reached: string[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      reached.push(url);
      return { ok: true, status: 200, text: async () => JSON.stringify({ answers: { "rule:named:a": { type: "noul", noul: 1 } } }) };
    }) as never;
    try {
      const declared = decideFor(NO_AI, { intelligence: [{ name: "jev", kind: "decision" }] });
      expect(declared).toBeTypeOf("function");
      await declared!({}, { "rule:named:a": questions["rule:named:a"]! });
      const elsewhere = decideFor({ complete: ask("x") }, { intelligence: [{ name: "jev", kind: "decision", bridge: "/decide-here" }] });
      await elsewhere!({}, { "rule:named:a": questions["rule:named:a"]! });
    } finally {
      globalThis.fetch = real;
    }
    expect(reached).toEqual(["/__graview/decide", "/decide-here"]);
  });
});
