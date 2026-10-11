/*
 * A DOCUMENT WRITTEN IN TYPESCRIPT NAMES WHAT IT DECLARES. `pnpm typecheck`
 * compiles this file (tsconfig.tests.json): every `@ts-expect-error` below is
 * a name the document does not declare, or a key the format does not have,
 * and the compile fails if any of them stops being an error.
 */
import { defineDocument, typedReader, type TypesOf } from "../../src/typed.js";
import { Store } from "../../src/store.js";

export const tasks = defineDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "The tasks",
  kinds: {
    task: {
      fields: {
        label: { type: "string", required: true },
        status: { type: "enum", options: ["todo", "doing", "done"], required: true },
        points: { type: "integer" },
      },
      glance: ["status", "points"],
      fieldRoles: { who: "label" },
      lifecycle: { field: "status", retired: ["done"] },
      edges: { assignedTo: { to: ["person"], cardinality: "one" } },
    },
    person: { fields: { label: { type: "string", required: true } } },
  },
  acts: {
    assign: { on: "task", connects: "assignedTo" },
    "add-task": { creates: "task", writes: ["label"] },
  },
  computed: { open: "count(all('task') where status != 'done')" },
  rules: { "a-task-has-points": { over: "task", require: "points != null", repairs: [{ act: "edit-task" }] } },
  roles: ["owner"],
  policy: { grants: [{ roles: ["owner"], mutations: "*" }] },
});

// The output is the document, as JSON: its names are its own.
export const name: "The tasks" = tasks.name;

defineDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "Unknown keys",
  kinds: {
    task: {
      fields: { label: { type: "string" } },
      // @ts-expect-error — `roles` is not a key of a kind: the fields that fill its roles are its `fieldRoles`.
      roles: { when: "label" },
    },
  },
});

defineDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "Names it does not declare",
  kinds: {
    task: {
      fields: { label: { type: "string" } },
      // @ts-expect-error — a glance says a field the kind has.
      glance: ["title"],
      // @ts-expect-error — a role names a field the kind has.
      fieldRoles: { when: "dueOn" },
      // @ts-expect-error — an edge reaches a kind the document declares.
      edges: { assignedTo: { to: ["persn"] } },
    },
  },
  acts: {
    // @ts-expect-error — an act connects a relation some kind declares.
    assign: { on: "task", connects: "assigned" },
  },
  rules: {
    // @ts-expect-error — a rule is over a kind the document declares, or the graph.
    "has-a-label": { over: "tsk", require: "label != null" },
    // @ts-expect-error — the act every kind is given is named for a kind the document declares.
    "is-named": { over: "task", require: "label != null", repairs: [{ act: "edit-tsk" }] },
  },
});

defineDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "A field key",
  kinds: {
    // @ts-expect-error — `choices` is not a key of a field: an enum's are its `options`.
    task: { fields: { status: { type: "enum", choices: ["a"] } } },
  },
});

// The types the document's own shape gives, read through a store.
type Types = TypesOf<typeof tasks>;
const read = typedReader<Types>(new Store({ schema: undefined as never }));
for (const task of read.nodes("task")) {
  const status: "todo" | "doing" | "done" = read.fieldOf(task, "status");
  const points: number | undefined = task.points;
  const assignee: string | undefined = read.edgesOf(task, "assignedTo")[0]?.label;
  void [status, points, assignee];
  // @ts-expect-error — a field the kind does not have.
  read.fieldOf(task, "title");
  // @ts-expect-error — a relation the kind does not declare.
  read.edgesOf(task, "assigned");
}
// @ts-expect-error — a kind the document does not declare.
read.nodes("tasks");
const someone = read.node("p1", "person");
if (someone) {
  const assigned: readonly { readonly kind: "task" }[] = read.inwardOf(someone, "assignedTo");
  void assigned;
}
