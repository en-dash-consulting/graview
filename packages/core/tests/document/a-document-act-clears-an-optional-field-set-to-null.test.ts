import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { ActRefusal, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A DOCUMENT ACT CLEARS AN OPTIONAL FIELD WHEN ITS EFFECT SETS IT TO NULL
 * (Roadmap f-act-clears-optional-field). Unassigning and clearing a date are
 * ordinary: `"set": { "assignee": null }` removes the value — on the act's
 * subject, on a record it makes, on the record at the other end of a link
 * and on linked records. A required field cannot be cleared: the call is
 * refused in words that name the field, and graview check warns of it.
 */
const tasks = (acts: Record<string, unknown>, more: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Tasks",
  description: "What there is to do, and who does it.",
  kinds: {
    task: {
      noun: "task",
      plural: "tasks",
      label: "{title}",
      description: "One thing to do.",
      fields: {
        title: { type: "string", required: true },
        assignee: { type: "string" },
        due: { type: "date" },
      },
      edges: { notes: { to: ["note"], description: "what is noted about it", inverse: "what it notes" } },
    },
    note: {
      noun: "note",
      plural: "notes",
      label: "{text}",
      description: "A line about a task.",
      fields: { text: { type: "string", required: true }, tag: { type: "string" } },
    },
    ...more,
  },
  acts,
});

const unassign = { title: "Unassign", on: "task", effects: [{ set: { assignee: null, due: null } }] };
const today = () => "2026-11-08";

function compiled(doc: unknown): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    snapshot: {
      nodes: [
        { id: "task-a", kind: "task", title: "Write the page", assignee: "ada", due: "2026-11-20" },
        { id: "note-a", kind: "note", text: "Ask first", tag: "open" },
        { id: "note-b", kind: "note", text: "Then write", tag: "open" },
      ],
      edges: [{ kind: "notes", from: "task-a", to: "note-a" }],
    } as never,
  });
const node = (store: Store<AnySchema>, id: string) => store.graph.getNode(id) as Record<string, unknown>;

describe("a document act clears an optional field when its effect sets it to null", () => {
  it("removes the value of each optional field its effect sets to null", () => {
    const store = storeOf(compiled(tasks({ unassign })));
    store.apply({ name: "unassign", args: { id: "task-a" } });
    expect(Object.hasOwn(node(store, "task-a"), "assignee")).toBe(false);
    expect(Object.hasOwn(node(store, "task-a"), "due")).toBe(false);
    expect(node(store, "task-a")["title"]).toBe("Write the page");
  });

  it("is taken back by an undo, the value it cleared restored", () => {
    const store = storeOf(compiled(tasks({ unassign })));
    const result = store.apply({ name: "unassign", args: { id: "task-a" } });
    store.undo(result.batch!);
    expect(node(store, "task-a")["assignee"]).toBe("ada");
  });

  it("leaves a field it sets to null off a record it makes", () => {
    const store = storeOf(compiled(tasks({ "add-note": { title: "Add a note", on: "task", args: { text: { type: "string", required: true } }, effects: [{ create: "note", as: "made", set: { text: "$text", tag: null } }, { connect: "notes", from: "$subject", to: "$made" }] } })));
    store.apply({ name: "add-note", args: { id: "task-a", text: "Check twice" } });
    const made = store.graph.out("task-a", "notes").find((n) => (n as Record<string, unknown>)["text"] === "Check twice") as Record<string, unknown>;
    expect(made).toBeDefined();
    expect(Object.hasOwn(made, "tag")).toBe(false);
  });

  it("clears the field of the record at the other end of a link it makes", () => {
    const store = storeOf(compiled(tasks({ "file-note": { title: "File a note", on: "task", connects: "notes", setsOther: { tag: null } } })));
    store.apply({ name: "file-note", args: { id: "task-a", to: "note-b" } });
    expect(Object.hasOwn(node(store, "note-b"), "tag")).toBe(false);
  });

  it("clears the field of every record linked to its subject", () => {
    const store = storeOf(compiled(tasks({ "untag-notes": { title: "Untag its notes", on: "task", setsLinked: { notes: { tag: null } } } })));
    store.apply({ name: "untag-notes", args: { id: "task-a" } });
    expect(Object.hasOwn(node(store, "note-a"), "tag")).toBe(false);
    expect(node(store, "note-b")["tag"]).toBe("open");
  });

  it("refuses a null set on a required field, in words that name the field", () => {
    // graview check warns of the act (below), and the document still compiles: the call is what is refused.
    const store = storeOf(compiled(tasks({ untitle: { title: "Untitle", on: "task", effects: [{ set: { title: null } }] } })));
    let error: unknown;
    try {
      store.apply({ name: "untitle", args: { id: "task-a" } });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ActRefusal);
    expect((error as Error).message).toBe('"Untitle" cannot clear Title of Write the page: every task has one');
    expect(node(store, "task-a")["title"]).toBe("Write the page");
  });
});

describe("graview check and a null set", () => {
  const cleared = (doc: unknown) => compileDocument(doc, { today }).findings.filter((f) => f.code === "act-clears-required");

  it("accepts a null set on an optional field", () => {
    expect(cleared(tasks({ unassign }))).toEqual([]);
  });

  it("warns of one on a required field, at the effect's path, naming the field, and the document still compiles", () => {
    const doc = tasks({ untitle: { title: "Untitle", on: "task", effects: [{ set: { title: null } }] } });
    expect(compileDocument(doc, { today }).ok).toBe(true);
    const found = cleared(doc);
    expect(found.map((f) => [f.severity, f.path])).toEqual([["warning", "acts.untitle.effects.0.set.title"]]);
    expect(found[0]!.message).toMatch(/title/);
  });

  it("warns at a shorthand's own key, sets", () => {
    expect(cleared(tasks({ untitle: { title: "Untitle", on: "task", sets: { title: null } } })).map((f) => f.path)).toEqual(["acts.untitle.sets.title"]);
  });

  it("says which kinds require it, for an act on several", () => {
    const doc = tasks({ untitle: { title: "Untitle", on: ["task", "chore"], sets: { title: null } } }, { chore: { noun: "chore", plural: "chores", label: "{title}", fields: { title: { type: "string" } } } });
    const found = cleared(doc);
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toMatch(/on a task/);
    expect(found[0]!.message).not.toMatch(/chore requires/);
  });

  it("warns of a record it makes, the other end and linked records too", () => {
    const doc = tasks({
      "add-note": { title: "Add a note", on: "task", effects: [{ create: "note", as: "made", set: { text: null } }, { connect: "notes", from: "$subject", to: "$made" }] },
      "file-note": { title: "File a note", on: "task", connects: "notes", setsOther: { text: null } },
      "blank-notes": { title: "Blank its notes", on: "task", setsLinked: { notes: { text: null } } },
    });
    expect(cleared(doc).map((f) => f.path)).toEqual(["acts.add-note.effects.0.set.text", "acts.file-note.setsOther.text", "acts.blank-notes.setsLinked.notes.text"]);
  });
});
