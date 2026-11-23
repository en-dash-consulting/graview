import { bindSchema, createSchema, defineApp, defineNode, PUBLISH, Store, type AnySchema, type GraviewApp, type Principal, type Publishing } from "@graview/core";
import { acceptSuggestion, declineSuggestion, suggestions } from "@graview/core/tidying";
import type { WorkflowDeclaration } from "@graview/core/workflows";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { memoryWorkflowLog, runWorkflow } from "../../src/workflows.js";

/*
 * A WORKFLOW PUBLISHES THE APP'S DRAFTS (Roadmap f-workflow-step-publishes):
 * a publish step moves what readers are served when its approval lets it,
 * a dry run says what it would publish and publishes nothing, and the run
 * names what it published — how many changes, and the seqs they span.
 */
const story = defineNode("story", { fields: z.object({ label: z.string() }), plural: "Stories" });
const schema = createSchema([story]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-story", {
  title: "Add a story",
  creates: ["story"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "s"), kind: "story", label: args.label } as never);
  },
});
const editor: Principal = { kind: "human", id: "pat", name: "Pat", roles: ["editor"] };
const reader: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };
const publishing: Publishing = { mode: "on-publish", working: ["editor"] };
const policy = { grants: [{ roles: ["editor"], mutations: "*" as const }], sees: [{ roles: "*" as const, kinds: ["story"] }] };

function appWith(workflows: Record<string, WorkflowDeclaration>, publishes = true): GraviewApp<AnySchema> {
  return defineApp({ name: "news", schema, mutations: [add] as never, policy, ...(publishes ? { publishing } : {}), workflows }) as GraviewApp<AnySchema>;
}

/** A store an editor wrote three stories into, none published. */
function drafted(publishes = true): Store<AnySchema> {
  const store = new Store<AnySchema>({ schema, mutations: [add] as never, policy, ...(publishes ? { publishing } : {}), snapshot: { nodes: [], edges: [] } as never });
  for (const label of ["One", "Two", "Three"]) store.apply({ name: "add-story", args: { label } }, { author: editor });
  return store;
}

const readerSees = (store: Store<AnySchema>) => store.seenBy(reader).graph.allNodes().map((node) => node.label).sort();
const publishEach: WorkflowDeclaration = { title: "Publish each morning", when: [{ every: "day 07:00" }], approve: "apply", steps: [{ publish: "head" }] } as WorkflowDeclaration;

