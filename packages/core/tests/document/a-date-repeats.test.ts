import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { documentTypes } from "../../src/cli/types.js";
import { DocumentSpec, diffDocuments, editDocument, planMigration, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { createSchema, defineApp, defineNode, refusalOf, repeatField, Store, z, type AnySchema, type GraviewApp } from "../../src/index.js";
import { nodeJsonSchema } from "../../src/json-schema.js";
import { fieldSpecOf } from "../../src/blocks.js";

/**
 * A DATE THAT REPEATS: a weekly practice, a monthly bill.
 *
 *   "startsAt": { "type": "datetime", "repeats": true }
 *
 * A record keeps its first occurrence in the date and how it repeats beside
 * it (`startsAtRepeat`); what reads the date reads the next occurrence, and
 * one occurrence is skipped, changed alone or changed from on by an act.
 */
const club = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "The running club",
    kinds: {
      practice: {
        label: "{title}",
        fields: {
          title: { type: "string", required: true },
          startsAt: { type: "datetime", required: true, repeats: true },
          place: { type: "string" },
        },
        edges: { ledBy: { to: ["coach"], cardinality: "one" } },
      },
      coach: { label: "{name}", fields: { name: { type: "string", required: true } } },
    },
    roles: ["coach", "runner"],
    acts: { "add-practice": { title: "Add a practice", creates: "practice" } },
    rules: {
      "not-past": { title: "A practice is still to come", over: "practice", require: "date(startsAt) >= today()", says: "{title} was {startsAt}" },
    },
    policy: { grants: [{ roles: ["coach"], mutations: ["add-practice"] }] },
  }) as unknown as GraviewDocument;

function compiled(doc: unknown = club()): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-21" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
// 2026-10-20 is a Tuesday: practice every Tuesday at six, from then.
const TUESDAYS = { id: "tuesdays", kind: "practice", title: "Tuesday run", startsAt: "2026-10-20T18:00", startsAtRepeat: { every: "week", on: ["tue"] } };
const storeOf = (app: GraviewApp<AnySchema>, today = "2026-10-21") =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    policy: app.policy,
    invariantOptions: { today },
    snapshot: { nodes: [{ id: "sam", kind: "coach", name: "Sam" }, TUESDAYS], edges: [{ kind: "ledBy", from: "tuesdays", to: "sam" }] } as never,
  });
const SYSTEM = { kind: "system", id: "system" } as never;
const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return refusalOf(error);
  }
  throw new Error("expected a refusal");
};

