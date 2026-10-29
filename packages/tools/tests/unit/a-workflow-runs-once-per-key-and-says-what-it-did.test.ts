import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { digestWords, foldDigests } from "@graview/core/tidying";
import { declaredWorkflows } from "@graview/core/workflows";
import { describe, expect, it } from "vitest";
import { memoryWorkflowLog, runWorkflow, STEP_RUNNERS, type StepRunner, type WorkflowLog } from "../../src/workflows.js";

/*
 * A WORKFLOW RUNS ONCE PER KEY AND SAYS WHAT IT DID (Roadmap
 * f-job-idempotency, f-job-pause-dry-run, f-job-step-types). The first run
 * after a workflow is added is a dry run; the next makes each record once,
 * under its key; a rerun over the same input is nothing new, a changed
 * source changes what it made, and a retry after a failure half way makes
 * no second record. A paused workflow's clock starts nothing; a model's
 * step proposes only the acts it is given, and with no model is skipped.
 */

const HOME = {
  format: "graview-document",
  formatVersion: 1,
  name: "Home",
  kinds: {
    routine: { label: "{name}", fields: { name: { type: "string", required: true }, active: { type: "boolean" } } },
    event: { label: "{name}", fields: { name: { type: "string", required: true }, date: { type: "date" }, done: { type: "boolean" } } },
  },
  acts: {
    "add-event": { title: "Add an event", args: { name: { type: "string", required: true }, date: { type: "date" } }, effects: [{ create: "event", set: { name: "$name", date: "$date" } }] },
  },
  workflows: {
    "next-weeks-events": {
      title: "Fill out next week's events",
      when: [{ every: "sunday 18:00" }],
      steps: [{ act: "add-event", over: { kind: "routine", where: "active" }, args: { name: { expr: "name" }, date: "$today" }, key: "{id}" }],
    },
    "close-events": {
      title: "Close what is done",
      when: [{ byHand: true }],
      approve: "apply",
      steps: [{ agent: "Mark events that are over as done.", reads: ["event"], acts: ["edit-event"] }],
    },
  },
};

const compiled = compileDocument(HOME);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
// What the document declares, as a TypeScript app would hold it: a variant below is the app with these changed.
const declared = declaredWorkflows(app)!;

// Midday on every clock the suite runs on, so the run is "today" and never "overnight" whether the zone is UTC or New York.
const NOW = "2026-11-01T16:00:00.000Z";

function homeStore() {
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    now: () => NOW,
    snapshot: {
      nodes: [
        { id: "routine:run", kind: "routine", name: "Long run", active: true },
        { id: "routine:swim", kind: "routine", name: "Swim", active: true },
        { id: "routine:yoga", kind: "routine", name: "Yoga", active: false },
      ],
      edges: [],
    } as never,
  });
}

const events = (store: Store<AnySchema>) => [...(store.graph as unknown as { nodesOfKind(kind: string): { id: string; name: string }[] }).nodesOfKind("event")];
const run = (store: Store<AnySchema>, log: WorkflowLog, more: Partial<Parameters<typeof runWorkflow>[0]> = {}) => runWorkflow({ app, store, log, workflow: "next-weeks-events", now: NOW, ...more });

