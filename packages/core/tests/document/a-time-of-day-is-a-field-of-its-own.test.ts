import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { blockContextFor, compileBlocks, fieldSpecOf, resolveBlocks } from "../../src/blocks.js";
import { documentTypes } from "../../src/cli/types.js";
import { appFrom, serializeCompiled } from "../../src/compiled.js";
import { DocumentSpec, editDocument, FIELD_TYPES, planMigration, renderTemplate, parseTemplate, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { describeActForm } from "../../src/document/describe-forms.js";
import { formArgs, formFields } from "../../src/forms.js";
import { createSchema, defineApp, defineNode, refusalOf, Store, timeAsRead, timeField, TIME_OF_DAY, z, type AnySchema, type GraviewApp } from "../../src/index.js";
import { mutationToolSchema, nodeJsonSchema } from "../../src/json-schema.js";
import { coerceCell } from "../../src/import/coerce.js";
import { describeArg, parseTimeOfDay, readableFields, typedFieldOf } from "../../src/words.js";
import { listCsv } from "../../src/csv.js";
import { labelOf } from "../../src/index.js";
import { withComputed } from "../../src/blocks.js";
import { sortTypeOfDocumentField } from "../../src/kind-list.js";

/**
 * A TIME OF DAY, a field type of its own (HQ feature
 * f-template-format-cloud-additions).
 *
 *   "dinner": { "type": "time" }   "15:00": no day, no zone, said "3:00 PM"
 *
 * Thanksgiving's schedule kept zone-less datetimes, and every view formatted
 * them itself; a time asked of a person ("What time is dinner?") had
 * nowhere to go but a string.
 */
const dinner = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Dinner",
    kinds: {
      course: {
        fields: { name: { type: "string", required: true }, at: { type: "time", required: true }, until: { type: "time" } },
      },
    },
    acts: { "add-course": { title: "Add a course", creates: "course" } },
    views: { course: { card: [{ title: "{name}" }, { field: "at" }, { text: "Served {at | time}" }] } },
  }) as unknown as GraviewDocument;

function compiled(doc: unknown = dinner()): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-11-26" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [{ id: "c1", kind: "course", name: "Pie", at: "17:15" }], edges: [] } as never });
const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return refusalOf(error);
  }
  throw new Error("expected a refusal");
};

describe("a time of day as it is typed", () => {
  it("is read as HH:MM from 15:00, 3 PM, 3:30pm, 9.15 a.m., noon and midnight, and nothing else", () => {
    expect(parseTimeOfDay("15:00")).toBe("15:00");
    expect(parseTimeOfDay("3 PM")).toBe("15:00");
    expect(parseTimeOfDay("3:30pm")).toBe("15:30");
    expect(parseTimeOfDay("9.15 a.m.")).toBe("09:15");
    expect(parseTimeOfDay("12 am")).toBe("00:00");
    expect(parseTimeOfDay("12 pm")).toBe("12:00");
    expect(parseTimeOfDay("09:30:00")).toBe("09:30");
    expect(parseTimeOfDay("noon")).toBe("12:00");
    expect(parseTimeOfDay("midnight")).toBe("00:00");
    for (const typed of ["3", "25:00", "13 pm", "9:75", "3:00:99", "3:00:60", "soon", "", 15, null]) expect(parseTimeOfDay(typed), String(typed)).toBeUndefined();
  });

  it("is said as the reader's clock says it, with no zone moving it", () => {
    expect(timeAsRead("15:00", "en-US")).toBe("3:00 PM");
    expect(timeAsRead("15:00", "en-GB")).toBe("15:00");
    expect(timeAsRead("09:05", "en-US", "Pacific/Auckland")).toBe("9:05 AM");
  });
});

