import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createToolRuntime, llmResponder, READ_CHARS, READ_HITS, READ_LINKS, READ_PAGE, READ_PROBLEMS, READ_TEXT, turnThroughMessages, type HostTurn, type MessagesStepRequest } from "../../src/index.js";
import { alreadyRead, TURN_CALLS } from "../../src/seat-model.js";

/**
 * A SEAT'S READ IS BOUNDED, AND A REPEATED READ IS NOT RE-SENT (FR-167).
 * One turn in an app of 30 components, 28 skills and 84 strengths ran
 * seven steps whose input grew 5.6k → 91k tokens: a read answered about
 * 28,000 tokens, the model asked for it again three times, and every step
 * resent all of it. Every read now answers a page of at most `READ_CHARS`
 * characters with how many more, and a call the turn already made is
 * answered with a line pointing at the first answer.
 */
const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Skills",
  kinds: {
    component: {
      fields: { name: { type: "string", required: true }, summary: { type: "string" }, notes: { type: "text" } },
      label: "{name}",
    },
    skill: {
      fields: { name: { type: "string", required: true }, description: { type: "text" } },
      label: "{name}",
      edges: { uses: { to: ["component"], cardinality: "many", description: "the components it draws on", inverse: "the skills that draw on it" } },
    },
    strength: {
      fields: { name: { type: "string", required: true }, level: { type: "number" }, evidence: { type: "text" } },
      label: "{name}",
      edges: {
        of: { to: ["skill"], cardinality: "one", description: "the skill it is a strength in", inverse: "its strengths" },
        in: { to: ["component"], cardinality: "one", description: "where it shows", inverse: "the strengths shown here" },
      },
    },
  },
  rules: {
    "strength-has-evidence": { title: "Every strength says why", over: "strength", require: "present(evidence)", says: "{name} has no evidence" },
  },
};
const owner: Principal = { kind: "human", id: "person-ola" };

/** Words of some length, as a person writes a note. */
const prose = (seed: string, length: number) => `${seed}: `.concat("carefully measured, reviewed with the team and written down ".repeat(Math.ceil(length / 60))).slice(0, length);

function skills() {
  const result = compileDocument(DOCUMENT);
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((finding) => finding.severity === "error")));
  const app = result.app as GraviewApp<AnySchema>;
  const components = Array.from({ length: 30 }, (_, i) => ({
    id: `component-${i}`,
    kind: "component",
    name: `Component ${i}`,
    summary: prose(`Component ${i} summary`, 160),
    // One record whose notes are longer than a read carries whole.
    notes: prose(`Component ${i} notes`, i === 0 ? 5_000 : 300),
  }));
  const skillNodes = Array.from({ length: 28 }, (_, i) => ({ id: `skill-${i}`, kind: "skill", name: `Skill ${i}`, description: prose(`Skill ${i}`, 240) }));
  // Half the strengths say no evidence: 42 problems, more than a page.
  const strengths = Array.from({ length: 84 }, (_, i) => ({
    id: `strength-${i}`,
    kind: "strength",
    name: `Strength ${i}`,
    level: i % 5,
    ...(i % 2 === 0 ? { evidence: prose(`Strength ${i}`, 200) } : {}),
  }));
  const edges = [
    ...skillNodes.flatMap((skill, i) => [0, 1, 2].map((k) => ({ kind: "uses", from: skill.id, to: `component-${(i + k) % 30}` }))),
    ...strengths.map((strength, i) => ({ kind: "of", from: strength.id, to: `skill-${i % 28}` })),
    // Every strength shows in one of two components: each has 42 linked in, more than a page.
    ...strengths.map((strength, i) => ({ kind: "in", from: strength.id, to: `component-${i % 2}` })),
  ];
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    snapshot: { nodes: [...components, ...skillNodes, ...strengths], edges } as never,
  });
}

const size = (value: unknown) => JSON.stringify(value).length;

