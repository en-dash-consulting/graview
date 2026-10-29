import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { lineageWords } from "@graview/core/provenance";
import { suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import type { HostAi } from "../../src/ai.js";
import type { Decide } from "../../src/fast.js";
import { memoryWorkflowLog, runWorkflow, type WorkflowLog } from "../../src/workflows.js";

/*
 * A CLASSIFY STEP LABELS EACH RECORD (Roadmap f-feedback-triage-agent):
 * one typed judgment per new feedback — spam, NSFW, rude, sensitive, needs
 * another look, good to show — with how sure and why on its lineage;
 * spam sure enough is set aside (archived, never removed); a label a host
 * shows the public waits for a person's yes even when the rest applies;
 * without a model the floor decides and what it cannot is left for a
 * person; and a record once labeled is never labeled again.
 */

const OPTIONS = ["spam", "nsfw", "rude", "sensitive", "needs-look", "good-to-show"];

const document = (step: Record<string, unknown>) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Feedback",
  kinds: {
    feedback: { noun: "feedback", plural: "feedback", label: "{title}", fields: { title: { type: "string", required: true }, body: { type: "string" }, category: { type: "enum", options: OPTIONS } } },
  },
  workflows: { triage: { title: "Triage new feedback", when: [{ made: "feedback" }], steps: [{ classify: "feedback", field: "category", ...step }] } },
});

const appOf = (step: Record<string, unknown>): GraviewApp<AnySchema> => {
  const compiled = compileDocument(document(step));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  return compiled.app as GraviewApp<AnySchema>;
};

const NOW = "2026-11-01T16:00:00.000Z";

const storeOf = (app: GraviewApp<AnySchema>, more: Record<string, unknown>[] = []) =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    now: () => NOW,
    snapshot: {
      nodes: [
        { id: "f-buy", kind: "feedback", title: "Buy cheap watches", body: "Visit https://a.example and https://b.example now" },
        { id: "f-love", kind: "feedback", title: "Lovely app", body: "It keeps our garden straight." },
        { id: "f-dumb", kind: "feedback", title: "This is dumb", body: "Whoever made this is an idiot." },
        { id: "f-meh", kind: "feedback", title: "Hmm", body: "Not sure what to say." },
        ...more,
      ],
      edges: [],
    } as never,
  });

/** A fake System One model: which option, and how sure, by what the record says. */
function judge(name = "jev-test"): HostAi & { asked: string[] } {
  const asked: string[] = [];
  const decide: Decide = async (state) => {
    const said = JSON.stringify(state);
    asked.push(said);
    const [choice, p] = /watches/.test(said) ? ["spam", 0.95] : /Lovely/.test(said) ? ["good-to-show", 0.9] : /dumb/.test(said) ? ["rude", 0.8] : ["none fits", 0.7];
    return { answers: { label: { type: "choice", choice, confidence: p, probabilities: { [choice]: p, "needs-look": 1 - p } } }, usage: { inputTokens: 100, outputTokens: 5 } };
  };
  return { name, decide, asked } as HostAi & { asked: string[] };
}

const categoryOf = (store: Store<AnySchema>, id: string) => (store.graph.getNode(id) as Record<string, unknown> | undefined)?.["category"];
const archived = (store: Store<AnySchema>, id: string) => (store.graph.getNode(id) as Record<string, unknown> | undefined)?.["$archived"] === true;

/** The first run after a workflow is added is a dry run; this is that one, then the run that keeps. */
async function runReal(app: GraviewApp<AnySchema>, store: Store<AnySchema>, log: WorkflowLog, ai?: HostAi) {
  await runWorkflow({ app, store, log, workflow: "triage", now: NOW, ...(ai ? { ai } : {}) });
  return runWorkflow({ app, store, log, workflow: "triage", now: NOW, ...(ai ? { ai } : {}) });
}

