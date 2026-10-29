import { describe, expect, it } from "vitest";
import { checkApp, compileDocument, describeApp } from "../../src/check.js";
import { documentJsonSchema } from "../../src/cli/document-schema.js";
import { diffDocuments, editDocument } from "../../src/document/index.js";
import type { GraviewDocument } from "../../src/document/schema.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { digestWords } from "../../src/tidying.js";
import { declaredWorkflows, nextRunAt, scheduleWords, STEP_KINDS, triggeredBy, workflowsOf, workflowWords, type WorkflowDeclaration } from "../../src/workflows.js";

/*
 * A WORKFLOW IS DECLARED, CHECKED AND SAID (Roadmap f-jobs-declared): the
 * document's `workflows` block compiles onto the app as it was written,
 * the checker says each way one could not run in the person's words with
 * the edit that fixes it, the edits add, replace, pause, resume and remove
 * one, and the app says each in a sentence and when it next runs.
 */

const HOME = {
  format: "graview-document",
  formatVersion: 1,
  name: "Home",
  kinds: {
    routine: { label: "{name}", fields: { name: { type: "string", required: true }, active: { type: "boolean" } } },
    event: { label: "{name}", fields: { name: { type: "string", required: true }, date: { type: "date" }, ends: { type: "date" } } },
    "grocery-list": { label: "{name}", fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["open", "done"] } } },
  },
  acts: {
    "add-event": { title: "Add an event", args: { name: { type: "string", required: true }, date: { type: "date" } }, effects: [{ create: "event", set: { name: "$name", date: "$date" } }] },
    "add-grocery-list": { title: "Add a list", args: { name: { type: "string", required: true }, status: { type: "enum", options: ["open", "done"] } }, effects: [{ create: "grocery-list", set: { name: "$name", status: "$status" } }] },
  },
  connections: {
    calendar: { system: "google-calendar", calendar: "primary", kind: "event", fields: { summary: "name", start: "date", end: "ends" }, direction: "both" },
  },
  workflows: {
    "next-weeks-events": {
      title: "Fill out next week's events",
      when: [{ every: "sunday 18:00" }, { made: "grocery-list", where: "status == 'done'" }],
      approve: "apply",
      steps: [{ act: "add-event", over: { kind: "routine", where: "active" }, args: { name: { expr: "name" }, date: "$today" }, key: "{id}" }],
    },
  },
} as const;

const compiled = (document: unknown) => {
  const result = compileDocument(document);
  return result;
};
const codes = (document: unknown) => {
  const result = compileDocument(document);
  return result.findings.filter((f) => f.code.startsWith("workflow-")).map((f) => `${f.code} @ ${f.path}`);
};
const withWorkflow = (workflow: unknown, extra: Record<string, unknown> = {}) => ({ ...HOME, ...extra, workflows: { w: workflow } });

describe("a workflow in the declaration", () => {
  it("round-trips through compile as it was written, read off the document the app remembers and never copied onto what a page draws", () => {
    const result = compiled(HOME);
    expect(result.ok, JSON.stringify(result.findings.filter((f) => f.severity === "error"))).toBe(true);
    if (!result.ok) return;
    expect(declaredWorkflows(result.app)).toEqual(HOME.workflows);
    expect(result.app.workflows).toBeUndefined();
  });

  it("is said whole in the JSON schema an editor reads", () => {
    const schema = documentJsonSchema("0.0.0") as { properties: Record<string, { additionalProperties?: { properties?: Record<string, unknown> } }> };
    expect(Object.keys(schema.properties["workflows"]!.additionalProperties!.properties!)).toEqual(expect.arrayContaining(["title", "when", "status", "approve", "steps"]));
  });

  it("is a closed set of step kinds, each told apart by one key", () => {
    expect(Object.keys(STEP_KINDS)).toEqual(["act", "agent", "generate", "archive", "classify"]);
  });
});

