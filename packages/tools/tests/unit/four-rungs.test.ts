import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  completionDecide,
  configuredResponder,
  decideFor,
  describeIntelligence,
  graphDecide,
  loadIntelligenceConfig,
  RUNGS,
  rungFor,
  rungHonesty,
  saveIntelligenceConfig,
  type IntelligenceConfig,
  type Question,
} from "../../src/index.js";

/**
 * ONE SWITCH, FOUR RUNGS — AND A RUNG THAT SAYS WHAT IT CANNOT DO.
 *
 * The ladder has two axes. A rung declares which capabilities it serves; a
 * surface asks for a capability and never for a provider; what a rung
 * cannot serve falls down to the graph. On the decision rung the chat
 * seat says, in its own answer, that this rung decides rather than talks
 * and that the graph is answering — and a turn that started on one rung
 * says so if the person moved to another meanwhile.
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

type Shim = { getItem(k: string): string | null; setItem(k: string, v: string): void };
afterEach(() => {
  delete (globalThis as { localStorage?: Shim }).localStorage;
});

describe("four rungs, two axes", () => {
  it("is one setting with four values, and the fourth round-trips", () => {
    expect(Object.keys(RUNGS)).toEqual(["graph", "local", "decision", "remote"]);
    const held = new Map<string, string>();
    (globalThis as { localStorage?: Shim }).localStorage = { getItem: (k) => held.get(k) ?? null, setItem: (k, v) => void held.set(k, v) };
    saveIntelligenceConfig({ source: "decision" });
    expect(loadIntelligenceConfig()).toEqual({ source: "decision" });
    expect(describeIntelligence({ source: "decision" })).toBe("jev — decides; the graph talks");
  });

  it("declares what each rung serves, and a surface asks for a capability", () => {
    expect(RUNGS.decision.serves).toEqual(["decide"]);
    expect(RUNGS.graph.serves).not.toContain("prose");
    expect(rungFor({ source: "decision" }, "decide")).toEqual({ rung: "decision", fell: false });
    expect(rungFor({ source: "remote" }, "prose")).toEqual({ rung: "remote", fell: false });
  });

  it("falls a capability the rung cannot serve down to the graph, and can say so", () => {
    expect(rungFor({ source: "decision" }, "prose")).toEqual({ rung: "graph", fell: true });
    expect(rungHonesty({ source: "decision" }, "prose")).toBe("(Jev decides rather than talks — the graph is answering here.)");
    expect(rungHonesty({ source: "remote" }, "prose")).toBeUndefined();
  });
});

describe("the chat seat on the decision rung", () => {
  it("is answered by the graph and SAYS so in the answer itself, not in chrome", async () => {
    const reply = await configuredResponder<typeof schema>({ source: "decision" })(store(), "hello");
    expect(reply.say).toContain("2 Things");
    expect(reply.say).toContain("Jev decides rather than talks — the graph is answering here.");
    expect(reply.proposals).toEqual([]);
  });

  it("says which rung a turn was answered on when the person switched meanwhile", async () => {
    let now: IntelligenceConfig = { source: "graph" };
    const responder = configuredResponder<typeof schema>({ source: "graph" }, { current: () => now });
    now = { source: "decision" };
    const reply = await responder(store(), "hello");
    expect(reply.say).toContain("answered on the Graph only rung — you switched to Jev meanwhile.");
    now = { source: "graph" };
    expect((await responder(store(), "hello")).say).not.toContain("switched");
  });
});

const questions: Record<string, Question> = {
  "rule:named:b": { type: "noul", instructions: "Every thing has a name. Is this so?" },
  "rule:named:a": { type: "noul", instructions: "Every thing has a name. Is this so?" },
  "repair:named:b": { type: "choice", instructions: "Which repair?", criteria: { rename: "Rename it", "rename:2": "Rename it otherwise" } },
  "field:thing.color": { type: "choice", instructions: "Which color?", criteria: { red: null, blue: null } },
};

describe("a decision on the other rungs", () => {
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

  it("is the provider exactly on the decision rung, a model on a model rung, and nothing here on the graph rung", () => {
    expect(decideFor({ source: "graph" })).toBeUndefined();
    expect(decideFor({ source: "decision" })).toBeTypeOf("function");
    expect(decideFor({ source: "remote", remote: { preset: "xai", apiKey: "k" } })).toBeTypeOf("function");
  });
});