describe("a classify step with a model", () => {
  it("labels each record with the model's choice, sets spam it is sure of aside, and keeps why on the lineage", async () => {
    const app = appOf({ approve: "apply", setAside: { spam: 0.9 } });
    const store = storeOf(app);
    const ai = judge();
    const run = await runReal(app, store, memoryWorkflowLog(), ai);
    expect(run.dry).toBe(false);
    expect(categoryOf(store, "f-buy")).toBe("spam");
    expect(archived(store, "f-buy")).toBe(true);
    expect(store.graph.getNode("f-buy")).toBeDefined();
    expect(categoryOf(store, "f-dumb")).toBe("rude");
    expect(archived(store, "f-dumb")).toBe(false);
    expect(categoryOf(store, "f-love")).toBe("good-to-show");
    expect(categoryOf(store, "f-meh")).toBeUndefined();
    expect(run.archived).toEqual(["f-buy"]);
    expect(run.notes).toContain("Left one feedback for a person: neither the model nor the floor labeled it.");
  });

  it("says why a record got its label: the model, how sure, and what it judged", async () => {
    const app = appOf({ approve: "apply" });
    const store = storeOf(app);
    await runReal(app, store, memoryWorkflowLog(), judge());
    const op = store.log.all().find((one) => one.primitives.some((p) => p.op === "patch-node" && p.id === "f-buy" && "category" in p.after))!;
    expect(op.lineage).toMatchObject({ basis: "Jev: 95% sure “Buy cheap watches” is spam", confidence: 0.95, model: "jev-test", actor: "workflow:triage" });
    expect(op.lineage?.run).toMatch(/^workflow:triage:/);
    expect(op.author).toMatchObject({ id: "workflow:triage", automated: true });
    expect(lineageWords(op.lineage!)).toBe("based on “Jev: 95% sure “Buy cheap watches” is spam” · 95% sure · jev-test");
  });

  it("asks a person before a label it is told to confirm, even when the rest applies", async () => {
    const app = appOf({ approve: "apply", confirm: ["good-to-show"] });
    const store = storeOf(app);
    const run = await runReal(app, store, memoryWorkflowLog(), judge());
    expect(categoryOf(store, "f-buy")).toBe("spam");
    expect(categoryOf(store, "f-love")).toBeUndefined();
    const waiting = suggestions(store);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.calls).toEqual([{ name: "edit-feedback", args: { id: "f-love", category: "good-to-show" } }]);
    expect(run.suggested).toEqual([waiting[0]!.id]);
  });

  it("asks a person before every label when the step says no approve of its own: one suggestion for the run, nothing set", async () => {
    const app = appOf({ setAside: { spam: 0.9 } });
    const store = storeOf(app);
    await runReal(app, store, memoryWorkflowLog(), judge());
    expect(["f-buy", "f-love", "f-dumb"].map((id) => categoryOf(store, id))).toEqual([undefined, undefined, undefined]);
    expect(archived(store, "f-buy")).toBe(false);
    const waiting = suggestions(store);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.calls.map((call) => call.name).sort()).toEqual(["archive-feedback", "edit-feedback", "edit-feedback", "edit-feedback"]);
  });

  it("never labels a record again, by a run or a person, unless the step says relabel", async () => {
    const app = appOf({ approve: "apply" });
    const store = storeOf(app, [{ id: "f-kept", kind: "feedback", title: "Lovely, by hand", category: "needs-look" }]);
    const log = memoryWorkflowLog();
    const ai = judge();
    await runReal(app, store, log, ai);
    expect(categoryOf(store, "f-kept")).toBe("needs-look");
    const asked = ai.asked.length;
    const again = await runWorkflow({ app, store, log, workflow: "triage", now: NOW, ai });
    expect(again.outcome).toBe("nothing-new");
    // Only the one no label fits is judged again; the cache answers it.
    expect(ai.asked.length).toBe(asked);
    expect(again.notes.some((note) => /^Passed by 4 feedback already labeled/.test(note))).toBe(true);

    const relabel = appOf({ approve: "apply", relabel: true });
    await runReal(relabel, store, memoryWorkflowLog(), judge("jev-other"));
    expect(categoryOf(store, "f-kept")).toBe("good-to-show");
  });

  it("judges only the records a change started it for", async () => {
    const app = appOf({ approve: "apply" });
    const store = storeOf(app);
    const log = memoryWorkflowLog();
    await runWorkflow({ app, store, log, workflow: "triage", now: NOW, dryRun: true });
    const run = await runWorkflow({ app, store, log, workflow: "triage", now: NOW, ai: judge(), trigger: { kind: "made", records: ["f-dumb"] } });
    expect(run.changed).toEqual(["f-dumb"]);
    expect(categoryOf(store, "f-buy")).toBeUndefined();
  });
});