describe("what the checker says of a workflow", () => {
  it("refuses a workflow with no steps, offering to remove it (workflow-steps-empty)", () => {
    const result = compiled(withWorkflow({ title: "Nothing", when: [{ byHand: true }], steps: [] }));
    const finding = result.findings.find((f) => f.code === "workflow-steps-empty")!;
    expect(finding.path).toBe("workflows.w.steps");
    expect(finding.edits).toEqual([{ op: "remove-workflow", name: "w" }]);
  });

  it("refuses an act the app does not give, naming the near one (workflow-act-unknown)", () => {
    const result = compiled(withWorkflow({ title: "T", when: [{ byHand: true }], steps: [{ act: "add-evnt" }] }));
    const finding = result.findings.find((f) => f.code === "workflow-act-unknown")!;
    expect(finding.path).toBe("workflows.w.steps.0.act");
    expect(finding.fix).toContain('"add-event"');
    expect((finding.edits![0] as { workflow: { steps: { act: string }[] } }).workflow.steps[0]!.act).toBe("add-event");
  });

  it("refuses a kind the app does not have, in a step and a trigger (workflow-kind-unknown)", () => {
    expect(codes(withWorkflow({ title: "T", when: [{ made: "chore" }], steps: [{ act: "add-event", over: { kind: "chore" }, args: { name: "x" } }] }))).toEqual(["workflow-kind-unknown @ workflows.w.steps.0.over.kind", "workflow-kind-unknown @ workflows.w.when.0.made"]);
  });

  it("refuses a rule that does not read or reads what is not there (workflow-where-invalid)", () => {
    expect(codes(withWorkflow({ title: "T", when: [{ made: "grocery-list", where: "color == 'red'" }], steps: [{ act: "add-event", over: { kind: "routine", where: "active ==" }, args: { name: "x" } }] }))).toEqual(["workflow-where-invalid @ workflows.w.steps.0.over.where", "workflow-where-invalid @ workflows.w.when.0.where"]);
  });

  it("refuses a schedule it cannot read, naming what it reads (workflow-schedule-invalid)", () => {
    const result = compiled(withWorkflow({ title: "T", when: [{ every: "fortnightly" }, { cron: "0 25 * * *" }], steps: [{ act: "add-event", args: { name: "x" } }] }));
    const found = result.findings.filter((f) => f.code === "workflow-schedule-invalid");
    expect(found.map((f) => f.path)).toEqual(["workflows.w.when.0.every", "workflows.w.when.1.cron"]);
    expect(found[0]!.message).toContain('"sunday 18:00"');
  });

  it("refuses a connection the app does not declare (workflow-connection-unknown)", () => {
    expect(codes(withWorkflow({ title: "T", when: [{ synced: "notion" }], steps: [{ act: "add-event", args: { name: "x" } }] }))).toEqual(["workflow-connection-unknown @ workflows.w.when.0.synced"]);
  });

  it("refuses a key that reads what the step does not have (workflow-key-field-unknown)", () => {
    expect(codes(withWorkflow({ title: "T", when: [{ byHand: true }], steps: [{ act: "add-event", over: { kind: "routine" }, args: { name: "x" }, key: "{id}:{color}" }] }))).toEqual(["workflow-key-field-unknown @ workflows.w.steps.0.key"]);
  });

  it("refuses a model's step that may propose nothing, offering the acts over what it reads (workflow-agent-acts-empty)", () => {
    const result = compiled(withWorkflow({ title: "T", when: [{ byHand: true }], steps: [{ agent: "Tidy the events", reads: ["event"], acts: [] }] }));
    const finding = result.findings.find((f) => f.code === "workflow-agent-acts-empty")!;
    expect(finding.path).toBe("workflows.w.steps.0.acts");
    expect(finding.edits?.length).toBe(1);
  });

  it("says, without refusing, a step that writes to another system unasked (workflow-sends-out-unasked)", () => {
    const result = compiled(HOME);
    const finding = result.findings.find((f) => f.code === "workflow-sends-out-unasked")!;
    expect(finding.severity).toBe("warning");
    expect(finding.message).toContain('"calendar"');
    expect(result.ok).toBe(true);
    expect((finding.edits![0] as { workflow: { approve: string } }).workflow.approve).toBe("ask");
  });

  it("asks a TypeScript app the same, at its own path", () => {
    const result = compiled(HOME);
    if (!result.ok) throw new Error("compiles");
    const app = { ...result.app, workflows: { w: { title: "T", when: [{ every: "someday" }], steps: [{ act: "nope" }] } } } as unknown as GraviewApp<AnySchema>;
    const found = checkApp(app, { design: false }).findings.filter((f) => f.code.startsWith("workflow-"));
    expect(found.map((f) => `${f.code} @ ${f.where}`)).toEqual(['workflow-act-unknown @ defineApp(…).workflows["w"].steps[0].act', 'workflow-schedule-invalid @ defineApp(…).workflows["w"].when[0].every']);
  });
});

