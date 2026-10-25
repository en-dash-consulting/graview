import { describe, expect, it } from "vitest";
import { z } from "zod";
import { aiContextOf } from "../../src/catalog.js";
import { checkApp, compileDocument, describeApp } from "../../src/check.js";
import { documentJsonSchema } from "../../src/cli/document-schema.js";
import { compileDocumentWithoutCheck, editDocument, toDocument } from "../../src/document/index.js";
import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { answerJob, jobsFor, jobsOf } from "../../src/jobs.js";

/**
 * AN APP SAYS WHO IT IS FOR AND WHAT THEY COME TO DO (Roadmap f-app-jobs).
 * A declaration's `purpose` is a sentence about its people and up to twelve
 * jobs — a question in their words, answered by the records of one kind a
 * rule holds for, in an order, with the act they take next. It is read the
 * same from a document and from `defineApp`, held to the declaration by the
 * checker (`job-*`), carried along by every edit that renames or removes
 * what a job names, answered as a seat may see it, and said by the
 * describer and to a model.
 */
const WEDDING = {
  format: "graview-document",
  formatVersion: 1,
  name: "Our wedding",
  roles: ["owner", "guest"],
  kinds: {
    vendor: {
      fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["asked", "booked"], default: "asked" }, due: { type: "date" }, cost: { type: "number" }, photo: { type: "image" } },
      edges: { hiredFor: { to: ["event"], cardinality: "one" } },
    },
    event: { fields: { name: { type: "string", required: true }, day: { type: "date" } } },
    secret: { fields: { name: { type: "string", required: true } } },
  },
  acts: {
    book: { title: "Book it", on: "vendor", sets: { status: "booked" } },
    "add-vendor": { creates: "vendor" },
    "add-event": { creates: "event" },
    "add-secret": { creates: "secret" },
  },
  policy: {
    grants: [{ roles: ["owner"], mutations: "*" }],
    sees: [
      { roles: "*", kinds: ["vendor", "event"] },
      { roles: ["owner"], kinds: ["secret"] },
    ],
  },
  purpose: {
    for: "The couple and their planner, mostly on phones",
    jobs: [
      { name: "unbooked-soon", ask: "What's still unbooked and due soon?", kind: "vendor", where: "status != 'booked' and due <= '2026-12-31'", sort: "due", act: "book", roles: ["owner"] },
      { name: "dearest", ask: "Who costs the most?", kind: "vendor", sort: { by: "cost", direction: "desc" } },
      { name: "secrets", ask: "What are we keeping quiet?", kind: "secret", roles: ["owner"] },
    ],
  },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const copy = (): any => structuredClone(WEDDING);
function compiled(document: unknown = WEDDING): GraviewApp<AnySchema> {
  const result = compileDocument(document);
  if (!result.ok) throw new Error(result.findings.map((f) => `${f.code} ${f.path}: ${f.message}`).join("\n"));
  return result.app as GraviewApp<AnySchema>;
}
const jobCodes = (document: unknown) => compileDocument(document).findings.filter((f) => /^jobs?-/.test(f.code)).map((f) => ({ code: f.code, path: f.path }));

const OWNER: Principal = { kind: "human", id: "ana", roles: ["owner"] };
const GUEST: Principal = { kind: "human", id: "gus", roles: ["guest"] };

function wedding() {
  const app = compiled();
  const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy } as never) as Store<AnySchema>;
  for (const [name, status, due, cost] of [
    ["Florist", "asked", "2026-11-02", 900],
    ["Band", "booked", "2026-10-30", 2400],
    ["Caterer", "asked", "2026-10-28", 5200],
    ["Cake", "asked", "2027-02-01", 300],
    ["Photographer", "asked", undefined, 1800],
  ] as const) store.apply({ name: "add-vendor", args: { name, status, ...(due ? { due } : {}), cost } }, { author: OWNER });
  store.apply({ name: "add-secret", args: { name: "The ring" } }, { author: OWNER });
  return { app, store };
}
const names = (store: Store<AnySchema>, ids: readonly string[]) => ids.map((id) => (store.graph.getNode(id) as { name?: string } | undefined)?.name);

