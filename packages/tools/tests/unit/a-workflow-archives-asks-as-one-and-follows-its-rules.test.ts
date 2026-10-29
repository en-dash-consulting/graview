import { bindSchema, createSchema, defineApp, defineNode, isArchived, nodeRef, Store, type AnySchema, type Author, type GraviewApp } from "@graview/core";
import { acceptSuggestion, declined, declineSuggestion, foldDigests, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { memoryWorkflowLog, runWorkflow } from "../../src/workflows.js";
import type { WorkflowDeclaration } from "@graview/core/workflows";

/*
 * A WORKFLOW SETS ASIDE WHAT IS DONE WITH, ASKS AS ONE, AND FOLLOWS THE
 * APP'S OWN RULES (Roadmap f-retention-rules, f-job-approvals,
 * f-job-rule-inputs).
 */
const list = defineNode("grocery-list", {
  fields: z.object({ label: z.string(), status: z.enum(["open", "done"]), doneOn: z.string().optional() }),
});
const pinned = defineNode("recipe", { fields: z.object({ label: z.string() }), tidying: "never" });
const rule = defineNode("rule", { fields: z.object({ label: z.string(), action: z.string(), order: z.number().optional(), appliesTo: z.string().optional(), status: z.enum(["active", "retired"]).optional() }) });
const schema = createSchema([list, pinned, rule]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish-list", {
  title: "Finish a list",
  subject: { kinds: ["grocery-list"], arg: "id" },
  input: z.object({ id: nodeRef(["grocery-list"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "done" });
  },
});

const nick: Author = { kind: "human", id: "nick", name: "Nick" };
const DAY = 86_400_000;
const T0 = Date.parse("2026-10-01T09:00:00.000Z");
const iso = (at: number) => new Date(at).toISOString();

function appWith(workflows: Record<string, WorkflowDeclaration>): GraviewApp<AnySchema> {
  return defineApp({ name: "groceries", schema, mutations: [finish] as never, workflows }) as GraviewApp<AnySchema>;
}

/** A store whose clock the test moves: three lists finished on day 0, one still open, one a person finishes on day 5. */
function storeAt(clock: { at: number }) {
  const store = new Store<AnySchema>({
    schema,
    mutations: [finish] as never,
    now: () => iso(clock.at),
    snapshot: {
      nodes: [
        { id: "grocery-list:sunday", kind: "grocery-list", label: "Sunday shop", status: "open" },
        { id: "grocery-list:party", kind: "grocery-list", label: "Party", status: "open" },
        { id: "grocery-list:standing", kind: "grocery-list", label: "Standing order", status: "open" },
        { id: "grocery-list:week", kind: "grocery-list", label: "This week", status: "open" },
        { id: "grocery-list:later", kind: "grocery-list", label: "Later", status: "open" },
        { id: "recipe:soup", kind: "recipe", label: "Soup" },
        { id: "rule:keep-standing", kind: "rule", label: "Keep the standing order", action: "Keep the standing order: it is used every week", appliesTo: "label == 'Standing order'", order: 1 },
        { id: "rule:old", kind: "rule", label: "An old rule", action: "Archive everything", status: "retired" },
        { id: "rule:words", kind: "rule", label: "Say why", action: "Say why in one sentence", order: 2 },
      ] as never,
      edges: [],
    },
  });
  clock.at = T0;
  for (const id of ["grocery-list:sunday", "grocery-list:party", "grocery-list:standing"]) store.apply({ name: "finish-list", args: { id } }, { author: nick });
  return store;
}

const tidy: WorkflowDeclaration = { title: "Set aside done grocery lists", when: [{ every: "day 03:00" }], approve: "apply", follows: "rule", steps: [{ archive: "grocery-list", where: "status == 'done'", after: "3 days" }] } as WorkflowDeclaration;

/** Runs a workflow twice — the first run after it is added is a dry run — and answers the real run. */
async function runReal(app: GraviewApp<AnySchema>, store: Store<AnySchema>, name: string, clock: { at: number }, log = memoryWorkflowLog()) {
  const first = await runWorkflow({ app, store, workflow: name, log, now: iso(clock.at) });
  expect(first.dry).toBe(true);
  return { run: await runWorkflow({ app, store, workflow: name, log, now: iso(clock.at) }), log };
}

describe("a workflow archives what is done with (f-retention-rules)", () => {
  it("archives a done record once it has stood the days it says, never one younger, never removing it, as one row of Activity", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    clock.at = T0 + 5 * DAY;
    store.apply({ name: "finish-list", args: { id: "grocery-list:week" } }, { author: nick });
    const { run } = await runReal(appWith({ tidy }), store, "tidy", clock);
    expect(run.outcome).toBe("ok");
    expect([...run.archived].sort()).toEqual(["grocery-list:party", "grocery-list:sunday"]);
    expect(isArchived(store.graph.getNode("grocery-list:sunday"))).toBe(true);
    // Finished today: too young. Open: not done. Neither touched.
    expect(isArchived(store.graph.getNode("grocery-list:week"))).toBe(false);
    expect(isArchived(store.graph.getNode("grocery-list:later"))).toBe(false);
    const ops = store.log.all().filter((op) => op.lineage?.run === run.id);
    expect(ops.map((op) => op.mutation?.name)).toEqual(["archive-grocery-list", "archive-grocery-list"]);
    const rows = foldDigests(store.batches(), (id) => store.log.get(id));
    expect(rows.filter((row) => "digest" in row && row.digest.run === run.id)).toHaveLength(1);
  });

  it("passes by a record a rule it follows keeps, and says so", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    clock.at = T0 + 5 * DAY;
    const { run } = await runReal(appWith({ tidy }), store, "tidy", clock);
    expect(run.archived).not.toContain("grocery-list:standing");
    expect(run.notes.join(" ")).toContain("Kept one record by the rule “Keep the standing order”");
  });

  it("passes by a record a person said to leave alone", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    store.apply({ name: "leave-alone-grocery-list", args: { id: "grocery-list:party" } }, { author: nick });
    clock.at = T0 + 5 * DAY;
    const { run } = await runReal(appWith({ tidy }), store, "tidy", clock);
    expect(run.archived).toEqual(["grocery-list:sunday"]);
    expect(run.notes.join(" ")).toContain("a person said to leave alone");
  });

  it("never archives again a record a person brought back from its archive", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    clock.at = T0 + 5 * DAY;
    const log = memoryWorkflowLog();
    const { run } = await runReal(appWith({ tidy }), store, "tidy", clock, log);
    const archiving = store.log.all().find((op) => op.lineage?.run === run.id && (op.mutation?.args as { id?: string }).id === "grocery-list:sunday")!;
    store.undo(archiving.batch, { author: nick });
    store.apply({ name: "unarchive-grocery-list", args: { id: "grocery-list:party" } }, { author: nick });
    clock.at = T0 + 10 * DAY;
    const again = await runWorkflow({ app: appWith({ tidy }), store, workflow: "tidy", log, now: iso(clock.at) });
    expect(again.archived).toEqual([]);
    expect(again.outcome).toBe("nothing-new");
    expect(again.notes.join(" ")).toContain("brought back after this workflow archived them");
  });

  it("holds back on a kind the app says is never tidied", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    const app = appWith({ soup: { title: "Set aside recipes", when: [{ byHand: true }], approve: "apply", steps: [{ archive: "recipe" }] } as WorkflowDeclaration });
    const { run } = await runReal(app, store, "soup", clock);
    expect(run.archived).toEqual([]);
    expect(run.heldBack.map((one) => one.why).join(" ")).toContain("never tidied");
    expect(store.graph.getNode("recipe:soup")).toBeDefined();
  });
});

