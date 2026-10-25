// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * THE HOME OPENS ON THE JOBS (Roadmap f-design-composer). An app that says
 * what its people come to do, and draws no home of its own, leads with it:
 * the first job with records waiting is the page's title, with how many and
 * the first of them, each offering the act people take next; a job with
 * nothing waiting is a quiet line; what the app holds follows, smaller. An
 * app with no jobs keeps the home it had.
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Chores",
  kinds: {
    task: {
      noun: "task",
      plural: "tasks",
      fields: { label: { type: "string", required: true }, status: { type: "enum", options: ["todo", "done"], default: "todo", required: true }, due: { type: "date" } },
    },
  },
  acts: { finish: { title: "Finish", on: "task", sets: { status: "done" } } },
  roles: ["owner", "helper"],
  policy: { grants: [{ roles: ["owner", "helper"], mutations: "*" }] },
  lenses: [{ name: "columns", title: "The board", bindings: { task: { column: "status" } } }],
};
const jobs = [
  { name: "late", ask: "What's late?", kind: "task", where: "status != 'done' and due < today()", sort: "due", act: "finish" },
  { name: "finished", ask: "What did we finish?", kind: "task", where: "status == 'done'" },
  { name: "owners-only", ask: "What is unplanned?", kind: "task", where: "due == null", roles: ["owner"] },
];
const appOf = (purpose: unknown): GraviewApp<AnySchema> => {
  const compiled = compileDocument({ ...document, ...(purpose ? { purpose } : {}) } as never, { today: () => "2026-10-20" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled));
  return compiled.app as GraviewApp<AnySchema>;
};
const seed = {
  nodes: [
    ...Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, kind: "task", label: `Late chore ${i}`, status: "todo", due: `2026-10-0${i + 1}` })),
    // Late by the real clock, which the store keeps; one still to come long after it.
    { id: "soon", kind: "task", label: "Chore to come", status: "todo", due: "2036-11-01" },
  ],
  edges: [],
};
const HELPER: Principal = { kind: "human", id: "h", roles: ["helper"] };

beforeAll(() => fetchDeclaredLenses());

async function rendered(app: GraviewApp<AnySchema>, options: { withApp?: boolean } = {}) {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: structuredClone(seed) as never });
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal: HELPER, ...(options.withApp === false ? {} : { app }) }} initialPath="/" />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const all = (selector: string) => [...host.querySelectorAll<HTMLElement>(selector)];
  const done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, store, all, done };
}

describe("the home opens on the jobs", () => {
  it("leads with the first job that has records waiting: its question is the page's title, with how many and the first five in its order", async () => {
    const { host, all, done } = await rendered(appOf({ jobs }));
    expect(host.querySelector("[data-graview-page-title]")?.textContent).toBe("What's late?");
    const lead = host.querySelector('[data-testid="job"][data-leads]')!;
    expect(lead.getAttribute("data-job")).toBe("late");
    expect(lead.querySelector('[data-testid="job-count"]')?.textContent).toBe("7 tasks");
    expect([...lead.querySelectorAll('[data-testid="job-row"]')].map((row) => row.getAttribute("data-graview-record"))).toEqual(["t0", "t1", "t2", "t3", "t4"]);
    expect(lead.querySelector('[data-testid="job-more"]')?.textContent).toBe("2 more");
    // The rest is the kind's list: an address narrows a list by a field's value, not by a job's rule.
    expect(lead.querySelector('[data-testid="job-all"]')?.getAttribute("href")).toBe("/tasks");
    // One title on the page; the standing is a line after the jobs.
    expect(all("[data-graview-page-title]")).toHaveLength(1);
    expect(host.querySelector('[data-testid="standing"]')?.tagName).toBe("P");
    await done();
  });

  it("says a job with nothing waiting in one quiet line, and leaves out a job for roles the seat does not hold", async () => {
    const { all, done } = await rendered(appOf({ jobs }));
    expect(all('[data-testid="job-quiet"]').map((line) => line.textContent)).toEqual(["What did we finish? No tasks right now."]);
    expect(all('[data-testid="job"]').map((job) => job.getAttribute("data-job"))).toEqual(["late"]);
    await done();
  });

  it("offers the job's act on each record, the record page's act and form, and the record leaves the job once it is done", async () => {
    const { host, store, all, done } = await rendered(appOf({ jobs }));
    const press = all('[data-testid="job-act"]')[0]!;
    expect(press.textContent).toBe("Finish");
    expect(press.getAttribute("aria-label")).toBe("Finish: Late chore 0");
    await act(async () => press.click());
    const form = host.querySelector<HTMLFormElement>('[data-testid="form-finish"]')!;
    expect(form).not.toBeNull();
    await act(async () => form.requestSubmit());
    expect(store.graph.getNode("t0")).toMatchObject({ status: "done" });
    expect(host.querySelector('[data-testid="job-count"]')?.textContent).toBe("6 tasks");
    expect(all('[data-job="late"] [data-testid="job-row"]').map((row) => row.getAttribute("data-graview-record"))).toEqual(["t1", "t2", "t3", "t4", "t5"]);
    // …and answers the job that asks for it, which now has a record waiting and follows the lead, smaller.
    expect(all('[data-job="finished"] [data-testid="job-row"]').map((row) => row.getAttribute("data-graview-record"))).toEqual(["t0"]);
    expect(host.querySelector('[data-job="finished"] h2')?.textContent).toBe("What did we finish?");
    await done();
  });

  it("draws the gallery of places after the jobs, smaller", async () => {
    const { host, done } = await rendered(appOf({ jobs }));
    const jobsAt = host.querySelector('[data-testid="jobs"]')!;
    const gallery = host.querySelector('[data-testid="gallery"]')!;
    expect(gallery.hasAttribute("data-small")).toBe(true);
    expect(jobsAt.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await done();
  });

  it("keeps the home it had for an app with no jobs, and for a page not handed the app", async () => {
    for (const [app, withApp] of [[appOf(undefined), true], [appOf({ jobs }), false]] as const) {
      const { host, done } = await rendered(app, { withApp });
      expect(host.querySelector('[data-testid="jobs"]')).toBeNull();
      expect(host.querySelector("[data-graview-page-title]")?.getAttribute("data-testid")).toBe("standing");
      expect(host.querySelector('[data-testid="gallery"]')?.hasAttribute("data-small")).toBe(false);
      await done();
    }
  });

  it("says the standing as the title when no job has anything waiting, the jobs as quiet lines under it", async () => {
    const { host, all, done } = await rendered(appOf({ jobs: [jobs[1]] }));
    expect(host.querySelector("[data-graview-page-title]")?.getAttribute("data-testid")).toBe("standing");
    expect(all('[data-testid="job-quiet"]')).toHaveLength(1);
    await done();
  });
});