describe("a declaration's purpose", () => {
  it("is read from a document, carried by the compiled app and given back by toDocument", () => {
    const app = compiled();
    expect(app.purpose).toEqual(WEDDING.purpose);
    expect(toDocument(app).document.purpose).toEqual(WEDDING.purpose);
  });

  it("is read loosely by a page and judged whole by the checker: a job takes no key it does not have, and the JSON schema says its shape", () => {
    const schema = documentJsonSchema("0.0.0") as { properties: Record<string, { properties?: Record<string, unknown> }> };
    expect(Object.keys(schema.properties["purpose"]!.properties!)).toEqual(["for", "jobs"]);
    const document = copy();
    document.purpose.jobs[0].filter = "status";
    expect(compileDocumentWithoutCheck(document).ok).toBe(true);
    const checked = compileDocument(document);
    expect(checked.ok).toBe(false);
    expect(checked.findings.map((f) => [f.code, f.path])).toEqual([["unknown-key", "purpose.jobs.0"]]);
  });

  it("is taken by defineApp in the same words, its where in the rule language, and judged by the checker with the same codes", () => {
    const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().optional(), due: z.iso.date().optional() }) });
    const schema = createSchema([task]);
    const { defineMutation } = bindSchema(schema);
    const complete = defineMutation("complete", { subject: { kinds: ["task"], arg: "id" }, input: z.object({ id: nodeRef(["task"]) }), apply: (ctx, args) => ctx.patchNode(args.id, { done: true }) });
    const app = defineApp({
      name: "Chores",
      schema,
      mutations: [complete],
      purpose: {
        for: "Two people sharing a flat",
        jobs: [
          { name: "due-today", ask: "What's due today?", kind: "task", where: "not done and due <= today()", sort: "due", act: "complete" },
          { name: "broken", ask: "What's wrong?", kind: "chore", where: "nope", act: "complete", roles: ["boss"] },
        ],
      },
    });
    const found = checkApp(app).findings.filter((f) => f.code.startsWith("job")).map((f) => [f.code, f.where]);
    expect(found).toEqual([
      ["job-kind", "defineApp(…).purpose.jobs[1].kind"],
      ["job-role", "defineApp(…).purpose.jobs[1].roles"],
    ]);
    const store = new Store({
      schema,
      mutations: [complete],
      snapshot: {
        nodes: [
          { id: "t-1", kind: "task", label: "Bins", due: "2020-01-02" },
          { id: "t-2", kind: "task", label: "Dishes", due: "2020-01-01" },
          { id: "t-3", kind: "task", label: "Hoover", due: "2020-01-01", done: true },
          { id: "t-4", kind: "task", label: "Windows", due: "2999-01-01" },
        ],
        edges: [],
      },
    } as never) as Store<AnySchema>;
    expect(jobsOf(app).map((job) => job.name)).toEqual(["due-today"]);
    expect(answerJob(store, jobsOf(app)[0]!, { kind: "human", id: "a" })).toEqual({ count: 2, ids: ["t-2", "t-1"] });
  });
});

describe("the checker, on a document's jobs", () => {
  it("passes the wedding's jobs as declared", () => {
    expect(jobCodes(WEDDING)).toEqual([]);
  });

  it("names a kind, a where, a sort, an act, an act on another kind and a role it cannot answer by, each at its path", () => {
    const document = copy();
    document.purpose.jobs = [
      { name: "a", ask: "?", kind: "venue" },
      { name: "b", ask: "?", kind: "vendor", where: "price > 3" },
      { name: "c", ask: "?", kind: "vendor", where: "status ==" },
      { name: "d", ask: "?", kind: "vendor", sort: "photo" },
      { name: "e", ask: "?", kind: "vendor", sort: { by: "nothing", direction: "asc" } },
      { name: "f", ask: "?", kind: "vendor", act: "elope" },
      { name: "g", ask: "?", kind: "event", act: "book" },
      { name: "h", ask: "?", kind: "event", act: "add-event" },
      { name: "i", ask: "?", kind: "vendor", roles: ["planner"] },
      { name: "a", ask: "?", kind: "vendor", where: "count(out('hiredFor')) > 0 and count(all('event')) > 0", act: "edit-vendor", sort: "label" },
    ];
    expect(jobCodes(document)).toEqual([
      { code: "job-kind", path: "purpose.jobs.0.kind" },
      { code: "job-where", path: "purpose.jobs.1.where" },
      { code: "job-where", path: "purpose.jobs.2.where" },
      { code: "job-sort", path: "purpose.jobs.3.sort" },
      { code: "job-sort", path: "purpose.jobs.4.sort" },
      { code: "job-act", path: "purpose.jobs.5.act" },
      { code: "job-act-kind", path: "purpose.jobs.6.act" },
      { code: "job-act-kind", path: "purpose.jobs.7.act" },
      { code: "job-role", path: "purpose.jobs.8.roles" },
      { code: "job-name-taken", path: "purpose.jobs.9.name" },
    ]);
  });

  it("refuses more than twelve jobs", () => {
    const document = copy();
    document.purpose.jobs = Array.from({ length: 13 }, (_, n) => ({ name: `job-${n}`, ask: "?", kind: "vendor" }));
    expect(jobCodes(document)).toEqual([{ code: "jobs-too-many", path: "purpose.jobs" }]);
  });
});

