import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arrange, listOpening, orderListGroups, withWorkedOut, arrangeable } from "../../src/arrange.js";
import { compileDocument, describeApp } from "../../src/check.js";
import { diffDocuments, editDocument } from "../../src/document/index.js";
import { Graph } from "../../src/index.js";

/**
 * A KIND'S LIST OPENS IN THE ORDER ITS DECLARATION SAYS (the Roadmap's ask,
 * prioritizing in a Graview app): features by a rank they work out, requests
 * grouped by status with done and declined closed at the bottom. Only a
 * blocks lens could sort and group; a kind's list mixed what was finished
 * with what was open. `pages.lists.<kind>.sort` and `.group` sit beside its
 * `filters`, checked by `graview check`, set by `arrange-pages`, and said.
 */
const roadmap = JSON.parse(readFileSync(new URL("../../../../scripts/fixtures/growing/roadmap.gdd.json", import.meta.url), "utf8"));
// The feature works out a rank: three a vote, less its stage's distance from shipping.
const ranked = {
  ...roadmap,
  kinds: { ...roadmap.kinds, feature: { ...roadmap.kinds.feature, computed: { rank: { expr: "count(in('became')) * 3", label: "Rank" } } } },
};
const lists = {
  request: { filters: ["status"], sort: "name", group: { by: "status", order: ["planned", "considering", "new"], closed: ["done", "declined"] } },
  feature: { sort: { by: "rank", direction: "desc" as const, then: "name" } },
};

function compiled(document: unknown) {
  return compileDocument(document, { today: () => "2026-10-14" });
}

describe("a kind's declared order and grouping, in a document", () => {
  it("is a document's key beside filters, and compiles into the app's pages", () => {
    const result = compiled({ ...ranked, pages: { lists } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.app.pages?.lists?.["request"]).toEqual(lists.request);
    expect(listOpening(result.app.pages?.lists?.["feature"])).toEqual({ sort: { by: "rank", direction: "desc", then: { by: "name", direction: "asc" } } });
    // describe_app's text says how the list opens, as it says how it may be arranged.
    const said = describeApp(result.app);
    expect(said).toContain('Its list opens sorted by "name", A to Z, grouped by "status", "planned", "considering" and "new" first, "done" and "declined" closed at the end.');
    expect(said).toContain('Its list opens sorted by "rank", highest first, then "name", A to Z.');
  });

  it("refuses a bad field or a closed value that is not a choice, each in a sentence at its path", () => {
    const bad = {
      request: { sort: { by: "ghost", then: "summary" }, group: { by: "summary", closed: ["done"] } },
      feature: { group: { by: "stage", order: ["someday"], closed: ["finished"] } },
    };
    const result = compiled({ ...ranked, pages: { lists: bad } });
    expect(result.ok).toBe(false);
    const found = result.findings.filter((finding) => finding.code === "check:pages-list-arrangement");
    expect(found.map((finding) => [finding.path, finding.message])).toEqual([
      ["pages.lists.request.sort.by", 'The request list cannot be sorted by "ghost": request has no field or computed field called that.'],
      ["pages.lists.request.group.by", 'The request list cannot be grouped by "summary": a list groups by a choice or a yes-or-no field, and summary is neither.'],
      ["pages.lists.feature.group.order.0", 'The feature list cannot put the "someday" group in order: "someday" is not one of stage\'s choices.'],
      ["pages.lists.feature.group.closed.0", 'The feature list cannot close the "finished" group: "finished" is not one of stage\'s choices.'],
    ]);
    expect(found.every((finding) => finding.severity === "error")).toBe(true);
    expect(found[3]?.fix).toBe('Name "idea", "planned", "building", "shipped".');
  });
});

describe("arrange-pages sets a list's order and grouping", () => {
  it("and says it in the edit and in the preview", () => {
    const changed = editDocument(ranked, [{ op: "arrange-pages", filters: { request: ["status"] }, sort: { feature: lists.feature.sort }, group: { request: lists.request.group } }]);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    // Each part of a list is its own: the filters stay beside the order and the grouping.
    expect(changed.document.pages?.lists).toEqual({ request: { filters: ["status"], group: lists.request.group }, feature: { sort: lists.feature.sort } });
    const said = changed.said.join(" ");
    expect(said).toContain('the list of features opens sorted by "rank", highest first, then "name", A to Z');
    expect(said).toContain('the list of requests opens grouped by "status", "planned", "considering" and "new" first, "done" and "declined" closed at the end');
    const preview = diffDocuments(ranked, changed.document).sentences;
    expect(preview).toContain('The feature list opens sorted by "rank", highest first, then "name", A to Z.');
    expect(preview).toContain('The request list opens grouped by "status", "planned", "considering" and "new" first, "done" and "declined" closed at the end.');

    // Null gives a list back its own order; the filters stay.
    const back = editDocument(changed.document, [{ op: "arrange-pages", group: { request: null }, sort: { feature: null } }]);
    expect(back.ok && back.document.pages?.lists).toEqual({ request: { filters: ["status"] } });
    expect(back.ok && back.said.join(" ")).toContain("the list of requests opens ungrouped again");
    expect(back.ok && diffDocuments(changed.document, back.document).sentences).toContain("The feature list opens in its own order again.");
  });

  it("refuses a field the kind does not have and a closed value that is not one of its choices", () => {
    const unknown = editDocument(ranked, [{ op: "arrange-pages", sort: { feature: "ghost" } }]);
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.findings[0]?.message).toContain('The feature list cannot be sorted by "ghost": feature has no field or computed field called that');
    const closed = editDocument(ranked, [{ op: "arrange-pages", group: { request: { by: "status", closed: ["finished"] } } }]);
    expect(closed.ok).toBe(false);
    if (closed.ok) return;
    expect(closed.findings[0]?.path).toBe("edits.0.group.request.closed.0");
    expect(closed.findings[0]?.message).toContain('cannot close the "finished" group: "finished" is not one of status\'s choices');
    const text = editDocument(ranked, [{ op: "arrange-pages", group: { request: "summary" } }]);
    expect(text.ok || text.findings[0]?.message).toContain("a list groups by a choice or a yes-or-no field, and summary is neither");
  });

  it("follows a field renamed, and lets go of one removed or a choice dropped, saying so", () => {
    const set = editDocument(ranked, [{ op: "arrange-pages", sort: { feature: lists.feature.sort }, group: { request: lists.request.group } }]);
    if (!set.ok) throw new Error("not set");
    const renamed = editDocument(set.document, [{ op: "rename-field", kind: "request", field: "status", to: "state" }]);
    expect(renamed.ok && renamed.document.pages?.lists?.["request"]?.group).toEqual({ ...lists.request.group, by: "state" });
    expect(renamed.ok && renamed.said.join(" ")).toContain("the request list's grouping");
    const dropped = editDocument(set.document, [{ op: "set-options", kind: "request", field: "status", remove: ["declined"] }]);
    expect(dropped.ok && dropped.document.pages?.lists?.["request"]?.group).toEqual({ by: "status", order: ["planned", "considering", "new"], closed: ["done"] });
    const gone = editDocument(set.document, [{ op: "set-computed", kind: "feature", name: "rank", expr: null }]);
    expect(gone.ok && gone.document.pages?.lists?.["feature"]).toBeUndefined();
    expect(gone.ok && gone.said.join(" ")).toContain("the feature list's order");
    // What is left still compiles: the list never names what the kind lost.
    for (const outcome of [renamed, dropped, gone]) expect(outcome.ok && compiled(outcome.document).ok).toBe(true);
  });
});