describe("a read in an app of 30 components, 28 skills and 84 strengths", () => {
  it("was far over a read's bound before: the whole graph is several times READ_CHARS", () => {
    expect(size(skills().graph.snapshot())).toBeGreaterThan(READ_CHARS * 5);
  });

  it("answers get_graph a page at a time, each within READ_CHARS, saying how many more and where the next page starts, until every record has been read once", async () => {
    const tools = createToolRuntime(skills(), { author: owner, readOnly: true });
    const seen: string[] = [];
    let offset = 0;
    for (let pages = 0; pages < 50; pages += 1) {
      const result = await tools.call("get_graph", { offset });
      expect(result.ok).toBe(true);
      const page = (result as { data: { nodes: { id: string }[]; edges: { from: string }[]; total: number; more?: string } }).data;
      expect(size(page)).toBeLessThanOrEqual(READ_CHARS);
      expect(page.nodes.length).toBeGreaterThan(0);
      expect(page.nodes.length).toBeLessThanOrEqual(READ_PAGE);
      expect(page.total).toBe(142);
      // The edges out of the page's records, and no others.
      const on = new Set(page.nodes.map((node) => node.id));
      expect(page.edges.every((edge) => on.has(edge.from))).toBe(true);
      seen.push(...page.nodes.map((node) => node.id));
      if (!page.more) break;
      offset += page.nodes.length;
      expect(page.more).toBe(`and ${142 - offset} more nodes: call get_graph with offset ${offset} for the next page.`);
    }
    expect(seen).toHaveLength(142);
    expect(new Set(seen).size).toBe(142);
  });

  it("cuts a long text at READ_TEXT characters and says how long it was", async () => {
    const tools = createToolRuntime(skills(), { author: owner, readOnly: true });
    const read = (await tools.call("get_node", { id: "component-0" })) as { data: { node: { notes: string } } };
    expect(read.data.node.notes).toHaveLength(READ_TEXT + `… (cut at ${READ_TEXT} of 5000 characters)`.length);
    expect(read.data.node.notes.endsWith(`… (cut at ${READ_TEXT} of 5000 characters)`)).toBe(true);
  });

  it("answers get_node with the record's fields and its links as ids, kinds and labels, READ_LINKS each way, and how to read the rest", async () => {
    const tools = createToolRuntime(skills(), { author: owner, readOnly: true });
    const result = (await tools.call("get_node", { id: "Component 1" })) as { ok: true; data: { node: { id: string }; out: unknown[]; in: { kind: string; id: string; label: string }[]; more?: string } };
    expect(result.ok).toBe(true);
    expect(size(result.data)).toBeLessThanOrEqual(READ_CHARS);
    expect(result.data.node.id).toBe("component-1");
    expect(result.data.in).toHaveLength(READ_LINKS);
    expect(result.data.in[0]).toEqual({ kind: "uses", id: "skill-0", label: "Skill 0" });
    // Never a linked record's own fields.
    expect(JSON.stringify(result.data.in)).not.toContain("evidence");
    // 42 strengths and 2 skills link in.
    expect(result.data.more).toBe(`and ${44 - READ_LINKS} more links in: call get_node with id "component-1" and offset ${READ_LINKS} for the next page.`);
    const next = (await tools.call("get_node", { id: "component-1", offset: READ_LINKS })) as { data: { in: { id: string }[] } };
    expect(next.data.in).toHaveLength(READ_LINKS);
    expect(next.data.in.map((link) => link.id)).not.toContain(result.data.in[0]!.id);
  });

  it(`answers search_graph with at most READ_HITS hits, whatever limit asked for, without every match's id, and says how many more`, async () => {
    const tools = createToolRuntime(skills(), { author: owner, readOnly: true });
    const result = (await tools.call("search_graph", { query: "strength", limit: 500 })) as { ok: true; data: { hits: { about: string }[]; total: number; more?: string; matched?: unknown } };
    expect(result.ok).toBe(true);
    expect(size(result.data)).toBeLessThanOrEqual(READ_CHARS);
    expect(result.data.hits.filter((hit) => hit.about === "node").length).toBeLessThanOrEqual(READ_HITS);
    expect(result.data.matched).toBeUndefined();
    expect(result.data.total).toBeGreaterThan(READ_HITS);
    expect(result.data.more).toBe(`and ${result.data.total - result.data.hits.filter((hit) => hit.about === "node").length} more records match: narrow the words, or add kind:<kind>.`);
  });

  it("answers get_violations READ_PROBLEMS a page, with the total and how to read the rest", async () => {
    const tools = createToolRuntime(skills(), { author: owner, readOnly: true });
    const result = (await tools.call("get_violations", {})) as { ok: true; data: { violations: unknown[]; total: number; more?: string } };
    expect(size(result.data)).toBeLessThanOrEqual(READ_CHARS);
    expect(result.data.total).toBe(42);
    expect(result.data.violations.length).toBeLessThanOrEqual(READ_PROBLEMS);
    expect(result.data.more).toBe(`and ${42 - result.data.violations.length} more problems: call get_violations with offset ${result.data.violations.length} for the next page.`);
  });

  it("holds every other read to READ_CHARS too, cutting what does not fit and saying so", async () => {
    const tools = createToolRuntime(skills(), { author: owner, readOnly: true });
    for (const [name, args] of [
      ["describe_place", { place: "home" }],
      ["describe_place", { place: "strengths" }],
      ["get_affordances", { selection: ["component-0", "component-1"] }],
    ] as const) {
      const result = await tools.call(name, args as Record<string, unknown>);
      expect(result.ok, name).toBe(true);
      const data = (result as { data: { cut?: string } }).data;
      expect(size(data), name).toBeLessThanOrEqual(READ_CHARS);
      if (data.cut) expect(data.cut).toMatch(new RegExp(`^This answer was \\d+ characters, more than the ${READ_CHARS} one read answers, so it is cut\\. Ask ${name} for less`));
    }
  });
});