describe("a classify step without a model", () => {
  const floor = { spam: { links: 2, words: ["casino"] }, rude: { words: ["idiot"] } };

  it("lets the floor decide, sure, and leaves for a person what no rule matches", async () => {
    const app = appOf({ approve: "apply", floor, setAside: { spam: 0.9 } });
    const store = storeOf(app);
    const run = await runReal(app, store, memoryWorkflowLog());
    expect(run.outcome).toBe("ok");
    expect(categoryOf(store, "f-buy")).toBe("spam");
    expect(archived(store, "f-buy")).toBe(true);
    expect(categoryOf(store, "f-dumb")).toBe("rude");
    expect(categoryOf(store, "f-love")).toBeUndefined();
    expect(run.notes).toContain("Step 1: no model was lent, so the floor decided.");
    expect(run.notes).toContain("Left 2 feedback for a person: no floor rule labeled them.");
    const op = store.log.all().find((one) => one.primitives.some((p) => p.op === "patch-node" && p.id === "f-buy" && "category" in p.after))!;
    expect(op.lineage).toMatchObject({ basis: "Sure: spam, from 2 links", confidence: 1 });
    expect(op.lineage?.model).toBeUndefined();
  });

  it("lets the floor decide what the model could not answer", async () => {
    const app = appOf({ approve: "apply", floor });
    const store = storeOf(app);
    const failing: HostAi = { name: "jev-down", decide: async () => Promise.reject(new Error("the service is down")) } as HostAi;
    const run = await runReal(app, store, memoryWorkflowLog(), failing);
    expect(categoryOf(store, "f-buy")).toBe("spam");
    expect(run.notes.some((note) => note.includes("the model failed (the service is down); the floor decided the rest."))).toBe(true);
  });

  it("is skipped, and the run partial, with neither a model nor a floor", async () => {
    const app = appOf({ approve: "apply" });
    const store = storeOf(app);
    const run = await runReal(app, store, memoryWorkflowLog());
    expect(run.outcome).toBe("partial");
    expect(run.heldBack).toEqual([{ step: 0, why: "Step 1: no model was lent and the step has no floor, so nothing was labeled." }]);
  });
});

/*
 * WHAT NO OPTION CLEARS, AND WHAT IT IS SURE ENOUGH OF (Roadmap
 * f-workflow-runs-say-more, request classify-step-otherwise-and-apply-at):
 * `otherwise` labels a record neither the model nor the floor found an
 * option for, rather than leaving it unlabeled; `applyAt` sets a label the
 * model is at least that sure of without asking, and asks below it as the
 * step says — never for an option `confirm` names.
 */
describe("a classify step's otherwise and applyAt", () => {
  it("labels what no option clears with otherwise, and says how many", async () => {
    const app = appOf({ approve: "apply", otherwise: "needs-look" });
    const store = storeOf(app);
    const run = await runReal(app, store, memoryWorkflowLog(), judge());
    expect(categoryOf(store, "f-meh")).toBe("needs-look");
    expect(categoryOf(store, "f-buy")).toBe("spam");
    expect(run.notes).toContain("Labeled one feedback needs-look: neither the model nor the floor found an option that fit.");
    expect(run.notes.some((note) => note.startsWith("Left"))).toBe(false);
  });

  it("labels what no floor rule matches with otherwise when no model is lent", async () => {
    const app = appOf({ approve: "apply", floor: { spam: { links: 2 } }, otherwise: "good-to-show" });
    const store = storeOf(app);
    await runReal(app, store, memoryWorkflowLog());
    expect(["f-buy", "f-love", "f-dumb", "f-meh"].map((id) => categoryOf(store, id))).toEqual(["spam", "good-to-show", "good-to-show", "good-to-show"]);
  });

  it("sets a label at or above its applyAt without asking, and asks the rest as the step says", async () => {
    const app = appOf({ applyAt: { spam: 0.9, rude: 0.9 } });
    const store = storeOf(app);
    await runReal(app, store, memoryWorkflowLog(), judge());
    expect(categoryOf(store, "f-buy")).toBe("spam");
    expect(categoryOf(store, "f-dumb")).toBeUndefined();
    expect(categoryOf(store, "f-love")).toBeUndefined();
    const waiting = suggestions(store);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.calls).toEqual([
      { name: "edit-feedback", args: { id: "f-love", category: "good-to-show" } },
      { name: "edit-feedback", args: { id: "f-dumb", category: "rude" } },
    ]);
  });

  it("asks before an option confirm names, whatever its applyAt", async () => {
    const app = appOf({ applyAt: { spam: 0.5 }, confirm: ["spam"] });
    const store = storeOf(app);
    await runReal(app, store, memoryWorkflowLog(), judge());
    expect(categoryOf(store, "f-buy")).toBeUndefined();
    expect(suggestions(store)[0]!.calls).toContainEqual({ name: "edit-feedback", args: { id: "f-buy", category: "spam" } });
  });
});