describe("a document's time field", () => {
  it("is a field type of the document, its schema and its check", () => {
    expect(FIELD_TYPES).toContain("time");
    expect(DocumentSpec.safeParse(dinner()).success).toBe(true);
    expect(compileDocument(dinner()).findings.filter((f) => f.severity === "error")).toEqual([]);
  });

  it("keeps HH:MM and refuses what is none", () => {
    const store = storeOf(compiled());
    store.apply({ name: "edit-course", args: { id: "c1", at: "09:30", until: "23:59" } });
    expect(store.graph.getNode("c1")).toMatchObject({ at: "09:30", until: "23:59" });
    for (const at of ["3 PM", "9:30", "24:00", "2026-11-26T15:00:00", "15:00:00", 900]) {
      expect(refusal(() => store.apply({ name: "edit-course", args: { id: "c1", at } })), String(at)).toMatchObject({ reason: "invalid" });
    }
  });

  it("is asked for with a time input, and what was typed is sent as HH:MM", () => {
    const edit = storeOf(compiled()).mutation("edit-course");
    expect(describeArg((edit.input as unknown as { shape: Record<string, unknown> }).shape["at"])).toEqual({ type: "time" });
    const fields = formFields(edit.input);
    expect(fields.find((f) => f.name === "at")).toMatchObject({ control: "time" });
    expect(formArgs(fields, { id: "c1", at: "15:00", until: "3:30 pm" })).toMatchObject({ at: "15:00", until: "15:30" });
    expect(formArgs(fields, { id: "c1", at: "soon" })).toMatchObject({ at: "soon" });
    expect(formArgs(fields, { id: "c1", until: "" })["until"]).toBeUndefined();
    const store = storeOf(compiled());
    const described = describeActForm(store, { kind: "system", id: "test" }, store.mutation("edit-course"));
    expect(JSON.stringify(described)).toContain('"input":"time of day"');
  });

  it("has a JSON schema an agent sends HH:MM by: its pattern and x-graview-type", () => {
    const app = compiled();
    const edit = storeOf(app).mutation("edit-course");
    const properties = mutationToolSchema(edit).inputSchema["properties"] as Record<string, Record<string, unknown>>;
    expect(properties["at"]).toMatchObject({ type: "string", "x-graview-type": "time", description: "A time of day on a 24-hour clock, HH:MM with no day and no zone: 15:00 is 3 PM." });
    const pattern = new RegExp(String(properties["at"]?.["pattern"]));
    expect(pattern.test("15:00")).toBe(true);
    expect(pattern.test("3 PM")).toBe(false);
    const kind = nodeJsonSchema(app.schema.tryDefinition("course")!) as { properties: Record<string, Record<string, unknown>> };
    expect(kind.properties["at"]).toMatchObject({ type: "string", "x-graview-type": "time" });
  });

  it("is said with {x | time}, by a card's field block, a record's facts and a list's CSV", () => {
    const app = compiled();
    const store = storeOf(app);
    const node = store.graph.getNode("c1")!;
    expect(renderTemplate(parseTemplate("Served at {at | time}"), { node, kinds: new Map(), money: { locale: "en-US" } })).toBe("Served at 5:15 PM");
    const [, at, said] = resolveBlocks(compileBlocks([{ title: "{name}" }, { field: "at" }, { text: "Served {at | time}" }]), blockContextFor(store, null, node));
    expect(at).toMatchObject({ t: "field", text: "5:15 PM" });
    expect(said).toMatchObject({ text: "Served 5:15 PM" });
    expect(readableFields(node, app.schema.tryDefinition("course"), { locale: "en-US" }).find((f) => f.key === "at")).toMatchObject({ value: "5:15 PM", stored: "17:15" });
    const csv = listCsv({ schema: app.schema, graph: store.graph, kind: "course", groups: [{ nodes: [node] }], grouped: false, locale: "en-US", words: { labelOf, readableFields, withComputed } });
    expect(csv).toContain("5:15 PM");
  });

  it("sorts as written, earliest first, since HH:MM sorts as its hours do", () => {
    expect(sortTypeOfDocumentField("time")).toBe("date");
    expect(["17:15", "09:30", "12:00", "00:05"].sort()).toEqual(["00:05", "09:30", "12:00", "17:15"]);
  });

  it("survives a compiled app handed to a page", () => {
    const result = compileDocument(dinner(), { today: () => "2026-11-26" });
    if (!result.ok) throw new Error("compiles");
    const again = appFrom(JSON.parse(JSON.stringify(serializeCompiled(result))));
    if (!again.ok) throw new Error("builds");
    expect(typedFieldOf((again.app.schema.tryDefinition("course")!.fields as { shape: Record<string, unknown> }).shape["at"])).toBe("time");
  });

  it("is read from a spreadsheet's cells as it is typed, a part of a day or a date's clock", () => {
    expect(coerceCell({ type: "time" }, "3 PM", "At")).toEqual({ ok: true, value: "15:00" });
    expect(coerceCell({ type: "time" }, " 09:30 ", "At")).toEqual({ ok: true, value: "09:30" });
    expect(coerceCell({ type: "time" }, 0.625, "At")).toEqual({ ok: true, value: "15:00" });
    // A part of a day just short of a whole one is the day's last minute, never midnight again.
    expect(coerceCell({ type: "time" }, 0.999999, "At")).toEqual({ ok: true, value: "23:59" });
    expect(coerceCell({ type: "time" }, new Date(Date.UTC(1899, 11, 30, 18, 45)), "At")).toEqual({ ok: true, value: "18:45" });
    expect(coerceCell({ type: "time" }, "teatime", "At")).toEqual({ ok: false, why: "“teatime” under At is not a time of day, like 15:00 or 3 PM" });
  });

  it("is added, and a field retyped to one keeps what reads as a time, by editDocument and a migration", () => {
    const added = editDocument(dinner(), [{ op: "add-field", kind: "course", field: "doors", spec: { type: "time" } }]);
    expect(added.ok).toBe(true);
    const before = dinner() as unknown as { kinds: { course: { fields: Record<string, unknown> } } };
    before.kinds.course.fields["at"] = { type: "string", required: true };
    const plan = planMigration(before as never, dinner(), {
      nodes: [
        { id: "a", kind: "course", name: "A", at: "3 PM" },
        { id: "b", kind: "course", name: "B", at: "2026-11-26T13:45:00" },
        { id: "c", kind: "course", name: "C", at: "after the game" },
      ],
      edges: [],
    });
    expect(plan.counts.coerced).toBeGreaterThanOrEqual(2);
  });

  it("is written as TypeScript by graview types: a string that holds HH:MM", () => {
    expect(documentTypes(dinner())).toMatch(/A time of day, as 15:00[^\n]*\n\s*readonly at: string;/);
  });
});

describe("a TypeScript declaration's time field", () => {
  const course = defineNode("course", { fields: z.object({ name: z.string(), at: timeField(), until: timeField().optional() }) });

  it("is marked through optional, refuses what is none, and is written as a document's", () => {
    expect(typedFieldOf(course.fields.shape.at)).toBe("time");
    expect(typedFieldOf(course.fields.shape.until)).toBe("time");
    expect(timeField().safeParse("15:00").success).toBe(true);
    expect(timeField().safeParse("3 PM").success).toBe(false);
    expect(TIME_OF_DAY.test("23:59")).toBe(true);
    expect(fieldSpecOf(timeField())).toEqual({ type: "time", required: true });
    const { document, findings } = toDocument(defineApp({ name: "dinner", schema: createSchema([course]) }));
    expect(findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(document.kinds["course"]!.fields).toMatchObject({ at: { type: "time", required: true }, until: { type: "time" } });
  });
});