describe("a document's date that repeats", () => {
  it("is said on a date or datetime field, and nowhere else", () => {
    expect(DocumentSpec.safeParse(club()).success).toBe(true);
    const wrong = club() as unknown as { kinds: { practice: { fields: Record<string, unknown> } } };
    wrong.kinds.practice.fields["place"] = { type: "string", repeats: true };
    expect(compileDocument(wrong).findings.filter((f) => f.severity === "error").map((f) => f.path)).toContain("kinds.practice.fields.place.repeats");
    const clash = club() as unknown as { kinds: { practice: { fields: Record<string, unknown> } } };
    clash.kinds.practice.fields["startsAtRepeat"] = { type: "string" };
    expect(compileDocument(clash).findings.map((f) => f.code)).toContain("repeat-clash");
  });

  it("keeps how it repeats beside it, refusing one that is not a repeat", () => {
    const store = storeOf(compiled());
    expect(store.graph.getNode("tuesdays")?.["startsAtRepeat"]).toEqual({ every: "week", on: ["tue"] });
    expect(refusal(() => store.apply({ name: "edit-practice", args: { id: "tuesdays", startsAtRepeat: { every: "fortnight" } } }, { author: SYSTEM }))).toMatchObject({ reason: "invalid" });
    store.apply({ name: "edit-practice", args: { id: "tuesdays", startsAtRepeat: { every: "week", on: ["tue", "thu"], until: "2026-12-15" } } }, { author: SYSTEM });
    expect(store.graph.getNode("tuesdays")?.["startsAtRepeat"]).toMatchObject({ until: "2026-12-15" });
    // No longer repeating is none: the date is its one day again.
    store.apply({ name: "edit-practice", args: { id: "tuesdays", startsAtRepeat: null } }, { author: SYSTEM });
    expect(store.graph.getNode("tuesdays")?.["startsAtRepeat"] ?? null).toBeNull();
    expect(store.violations().filter((v) => v.invariant === "not-past")).toHaveLength(1);
  });

  it("is judged by a rule on its next occurrence, which the day turning moves", () => {
    const store = storeOf(compiled(), "2026-11-04");
    // Its first occurrence is two weeks gone; its next is today.
    expect(store.violations().filter((v) => v.invariant === "not-past")).toEqual([]);
    const ended = storeOf(compiled(), "2027-01-05");
    ended.apply({ name: "edit-practice", args: { id: "tuesdays", startsAtRepeat: { every: "week", until: "2026-12-15" } } }, { author: SYSTEM });
    const [past] = ended.violations().filter((v) => v.invariant === "not-past");
    // Once it has ended, it reads as its last.
    expect(past?.message).toBe("Tuesday run was Dec 15, 2026, 6:00 PM");
  });

  it("skips one occurrence with one act, said as a sentence, undone as one", () => {
    const store = storeOf(compiled());
    const done = store.apply({ name: "skip-practice", args: { id: "tuesdays", on: "2026-10-27" } }, { author: SYSTEM });
    expect(done.ops[0]?.intent).toBe("Skip Tuesday run on Oct 27, 2026");
    expect(store.graph.getNode("tuesdays")?.["startsAtRepeat"]).toEqual({ every: "week", on: ["tue"], except: ["2026-10-27"] });
    expect(refusal(() => store.apply({ name: "skip-practice", args: { id: "tuesdays", on: "2026-10-28" } }, { author: SYSTEM }))).toMatchObject({ reason: "refused", sentence: expect.stringContaining("does not fall on Oct 28, 2026") });
    store.undo(done.batch!, { author: SYSTEM });
    expect(store.graph.getNode("tuesdays")?.["startsAtRepeat"]).toEqual({ every: "week", on: ["tue"] });
  });

  it("changes just one occurrence: a record of its own on that day, with the series' links, and the day left out of the series", () => {
    const store = storeOf(compiled());
    const done = store.apply({ name: "detach-practice", args: { id: "tuesdays", on: "2026-10-27", place: "The track" } }, { author: SYSTEM });
    const made = store.graph.allNodes().find((node) => node.kind === "practice" && node.id !== "tuesdays")!;
    expect(made).toMatchObject({ title: "Tuesday run", startsAt: "2026-10-27T18:00", place: "The track" });
    expect(made["startsAtRepeat"]).toBeUndefined();
    expect(store.graph.out(made.id, "ledBy").map((node) => node.id)).toEqual(["sam"]);
    expect(store.graph.getNode("tuesdays")?.["startsAtRepeat"]).toMatchObject({ except: ["2026-10-27"] });
    store.undo(done.batch!, { author: SYSTEM });
    expect(store.graph.nodesOfKind("practice")).toHaveLength(1);
  });

  it("changes from one occurrence on: the series ends the day before, and a new one continues it", () => {
    const store = storeOf(compiled());
    const done = store.apply({ name: "split-practice", args: { id: "tuesdays", on: "2026-11-03", startsAt: "2026-11-03T19:00" } }, { author: SYSTEM });
    expect(store.graph.getNode("tuesdays")?.["startsAtRepeat"]).toEqual({ every: "week", on: ["tue"], until: "2026-11-02" });
    const next = store.graph.allNodes().find((node) => node.kind === "practice" && node.id !== "tuesdays")!;
    expect(next).toMatchObject({ startsAt: "2026-11-03T19:00", startsAtRepeat: { every: "week", on: ["tue"], continues: "tuesdays" } });
    expect(refusal(() => store.apply({ name: "split-practice", args: { id: next.id, on: "2026-11-10" } }, { author: SYSTEM }))).toMatchObject({ sentence: expect.stringContaining("Nothing to change") });
    store.undo(done.batch!, { author: SYSTEM });
    expect(store.graph.getNode("tuesdays")?.["startsAtRepeat"]).toEqual({ every: "week", on: ["tue"] });
    expect(store.graph.nodesOfKind("practice")).toHaveLength(1);
  });

  it("is acted on by whoever may change the record, and by nobody else", () => {
    const store = storeOf(compiled());
    expect(store.permits({ name: "skip-practice", args: { id: "tuesdays", on: "2026-10-27" } }, { kind: "human", id: "c", roles: ["coach"] }).ok).toBe(true);
    expect(store.permits({ name: "skip-practice", args: { id: "tuesdays", on: "2026-10-27" } }, { kind: "human", id: "r", roles: ["runner"] }).ok).toBe(false);
  });

  it("is turned on and off by an edit to the document, and turning it off drops each record's repeat", () => {
    const off = (() => {
      const doc = club() as unknown as { kinds: { practice: { fields: { startsAt: { repeats?: boolean } } } } };
      delete doc.kinds.practice.fields.startsAt.repeats;
      return doc as unknown as GraviewDocument;
    })();
    const on = editDocument(off, [{ op: "set-repeats", kind: "practice", field: "startsAt", repeats: true }]);
    expect(on.ok && on.document.kinds["practice"]!.fields["startsAt"]!.repeats).toBe(true);
    expect(on.ok && on.said).toEqual(["practice's startsAt may repeat: weekly, monthly, on chosen days, until a day."]);
    expect(editDocument(club(), [{ op: "set-repeats", kind: "practice", field: "title", repeats: true }]).ok).toBe(false);
    const diff = diffDocuments(club(), off);
    expect(diff.breaking).toBe(true);
    expect(diff.sentences).toContain("practice's startsAt no longer repeats; how each practice repeated is dropped.");
    const plan = planMigration(club(), off, { nodes: [TUESDAYS], edges: [] });
    expect(plan.words.join(" ")).toContain("no longer repeats");
  });

  it("goes with its date when the date is renamed", () => {
    const doc = club() as unknown as { kinds: { practice: { fields: Record<string, Record<string, unknown>> } } };
    const { startsAt, ...rest } = doc.kinds.practice.fields;
    doc.kinds.practice.fields = { ...rest, meetsAt: { ...startsAt, renamedFrom: "startsAt" } };
    const plan = planMigration(club(), doc as unknown as GraviewDocument, { nodes: [TUESDAYS], edges: [] });
    const patch = plan.primitives.find((p) => p.op === "patch-node") as { after: Record<string, unknown> } | undefined;
    expect(patch?.after).toMatchObject({ meetsAt: "2026-10-20T18:00", meetsAtRepeat: { every: "week", on: ["tue"] } });
  });

  it("reads back as a date and time, so a face that asks which fields are dates finds it", () => {
    const shape = (compiled().schema.definition("practice").fields as unknown as { shape: Record<string, unknown> }).shape;
    expect(fieldSpecOf(shape["startsAt"])).toMatchObject({ type: "datetime" });
  });

  it("is written in its types and its JSON Schema", () => {
    const types = documentTypes(club());
    expect(types).toContain('import type { Repeat } from "@graview/core";');
    expect(types).toContain("readonly startsAtRepeat?: Repeat | null;");
    const json = nodeJsonSchema(compiled().schema.definition("practice") as never) as { properties: Record<string, Record<string, unknown>> };
    for (const said of [`"x-graview-repeat":true`, `"every":{"type":"string","enum":["day","week","month","year"]}`]) expect(JSON.stringify(json.properties["startsAtRepeat"])).toContain(said);
  });
});

