import { createSchema, defineNode, Store, type AnySchema } from "@graview/core";
import { suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Question } from "../../src/questions.js";
import { dream, duplicates, memoryDreamCache, NONE_FITS, NONE_OF_THESE, type DreamModel, type SystemOneAnswer } from "../../src/tidy.js";

/*
 * THE MODEL JUDGES; CODE FINDS, ROUTES AND MAKES. Code puts forward far
 * more than an exact match would — two vendors that share a telling word,
 * a task whose notes mention a vendor, a choice left empty — and a System
 * One model answers each in one request; how sure it is, against how much
 * the change would undo, says whether it is made, suggested or let go.
 * The model here is a fake that answers from fixtures, so every claim is
 * about the code around it.
 */
const vendor = defineNode("vendor", {
  description: "A business the wedding buys from.",
  fields: z.object({ label: z.string(), email: z.string().optional(), tier: z.enum(["preferred", "backup"]).optional() }),
});
const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]), notes: z.string().optional(), closedOn: z.string().optional() }),
  edges: { vendor: { to: ["vendor"], cardinality: "one", description: "who supplies it" } },
  fieldRoles: { end: "closedOn" },
});
const schema = createSchema([vendor, task]);
const NOW = "2026-10-22T09:00:00.000Z";

function storeOf(clock = { at: NOW }) {
  return new Store<AnySchema>({
    schema,
    now: () => clock.at,
    snapshot: {
      nodes: [
        { id: "vendor:acme", kind: "vendor", label: "Acme Corp", tier: "preferred" },
        { id: "vendor:acme-2", kind: "vendor", label: "ACME Corporation", tier: "backup" },
        { id: "vendor:harbor", kind: "vendor", label: "Harbor Catering", tier: "preferred" },
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "task:order", kind: "task", label: "Order the chairs", status: "todo", notes: "Harbor said they can bring them" },
        { id: "task:call", kind: "task", label: "Call about flowers", status: "doing", notes: "Not Quill, they only print" },
        { id: "task:old", kind: "task", label: "Book the hall", status: "done", closedOn: "2026-07-01" },
      ] as never,
      edges: [],
    },
  });
}

/** What a fixture is keyed by: the record (or "first + second") and the question. */
const subjectOf = (state: Record<string, { label?: string } | undefined>) => (state["record"] ? state["record"].label : `${state["first"]?.label} + ${state["second"]?.label}`);

/**
 * A FAKE SYSTEM ONE: answers by fixture, and otherwise as a model unsure of
 * anything would — "no", "different", "none of these".
 */
function fakeSystemOne(fixtures: Readonly<Record<string, SystemOneAnswer>>, options: { readonly fail?: string } = {}) {
  const asked: { subject: string; questions: Readonly<Record<string, Question>> }[] = [];
  const model: DreamModel = {
    model: "jev-latest",
    async decide(state, questions) {
      const subject = subjectOf(state as never) ?? "?";
      asked.push({ subject, questions });
      if (options.fail) throw new Error(options.fail);
      const answers: Record<string, SystemOneAnswer> = {};
      for (const [key, question] of Object.entries(questions)) {
        const fixture = fixtures[`${subject} / ${key}`];
        if (fixture) answers[key] = fixture;
        else if (question.type === "noul") answers[key] = { type: "noul", noul: 0.1 };
        else if (question.type === "score") answers[key] = { type: "score", score: 0.1, confidence: 0.9, probabilities: { "0": 0.9, "1": 0.1, "2": 0 }, legend: {} };
        else {
          const none = NONE_OF_THESE in question.criteria ? NONE_OF_THESE : NONE_FITS;
          answers[key] = { type: "choice", choice: none, confidence: 0.9, probabilities: { [none]: 0.9 } };
        }
      }
      return { answers, usage: { inputTokens: 100, outputTokens: 0 } };
    },
  };
  return { model, asked };
}

