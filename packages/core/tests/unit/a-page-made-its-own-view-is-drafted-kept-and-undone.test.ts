import { describe, expect, it } from "vitest";
import { memoryViews, withMemoryRevisions, type ViewForkKept } from "../../src/index.js";
import { checkViewForkHost } from "../../src/conformance/index.js";

/**
 * A BUILT-IN PAGE MADE ITS OWN VIEW (Roadmap f-make-any-page-better): the
 * host's views show the draft on this page only, keep it as the page's view
 * on Keep, and one Undo takes it away — refused to a seat that may not
 * change views, and not offered by a host that lends no fork.
 */
const fork: ViewForkKept = {
  manifest: { name: "task-list", title: "Tasks", attach: "task", cardinality: "many", replaces: "page" },
  source: "graview.onProps(() => graview.render(graview.html`<h1>Tasks</h1>`));",
  from: { page: "list", kind: "task" },
  said: "Made the tasks a view of their own.",
};

describe("a page made its own view, in memory", () => {
  it("passes the fork host's conformance check", async () => {
    const report = await checkViewForkHost(withMemoryRevisions(memoryViews()), fork);
    expect(report.said).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("is said when it changes, so the page draws it", () => {
    const views = withMemoryRevisions(memoryViews());
    let heard = 0;
    views.onChange?.(() => (heard += 1));
    views.draftFork!(fork);
    expect(views.forked!()).toEqual([{ ...fork, draft: true }]);
    void views.fork!(fork);
    expect(views.forked!()).toEqual([fork]);
    expect(heard).toBe(2);
  });

  it("is refused to a seat that may not change views, and not offered by a host that lends no fork", async () => {
    const viewer = withMemoryRevisions(memoryViews({ may: { views: false, lenses: false } }));
    expect(() => viewer.draftFork!(fork)).toThrow(/may change this app's views/);
    expect((await checkViewForkHost(viewer, fork)).claims.offersForking).toBe(false);
    expect((await checkViewForkHost(memoryViews(), fork)).said[0]).toContain("lend no fork");
  });
});
