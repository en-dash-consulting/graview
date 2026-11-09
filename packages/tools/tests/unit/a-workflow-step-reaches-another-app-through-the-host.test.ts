import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { suggestions } from "@graview/core/tidying";
import { workflowOrigin } from "@graview/core/workflows";
import { describe, expect, it } from "vitest";
import type { HostAi } from "../../src/ai.js";
import { farAppsOver, memoryWorkflowLog, runWorkflow, type WorkflowLog } from "../../src/workflows.js";

/*
 * A WORKFLOW'S STEP REACHES ANOTHER APP THROUGH THE HOST (Roadmap
 * f-workflow-steps-in-another-app): HQ keeps the tickets, Graview Public
 * shows them. A workflow in HQ runs Graview Public's act — an act step
 * over HQ's tickets, and a model's step shown Graview Public's tickets and
 * offered its act with its schema — through the host's `FarApps`, as the
 * workflow's own actor. A dry run lists the far write and keeps nothing
 * there; a real run makes it there with the run's lineage, so that app's
 * log says which workflow's run made it; a host with no way into other
 * apps refuses the step in words; and the runner never writes into the
 * other app's store itself.
 */

const PUBLIC_ADDRESS = "@self/graview-public";

const compiled = (document: unknown): GraviewApp<AnySchema> => {
  const result = compileDocument(document);
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((f) => f.severity === "error")));
  return result.app as GraviewApp<AnySchema>;
};

const PUBLIC = compiled({
  format: "graview-document",
  formatVersion: 1,
  name: "Graview Public",
  kinds: { ticket: { label: "{title}", fields: { title: { type: "string", required: true }, status: { type: "enum", options: ["open", "done"] } } } },
  acts: { "set-ticket-status": { title: "Set a ticket's status", on: "ticket", args: { status: { type: "enum", options: ["open", "done"], required: true } }, sets: { status: "$status" } } },
});

const HQ = compiled({
  format: "graview-document",
  formatVersion: 1,
  name: "HQ",
  kinds: { ticket: { label: "{title}", fields: { title: { type: "string", required: true }, status: { type: "enum", options: ["open", "done"] }, public: { type: "boolean" }, publicId: { type: "string" } } } },
  workflows: {
    "sync-tickets": {
      title: "Keep Graview Public's tickets in step",
      when: [{ every: "day 07:00" }],
      approve: "apply",
      steps: [{ act: `${PUBLIC_ADDRESS}/set-ticket-status`, over: { kind: "ticket", where: "public" }, args: { id: { expr: "publicId" }, status: { expr: "status" } }, key: "{publicId}" }],
    },
    "close-public": {
      title: "Close in public what HQ closed",
      when: [{ byHand: true }],
      approve: "apply",
      steps: [{ agent: "Close each public ticket HQ closed.", reads: ["ticket", `${PUBLIC_ADDRESS}/ticket`], acts: [`${PUBLIC_ADDRESS}/set-ticket-status`] }],
    },
    "ask-public": {
      title: "Ask Graview Public to close what HQ closed",
      when: [{ byHand: true }],
      approve: "ask",
      steps: [{ act: `${PUBLIC_ADDRESS}/set-ticket-status`, over: { kind: "ticket", where: "public" }, args: { id: { expr: "publicId" }, status: { expr: "status" } } }],
    },
  },
});

const NOW = "2026-11-04T07:00:00.000Z";
const stores = () => ({
  hq: new Store<AnySchema>({ schema: HQ.schema, mutations: (HQ.mutations ?? []) as never, now: () => NOW, snapshot: { nodes: [{ id: "h-1", kind: "ticket", title: "Login broken", status: "done", public: true, publicId: "t-1" }, { id: "h-2", kind: "ticket", title: "Payroll", status: "done", public: false }], edges: [] } as never }),
  public: new Store<AnySchema>({ schema: PUBLIC.schema, mutations: (PUBLIC.mutations ?? []) as never, now: () => NOW, snapshot: { nodes: [{ id: "t-1", kind: "ticket", title: "Login broken", status: "open" }], edges: [] } as never }),
});
const statusOf = (store: Store<AnySchema>, id: string) => (store.graph.getNode(id) as unknown as { status?: string } | undefined)?.status;

/** Run twice: the first after a workflow is added is dry whatever it is asked. */
async function runTwice(options: Omit<Parameters<typeof runWorkflow>[0], "log" | "now"> & { log?: WorkflowLog }) {
  const log = options.log ?? memoryWorkflowLog();
  const first = await runWorkflow({ ...options, log, now: NOW });
  const second = await runWorkflow({ ...options, log, now: NOW });
  return { first, second, log };
}

