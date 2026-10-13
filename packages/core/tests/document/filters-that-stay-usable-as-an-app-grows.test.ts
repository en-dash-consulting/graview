import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { admitArrangement, arrangeable, conditionHolds, throughEdges } from "../../src/arrange.js";
import { compileDocument } from "../../src/check.js";
import { diffDocuments, editDocument } from "../../src/document/index.js";
import { Graph } from "../../src/index.js";

/**
 * FILTERS THAT STAY USABLE AS AN APP GROWS (the Roadmap's f-filters-that-scale).
 *
 * On the Roadmap's Requests, "Filter" listed every feature a request could
 * have become — ninety names in one menu. A list reaches through a relation
 * to what is at its far end instead ("became a feature that is: building",
 * `became.stage:building`), and a declaration names what a kind's list
 * offers with `pages.lists.<kind>.filters`, which `graview check` holds to
 * what the kind can be filtered by.
 */
const roadmap = JSON.parse(readFileSync(new URL("../../../../scripts/fixtures/growing/roadmap.gdd.json", import.meta.url), "utf8"));

function compiled(document: unknown = roadmap) {
  const result = compileDocument(document, { today: () => "2026-10-12" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((finding) => finding.severity === "error")));
  return result;
}

describe("a list's filters through a relation", () => {
  const { app } = compiled();
  const offers = throughEdges(app.schema, arrangeable(app.schema, "request"));

  it("offer each choice field of the far end's kind, keyed <edge>.<field>, before `is`", () => {
    const via = offers.filters.filter((offer) => offer.about === "via");
    expect(via.map((offer) => offer.key)).toEqual(["became.stage", "became.area"]);
    expect(via[0]).toMatchObject({ label: "The feature it became · Stage", type: "choice", options: ["idea", "planned", "building", "shipped"], far: ["feature"] });
    expect(offers.filters.at(-1)?.key).toBe("is");
    // A lens arranges by its kind's own: the declaration's offers alone say nothing through an edge.
    expect(arrangeable(app.schema, "request").filters.some((offer) => offer.about === "via")).toBe(false);
  });

  it("keep a record whose far end holds the value, and a link that asks for one is admitted", () => {
    const graph = Graph.from(app.schema, {
      nodes: [
        { id: "f1", kind: "feature", name: "Offline drafts", stage: "building", area: "core" },
        { id: "f2", kind: "feature", name: "Shared boards", stage: "idea", area: "pages" },
        { id: "r1", kind: "request", name: "Work on a plane", status: "planned" },
        { id: "r2", kind: "request", name: "Share a board", status: "new" },
        { id: "r3", kind: "request", name: "Dark mode", status: "new" },
      ],
      edges: [
        { kind: "became", from: "r1", to: "f1" },
        { kind: "became", from: "r2", to: "f2" },
      ],
    } as never);
    const ctx = { schema: app.schema, graph: graph as never };
    const building = { key: "became.stage", value: "building" };
    expect(["r1", "r2", "r3"].filter((id) => conditionHolds(ctx, graph.getNode(id)! as never, building))).toEqual(["r1"]);
    expect(admitArrangement({ filter: [building] }, offers).arrangement.filter).toEqual([building]);
  });
});

describe("pages.lists.<kind>.filters", () => {
  it("is a document's key, and graview check names a filter the kind cannot be filtered by", () => {
    const result = compiled({ ...roadmap, pages: { lists: { request: { filters: ["status", "became", "became.stage", "votes", "ghost"] }, nobody: { filters: ["status"] } } } });
    expect(result.app.pages?.lists?.["request"]?.filters).toEqual(["status", "became", "became.stage", "votes", "ghost"]);
    const unknown = result.findings.filter((finding) => finding.code === "check:pages-filter-unknown");
    expect(unknown.map((finding) => finding.path)).toEqual(["pages.lists.request.filters.4"]);
    expect(unknown[0]?.message).toContain('cannot be filtered by "ghost"');
    expect(result.findings.some((finding) => finding.code === "check:pages-kind-unknown" && finding.path === "pages.lists.nobody")).toBe(true);
  });

  it("is set by arrange-pages, which refuses a filter the kind does not have, and says what it did", () => {
    const changed = editDocument(roadmap, [{ op: "arrange-pages", filters: { request: ["status", "became.stage"] } }]);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.document.pages).toEqual({ lists: { request: { filters: ["status", "became.stage"] } } });
    expect(changed.said.join(" ")).toContain('list of requests filters by "status" and "became.stage"');
    expect(diffDocuments(roadmap, changed.document).sentences).toContain("The request list filters by status, became.stage.");
    const refused = editDocument(roadmap, [{ op: "arrange-pages", filters: { request: ["ghost"] } }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings[0]?.message).toContain('request cannot be filtered by "ghost"');
    // Null gives the kind back the filters the framework works out.
    const back = editDocument(changed.document, [{ op: "arrange-pages", filters: { request: null } }]);
    expect(back.ok && back.document.pages).toBeUndefined();
  });
});