describe("arranging a kind's list as it was declared", () => {
  const result = compiled({ ...ranked, pages: { lists } });
  if (!result.ok) throw new Error("did not compile");
  const { app } = result;
  const graph = Graph.from(app.schema, {
    nodes: [
      { id: "f1", kind: "feature", name: "Offline drafts", stage: "building", area: "core" },
      { id: "f2", kind: "feature", name: "Boards", stage: "idea", area: "pages" },
      { id: "f3", kind: "feature", name: "Avatars", stage: "idea", area: "pages" },
      { id: "r1", kind: "request", name: "Work on a plane", status: "planned" },
      { id: "r2", kind: "request", name: "Share a board", status: "new" },
      { id: "r3", kind: "request", name: "Dark mode", status: "done" },
      { id: "r4", kind: "request", name: "A fax button", status: "declined" },
      { id: "r5", kind: "request", name: "Another board", status: "new" },
    ],
    edges: [
      { kind: "became", from: "r1", to: "f1" },
      { kind: "became", from: "r2", to: "f2" },
      { kind: "became", from: "r5", to: "f2" },
      { kind: "became", from: "r3", to: "f3" },
    ],
  } as never);
  const ranks: Record<string, number> = { f1: 3, f2: 6, f3: 3 };

  it("sorts by a computed rank, highest first, ties by the tiebreak", () => {
    const opening = listOpening(lists.feature)!;
    const offers = withWorkedOut(app.schema, arrangeable(app.schema, "feature"));
    expect(offers.sorts.find((offer) => offer.key === "rank")).toMatchObject({ label: "Rank", type: "number" });
    const arranged = arrange(graph.nodesOfKind("feature") as unknown as { id: string; kind: string }[], opening, { schema: app.schema, graph: graph as never, read: (node, key) => (key === "rank" ? ranks[node.id] : undefined) });
    expect(arranged.nodes.map((node) => node.id)).toEqual(["f2", "f3", "f1"]);
  });

  it("draws the open groups first in the declared order, the closed ones last and marked", () => {
    const opening = listOpening(lists.request)!;
    const arranged = arrange(graph.nodesOfKind("request") as unknown as { id: string; kind: string }[], { ...opening }, { schema: app.schema, graph: graph as never });
    const groups = orderListGroups(arranged.groups, lists.request.group, { type: "choice", options: ["new", "considering", "planned", "declined", "done"] });
    expect(groups.map((group) => [group.key, group.closed, group.nodes.map((node) => node.id)])).toEqual([
      ["planned", false, ["r1"]],
      ["new", false, ["r5", "r2"]],
      ["done", true, ["r3"]],
      ["declined", true, ["r4"]],
    ]);
  });
});