describe("editing an app's workflows", () => {
  const doc = HOME as unknown as GraviewDocument;
  const workflow = { title: "Set aside done lists", when: [{ every: "day 03:00" }], steps: [{ act: "archive-grocery-list", over: { kind: "grocery-list", where: "status == 'done'" } }] };

  it("adds one, judged as the checker judges it, and says it", () => {
    const out = editDocument(doc, [{ op: "add-workflow", name: "tidy-lists", workflow }]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.document.workflows?.["tidy-lists"]).toEqual(workflow);
    expect(out.said[0]).toBe("A new workflow “Set aside done lists”: Every day at 3 AM, one step.");
  });

  it("refuses one that could not run, with the checker's code", () => {
    const out = editDocument(doc, [{ op: "add-workflow", name: "bad", workflow: { ...workflow, steps: [{ act: "nope" }] } }]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.findings[0]!.code).toBe("workflow-act-unknown");
  });

  it("replaces, pauses, resumes and removes one, and the diff says each", () => {
    const set = editDocument(doc, [{ op: "set-workflow", name: "next-weeks-events", workflow: { ...HOME.workflows["next-weeks-events"], title: "Next week" } }]);
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(diffDocuments(doc, set.document).sentences).toContain("The workflow “Next week” changes: its next run is a dry run.");
    const paused = editDocument(doc, [{ op: "pause-workflow", name: "next-weeks-events" }]);
    if (!paused.ok) throw new Error("pauses");
    expect(paused.document.workflows?.["next-weeks-events"]?.status).toBe("paused");
    expect(diffDocuments(doc, paused.document).sentences).toEqual(["The workflow “Fill out next week's events” is paused."]);
    const resumed = editDocument(paused.document, [{ op: "resume-workflow", name: "next-weeks-events" }]);
    if (!resumed.ok) throw new Error("resumes");
    expect(resumed.document.workflows?.["next-weeks-events"]?.status).toBeUndefined();
    const removed = editDocument(doc, [{ op: "remove-workflow", name: "next-weeks-events" }]);
    if (!removed.ok) throw new Error("removes");
    expect(removed.document.workflows).toBeUndefined();
    expect(diffDocuments(doc, removed.document).sentences).toEqual(["The workflow “Fill out next week's events” is removed."]);
  });
});

describe("a workflow said and resolved", () => {
  const result = compiled(HOME);
  if (!result.ok) throw new Error("compiles");
  const app = result.app as GraviewApp<AnySchema>;

  it("is said in a sentence: what starts it, then what it does", () => {
    expect(workflowWords(HOME.workflows["next-weeks-events"] as unknown as WorkflowDeclaration)).toBe("Every Sunday at 6 PM, and when a grocery list is made where status == 'done': fill out next week's events");
    expect(scheduleWords({ cron: "0 9 * * 1-5" })).toBe("Every weekday at 9 AM");
    expect(scheduleWords({ every: "month 1 09:00" })).toBe("On the 1st of each month at 9 AM");
    expect(scheduleWords({ every: "hour" })).toBe("Every hour");
  });

  it("resolves with its defaults, and lists dreaming as every app's own", () => {
    const [declared, dreaming] = workflowsOf(app);
    expect(declared).toMatchObject({ name: "next-weeks-events", status: "active", approve: "apply", reads: ["routine"], writes: ["event"], sendsOut: true });
    expect(dreaming).toMatchObject({ name: "dreaming", builtIn: true, when: [{ every: "day 03:00" }] });
    // Unsaid, a workflow that writes to another system asks first.
    const asking = workflowsOf({ ...app, workflows: { w: { ...HOME.workflows["next-weeks-events"], approve: undefined } } } as never)[0]!;
    expect(asking.approve).toBe("ask");
  });

  it("does not list dreaming where every kind says the actor never tidies it", () => {
    const never = compiled({ ...HOME, kinds: Object.fromEntries(Object.entries(HOME.kinds).map(([kind, spec]) => [kind, { ...spec, tidying: "never" }])) });
    if (!never.ok) throw new Error("compiles");
    expect(workflowsOf(never.app).map((one) => one.name)).toEqual(["next-weeks-events"]);
  });

  it("is listed by describeApp, each step on a line", () => {
    const said = describeApp(app);
    expect(said).toContain("## What it does on its own");
    expect(said).toContain("next-weeks-events — Every Sunday at 6 PM, and when a grocery list is made where status == 'done': fill out next week's events; its changes are applied.");
    expect(said).toContain("1. Run “add-event” for each routine where active");
  });
});