const choice = (chosen: string, p: number, others: Record<string, number> = {}): SystemOneAnswer => ({ type: "choice", choice: chosen, confidence: p, probabilities: { [chosen]: p, ...others } });
const FIXTURES: Record<string, SystemOneAnswer> = {
  "ACME Corporation + Acme Corp / same_thing": { type: "score", score: 1.91, confidence: 0.93, probabilities: { "0": 0.02, "1": 0.05, "2": 0.93 }, legend: {} },
  "ACME Corporation + Acme Corp / same_name": { type: "noul", noul: 0.95 },
  "Order the chairs / link_vendor": choice("Harbor Catering", 0.88, { [NONE_OF_THESE]: 0.12 }),
  "Book the hall / finished": { type: "noul", noul: 0.92 },
  "Quill Stationers / fill_tier": choice("backup", 0.9, { preferred: 0.05, [NONE_FITS]: 0.05 }),
};

const waitingCalls = (store: Store<AnySchema>) => suggestions(store).map((one) => one.calls[0]);

describe("a dream judged by a System One model", () => {
  it("finds a near-duplicate an exact match misses, and says why in words", async () => {
    const store = storeOf();
    const context = { store, now: Date.parse(NOW), touched: new Map(), quietFor: 0, olderThanDays: 30 };
    expect(duplicates.judge(context)).toEqual([]);
    const { model } = fakeSystemOne(FIXTURES);
    await dream(store, { now: NOW, model, cache: false });
    const merge = suggestions(store).find((one) => one.calls[0]!.name === "merge-vendor")!;
    expect(merge.calls[0]!.args).toEqual({ id: "vendor:acme-2", into: "vendor:acme" });
    expect(merge.lineage).toEqual({ basis: "Jev: 0.96 that “ACME Corporation” and “Acme Corp” are the same vendor", confidence: 0.96, model: "jev-latest", actor: "duplicates", run: expect.any(String) });
  });

  it("links a record to the candidate the model chose among several, through the relation the app declares", async () => {
    const store = storeOf();
    const { model, asked } = fakeSystemOne(FIXTURES);
    await dream(store, { now: NOW, model, cache: false });
    expect(waitingCalls(store)).toContainEqual({ name: "connect-task-vendor", args: { id: "task:order", to: "vendor:harbor" } });
    const order = asked.find((one) => one.subject === "Order the chairs")!;
    expect(order.questions["link_vendor"]).toMatchObject({ type: "choice", criteria: { "Harbor Catering": "a vendor: Harbor Catering", [NONE_OF_THESE]: expect.any(String) } });
    expect(order.questions["link_vendor"]!.instructions).toMatch(/who supplies it/);
  });

  it("drops a link when the model says none of these, and the judges' rules do not make it after all", async () => {
    const store = storeOf();
    const { model } = fakeSystemOne(FIXTURES);
    const report = await dream(store, { now: NOW, model, cache: false });
    expect(report.outcomes.find((one) => one.about[0] === "task:call" && one.judge === "missing-links")).toMatchObject({ outcome: "dropped", calls: [] });
    expect(waitingCalls(store).filter((call) => (call!.args as { id: string }).id === "task:call")).toEqual([]);
  });

  it("fills an empty choice with the option the model chose, applied only where the host lets it", async () => {
    const store = storeOf();
    const { model } = fakeSystemOne(FIXTURES);
    const report = await dream(store, { now: NOW, model, cache: false, applyAtLeast: 0.85 });
    expect(store.graph.getNode("vendor:quill")).toMatchObject({ tier: "backup" });
    expect(report.outcomes.find((one) => one.judge === "categorize" && one.outcome === "applied")).toMatchObject({ basis: "Jev: 0.90 that the tier of “Quill Stationers” is “backup”", model: "jev-latest" });
  });

  it("holds a merge to more than a link: as sure of each, the link is made and the merge is asked", async () => {
    const store = storeOf();
    const sure = { ...FIXTURES, "ACME Corporation + Acme Corp / same_name": { type: "noul", noul: 0.6 } as SystemOneAnswer };
    const { model } = fakeSystemOne(sure);
    const report = await dream(store, { now: NOW, model, cache: false, applyAtLeast: 0.8 });
    const outcome = (name: string) => report.outcomes.find((one) => one.calls[0]?.name === name)?.outcome;
    // 0.84 sure of the merge, 0.88 of the link.
    expect(outcome("merge-vendor")).toBe("suggested");
    expect(outcome("connect-task-vendor")).toBe("applied");
    expect(outcome("archive-task")).toBe("applied");
  });

  it("asks every question about one record in one request", async () => {
    const store = storeOf();
    const { model, asked } = fakeSystemOne(FIXTURES);
    await dream(store, { now: NOW, model, cache: false });
    const subjects = asked.map((one) => one.subject);
    expect(new Set(subjects).size).toBe(subjects.length);
    expect(Object.keys(asked.find((one) => one.subject === "Book the hall")!.questions)).toEqual(["finished"]);
    expect(Object.keys(asked.find((one) => one.subject === "ACME Corporation + Acme Corp")!.questions)).toEqual(["same_thing", "same_name"]);
  });

  it("stops asking at the run's budget, and leaves the rest to the judges' own rules", async () => {
    const store = storeOf();
    const { model, asked } = fakeSystemOne(FIXTURES);
    const report = await dream(store, { now: NOW, model, cache: false, concurrency: 1, budget: { requests: 2 } });
    expect(asked).toHaveLength(2);
    expect(report.usage).toMatchObject({ requests: 2, inputTokens: 200 });
    expect(report.budget).toMatch(/^Stopped at the run's request budget after 2 requests; \d+ candidates were left to the judges' own rules\.$/);
  });

  it("does not ask again what it was asked last night about records nothing changed", async () => {
    const cache = memoryDreamCache();
    const first = fakeSystemOne(FIXTURES);
    const ran = await dream(storeOf(), { now: NOW, model: first.model, cache });
    const second = fakeSystemOne(FIXTURES);
    const again = await dream(storeOf(), { now: NOW, model: second.model, cache });
    expect(second.asked).toEqual([]);
    expect(again.usage).toMatchObject({ requests: 0, cached: first.asked.length });
    expect(again.outcomes.map((one) => [one.outcome, one.basis])).toEqual(ran.outcomes.map((one) => [one.outcome, one.basis]));
    // A record that changed is asked again.
    const changed = storeOf({ at: "2026-10-20T09:00:00.000Z" });
    changed.apply({ name: "edit-vendor", args: { id: "vendor:quill", email: "orders@quill.example" } }, { author: { kind: "human", id: "nick", name: "Nick" } });
    const third = fakeSystemOne(FIXTURES);
    await dream(changed, { now: NOW, model: third.model, cache });
    // Quill changed, and so did the task whose candidates show it; nothing else is asked.
    expect(third.asked.map((one) => one.subject).sort()).toEqual(["Call about flowers", "Quill Stationers"]);
  });

  it("falls back to the judges' own rules when the model fails, and says so", async () => {
    const store = storeOf();
    const { model } = fakeSystemOne(FIXTURES, { fail: "The decision provider is rate-limiting and stayed so through 3 retries." });
    const report = await dream(store, { now: NOW, model, cache: false });
    expect(report.model).toMatchObject({ name: "jev-latest", answered: false, error: expect.stringMatching(/rate-limiting/) });
    expect(waitingCalls(store)).toEqual([{ name: "archive-task", args: { id: "task:old" } }]);
    expect(suggestions(store)[0]!.lineage).toEqual({ basis: "Finished — its status is “done” — and unchanged for 113 days", confidence: 0.8, actor: "archive", run: expect.any(String) });
  });

  it("is asked through the host's Fast slot, and not at all when the host says AI is off", async () => {
    const { model, asked } = fakeSystemOne(FIXTURES);
    const report = await dream(storeOf(), { now: NOW, ai: { fast: model }, cache: false });
    expect(report.model).toMatchObject({ name: "jev-latest", answered: true });
    const count = asked.length;
    const off = await dream(storeOf(), { now: NOW, ai: { fast: model, off: true }, cache: false });
    expect(off.model).toBeUndefined();
    expect(asked).toHaveLength(count);
  });
});