describe("a job, answered", () => {
  it("is resolved with its order's direction and its kind's plural, and narrowed to a seat's roles", () => {
    const jobs = jobsOf(compiled());
    expect(jobs[1]).toEqual({ name: "dearest", ask: "Who costs the most?", kind: "vendor", plural: "vendors", sort: { by: "cost", direction: "desc" } });
    expect(jobsFor(jobs, GUEST).map((job) => job.name)).toEqual(["dearest"]);
    expect(jobsFor(jobs, OWNER).map((job) => job.name)).toEqual(["unbooked-soon", "dearest", "secrets"]);
  });

  it("counts the records its where holds for, in its order, the ones with nothing to sort by last", () => {
    const { app, store } = wedding();
    const [soon, dearest] = jobsOf(app);
    const unbooked = answerJob(store, soon!, OWNER);
    expect(unbooked.count).toBe(2);
    expect(names(store, unbooked.ids)).toEqual(["Caterer", "Florist"]);
    expect(names(store, answerJob(store, dearest!, OWNER).ids)).toEqual(["Caterer", "Band", "Photographer", "Florist", "Cake"]);
  });

  it("is held to the seat's sight: a kind kept from it answers nothing, and an archived record is not counted", () => {
    const { app, store } = wedding();
    const secrets = jobsOf(app)[2]!;
    expect(answerJob(store, secrets, OWNER).count).toBe(1);
    expect(answerJob(store, secrets, GUEST)).toEqual({ count: 0, ids: [] });
    const cake = (store.graph.nodesOfKind("vendor") as unknown as { id: string; name?: string }[]).find((node) => node.name === "Cake")!;
    store.apply({ name: "archive-vendor", args: { id: cake.id } }, { author: OWNER });
    expect(answerJob(store, jobsOf(app)[1]!, OWNER).count).toBe(4);
  });
});