describe("a seat's turn in that app", () => {
  it("is answered from the first result when it asks the same thing again: a line pointing at the call, not the answer", async () => {
    let answers: unknown[] = [];
    await llmResponder<AnySchema>({
      turn: async (turn: HostTurn) => {
        answers = [];
        for (const [name, args] of [
          ["get_graph", {}],
          ["get_node", { id: "component-1", offset: 0 }],
          ["get_graph", {}],
          ["get_graph", { offset: 25 }],
          ["get_node", { offset: 0, id: "component-1" }],
          ["get_graph", {}],
        ] as const) answers.push(await turn.call(name, args));
        return '{"say": "ok", "proposals": []}';
      },
    })(skills(), "add a new skill, playing basketball", { principal: owner });
    expect(answers[2]).toEqual({ already: alreadyRead(1) });
    expect(alreadyRead(1)).toBe("Already read: see the answer to call 1 of this turn, which is above.");
    // A different page is a different read; the same input in another order is the same one.
    expect(answers[3]).toHaveProperty("nodes");
    expect(answers[4]).toEqual({ already: alreadyRead(2) });
    expect(answers[5]).toEqual({ already: alreadyRead(1) });
    for (const answer of answers) expect(size(answer)).toBeLessThanOrEqual(READ_CHARS);
  });

  it("counts a repeat toward the cap of TURN_CALLS, so a model asking the same thing over and over is stopped", async () => {
    let answers: unknown[] = [];
    await llmResponder<AnySchema>({
      turn: async (turn: HostTurn) => {
        answers = [];
        for (let i = 0; i <= TURN_CALLS; i += 1) answers.push(await turn.call("get_violations", {}));
        return '{"say": "ok", "proposals": []}';
      },
    })(skills(), "what is wrong?", { principal: owner });
    expect(answers[1]).toEqual({ already: alreadyRead(1) });
    expect(answers[TURN_CALLS - 1]).toEqual({ already: alreadyRead(1) });
    expect(answers[TURN_CALLS]).toEqual({ error: `This turn has read ${TURN_CALLS} times; answer from what you have read.` });
  });

  it("keeps every step's request small through the Messages API: seven steps of reads and repeats stay within a few reads' size", async () => {
    const requests: MessagesStepRequest[] = [];
    const script: readonly (readonly [string, Record<string, unknown>])[][] = [
      [["get_graph", {}]],
      [["get_graph", {}]],
      [["get_graph", {}]],
      [["get_node", { id: "Component 1" }], ["search_graph", { query: "strength" }]],
      [["get_graph", {}], ["get_violations", {}]],
      [["get_node", { id: "Component 1" }]],
    ];
    const turn = turnThroughMessages(async (request) => {
      requests.push(request);
      const step = script[requests.length - 1];
      if (!step || request.tool_choice) return { content: [{ type: "text", text: '{"say": "Added.", "proposals": []}' }], stop_reason: "end_turn" };
      return { content: step.map(([name, input], i) => ({ type: "tool_use", id: `t${requests.length}-${i}`, name, input })), stop_reason: "tool_use" };
    });
    await llmResponder<AnySchema>({ turn })(skills(), "add a new skill, playing basketball", { principal: owner });
    expect(requests).toHaveLength(7);
    const results = requests[6]!.messages.flatMap((message) => (Array.isArray(message.content) ? message.content.filter((block) => block.type === "tool_result") : [])) as { content: string }[];
    // Four reads of their own, and four answered "already read".
    expect(results.filter((result) => result.content.includes("Already read")).length).toBe(4);
    for (const result of results) expect(result.content.length).toBeLessThanOrEqual(READ_CHARS);
    // The last step carries the system, the ask and four bounded reads — not the 28,000 tokens one read was.
    expect(size(requests[6])).toBeLessThan(size(requests[0]) + 5 * READ_CHARS);
  });
});