describe("a workflow publishes the app's drafts", () => {
  it("says what it would publish on a dry run and publishes nothing", async () => {
    const store = drafted();
    const head = store.log.length;
    const run = await runWorkflow({ app: appWith({ morning: publishEach }), store, workflow: "morning", log: memoryWorkflowLog() });
    expect(run.dry).toBe(true);
    expect(store.publishedSeq).toBeUndefined();
    expect(store.log.length).toBe(head);
    expect(readerSees(store)).toEqual([]);
    expect(run.published).toEqual([{ step: 0, changes: 3, from: 0, to: 2, through: head + 1, as: "previewed" }]);
    expect(run.notes).toContain("It would publish 3 changes (seqs 0 to 2); nothing was published.");
  });

  it("moves what readers are served to the head when its approval lets it, and names what it published on the run", async () => {
    const store = drafted();
    const log = memoryWorkflowLog();
    const app = appWith({ morning: publishEach });
    await runWorkflow({ app, store, workflow: "morning", log });
    const run = await runWorkflow({ app, store, workflow: "morning", log });
    expect(run.dry).toBe(false);
    expect(run.outcome).toBe("ok");
    expect(readerSees(store)).toEqual(["One", "Three", "Two"]);
    expect(store.publishedSeq).toBe(4);
    expect(run.published).toEqual([{ step: 0, changes: 3, from: 0, to: 2, through: 4, as: "published" }]);
    expect(run.notes).toContain("Published 3 changes (seqs 0 to 2): readers are served them now.");
    // The publish is the run's own op, under its lineage, said as the act says it.
    const ops = store.log.all().filter((op) => op.lineage?.run === run.id);
    expect(ops.map((op) => [op.mutation?.name, op.intent, op.author.id])).toEqual([["publish", "Publish 3 changes", "workflow:morning"]]);

    // Nothing new since: it publishes nothing and says so.
    const again = await runWorkflow({ app, store, workflow: "morning", log });
    expect(again.published).toBeUndefined();
    expect(again.outcome).toBe("nothing-new");
    expect(again.notes.some((note) => note.startsWith("Nothing new to publish"))).toBe(true);
    expect(store.publishedSeq).toBe(4);
  });

  it("publishes what an earlier step of the run made", async () => {
    const store = drafted();
    const log = memoryWorkflowLog();
    const app = appWith({ sync: { title: "Sync and publish", when: [{ byHand: true }], approve: "apply", steps: [{ act: "add-story", args: { label: "Synced" } }, { publish: "head" }] } as WorkflowDeclaration });
    const dry = await runWorkflow({ app, store, workflow: "sync", log });
    expect(dry.notes).toContain("It would publish 3 changes (seqs 0 to 2), and with them what the steps before it would change; nothing was published.");
    const run = await runWorkflow({ app, store, workflow: "sync", log });
    expect(run.published?.[0]).toMatchObject({ changes: 4, from: 0, to: 3, as: "published" });
    expect(readerSees(store)).toEqual(["One", "Synced", "Three", "Two"]);
  });

  it("under \"run\", publishes through what the run read and made, leaving a later change a draft", async () => {
    const store = drafted();
    const log = memoryWorkflowLog();
    const app = appWith({ morning: { ...publishEach, steps: [{ publish: "run" }] } as WorkflowDeclaration });
    await runWorkflow({ app, store, workflow: "morning", log });
    const run = await runWorkflow({ app, store, workflow: "morning", log });
    expect(run.published).toEqual([{ step: 0, changes: 3, from: 0, to: 2, through: 3, as: "published" }]);
    expect(store.publishedSeq).toBe(3);
  });

  it("asked, puts the publish to a person, and publishes once they say yes", async () => {
    const store = drafted();
    const log = memoryWorkflowLog();
    const app = appWith({ morning: { ...publishEach, approve: "ask" } as WorkflowDeclaration });
    await runWorkflow({ app, store, workflow: "morning", log });
    const run = await runWorkflow({ app, store, workflow: "morning", log });
    expect(run.published).toEqual([expect.objectContaining({ changes: 3, as: "suggested" })]);
    expect(run.notes).toContain("Asked a person to publish 3 changes (seqs 0 to 2); a yes publishes the drafts as they stand then, including what is asked with it.");
    expect(store.publishedSeq).toBeUndefined();
    const [waiting] = suggestions(store);
    expect(waiting?.id).toBe(run.suggested[0]);
    acceptSuggestion(store, waiting!.id, { author: editor });
    expect(store.publishedSeq).toBeDefined();
    expect(readerSees(store)).toEqual(["One", "Three", "Two"]);
    expect(suggestions(store)).toEqual([]);
  });

  it("asked under \"run\", publishes what the person says yes to with it, never taking back what was published since", async () => {
    const store = drafted();
    const log = memoryWorkflowLog();
    const app = appWith({ sync: { title: "Sync and publish", when: [{ byHand: true }], approve: "ask", steps: [{ act: "add-story", args: { label: "Synced" } }, { publish: "run" }] } as WorkflowDeclaration });
    await runWorkflow({ app, store, workflow: "sync", log });
    await runWorkflow({ app, store, workflow: "sync", log });
    // Somebody publishes further before the yes.
    store.apply({ name: "add-story", args: { label: "Late" } }, { author: editor });
    store.apply({ name: PUBLISH, args: {} }, { author: editor });
    const published = store.publishedSeq!;
    acceptSuggestion(store, suggestions(store)[0]!.id, { author: editor });
    expect(store.publishedSeq).toBeGreaterThan(published);
    expect(readerSees(store)).toEqual(["Late", "One", "Synced", "Three", "Two"]);
  });

  it("publishes again after a person undid a publish or declined an asked one: neither is a no to every later publish", async () => {
    const store = drafted();
    store.undo(store.apply({ name: PUBLISH, args: {} }, { author: editor }).ops[0]!.batch, { author: editor });
    expect(store.publishedSeq).toBeUndefined();
    const log = memoryWorkflowLog();
    const app = appWith({ morning: publishEach });
    await runWorkflow({ app, store, workflow: "morning", log });
    const run = await runWorkflow({ app, store, workflow: "morning", log });
    expect(run.published?.[0]?.as).toBe("published");
    expect(run.heldBack).toEqual([]);

    const asking = appWith({ morning: { ...publishEach, approve: "ask" } as WorkflowDeclaration });
    const other = drafted();
    const asked = memoryWorkflowLog();
    await runWorkflow({ app: asking, store: other, workflow: "morning", log: asked });
    await runWorkflow({ app: asking, store: other, workflow: "morning", log: asked });
    declineSuggestion(other, suggestions(other)[0]!.id, { author: editor });
    other.apply({ name: "add-story", args: { label: "Four" } }, { author: editor });
    const next = await runWorkflow({ app: asking, store: other, workflow: "morning", log: asked });
    expect(next.published?.[0]).toMatchObject({ changes: 4, as: "suggested" });
    expect(suggestions(other)).toHaveLength(1);
  });

  it("is skipped, in words, in an app that is live", async () => {
    const store = drafted(false);
    const log = memoryWorkflowLog();
    const app = appWith({ morning: publishEach }, false);
    await runWorkflow({ app, store, workflow: "morning", log });
    const run = await runWorkflow({ app, store, workflow: "morning", log });
    expect(run.outcome).toBe("partial");
    expect(run.heldBack).toEqual([{ step: 0, why: "Step 1: the app is live: every edit reaches its readers as it is made, so there is nothing to publish." }]);
    expect(run.published).toBeUndefined();
  });
});
