import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { composeAppChange as composeChecked } from "../../src/compose.js";
import { composeAppChange } from "../../src/composer.js";
import { checkPlanHost, type PlanHost } from "../../src/conformance/index.js";
import { planEdits } from "../../src/plan-edits.js";
import { compileDocumentWithoutCheck, type GraviewDocument } from "../../src/document/index.js";

/**
 * A PAGE COMPOSES A CHANGE WITH THE COMPILE IT ALREADY HAS (Roadmap
 * f-light-composer). `@graview/core/composer` is the `composeChange` an
 * owner's or an editor's page fetches: the plan's edits applied, what they
 * add granted, and the changed document compiled the way the page compiles
 * its own, the checker left to the host that keeps the change. It composes
 * what `@graview/core/compose` composes, lands a plan as one change, and
 * the app it makes is rehearsed by the page's own store.
 */
const tasks = JSON.parse(readFileSync(new URL("../document/fixtures/tasks.gdd.json", import.meta.url), "utf8"));
const lean: GraviewDocument = { ...tasks, kinds: { task: { ...tasks.kinds.task, edges: {} } }, acts: { "add-task": tasks.acts["add-task"], "set-status": tasks.acts["set-status"] }, policy: { grants: [{ roles: ["owner"], mutations: ["add-task", "set-status"] }], sees: [{ roles: ["owner"], kinds: ["task"] }] } };
const SEED = { nodes: [{ id: "t1", kind: "task", label: "Write the brief", status: "todo" }, { id: "t2", kind: "task", label: "Book the hall", status: "doing" }], edges: [] };
const storeOf = (app: GraviewApp<AnySchema>, snapshot: unknown) => new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: snapshot as never } as never);
const owner = { kind: "human" as const, id: "p1", roles: ["owner"] };

/** The edits a plan names to give the tasks somebody to do them: a person kind and a link. */
function assigning() {
  const planned = planEdits(lean, { link: { on: "task", called: "assigned to", to: "person" } });
  if ("refused" in planned) throw new Error(planned.refused);
  return planned;
}

describe("the composer a page fetches", () => {
  it("composes the document the checked composer composes, and says the same steps", () => {
    const { edits } = assigning();
    const light = composeAppChange({ document: lean, edits });
    const checked = composeChecked({ document: lean, edits });
    expect(light.ok && checked.ok).toBe(true);
    if (!light.ok || !checked.ok) return;
    expect(light.document).toEqual(checked.document);
    expect(light.said).toEqual(checked.said);
    // What it adds is granted as the widest grant is, so the new acts are reachable.
    expect(light.said.some((line) => line.startsWith("Who may run what it adds"))).toBe(true);
  });

  it("makes an app the page's own store rehearses the plan's records in", () => {
    const planned = assigning();
    const light = composeAppChange({ document: lean, edits: planned.edits });
    if (!light.ok) throw new Error(light.refused);
    const scratch = storeOf(light.app, SEED);
    const made = planned.makes ?? "add-person";
    expect(() => scratch.previewAll([{ name: made, args: { name: "Sam" }, mintedHint: "person-sam" } as never, { name: planned.act, args: { id: "t1", [planned.arg]: "person-sam" } }], { author: owner })).not.toThrow();
  });

  it("refuses an edit the document cannot take, in words", () => {
    const refused = composeAppChange({ document: lean, edits: [{ op: "remove-kind", kind: "nothing-here" }] });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.refused).toMatch(/^It could not be written: /);
  });

  it("leaves a reshape's traits to the host, said in words", () => {
    const refused = composeAppChange({ document: lean, add: ["people"] });
    expect(refused).toEqual({ ok: false, refused: "Only a change written as edits can be composed here; a reshape is composed by the host." });
  });

  it("lands a plan as one change with its one way back, as a host checks it", async () => {
    const compiled = compileDocumentWithoutCheck(lean);
    if (!compiled.ok) throw new Error("the lean tasks did not compile");
    let current = { document: lean, store: storeOf(compiled.app as GraviewApp<AnySchema>, SEED) };
    const host: PlanHost = {
      composeChange: (change) => composeAppChange(change as never),
      onProposeChange: (proposal) => {
        const before = current;
        // The host keeps the change with the checker, as Cloud does.
        const kept = composeChecked({ document: before.document, edits: proposal.edits });
        if (!kept.ok) return "declined";
        const store = storeOf(kept.app, before.store.graph.snapshot());
        store.applyAll(proposal.records, { author: owner, via: proposal.via as never });
        current = { document: kept.document, store };
        return { applied: true, undo: () => void (current = before) };
      },
      store: () => current.store,
    };
    const report = await checkPlanHost(host, { document: lean, kind: "task", members: ["t1", "t2"], principal: owner });
    expect(report).toEqual({ ok: true, claims: { composes: true, appliedAsOneChange: true, saidAsTheAi: true, linksEveryRecord: true, undoTakesItAllBack: true }, said: [] });
  });
});
