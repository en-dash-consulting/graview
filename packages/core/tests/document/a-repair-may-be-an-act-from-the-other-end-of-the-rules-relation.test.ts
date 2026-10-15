import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import type { GraviewDocument } from "../../src/document/index.js";

/**
 * A rule over findings requires that a serious one has an initiative
 * resolving it. The natural repair is `resolve-finding`: an act on the
 * initiative, which a finding's own page already offers as "Name the work
 * that fixes it" because it says `fromTheOtherEnd`. `repair-wrong-kind`
 * refused it, since the act's subject is an initiative and the rule judges
 * a finding. An act that ties the judged record to its own subject and
 * reads from the far end is the repair, handed the finding as that end.
 */
const review = (act: Record<string, unknown>): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Review",
    kinds: {
      finding: { noun: "finding", plural: "findings", label: "{title}", fields: { title: { type: "string", required: true }, serious: { type: "boolean" } } },
      initiative: {
        noun: "initiative",
        plural: "initiatives",
        label: "{name}",
        fields: { name: { type: "string", required: true } },
        edges: { resolves: { to: ["finding"], description: "resolves", inverse: "is resolved by" } },
      },
    },
    acts: {
      "add-finding": { title: "Add a finding", creates: "finding" },
      "add-initiative": { title: "Add an initiative", creates: "initiative" },
      "resolve-finding": { title: "Resolve a finding", on: "initiative", connects: "resolves", ...act },
      "stop-resolving": { title: "Stop resolving it", on: "initiative", severs: "resolves", fromTheOtherEnd: "Take this work off it" },
    },
    rules: {
      "serious-findings-have-work": {
        title: "A serious finding has work that fixes it",
        over: "finding",
        when: "serious",
        require: "exists(in('resolves'))",
        repairs: [{ act: "resolve-finding" }],
      },
    },
  }) as unknown as GraviewDocument;

describe("a repair may be an act from the other end of the rule's relation", () => {
  it("passes graview check when the act ties the judged kind to its subject and says fromTheOtherEnd", () => {
    const compiled = compileDocument(review({ fromTheOtherEnd: "Name the work that fixes it" }));
    expect(compiled.findings.filter((f) => f.code === "check:repair-wrong-kind")).toEqual([]);
    expect(compiled.ok).toBe(true);
  });

  it("still refuses the act when it has no reading from the far end, and says how to give it one", () => {
    const compiled = compileDocument(review({}));
    const finding = compiled.findings.find((f) => f.code === "check:repair-wrong-kind");
    expect(finding?.fix).toContain("fromTheOtherEnd");
  });

  it("hands the act the judged finding as its far end and leaves the initiative to be chosen, and the repair repairs", () => {
    const compiled = compileDocument(review({ fromTheOtherEnd: "Name the work that fixes it" }));
    if (!compiled.ok) throw new Error("the document does not compile");
    const app = compiled.app as GraviewApp<AnySchema>;
    const store = new Store<AnySchema>({
      schema: app.schema,
      mutations: app.mutations ?? [],
      invariants: app.invariants ?? [],
      snapshot: {
        nodes: [
          { id: "f1", kind: "finding", title: "Backups are untested", serious: true },
          { id: "i1", kind: "initiative", name: "Restore drill" },
        ],
        edges: [],
      } as never,
    });
    const violation = store.violations().find((v) => v.invariant === "serious-findings-have-work")!;
    const repair = violation.repairs[0]!;
    expect(repair).toMatchObject({ mutation: "resolve-finding", label: "Name the work that fixes it", args: { to: "f1" }, missing: ["id"] });
    store.apply({ name: "resolve-finding", args: { ...repair.args, id: "i1" } });
    expect(store.violations().filter((v) => v.invariant === "serious-findings-have-work")).toEqual([]);
    expect(store.graph.snapshot().edges).toContainEqual(expect.objectContaining({ kind: "resolves", from: "i1", to: "f1" }));
  });
});