describe("a workflow that asks gathers its run into one suggestion (f-job-approvals)", () => {
  const ask = { ...tidy, approve: "ask" } as WorkflowDeclaration;

  it("asks one suggestion per run, said as one, each change its own sentence, the run named on its lineage", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    clock.at = T0 + 5 * DAY;
    const { run } = await runReal(appWith({ tidy: ask }), store, "tidy", clock);
    const waiting = suggestions(store);
    expect(waiting).toHaveLength(1);
    const [one] = waiting;
    expect(run.suggested).toEqual([one!.id]);
    expect(one!.headline).toBe("Set aside done grocery lists: 2 grocery lists to archive");
    expect(one!.items.map((item) => item.intent)).toEqual(["Archive Sunday shop", "Archive Party"]);
    expect(one!.lineage?.run).toBe(run.id);
    // Nothing made yet.
    expect(store.graph.getNode("grocery-list:sunday")).toBeDefined();
  });

  it("is accepted a change at a time, the rest still waiting, then declined, and what was accepted is no decline", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    clock.at = T0 + 5 * DAY;
    await runReal(appWith({ tidy: ask }), store, "tidy", clock);
    const [group] = suggestions(store);
    acceptSuggestion(store, group!.id, { author: nick, items: [1] });
    expect(isArchived(store.graph.getNode("grocery-list:party"))).toBe(true);
    const [rest] = suggestions(store);
    expect(rest!.id).toBe(group!.id);
    expect(rest!.items.map((item) => item.at)).toEqual([0]);
    expect(rest!.intent).toBe("Archive Sunday shop");
    declineSuggestion(store, group!.id, { author: nick });
    expect(suggestions(store)).toEqual([]);
    expect(declined(store, [{ name: "archive-grocery-list", args: { id: "grocery-list:sunday" } }])).toBeDefined();
    expect(declined(store, [{ name: "archive-grocery-list", args: { id: "grocery-list:party" } }])).toBeUndefined();
  });

  it("accepted whole, every change is made under the suggestion's lineage", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    clock.at = T0 + 5 * DAY;
    await runReal(appWith({ tidy: ask }), store, "tidy", clock);
    const [group] = suggestions(store);
    acceptSuggestion(store, group!.id, { author: nick });
    expect(suggestions(store)).toEqual([]);
    expect(isArchived(store.graph.getNode("grocery-list:sunday"))).toBe(true);
    expect(store.log.all().filter((op) => op.lineage?.suggestion === group!.id)).toHaveLength(2);
  });

  it("a later run's group takes the place of the one still waiting, never piling up", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    clock.at = T0 + 5 * DAY;
    const { log } = await runReal(appWith({ tidy: ask }), store, "tidy", clock);
    store.apply({ name: "finish-list", args: { id: "grocery-list:week" } }, { author: nick });
    clock.at = T0 + 9 * DAY;
    const again = await runWorkflow({ app: appWith({ tidy: ask }), store, workflow: "tidy", log, now: iso(clock.at) });
    const waiting = suggestions(store);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.id).toBe(again.suggested[0]);
    expect(waiting[0]!.items).toHaveLength(3);
    // Withdrawn, not declined: nothing in it is refused for later.
    expect(declined(store, [{ name: "archive-grocery-list", args: { id: "grocery-list:sunday" } }])).toBeUndefined();
  });

  it("asks exactly what still waits, and the waiting one stands, three runs in a row: one suggestion, the later runs nothing new", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    clock.at = T0 + 5 * DAY;
    const { run, log } = await runReal(appWith({ tidy: ask }), store, "tidy", clock);
    expect(run.suggested).toHaveLength(1);
    for (const day of [1, 2]) {
      const again = await runWorkflow({ app: appWith({ tidy: ask }), store, workflow: "tidy", log, now: iso(clock.at + day * DAY) });
      expect(again.suggested).toEqual([]);
      expect(again.outcome).toBe("nothing-new");
      expect(suggestions(store).map((one) => one.id)).toEqual(run.suggested);
    }
    expect(store.log.all().filter((op) => op.suggests)).toHaveLength(1);
  });
});

describe("a workflow follows the rules kept as records (f-job-rule-inputs)", () => {
  it("hands an agent step the rules that stand, verbatim and in order", async () => {
    const clock = { at: T0 };
    const store = storeAt(clock);
    const prompts: string[] = [];
    const app = appWith({ sort: { title: "Sort the lists", when: [{ byHand: true }], approve: "apply", follows: "rule", steps: [{ agent: "Finish what is bought.", reads: ["grocery-list"], acts: ["finish-list"] }] } as WorkflowDeclaration });
    const ai = { complete: async ({ prompt }: { prompt: string }) => (prompts.push(prompt), JSON.stringify({ proposals: [] })) };
    await runWorkflow({ app, store, workflow: "sort", log: memoryWorkflowLog(), ai: ai as never, now: iso(clock.at), dryRun: true });
    expect(prompts[0]).toContain("1. Keep the standing order: Keep the standing order: it is used every week (applies to label == 'Standing order')\n2. Say why: Say why in one sentence");
    expect(prompts[0]).not.toContain("Archive everything");
  });
});