describe("an act step that runs another app's act", () => {
  it("lists the far write in a dry run, naming the app, and makes nothing there", async () => {
    const { hq, public: far } = stores();
    const run = await runWorkflow({ app: HQ, store: hq, log: memoryWorkflowLog(), workflow: "sync-tickets", now: NOW, farApps: farAppsOver({ [PUBLIC_ADDRESS]: { store: far, name: "Graview Public" } }) });
    expect(run.dry).toBe(true);
    expect(run.far).toEqual([{ step: 0, app: PUBLIC_ADDRESS, name: "Graview Public", act: "set-ticket-status", args: { id: "t-1", status: "done" }, as: "previewed", changed: ["t-1"], key: "t-1" }]);
    expect(run.notes).toContain(`In Graview Public (${PUBLIC_ADDRESS}) it would run 1 act; nothing was kept there.`);
    expect(statusOf(far, "t-1")).toBe("open");
    expect(far.log.all()).toEqual([]);
  });

  it("makes it there through the host, as the workflow's actor, with the run's lineage — and nothing twice", async () => {
    const { hq, public: far } = stores();
    const farApps = farAppsOver({ [PUBLIC_ADDRESS]: { store: far, name: "Graview Public" } });
    const { second: run, log } = await runTwice({ app: HQ, store: hq, workflow: "sync-tickets", farApps });
    expect(run.dry).toBe(false);
    expect(run.outcome).toBe("ok");
    expect(run.far?.map((one) => [one.app, one.act, one.as])).toEqual([[PUBLIC_ADDRESS, "set-ticket-status", "applied"]]);
    expect(run.notes).toContain(`In Graview Public (${PUBLIC_ADDRESS}) it ran 1 act.`);
    expect(statusOf(far, "t-1")).toBe("done");
    // That app's log says which workflow's run made it.
    const op = far.log.all().at(-1)!;
    expect(op.author).toMatchObject({ kind: "system", id: "workflow:sync-tickets", automated: true });
    expect(op.lineage).toMatchObject({ run: run.id, actor: "workflow:sync-tickets", key: "t-1" });
    expect(workflowOrigin(op)).toEqual({ workflow: "sync-tickets", run: run.id });
    // Nothing was written into HQ's own store.
    expect(hq.log.all()).toEqual([]);
    const third = await runWorkflow({ app: HQ, store: hq, log, workflow: "sync-tickets", now: NOW, farApps });
    expect(third.outcome).toBe("nothing-new");
    expect(third.far).toBeUndefined();
  });

  it("asks a person there when the workflow says ask: the change waits in that app's Suggested tray", async () => {
    const { hq, public: far } = stores();
    const { second: run } = await runTwice({ app: HQ, store: hq, workflow: "ask-public", farApps: farAppsOver({ [PUBLIC_ADDRESS]: { store: far } }) });
    expect(run.far?.map((one) => one.as)).toEqual(["suggested"]);
    expect(statusOf(far, "t-1")).toBe("open");
    expect(suggestions(far).map((one) => one.lineage?.run)).toEqual([run.id]);
  });

  it("is refused in words by a host with no way into other apps, and by one that does not let this workflow reach that app", async () => {
    const { hq, public: far } = stores();
    const { second: run } = await runTwice({ app: HQ, store: hq, workflow: "sync-tickets" });
    expect(run.outcome).toBe("partial");
    expect(run.heldBack).toEqual([{ step: 0, why: `Step 1: this host does not let workflows reach other apps, so it could not reach ${PUBLIC_ADDRESS}.` }]);
    expect(run.far).toBeUndefined();
    const { second: kept } = await runTwice({ app: HQ, store: hq, workflow: "sync-tickets", farApps: farAppsOver({ [PUBLIC_ADDRESS]: { store: far, reaches: (origin) => origin.workflow !== "sync-tickets" } }) });
    expect(kept.heldBack.map((one) => one.why)).toEqual([`Step 1: this host does not let “Keep Graview Public's tickets in step” reach ${PUBLIC_ADDRESS}.`]);
    expect(statusOf(far, "t-1")).toBe("open");
  });

  it("says the host's own sentence when the host refuses it in its words, and touches nothing there", async () => {
    const { hq, public: far } = stores();
    const sentence = "The owner of this workflow's app may not change Graview Public.";
    const { second: run } = await runTwice({ app: HQ, store: hq, workflow: "sync-tickets", farApps: { otherApp: () => ({ refused: sentence }) } });
    expect(run.outcome).toBe("partial");
    expect(run.heldBack).toEqual([{ step: 0, why: `Step 1: ${sentence}` }]);
    expect(run.far).toBeUndefined();
    // And through the in-memory host, by its grant's own words.
    const { second: kept } = await runTwice({ app: HQ, store: hq, workflow: "sync-tickets", farApps: farAppsOver({ [PUBLIC_ADDRESS]: { store: far, refuses: (origin) => (origin.workflow === "sync-tickets" ? "HQ's workflows may only read Graview Public" : undefined) } }) });
    expect(kept.heldBack.map((one) => one.why)).toEqual(["Step 1: HQ's workflows may only read Graview Public."]);
    expect(statusOf(far, "t-1")).toBe("open");
    expect(far.log.all()).toEqual([]);
  });

  it("still says in words that the app has no such act when its host gives no refusal of its own", async () => {
    const { hq, public: far } = stores();
    const reached = farAppsOver({ [PUBLIC_ADDRESS]: { store: far, name: "Graview Public" } });
    const farApps = {
      async otherApp(address: string, origin: Parameters<typeof reached.otherApp>[1]) {
        const app = await reached.otherApp(address, origin);
        return app && !("refused" in app) ? { ...app, shape: { ...app.shape, acts: {} } } : app;
      },
    };
    const { second: run } = await runTwice({ app: HQ, store: hq, workflow: "sync-tickets", farApps });
    expect(run.heldBack.map((one) => one.why)).toEqual([`Step 1: Graview Public (${PUBLIC_ADDRESS}) has no act “set-ticket-status”.`]);
    expect(statusOf(far, "t-1")).toBe("open");
  });
});