describe("an act step over a query, keyed", () => {
  it("is a dry run the first time after it is added: it says what it would make and keeps nothing", async () => {
    const store = homeStore();
    const first = await run(store, memoryWorkflowLog());
    expect(first).toMatchObject({ dry: true, outcome: "ok" });
    expect(first.made).toHaveLength(2);
    expect(first.notes).toContain("First run after a change: nothing was kept. The next run keeps what it does.");
    expect(events(store)).toEqual([]);
  });

  it("then makes one record for each record the rule picks, by the workflow, in one run", async () => {
    const store = homeStore();
    const log = memoryWorkflowLog();
    await run(store, log);
    const real = await run(store, log);
    expect(real).toMatchObject({ dry: false, outcome: "ok" });
    expect(events(store).map((one) => one.name).sort()).toEqual(["Long run", "Swim"]);
    const ops = store.log.all().filter((op) => op.lineage?.run === real.id);
    expect(ops).toHaveLength(2);
    expect(ops.every((op) => op.author.id === "workflow:next-weeks-events" && op.author.name === "Fill out next week's events")).toBe(true);
    // It read the log through where it stood when it began: what it made is after that.
    expect(ops.every((op) => op.seq >= real.through)).toBe(true);
    expect(real.through).toBe(0);
  });

  it("makes each record once: a run twice over the same input is nothing new", async () => {
    const store = homeStore();
    const log = memoryWorkflowLog();
    await run(store, log);
    await run(store, log);
    const again = await run(store, log);
    expect(again.outcome).toBe("nothing-new");
    expect(events(store)).toHaveLength(2);
  });

  it("changes what it made last time when its source changes, rather than making another", async () => {
    const store = homeStore();
    const log = memoryWorkflowLog();
    await run(store, log);
    const made = await run(store, log);
    store.apply({ name: "edit-routine", args: { id: "routine:run", name: "Long run (hills)" } });
    const after = await run(store, log);
    expect(after.outcome).toBe("ok");
    expect(after.made).toEqual([]);
    expect(after.changed).toHaveLength(1);
    expect(made.made).toContain(after.changed[0]);
    expect(events(store).map((one) => one.name).sort()).toEqual(["Long run (hills)", "Swim"]);
  });

  it("does not make again what a person removed since, and says so", async () => {
    const store = homeStore();
    const log = memoryWorkflowLog();
    await run(store, log);
    const made = await run(store, log);
    store.apply({ name: "remove-event", args: { id: made.made[0]! } });
    const after = await run(store, log);
    expect(events(store)).toHaveLength(1);
    expect(after.heldBack[0]?.why).toContain("was removed since; it is not made again");
  });

  it("makes no second record on a retry after a step failed half way", async () => {
    const store = homeStore();
    const log = memoryWorkflowLog();
    await run(store, log);
    const act = STEP_RUNNERS["act"] as unknown as StepRunner;
    const runners = STEP_RUNNERS as unknown as Record<string, StepRunner>;
    // The host goes away after the first record is kept.
    runners["act"] = {
      key: "act",
      run: (step, context) => {
        let changes = 0;
        return act.run(step, {
          ...context,
          change: (change) => {
            if (changes++ === 1) throw new Error("the host went away");
            return context.change(change);
          },
        });
      },
    };
    let failed;
    try {
      failed = await run(store, log);
    } finally {
      runners["act"] = act;
    }
    expect(failed.outcome).toBe("failed");
    expect(events(store)).toHaveLength(1);
    const retried = await run(store, log);
    expect(retried.outcome).toBe("ok");
    expect(retried.made).toHaveLength(1);
    expect(events(store).map((one) => one.name).sort()).toEqual(["Long run", "Swim"]);
    // The failed run left the cursor where the last good run had it.
    expect(failed.through).toBe(0);
  });

  it("folds into one row of Activity, said by the workflow's title", async () => {
    const store = homeStore();
    const log = memoryWorkflowLog();
    await run(store, log);
    await run(store, log);
    const rows = foldDigests(store.batches());
    const digest = rows.find((row) => "digest" in row);
    // When it fell ("today", "overnight", "on Nov 1") is the runner's clock and zone; whose run it was is the title.
    expect(digest && "digest" in digest ? digestWords(digest.digest, "2026-11-01") : "").toMatch(/^Fill out next week's events: 2 things (today|overnight|on .+)$/);
  });
});

describe("pausing and a dry run", () => {
  const paused = { ...app, workflows: { ...declared, "next-weeks-events": { ...declared["next-weeks-events"]!, status: "paused" as const } } };

  it("a paused workflow's clock starts nothing, and says so", async () => {
    const store = homeStore();
    const held = await runWorkflow({ app: paused, store, log: memoryWorkflowLog(), workflow: "next-weeks-events", now: NOW, trigger: { kind: "schedule", at: NOW } });
    expect(held).toMatchObject({ outcome: "held", made: [] });
    expect(held.notes[0]).toBe("“Fill out next week's events” is paused: it did not run.");
  });

  it("run by hand, a paused workflow is a dry run", async () => {
    const store = homeStore();
    const log = memoryWorkflowLog();
    await run(store, log);
    const byHand = await runWorkflow({ app: paused, store, log, workflow: "next-weeks-events", now: NOW });
    expect(byHand).toMatchObject({ dry: true, outcome: "ok" });
    expect(byHand.made).toHaveLength(2);
    expect(events(store)).toEqual([]);
  });

  it("a dry run asked for keeps nothing, and the run after it still keeps what it does", async () => {
    const store = homeStore();
    const log = memoryWorkflowLog();
    await run(store, log);
    const dry = await run(store, log, { dryRun: true });
    expect(dry.dry).toBe(true);
    expect(events(store)).toEqual([]);
    expect((await run(store, log)).made).toHaveLength(2);
  });
});

describe("a model's step", () => {
  const withEvents = () => {
    const store = homeStore();
    store.applyAll([
      { name: "add-event", args: { name: "Dentist", date: "2026-10-01" } },
      { name: "add-event", args: { name: "Party", date: "2026-12-24" } },
    ]);
    return store;
  };
  const twice = async (store: Store<AnySchema>, ai: Parameters<typeof runWorkflow>[0]["ai"]) => {
    const log = memoryWorkflowLog();
    await runWorkflow({ app, store, log, workflow: "close-events", now: NOW, ai });
    return runWorkflow({ app, store, log, workflow: "close-events", now: NOW, ai });
  };

  it("applies the acts the model proposes from its list, and lets go of any other", async () => {
    const store = withEvents();
    const dentist = events(store).find((one) => one.name === "Dentist")!.id;
    const asked: string[] = [];
    const ai = {
      complete: async (request: { prompt: string }) => {
        asked.push(request.prompt);
        return { text: JSON.stringify({ proposals: [{ mutation: "edit-event", args: { id: dentist, done: true }, confidence: 0.95, why: "It was in October." }, { mutation: "remove-event", args: { id: dentist }, confidence: 0.9 }] }) };
      },
    };
    const after = await twice(store, ai);
    expect(after.outcome).toBe("ok");
    expect(after.changed).toEqual([dentist]);
    expect(asked[0]).toContain("Mark events that are over as done.");
    expect(asked[0]).toContain('"Dentist"');
    expect(after.notes.some((note) => note.includes("named an act it may not propose"))).toBe(true);
    expect(store.graph.getNode(dentist)).toMatchObject({ done: true });
  });

  it("keeps the records it shows the model to its token budget", async () => {
    const store = withEvents();
    store.applyAll(Array.from({ length: 40 }, (_, at) => ({ name: "add-event", args: { name: `Class ${at + 1}`, date: "2026-11-20" } })));
    const tight = { ...app, workflows: { ...declared, "close-events": { ...declared["close-events"]!, steps: [{ agent: "Mark events that are over as done.", reads: ["event"], acts: ["edit-event"], budget: { tokens: 700 } }] } } };
    let prompt = "";
    const ai = { complete: async (request: { prompt: string }) => ((prompt = request.prompt), { text: '{"proposals": []}' }) };
    const log = memoryWorkflowLog();
    await runWorkflow({ app: tight, store, log, workflow: "close-events", now: NOW, ai });
    const after = await runWorkflow({ app: tight, store, log, workflow: "close-events", now: NOW, ai });
    expect(after.outcome).toBe("nothing-new");
    expect(after.notes, JSON.stringify({ notes: after.notes, held: after.heldBack, size: prompt.length })).toEqual(expect.arrayContaining([expect.stringMatching(/left out to keep to its budget of 700 tokens/)]));
    expect(prompt.length / 4).toBeLessThanOrEqual(700);
  });

  it("is skipped with no model lent, and the run says so rather than failing", async () => {
    const after = await twice(withEvents(), undefined);
    expect(after.outcome).toBe("partial");
    expect(after.heldBack[0]?.why).toContain("no model was lent");
  });
});
