import {
  bindSchema,
  isEffectiveOn,
  labelOf,
  type GraphReader,
  type InvariantDefinition,
  type Repair,
  type Violation,
} from "@graview/core";
import { todoSchema, type TodoSchema } from "./schema.js";

const { defineInvariant } = bindSchema(todoSchema);
type AnyNode = { id: string; kind: string } & Record<string, unknown>;
type Reader = GraphReader<AnyNode>;
type I = InvariantDefinition<TodoSchema>;

const name = (node: AnyNode | undefined): string =>
  node ? labelOf(todoSchema.tryDefinition(node.kind), node as never) : "something";
const nodesOf = (graph: Reader, kind: string): AnyNode[] =>
  graph.allNodes().filter((node) => node.kind === kind);

/**
 * Rules that name the mutations that would fix them.
 *
 * This is the seam the whole affordance system rides on, and it is worth
 * seeing in something this small: nobody wrote a rule saying "offer to finish
 * the blocker". The rule says what is wrong and which mutation resolves it,
 * and the interface derives the rest.
 */

/** You cannot have finished something that waits on something unfinished. */
export const orderHolds: I = defineInvariant("nothing-done-before-what-it-waits-for", {
  scope: { kind: "rule", match: (node) => node.spec.type === "nothing-done-before-what-it-waits-for" },
  label: "Nothing done before what it waits for",
  description: "A finished task whose blockers are not finished is a task somebody mis-ticked.",
  repairs: ["finish", "reopen"],
  evaluate({ graph, subject }) {
    const reader = graph as Reader;
    const violations: Violation[] = [];
    for (const task of nodesOf(reader, "task")) {
      if (task["done"] !== true) continue;
      const waiting = reader
        .out(task.id, "waits-for")
        .filter((other) => other["done"] !== true);
      if (waiting.length === 0) continue;
      violations.push({
        invariant: "nothing-done-before-what-it-waits-for",
        subjectId: subject.id,
        label: subject.label,
        message: `"${name(task)}" is done, but it waits for ${waiting
          .map((other) => `"${name(other)}"`)
          .join(" and ")}`,
        nodeIds: [task.id, ...waiting.map((other) => other.id)],
        repairs: [
          // Two honest ways out, and the framework offers both rather than
          // choosing: finish what it waits for, or admit it is not done.
          ...waiting.map(
            (other): Repair => ({
              mutation: "finish",
              args: { taskId: other.id },
              label: `Finish "${name(other)}" too`,
            }),
          ),
          { mutation: "reopen", args: { taskId: task.id }, label: "Put it back" },
        ],
      });
    }
    return violations;
  },
});

/**
 * Overdue, judged against a date the app threads through the CONTEXT.
 *
 * Not `new Date()`. An invariant must be pure — same graph and context in,
 * same violations out — or the whole tier stops being testable and `preview`
 * stops being able to say what a change would break.
 */
export const nothingOverdue: I = defineInvariant("nothing-overdue", {
  scope: { kind: "rule", match: (node) => node.spec.type === "nothing-overdue" },
  label: "Nothing overdue",
  description: "A task past its date that nobody has finished or moved.",
  repairs: ["reschedule", "finish"],
  evaluate({ graph, subject, context }) {
    const today = typeof context["today"] === "string" ? (context["today"] as string) : undefined;
    if (!today) return [];
    // A rule can be effective only from a date, like anything else here.
    if (!isEffectiveOn(subject as never, today)) return [];

    const reader = graph as Reader;
    const late = nodesOf(reader, "task").filter(
      (task) =>
        task["done"] !== true && typeof task["due"] === "string" && (task["due"] as string) < today,
    );
    if (late.length === 0) return [];
    return [
      {
        invariant: "nothing-overdue",
        subjectId: subject.id,
        label: subject.label,
        message:
          late.length === 1
            ? `"${name(late[0])}" was due ${String(late[0]!["due"])}`
            : `${late.length} tasks are past their date, the oldest ${String(late[0]!["due"])}`,
        nodeIds: late.map((task) => task.id),
        repairs: late.flatMap((task): Repair[] => [
          {
            mutation: "reschedule",
            args: { taskId: task.id },
            missing: ["due"],
            // The strip already names what is selected. Repeating it inside
            // every action turns four buttons into four sentences.
            label: late.length === 1 ? "Give it a new date" : `A new date for "${name(task)}"`,
          },
          {
            mutation: "finish",
            args: { taskId: task.id },
            label: late.length === 1 ? "Finish it" : `Finish "${name(task)}"`,
          },
        ]),
      },
    ];
  },
});

/**
 * A list nobody can act on.
 *
 * The rule with an opinion, and the one worth arguing with — which is exactly
 * why it is a node rather than a line of code. Somebody can look at it, decide
 * twelve is the wrong number, and rename it.
 */
export const notAHeap: I = defineInvariant("a-list-is-not-a-heap", {
  scope: { kind: "rule", match: (node) => node.spec.type === "a-list-is-not-a-heap" },
  label: "A list is not a heap",
  description: "Past about a dozen open tasks a list stops being a list you work from.",
  repairs: ["move-to-list", "drop"],
  evaluate({ graph, subject }) {
    const reader = graph as Reader;
    const limit = 12;
    const violations: Violation[] = [];
    for (const list of nodesOf(reader, "list")) {
      const open = reader.out(list.id, "holds").filter((task) => task["done"] !== true);
      if (open.length <= limit) continue;
      const elsewhere = nodesOf(reader, "list").filter((other) => other.id !== list.id);
      violations.push({
        invariant: "a-list-is-not-a-heap",
        subjectId: subject.id,
        label: subject.label,
        message: `"${name(list)}" has ${open.length} open tasks — past ${limit} it stops being a list you work from`,
        nodeIds: [list.id, ...open.map((task) => task.id)],
        repairs: elsewhere.map(
          (other): Repair => ({
            mutation: "move-to-list",
            args: { listId: other.id },
            missing: ["taskId"],
            label: `Move something to "${name(other)}"`,
          }),
        ),
      });
    }
    return violations;
  },
});

export const todoInvariants: I[] = [orderHolds, nothingOverdue, notAHeap];
