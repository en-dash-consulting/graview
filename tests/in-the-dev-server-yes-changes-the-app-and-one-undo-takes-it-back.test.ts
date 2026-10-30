import type { AnySchema, GraviewApp, Principal, Store } from "@graview/core";
import { planEdits } from "@graview/core/catalog";
import { checkPlanHost } from "@graview/core/conformance";
import { documentOf } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { todoApp } from "../apps/todo/src/domain/app.js";
import { createTodoUiStore } from "../apps/todo/src/ui/app.js";
import { devAppChanges, type DevApp } from "../apps/todo/src/dev-change.js";

/**
 * IN THE DEV SERVER, YES CHANGES THE APP AND ONE UNDO TAKES IT BACK (Roadmap
 * f-menu-type-anything). `pnpm dev`'s host for the todo example lends the
 * quick ask's plan its composer and lands the plan on the running code app:
 * the least change the ask needs laid over the app it is — every act it had
 * kept — the plan's records applied as one change in a store over the same
 * records, app and store swapped in place; one undo puts both back. Nothing
 * is written to the checkout. And it passes the same check Graview Cloud runs
 * against its own host (`checkPlanHost`, `@graview/core/conformance`).
 */
const nora: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const start = (): { shown: () => DevApp; host: ReturnType<typeof devAppChanges>; store: Store<AnySchema> } => {
  const store = createTodoUiStore("2026-09-01") as unknown as Store<AnySchema>;
  let shown: DevApp = { app: todoApp as unknown as GraviewApp<AnySchema>, store };
  const host = devAppChanges(shown, (next) => (shown = next), { principal: nora });
  return { shown: () => shown, host, store };
};

describe("the dev server's host for a plan", () => {
  it("inTheDevServerYesChangesTheAppAndOneUndoTakesItBack: lands the least change over the code app with its records as one change, and one undo puts the app and the records back", async () => {
    const { shown, host, store } = start();
    const document = documentOf(todoApp)!;
    const planned = planEdits(document, { link: { on: "task", called: "assigned to", to: "person" } });
    if ("refused" in planned) throw new Error(planned.refused);
    // The app's people are its users: the link points to them, and nothing new is made.
    expect(planned.to).toBe("user");
    expect(planned.made).toBe(false);
    const tasks = store.graph.allNodes().filter((node) => node.kind === "task").slice(0, 2).map((node) => node.id);
    const composed = host.composeChange({ document, edits: planned.edits });
    expect(composed.ok).toBe(true);
    // Every act the code app had is kept, beside the one the change brings.
    expect(((composed as { app: GraviewApp<AnySchema> }).app.mutations ?? []).map((one) => one.name)).toEqual(expect.arrayContaining([...(todoApp.mutations ?? []).map((one) => one.name), planned.act]));

    const answered = await host.onProposeChange({ said: "assign these to sam", add: [], drop: [], card: { said: "", adds: [], keeps: [], drops: [], breaking: [] }, edits: planned.edits, records: tasks.map((id) => ({ name: planned.act, args: { id, to: "user-sam" } })), via: "ai:fake" });
    expect(answered).toMatchObject({ applied: true, note: "Kept until this page reloads: the app's code is not changed." });
    expect(shown().app).not.toBe(todoApp);
    for (const id of tasks) expect(shown().store.graph.out(id, planned.relation!).map((node) => node.id)).toEqual(["user-sam"]);
    const ops = shown().store.log.all();
    expect(new Set(ops.map((op) => op.batch)).size).toBe(1);
    expect(ops.every((op) => op.via === "ai:fake")).toBe(true);

    await (answered as { undo: () => void }).undo();
    expect(shown().app).toBe(todoApp);
    expect(shown().store).toBe(store);
  });

  it("theDevHostPassesTheHostConformanceCloudRuns", async () => {
    const { host, store } = start();
    const tasks = store.graph.allNodes().filter((node) => node.kind === "task").slice(0, 3).map((node) => node.id);
    const report = await checkPlanHost({ composeChange: host.composeChange, onProposeChange: host.onProposeChange as never, store: () => host.current().store }, { document: documentOf(todoApp)!, kind: "task", members: tasks, principal: nora });
    expect(report.said).toEqual([]);
    expect(report).toMatchObject({ ok: true, claims: { composes: true, appliedAsOneChange: true, saidAsTheAi: true, linksEveryRecord: true, undoTakesItAllBack: true } });
  });
});
