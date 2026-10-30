import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { composeAppChange } from "../../src/compose.js";
import { checkPlanHost, type PlanHost } from "../../src/conformance/index.js";
import { compileDocumentWithoutCheck, type GraviewDocument } from "../../src/document/index.js";

/**
 * A HOST THAT LANDS A PLAN, CHECKED AS GRAVIEW CHECKS ITS OWN (Roadmap
 * f-menu-type-anything): `checkPlanHost` runs the assign-to-a-person plan
 * against a host's `composeChange` and `onProposeChange` — composed, landed
 * as one change said as the AI's, every record linked, one undo taking it
 * all back — and names what failed. A host that lands it passes; one that
 * forgets the way back, or splits the records, is told which.
 */
const tasks = JSON.parse(readFileSync(new URL("../document/fixtures/tasks.gdd.json", import.meta.url), "utf8"));
const lean: GraviewDocument = { ...tasks, kinds: { task: { ...tasks.kinds.task, edges: {} } }, acts: { "add-task": tasks.acts["add-task"], "set-status": tasks.acts["set-status"] }, policy: { grants: [{ roles: ["owner"], mutations: "*" }], sees: [{ roles: ["owner"], kinds: ["task"] }] } };
const SEED = { nodes: [{ id: "t1", kind: "task", label: "Write the brief", status: "todo" }, { id: "t2", kind: "task", label: "Book the hall", status: "doing" }], edges: [] };
const storeOf = (app: GraviewApp<AnySchema>, snapshot: unknown) => new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: snapshot as never } as never);
const owner = { kind: "human" as const, id: "p1", roles: ["owner"] };

/** A host as Cloud's would be: the app as a document, a change composed and checked, the store made again over the records. */
function aHost(options: { readonly undo?: boolean; readonly split?: boolean } = {}): PlanHost {
  const compiled = compileDocumentWithoutCheck(lean);
  if (!compiled.ok) throw new Error("the lean tasks did not compile");
  let current = { document: lean, app: compiled.app as GraviewApp<AnySchema>, store: storeOf(compiled.app as GraviewApp<AnySchema>, SEED) };
  return {
    composeChange: (change) => composeAppChange(change as never),
    onProposeChange: (proposal) => {
      const before = current;
      const composed = composeAppChange({ document: before.document, edits: proposal.edits });
      if (!composed.ok) return "declined";
      const store = storeOf(composed.app, before.store.graph.snapshot());
      store.applyAll(proposal.records, { author: owner, via: proposal.via as never });
      // A host that lands something more beside it, as a change of its own.
      if (options.split) store.applyAll([{ name: "set-status", args: { id: "t1", status: "done" } }], { author: owner, via: proposal.via as never });
      current = { document: composed.document, app: composed.app, store };
      return options.undo === false ? "applied" : { applied: true, undo: () => void (current = before) };
    },
    store: () => current.store,
  };
}

describe("a host that lands a plan", () => {
  it("passes the check where it lands the plan as one change with its one way back", async () => {
    const report = await checkPlanHost(aHost(), { document: lean, kind: "task", members: ["t1", "t2"], principal: owner });
    expect(report).toEqual({ ok: true, claims: { composes: true, appliedAsOneChange: true, saidAsTheAi: true, linksEveryRecord: true, undoTakesItAllBack: true }, said: [] });
  });

  it("is told it answered no way back", async () => {
    const report = await checkPlanHost(aHost({ undo: false }), { document: lean, kind: "task", members: ["t1", "t2"] });
    expect(report.ok).toBe(false);
    expect(report.said).toEqual(["onProposeChange answered no way back ({ applied: true, undo })."]);
  });

  it("is told it landed the records as more than one change", async () => {
    const report = await checkPlanHost(aHost({ split: true }), { document: lean, kind: "task", members: ["t1", "t2"] });
    expect(report.claims.appliedAsOneChange).toBe(false);
    expect(report.said).toContain("The records landed as more than one change.");
  });
});