describe("when a workflow next runs", () => {
  const zone = "America/New_York";
  const sunday = { when: [{ every: "sunday 18:00" }] };

  it("runs at 6 PM on the wall on the Sunday the clocks spring forward, and the one before", () => {
    // 2026-03-08 is the Sunday the clocks spring forward in New York.
    expect(nextRunAt(sunday, new Date("2026-03-02T12:00:00Z"), zone)?.toISOString()).toBe("2026-03-08T22:00:00.000Z");
    expect(nextRunAt(sunday, new Date("2026-02-23T12:00:00Z"), zone)?.toISOString()).toBe("2026-03-01T23:00:00.000Z");
  });

  it("runs a time the clock skips once, as the clock jumps past it, and a time it says twice once", () => {
    expect(nextRunAt({ when: [{ every: "day 02:30" }] }, new Date("2026-03-08T05:00:00Z"), zone)?.toISOString()).toBe("2026-03-08T07:00:00.000Z");
    const first = nextRunAt({ when: [{ every: "day 01:30" }] }, new Date("2026-11-01T04:00:00Z"), zone)!;
    const after = nextRunAt({ when: [{ every: "day 01:30" }] }, first, zone)!;
    expect(after.toISOString().slice(0, 10)).toBe("2026-11-02");
  });

  it("reads cron the same, the soonest of several triggers first, and nothing when paused", () => {
    const both = { when: [{ cron: "0 18 * * 0" }, { every: "weekday 09:00" }] };
    expect(nextRunAt(both, new Date("2026-03-07T12:00:00Z"), zone)?.toISOString()).toBe("2026-03-08T22:00:00.000Z");
    expect(nextRunAt(both, new Date("2026-03-08T23:00:00Z"), zone)?.toISOString()).toBe("2026-03-09T13:00:00.000Z");
    expect(nextRunAt({ ...both, status: "paused" }, new Date(), zone)).toBeUndefined();
  });
});

describe("what a commit starts", () => {
  const result = compiled(HOME);
  if (!result.ok) throw new Error("compiles");
  const app = result.app as GraviewApp<AnySchema>;
  const store = () => new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: { nodes: [{ id: "grocery-list:1", kind: "grocery-list", name: "Week", status: "open" }], edges: [] } as never });
  const workflow = (when: readonly unknown[]) => ({ name: "w", title: "W", when }) as never;

  it("fires `made` for a record of the kind its rule holds of, and not otherwise", () => {
    const s = store();
    const done = s.applyAll([{ name: "add-grocery-list", args: { name: "Party", status: "done" } }]).ops;
    expect(triggeredBy(workflow([{ made: "grocery-list", where: "status == 'done'" }]), { ops: done }, s)).toHaveLength(1);
    const open = s.applyAll([{ name: "add-grocery-list", args: { name: "Later", status: "open" } }]).ops;
    expect(triggeredBy(workflow([{ made: "grocery-list", where: "status == 'done'" }]), { ops: open }, s)).toEqual([]);
  });

  it("fires `changed` only for the fields it names", () => {
    const s = store();
    const ops = s.applyAll([{ name: "edit-grocery-list", args: { id: "grocery-list:1", status: "done" } }]).ops;
    expect(triggeredBy(workflow([{ changed: "grocery-list", fields: ["status"] }]), { ops }, s)[0]?.records).toEqual(["grocery-list:1"]);
    expect(triggeredBy(workflow([{ changed: "grocery-list", fields: ["name"] }]), { ops }, s)).toEqual([]);
  });

  it("fires `synced` for its connection's pass, and never for the workflow's own changes", () => {
    const s = store();
    expect(triggeredBy(workflow([{ synced: "calendar" }]), { synced: "calendar" }, s)).toHaveLength(1);
    expect(triggeredBy(workflow([{ synced: "calendar" }]), { synced: "notion" }, s)).toEqual([]);
    const own = s.applyAll([{ name: "add-grocery-list", args: { name: "Mine", status: "done" } }], { author: { kind: "system", id: "workflow:w", name: "W", automated: true } }).ops;
    expect(triggeredBy(workflow([{ made: "grocery-list" }]), { ops: own }, s)).toEqual([]);
  });
});

describe("a workflow's run in Activity", () => {
  it("is said by the workflow's title", () => {
    // Noon, on the day as the runner's own clock reads it: "today" in any zone.
    const at = new Date(2026, 10, 1, 12).toISOString();
    expect(digestWords({ things: 6, at, author: { id: "workflow:w", name: "Fill out next week's events" } }, "2026-11-01")).toBe("Fill out next week's events: 6 things today");
    expect(digestWords({ things: 1, at, author: { id: "tidying", name: "Graview, tidying" } }, "2026-11-01")).toBe("Tidied one thing today");
  });
});

describe("the acts a workflow may name", () => {
  it("leave out setting aside a kind that is never set aside, in a document as in an app", () => {
    const never = { ...HOME, kinds: { ...HOME.kinds, routine: { ...HOME.kinds.routine, archives: false } } };
    expect(codes({ ...never, workflows: { w: { title: "T", when: [{ byHand: true }], steps: [{ act: "archive-routine", over: { kind: "routine" } }] } } })).toEqual(["workflow-act-unknown @ workflows.w.steps.0.act"]);
  });
});
