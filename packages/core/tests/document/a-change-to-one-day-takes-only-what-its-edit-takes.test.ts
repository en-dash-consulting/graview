import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { refusalOf, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A CHANGE TO ONE DAY TAKES ONLY WHAT ITS EDIT TAKES.
 *
 * "Change just this one" and "Change from here" ride the kind's edit, and
 * took every field of the kind beside the day: a member who may only rename
 * a chore approved it — a status only a manager's act sets, which the
 * chore's own edit refuses ("status is set by approve-chore") — by changing
 * it from the series' first day, and made chores, which only a manager may,
 * by changing one day alone. Now they take what the edit takes, refuse the
 * rest by the act that sets it, and make a record only for a seat that may
 * make one.
 */
const doc = {
  format: "graview-document",
  formatVersion: 1,
  name: "Chores",
  kinds: {
    chore: {
      label: "{title}",
      fields: {
        title: { type: "string", required: true },
        status: { type: "enum", options: ["pending", "approved"] },
        note: { type: "string" },
        due: { type: "date", required: true, repeats: true },
      },
    },
  },
  roles: ["member", "manager"],
  acts: {
    "add-chore": { title: "Add a chore", creates: "chore" },
    "rename-chore": { title: "Rename", on: "chore", sets: { title: "$title" } },
    "approve-chore": { title: "Approve", on: "chore", sets: { status: "approved" } },
  },
  policy: {
    grants: [
      { roles: ["member"], mutations: ["rename-chore"] },
      { roles: ["manager"], mutations: ["add-chore", "approve-chore"] },
    ],
  },
};
const member = { kind: "human" as const, id: "mia", roles: ["member"] };
const manager = { kind: "human" as const, id: "max", roles: ["manager"] };
// 2026-10-20 is a Tuesday: the bins every week from then.
const SERIES = { id: "weekly", kind: "chore", title: "Bins", status: "pending", due: "2026-10-20", dueRepeat: { every: "week" } };
const make = () => {
  const compiled = compileDocument(doc as never, { today: () => "2026-10-21" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], policy: app.policy, snapshot: { nodes: [SERIES], edges: [] } as never });
};
const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return refusalOf(error);
  }
  throw new Error("not refused");
};
const chores = (store: Store<AnySchema>) => store.graph.allNodes().filter((node) => node.kind === "chore");

describe("a change to one day of a series", () => {
  it("refuses a field another act sets, by that act's name, as the edit does", () => {
    const store = make();
    expect(refusal(() => store.apply({ name: "edit-chore", args: { id: "weekly", status: "approved" } }, { author: member }))).toMatchObject({ reason: "invalid", sentence: expect.stringContaining("status is set by approve-chore") });
    for (const call of [
      { name: "split-chore", args: { id: "weekly", on: "2026-10-20", status: "approved" } },
      { name: "detach-chore", args: { id: "weekly", on: "2026-10-27", status: "approved" } },
    ]) {
      expect(refusal(() => store.apply(call, { author: manager }))).toMatchObject({ reason: "invalid", sentence: expect.stringContaining("status is set by approve-chore") });
    }
    expect(store.graph.getNode("weekly")).toMatchObject({ status: "pending" });
    expect(chores(store)).toHaveLength(1);
  });

  it("changes what the edit takes from the series' first day, for a seat that may edit it", () => {
    const store = make();
    store.apply({ name: "split-chore", args: { id: "weekly", on: "2026-10-20", note: "Recycling too" } }, { author: member });
    expect(store.graph.getNode("weekly")).toMatchObject({ note: "Recycling too", status: "pending" });
    expect(chores(store)).toHaveLength(1);
    store.apply({ name: "skip-chore", args: { id: "weekly", on: "2026-10-27" } }, { author: member });
  });

  it("makes a record only for a seat that may make one", () => {
    const store = make();
    const detach = { name: "detach-chore", args: { id: "weekly", on: "2026-10-27", note: "Extra" } };
    const later = { name: "split-chore", args: { id: "weekly", on: "2026-11-03", note: "From November" } };
    for (const call of [detach, later]) {
      expect(store.permits(call, member).ok).toBe(false);
      expect(refusal(() => store.apply(call, { author: member }))).toMatchObject({ reason: "forbidden", sentence: expect.stringContaining("a manager can") });
    }
    expect(chores(store)).toHaveLength(1);
    store.apply(detach, { author: manager });
    store.apply(later, { author: manager });
    expect(chores(store)).toHaveLength(3);
  });
});
