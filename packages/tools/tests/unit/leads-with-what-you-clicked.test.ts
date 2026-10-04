import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances } from "../../src/derive.js";

/**
 * THE LIST LEADS WITH THE THING YOU PRESSED ON.
 *
 * One rule, one violation, six late tasks, six repairs — the rule lists
 * them in its own order and the interface used to show them in it, so
 * right-clicking the fourth task offered the FIRST task's repair at the
 * top. Every surface reads one rank from the derivation, and the rank now
 * knows which node the gesture landed on.
 */

const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean(), due: z.string() }),
  plural: "Tasks",
});
const schema = createSchema([task]);
const bound = bindSchema(schema);

const finish = bound.defineMutation("finish", {
  title: "Finish it",
  description: "Marks a task done.",
  subject: { kinds: ["task"], arg: "taskId" },
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: true });
  },
});

const reschedule = bound.defineMutation("reschedule", {
  title: "Give it a new date",
  description: "Moves a task's date.",
  subject: { kinds: ["task"], arg: "taskId" },
  input: z.object({ taskId: nodeRef(["task"]), due: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { due: args.due });
  },
});

const rename = bound.defineMutation("rename", {
  title: "Rename it",
  description: "Gives a task another name.",
  subject: { kinds: ["task"], arg: "taskId" },
  input: z.object({ taskId: nodeRef(["task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { label: args.label });
  },
});

/**
 * ONE violation naming EVERY late task — the shape that produced the bug.
 * A rule scoped per node would have hidden it, because each violation would
 * have implicated exactly the node you clicked.
 */
const overdue = bound.defineGraphInvariant("nothing-overdue", {
  description: "Nothing may sit past its date.",
  repairs: ["reschedule", "finish"],
  evaluate({ graph }) {
    const late = graph.allNodes().filter((node) => node.done === false && node.due < "2026-09-13");
    if (late.length === 0) return [];
    return [
      {
        invariant: "nothing-overdue",
        label: "Nothing overdue",
        message: `${late.length} tasks are past their date`,
        nodeIds: late.map((node) => node.id),
        repairs: late.flatMap((node) => [
          { mutation: "reschedule", args: { taskId: node.id }, missing: ["due"], label: `A new date for ${node.label}` },
          { mutation: "finish", args: { taskId: node.id }, label: `Finish ${node.label}` },
        ]),
      },
    ];
  },
});

const seeded = [
  ["t-a", "Book the hall"],
  ["t-b", "Pay the deposit"],
  ["t-c", "Send the list"],
] as const;

const store = (): Store<typeof schema> =>
  new Store({
    schema,
    mutations: [finish, reschedule, rename],
    invariants: [overdue],
    log: [
      {
        id: "op-0",
        seq: 0,
        batch: "b-0",
        author: { kind: "human", id: "seed" },
        intent: "seed",
        mutation: null,
        primitives: seeded.map(([id, label]) => ({
          op: "add-node" as const,
          node: { id, kind: "task", label, done: false, due: "2026-09-01" },
        })),
        inverse: seeded.map(([id, label]) => ({
          op: "remove-node" as const,
          node: { id, kind: "task", label, done: false, due: "2026-09-01" },
        })),
        reads: [],
        writes: seeded.map(([id]) => id),
        at: "2026-01-01T00:00:00Z",
      },
    ],
  });

const labels = (set: { affordances: readonly { label: string }[] }) => set.affordances.map((a) => a.label);

describe("the list leads with the thing you clicked", () => {
  it("puts the clicked task's repair first, ahead of another task's", () => {
    const first = deriveAffordances(store(), ["t-b"], { focus: "t-b" });
    expect(labels(first)[0]).toBe("A new date for Pay the deposit");
    // The same selection, a different press: a different first entry.
    const second = deriveAffordances(store(), ["t-c"], { focus: "t-c" });
    expect(labels(second)[0]).toBe("A new date for Send the list");
    // And every repair for the clicked task comes before any other task's.
    const mine = labels(first).filter((label) => label.includes("Pay the deposit"));
    const theirs = labels(first).filter((label) => label.includes("Book the hall"));
    expect(labels(first).indexOf(mine.at(-1)!)).toBeLessThan(labels(first).indexOf(theirs[0]!));
  });

  it("keeps the rule's own order among the clicked thing's repairs", () => {
    // The rule names a new date before finishing; that is a judgement.
    const derived = labels(deriveAffordances(store(), ["t-b"], { focus: "t-b" }));
    expect(derived.indexOf("A new date for Pay the deposit")).toBeLessThan(
      derived.indexOf("Finish Pay the deposit"),
    );
  });

  it("puts the clicked thing's own acts after its repairs and before other repairs", () => {
    const derived = deriveAffordances(store(), ["t-b"], { focus: "t-b" });
    const at = (label: string) => labels(derived).findIndex((entry) => entry === label);
    const ownRepair = at("Finish Pay the deposit");
    const otherRepair = at("A new date for Book the hall");
    const ownAct = labels(derived).findIndex((entry) => entry.startsWith("Rename"));
    expect(ownRepair).toBeGreaterThanOrEqual(0);
    expect(ownAct).toBeGreaterThan(ownRepair);
    expect(ownAct).toBeLessThan(otherRepair);
  });

  it("with no focus, ranks exactly as it did before there was one", () => {
    const focused = labels(deriveAffordances(store(), ["t-b"], { focus: "t-b" }));
    const plain = labels(deriveAffordances(store(), ["t-b"]));
    expect(plain).not.toEqual(focused);
    // Repairs still lead, in the rule's order — the old band, undisturbed.
    expect(plain[0]).toBe("A new date for Book the hall");
  });

  it("stamps one rank every surface can read, with the withheld continuing it", () => {
    const derived = deriveAffordances(store(), ["t-b"], { focus: "t-b" });
    expect(derived.affordances.map((a) => a.rank)).toEqual(derived.affordances.map((_, at) => at));
    for (const [at, held] of derived.withheld.entries()) {
      expect(held.rank).toBe(derived.affordances.length + at);
    }
  });
});
