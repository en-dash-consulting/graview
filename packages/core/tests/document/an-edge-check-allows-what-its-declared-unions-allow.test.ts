import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import type { GraviewDocument } from "../../src/document/index.js";
import { nodeRefArgs, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * AN EDGE CHECK ALLOWS WHAT ITS DECLARED UNIONS ALLOW, AND NEVER
 * CONTRADICTS ITSELF. On an app whose `about` relation reads
 * `brief|request -> feature|area`, the act `about-area` with a request and
 * a feature was refused with "Edge "about" is not declared from request to
 * feature — Declared: brief|request -> feature|area": the sentence named a
 * union that allows the pair it refused.
 */
const roadmap = (requestTo: readonly string[]): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Roadmap",
    kinds: {
      brief: { fields: { title: { type: "string", required: true } }, edges: { about: { to: ["feature", "area"] } } },
      request: { fields: { title: { type: "string", required: true } }, edges: { about: { to: requestTo } } },
      feature: { fields: { title: { type: "string", required: true } } },
      area: { fields: { title: { type: "string", required: true } } },
    },
    acts: {
      "about-area": { title: "Say what it is about", on: ["brief", "request"], effects: [{ connect: "about", from: "$subject", to: "$area" }] },
    },
  }) as unknown as GraviewDocument;

const seed = {
  nodes: [
    { id: "brief:one", kind: "brief", title: "Q4 brief" },
    { id: "request:one", kind: "request", title: "Dark mode, please" },
    { id: "feature:dark", kind: "feature", title: "Dark mode" },
    { id: "area:ui", kind: "area", title: "Interface" },
  ],
  edges: [],
};

function storeOf(doc: GraviewDocument): Store<AnySchema> {
  const compiled = compileDocument(doc, { today: () => "2026-11-01" });
  if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: structuredClone(seed) as never });
}
const refusalOf = (run: () => unknown): string | undefined => {
  try {
    run();
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
};

describe("an edge check", () => {
  it("allows a request about a feature when both kinds declare the relation to features and areas", () => {
    const store = storeOf(roadmap(["feature", "area"]));
    store.apply({ name: "about-area", args: { id: "request:one", area: "feature:dark" } });
    store.apply({ name: "about-area", args: { id: "brief:one", area: "area:ui" } });
    expect(store.graph.allEdges().map((edge) => `${edge.from}->${edge.to}`).sort()).toEqual(["brief:one->area:ui", "request:one->feature:dark"]);
  });

  it("refuses a request about a feature when only briefs may be, in a sentence that says what a request may be about", () => {
    const store = storeOf(roadmap(["area"]));
    const said = refusalOf(() => store.apply({ name: "about-area", args: { id: "request:one", area: "feature:dark" } }));
    expect(said).toBeDefined();
    expect(said).not.toContain("brief|request -> feature|area");
    expect(said).toBe('Edge "about" is not declared from request to feature\n  Declared: request -> area; brief -> feature|area');
    store.apply({ name: "about-area", args: { id: "brief:one", area: "feature:dark" } });
  });

  it("asks an act on requests alone for what a request may be about, so its form offers no feature", () => {
    const doc = roadmap(["area"]) as unknown as { acts: Record<string, { on: unknown }> };
    doc.acts["about-area"]!.on = "request";
    const store = storeOf(doc as unknown as GraviewDocument);
    const act = store.allMutations().find((one) => one.name === "about-area")!;
    expect(nodeRefArgs(act.input).find((ref) => ref.name === "area")?.kinds).toEqual(["area"]);
    store.apply({ name: "about-area", args: { id: "request:one", area: "area:ui" } });
    expect(store.graph.allEdges().map((edge) => `${edge.from}->${edge.to}`)).toEqual(["request:one->area:ui"]);
  });
});