describe("a declaration's date that repeats", () => {
  const practice = defineNode("practice", {
    fields: z.object({ title: z.string(), startsAt: z.iso.date(), startsAtRepeat: repeatField() }),
  });
  const app = defineApp({ name: "Club", schema: createSchema([practice]), mutations: [] });

  it("is written as a document's repeating date, and given the acts on one occurrence", () => {
    const written = toDocument(app as never);
    expect(written.document?.kinds["practice"]?.fields).toEqual({ title: { type: "string", required: true }, startsAt: { type: "date", required: true, repeats: true } });
    const store = new Store({ schema: app.schema, snapshot: { nodes: [{ id: "p", kind: "practice", title: "Run", startsAt: "2026-10-20", startsAtRepeat: { every: "week" } }], edges: [] } as never });
    expect(store.allMutations().map((m) => m.name)).toEqual(expect.arrayContaining(["skip-practice", "detach-practice", "split-practice"]));
    store.apply({ name: "skip-practice", args: { id: "p", on: "2026-10-27" } });
    expect(store.graph.getNode("p")?.["startsAtRepeat"]).toEqual({ every: "week", except: ["2026-10-27"] });
    expect(() => store.apply({ name: "edit-practice", args: { id: "p", startsAtRepeat: { every: "week", on: [3] } } })).toThrow();
    const json = nodeJsonSchema(practice as never) as { properties: Record<string, Record<string, unknown>> };
    for (const said of [`"x-graview-repeat":true`, `"every":{"type":"string","enum":["day","week","month","year"]}`]) expect(JSON.stringify(json.properties["startsAtRepeat"])).toContain(said);
  });
});