describe("a model's step that reads and proposes in another app", () => {
  const model = (asked: string[]): HostAi =>
    ({
      name: "thinker",
      complete: async ({ prompt }: { prompt: string }) => {
        asked.push(prompt);
        return { text: JSON.stringify({ proposals: [{ mutation: `${PUBLIC_ADDRESS}/set-ticket-status`, args: { id: "t-1", status: "done" }, confidence: 0.9, why: "HQ closed it" }] }) };
      },
    }) as unknown as HostAi;

  it("is offered the far act with the schema its host says and shown the far records, and its call is made there", async () => {
    const { hq, public: far } = stores();
    const asked: string[] = [];
    const { first, second } = await runTwice({ app: HQ, store: hq, workflow: "close-public", ai: model(asked), farApps: farAppsOver({ [PUBLIC_ADDRESS]: { store: far, name: "Graview Public" } }) });
    const offered = JSON.parse(/Acts you may propose:\n(.*)\n/.exec(asked[0]!)![1]!) as { name: string; app: string; inputSchema: { properties: Record<string, { enum?: string[] }> } }[];
    expect(offered.map((one) => [one.name, one.app])).toEqual([[`${PUBLIC_ADDRESS}/set-ticket-status`, "Graview Public"]]);
    expect(offered[0]!.inputSchema.properties["status"]!.enum).toEqual(["open", "done"]);
    expect(asked[0]).toContain(JSON.stringify({ id: "t-1", kind: `${PUBLIC_ADDRESS}/ticket`, name: "Login broken", title: "Login broken", status: "open" }));
    expect(asked[0]).toContain('"id":"h-1"');
    expect(first.far?.map((one) => one.as)).toEqual(["previewed"]);
    expect(second.far).toEqual([{ step: 0, app: PUBLIC_ADDRESS, name: "Graview Public", act: "set-ticket-status", args: { id: "t-1", status: "done" }, as: "applied", changed: ["t-1"], op: far.log.all().at(-1)!.id }]);
    expect(far.log.all().at(-1)!.lineage).toMatchObject({ run: second.id, model: "thinker", confidence: 0.9, basis: "HQ closed it" });
    expect(statusOf(far, "t-1")).toBe("done");
  });

  it("does not run, and says why, on a host with no way into other apps", async () => {
    const { hq } = stores();
    const asked: string[] = [];
    const { second } = await runTwice({ app: HQ, store: hq, workflow: "close-public", ai: model(asked) });
    expect(asked).toEqual([]);
    expect(second.heldBack.map((one) => one.why)).toEqual([`Step 1: this host does not let workflows reach other apps, so it could not reach ${PUBLIC_ADDRESS}, so the model's step did not run.`]);
  });

  it("does not run, and says the host's own sentence, when the host refuses it in its words", async () => {
    const { hq } = stores();
    const asked: string[] = [];
    const { second } = await runTwice({ app: HQ, store: hq, workflow: "close-public", ai: model(asked), farApps: { otherApp: () => ({ refused: "The owner of this workflow's app may not change Graview Public." }) } });
    expect(asked).toEqual([]);
    expect(second.heldBack.map((one) => one.why)).toEqual(["Step 1: The owner of this workflow's app may not change Graview Public, so the model's step did not run."]);
  });
});