describe("the edits a purpose is changed by", () => {
  it("set the sentence, add a job, change one and take one away, each said", () => {
    const start = copy();
    delete start.purpose;
    let outcome = editDocument(start, [
      { op: "set-purpose", for: "Us" },
      { op: "add-job", job: { name: "cheap", ask: "What's cheap?", kind: "vendor", where: "cost < 500" } },
      { op: "edit-job", name: "cheap", sort: "cost", act: "book" },
    ]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.document.purpose).toEqual({ for: "Us", jobs: [{ name: "cheap", ask: "What's cheap?", kind: "vendor", where: "cost < 500", sort: "cost", act: "book" }] });
    expect(outcome.said).toEqual(['The app says it is for "Us".', `A new job, "What's cheap?": answered by the vendors where cost < 500.`, `The job "cheap", "What's cheap?", is now answered by the vendors where cost < 500, sorted by cost, then "book".`]);
    outcome = editDocument(outcome.document, [{ op: "edit-job", name: "cheap", where: null }, { op: "remove-job", name: "cheap" }, { op: "set-purpose", for: null }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.document.purpose).toBeUndefined();
  });

  it("refuse a job the checker would, with its code, and a name already taken", () => {
    const refused = (edit: Record<string, unknown>) => {
      const outcome = editDocument(copy(), [edit]);
      return outcome.ok ? [] : outcome.findings.map((f) => f.code);
    };
    expect(refused({ op: "add-job", job: { name: "x", ask: "?", kind: "venue" } })).toEqual(["job-kind"]);
    expect(refused({ op: "add-job", job: { name: "dearest", ask: "?", kind: "vendor" } })).toEqual(["job-name-taken"]);
    expect(refused({ op: "edit-job", name: "dearest", act: "add-event" })).toEqual(["job-act-kind"]);
    expect(refused({ op: "edit-job", name: "nobody", ask: "?" })).toEqual(["edit"]);
    expect(refused({ op: "add-job", job: { name: "x", kind: "vendor" } })).toEqual(["edit"]);
  });

  it("carry jobs along a renamed kind, field and act, and let go of what a removal takes", () => {
    const renamed = editDocument(copy(), [
      { op: "rename-field", kind: "vendor", field: "due", to: "dueOn" },
      { op: "rename-kind", kind: "vendor", to: "supplier" },
    ]);
    if (!renamed.ok) throw new Error(JSON.stringify(renamed.findings));
    expect(renamed.document.purpose!.jobs![0]).toMatchObject({ kind: "supplier", where: "status != 'booked' and dueOn <= '2026-12-31'", sort: "dueOn", act: "book" });
    expect(renamed.document.purpose!.jobs![1]).toMatchObject({ kind: "supplier" });
    expect(jobCodes(renamed.document)).toEqual([]);

    const removed = editDocument(copy(), [{ op: "remove-field", kind: "vendor", field: "cost" }, { op: "remove-act", act: "book" }, { op: "remove-kind", kind: "secret" }]);
    if (!removed.ok) throw new Error(JSON.stringify(removed.findings));
    // The sort by cost is let go, the act no longer named, and the job over secrets goes with them.
    expect(removed.document.purpose!.jobs).toEqual([
      { name: "unbooked-soon", ask: "What's still unbooked and due soon?", kind: "vendor", where: "status != 'booked' and due <= '2026-12-31'", sort: "due", roles: ["owner"] },
      { name: "dearest", ask: "Who costs the most?", kind: "vendor" },
    ]);
    expect(removed.said.join(" ")).toMatch(/the order of the job "dearest"/);
    expect(removed.said.join(" ")).toMatch(/the job "secrets"/);

    const gone = editDocument(copy(), [{ op: "remove-field", kind: "vendor", field: "status" }]);
    if (!gone.ok) throw new Error(JSON.stringify(gone.findings));
    expect(gone.document.purpose!.jobs!.map((job) => job.name)).toEqual(["dearest", "secrets"]);
  });
});

describe("who it is for, said", () => {
  it("by the describer: the sentence, and each job's ask — only a seat's own when asked as one", () => {
    const app = compiled();
    const all = describeApp(app);
    expect(all).toContain("## Who it is for\nWho uses it: The couple and their planner, mostly on phones.");
    expect(all).toContain(`"What's still unbooked and due soon?" — the vendors where status != 'booked' and due <= '2026-12-31', sorted by due, then "book" (for owner).`);
    const asGuest = describeApp(app, { as: { kind: "human", roles: ["guest"] } });
    expect(asGuest).toContain(`"Who costs the most?" — the vendors, sorted by cost, highest first.`);
    expect(asGuest).not.toContain("unbooked");
  });

  it("to a model: the sentence and the asks of the jobs the viewer's roles and sight include", () => {
    const { app, store } = wedding();
    const asOwner = aiContextOf(store, { on: "place", place: "home" }, { principal: OWNER, purpose: app.purpose! });
    expect(asOwner.purpose).toEqual({
      for: "The couple and their planner, mostly on phones",
      jobs: [
        { name: "unbooked-soon", ask: "What's still unbooked and due soon?", kind: "vendor" },
        { name: "dearest", ask: "Who costs the most?", kind: "vendor" },
        { name: "secrets", ask: "What are we keeping quiet?", kind: "secret" },
      ],
    });
    expect(aiContextOf(store, { on: "place", place: "home" }, { principal: GUEST, purpose: app.purpose! }).purpose!.jobs.map((job) => job.name)).toEqual(["dearest"]);
    expect(aiContextOf(store, { on: "place", place: "home" }, { principal: OWNER }).purpose).toBeUndefined();
  });
});
