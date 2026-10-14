import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { blockContextFor, compileBlocks, fieldSpecOf, resolveBlocks } from "../../src/blocks.js";
import { documentTypes } from "../../src/cli/types.js";
import { appFrom, serializeCompiled } from "../../src/compiled.js";
import { DocumentSpec, editDocument, FIELD_TYPES, planMigration, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { formArgs, formFields } from "../../src/forms.js";
import { createSchema, defineApp, defineNode, durationField, phoneField, placeField, refusalOf, Store, z, type AnySchema, type GraviewApp } from "../../src/index.js";
import { mutationToolSchema } from "../../src/json-schema.js";
import { coerceCell } from "../../src/import/coerce.js";
import { fieldSays, typedFieldOf, mapsHref, parseDuration, readableFields, sayDuration, sayPhone, telHref } from "../../src/words.js";

/**
 * A PHONE, A PLACE AND A DURATION, each a field type of its own.
 *
 *   "phone": { "type": "phone" }       a tel: link, grouped for a US reader
 *   "venue": { "type": "place" }       a link to the reader's maps app
 *   "length": { "type": "duration" }   whole minutes, said "1 h 30 min"
 *
 * Templates held all three as strings: a phone that was not a link to call,
 * an address that was not a link to a map, and lengths of time nobody could
 * add up.
 */
const sessions = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Sessions",
    kinds: {
      project: {
        fields: { name: { type: "string", required: true }, budget: { type: "duration" } },
        edges: { sessions: { to: ["session"] } },
        computed: { spent: "sum(out('sessions'), length)", count: "count(out('sessions'))", left: "budget - spent" },
      },
      session: {
        fields: {
          name: { type: "string", required: true },
          phone: { type: "phone", description: "who to call about it" },
          venue: { type: "place" },
          length: { type: "duration" },
        },
        computed: { doubled: "length + length", rate: "length * 2" },
      },
    },
    acts: { "add-session": { title: "Add a session", creates: "session" } },
    views: { session: { card: [{ title: "{name}" }, { field: "phone" }, { field: "venue" }, { field: "length" }] } },
  }) as unknown as GraviewDocument;

function compiled(doc: unknown = sessions()): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-13" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [{ id: "s1", kind: "session", name: "Kickoff" }], edges: [] } as never });
const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return refusalOf(error);
  }
  throw new Error("expected a refusal");
};

describe("a length of time as it is typed", () => {
  it("is read in minutes from 90, 1:30, 1h 30m, 1 h 30 min, 1.5 h and words, and nothing else", () => {
    for (const typed of ["90", "1:30", "1:30:00", "1h 30m", "1h30m", "1 h 30 min", "1.5 h", "1,5h", "1 hour 30 minutes", "1 hour and 30 minutes", "90 min", "90m", " 1H 30M ", 90]) expect(parseDuration(typed), String(typed)).toBe(90);
    expect(parseDuration("2d")).toBe(2880);
    expect(parseDuration("45")).toBe(45);
    expect(parseDuration("0")).toBe(0);
    for (const typed of ["", "soon", "1 h and a bit", "1:75", "-5", "1 week", -5, Number.NaN, null]) expect(parseDuration(typed), String(typed)).toBeUndefined();
  });

  it("is said as 1 h 30 min, 45 min and 2 h, its numbers in the locale's figures", () => {
    expect(sayDuration(90, "en-US")).toBe("1 h 30 min");
    expect(sayDuration(45, "en-US")).toBe("45 min");
    expect(sayDuration(120, "en-US")).toBe("2 h");
    expect(sayDuration(0, "en-US")).toBe("0 min");
    expect(sayDuration(1500 * 60, "en-US")).toBe("1,500 h");
    expect(sayDuration(1500 * 60, "de-DE")).toBe("1.500 h");
  });
});

describe("a phone number", () => {
  it("is grouped for a reader in the US or Canada where it is a North American number, and said as entered anywhere else", () => {
    expect(sayPhone("5551234567", "en-US")).toBe("(555) 123-4567");
    expect(sayPhone("+1 555.123.4567 x12", "en-US")).toBe("+1 (555) 123-4567 ext. 12");
    expect(sayPhone("555-123-4567", "en-CA")).toBe("(555) 123-4567");
    expect(sayPhone("5551234567", "en-GB")).toBe("5551234567");
    expect(sayPhone("+44 20 7946 0958", "en-US")).toBe("+44 20 7946 0958");
    expect(sayPhone(" 911 ", "en-US")).toBe("911");
  });

  it("is a tel: link of its digits, its + and its extension", () => {
    expect(telHref("+1 (555) 123-4567 ext. 89")).toBe("tel:+15551234567;ext=89");
    expect(telHref("020 7946 0958")).toBe("tel:02079460958");
    expect(telHref("12")).toBeUndefined();
  });
});

describe("a place", () => {
  it("is a link to Apple's Maps on Apple's platforms and Google's universal Maps address elsewhere, with no key", () => {
    expect(mapsHref("1 Infinite Loop, Cupertino", true)).toBe("https://maps.apple.com/?q=1%20Infinite%20Loop%2C%20Cupertino");
    expect(mapsHref("Café Rouge & Bar", false)).toBe("https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20Rouge%20%26%20Bar");
  });
});

describe("a document's phone, place and duration fields", () => {
  it("are field types of the document, its schema and its check, and a duration may carry a range", () => {
    for (const type of ["phone", "place", "duration"]) expect(FIELD_TYPES).toContain(type);
    expect(DocumentSpec.safeParse(sessions()).success).toBe(true);
    expect(compileDocument(sessions()).findings.filter((f) => f.severity === "error")).toEqual([]);
    const ranged = sessions() as unknown as { kinds: { session: { fields: Record<string, unknown> } } };
    ranged.kinds.session.fields["length"] = { type: "duration", max: 480 };
    ranged.kinds.session.fields["phone"] = { type: "phone", max: 3 };
    expect(compileDocument(ranged).findings.filter((f) => f.severity === "error").map((f) => f.path)).toEqual(["kinds.session.fields.phone.max"]);
  });

  it("keep what an act sets — a phone as written, a place, a duration in minutes — and refuse what is none", () => {
    const store = storeOf(compiled());
    store.apply({ name: "edit-session", args: { id: "s1", phone: "+1 (555) 123-4567 ext. 2", venue: "Town Hall, Main St", length: 90 } });
    expect(store.graph.getNode("s1")).toMatchObject({ phone: "+1 (555) 123-4567 ext. 2", venue: "Town Hall, Main St", length: 90 });
    for (const args of [{ phone: "call me" }, { phone: "12" }, { phone: "5".repeat(41) }, { length: 1.5 }, { length: -10 }, { length: "1h 30m" }, { venue: "x".repeat(501) }]) {
      expect(refusal(() => store.apply({ name: "edit-session", args: { id: "s1", ...args } })), JSON.stringify(args)).toMatchObject({ reason: "invalid" });
    }
  });

  it("are asked for as one: a phone and a place in words, a duration typed as 1h 30m and sent as minutes", () => {
    const edit = storeOf(compiled()).mutation("edit-session");
    const fields = formFields(edit.input);
    expect(fields.find((f) => f.name === "phone")).toMatchObject({ control: "text", holds: "phone" });
    expect(fields.find((f) => f.name === "venue")).toMatchObject({ control: "text", holds: "place" });
    expect(fields.find((f) => f.name === "length")).toMatchObject({ control: "text", holds: "duration" });
    expect(formArgs(fields, { id: "s1", length: "1h 30m", phone: "  555 123 4567 ", venue: " Town Hall " })).toMatchObject({ length: 90, phone: "555 123 4567", venue: "Town Hall" });
    expect(formArgs(fields, { id: "s1", length: "soon" })).toMatchObject({ length: "soon" });
    expect(formArgs(fields, { id: "s1", length: "" })["length"]).toBeUndefined();
  });

  it("are described to an agent by x-graview-type, a duration in whole minutes", () => {
    const edit = storeOf(compiled()).mutation("edit-session");
    const properties = mutationToolSchema(edit).inputSchema["properties"] as Record<string, Record<string, unknown>>;
    expect(properties["phone"]).toMatchObject({ type: "string", "x-graview-type": "phone", description: "who to call about it" });
    expect(new RegExp(String(properties["phone"]?.["pattern"])).test("+44 20 7946 0958")).toBe(true);
    expect(properties["venue"]).toMatchObject({ type: "string", "x-graview-type": "place" });
    expect(properties["length"]).toMatchObject({ type: "integer", minimum: 0, "x-graview-type": "duration", "x-graview-unit": "minutes", description: "A length of time in whole minutes: 90 is 1 h 30 min." });
  });

  it("are added, and a field retyped to one, by editDocument; a retyped duration keeps its range", () => {
    const added = editDocument(sessions(), [
      { op: "add-field", kind: "session", field: "mobile", spec: { type: "phone" } },
      { op: "add-field", kind: "session", field: "spot", spec: { type: "place" } },
      { op: "add-field", kind: "session", field: "setup", spec: { type: "duration", max: 60 } },
    ]);
    expect(added.ok).toBe(true);
    if (added.ok) expect(added.document.kinds["session"]!.fields).toMatchObject({ mobile: { type: "phone" }, spot: { type: "place" }, setup: { type: "duration", max: 60 } });
    const doc = sessions() as unknown as { kinds: { session: { fields: Record<string, unknown> } } };
    doc.kinds.session.fields["minutes"] = { type: "integer", max: 600 };
    const retyped = editDocument(doc as never, [{ op: "retype-field", kind: "session", field: "minutes", type: "duration" }]);
    expect(retyped.ok).toBe(true);
    if (retyped.ok) expect(retyped.document.kinds["session"]!.fields["minutes"]).toEqual({ type: "duration", max: 600 });
  });

  it("keep through a retype from words what reads as one, and clear the rest", () => {
    const before = sessions() as unknown as { kinds: { session: { fields: Record<string, unknown> } } };
    before.kinds.session.fields["phone"] = { type: "string" };
    before.kinds.session.fields["length"] = { type: "string" };
    const plan = planMigration(before as never, sessions(), {
      nodes: [
        { id: "a", kind: "session", name: "A", phone: "555 123 4567", length: "1h 30m" },
        { id: "b", kind: "session", name: "B", phone: "ask Sam", length: "a while" },
      ],
      edges: [],
    });
    expect(plan.counts.cleared).toBe(2);
    expect(plan.counts.coerced).toBeGreaterThanOrEqual(1);
  });

  it("are read by a record's facts in words, a phone and a place with where they lead", () => {
    const app = compiled();
    const definition = app.schema.tryDefinition("session");
    const node = { id: "s1", kind: "session", name: "Kickoff", phone: "5551234567", venue: "Town Hall", length: 90 };
    const read = readableFields(node, definition, { locale: "en-US" });
    expect(read.find((f) => f.key === "phone")).toMatchObject({ value: "(555) 123-4567", stored: "5551234567", href: "tel:5551234567" });
    expect(read.find((f) => f.key === "venue")).toMatchObject({ value: "Town Hall", href: expect.stringMatching(/^https:\/\/(maps\.apple\.com\/\?q=|www\.google\.com\/maps\/search\/\?api=1&query=)Town%20Hall$/) });
    expect(read.find((f) => f.key === "length")).toMatchObject({ value: "1 h 30 min", stored: "90", alone: "Length 1 h 30 min" });
    expect(read.find((f) => f.key === "length")?.href).toBeUndefined();
  });

  it("are said by a card's field blocks, a phone and a place as links", () => {
    const app = compiled();
    const node = { id: "s1", kind: "session", name: "Kickoff", phone: "+44 20 7946 0958", venue: "Town Hall", length: 45 };
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [node], edges: [] } as never });
    const [, phone, venue, length] = resolveBlocks(compileBlocks([{ title: "{name}" }, { field: "phone" }, { field: "venue" }, { field: "length" }]), blockContextFor(store, null, node));
    expect(phone).toMatchObject({ t: "field", text: "+44 20 7946 0958", href: "tel:+442079460958" });
    expect(venue).toMatchObject({ t: "field", text: "Town Hall", href: expect.stringContaining("Town%20Hall") });
    expect(length).toMatchObject({ t: "field", text: "45 min" });
    expect((length as { href?: string }).href).toBeUndefined();
  });

  it("sum to a duration: a computed sum of durations, and durations added or taken apart, are said as one; a duration times a number is not", () => {
    const app = compiled();
    const store = new Store<AnySchema>({
      schema: app.schema,
      mutations: app.mutations ?? [],
      snapshot: {
        nodes: [
          { id: "p", kind: "project", name: "Launch", budget: 600 },
          { id: "a", kind: "session", name: "A", length: 90 },
          { id: "b", kind: "session", name: "B", length: 45 },
        ],
        edges: [
          { id: "e1", kind: "sessions", from: "p", to: "a" },
          { id: "e2", kind: "sessions", from: "p", to: "b" },
        ],
      } as never,
    });
    const project = app.schema.tryDefinition("project");
    expect(fieldSays(project, "spent")).toBe("duration");
    expect(fieldSays(project, "left")).toBe("duration");
    expect(fieldSays(project, "count")).toBeUndefined();
    const session = app.schema.tryDefinition("session");
    expect(fieldSays(session, "doubled")).toBe("duration");
    expect(fieldSays(session, "rate")).toBeUndefined();
    const node = store.graph.getNode("p")!;
    const [, spent, left] = resolveBlocks(compileBlocks([{ title: "{name}" }, { field: "spent" }, { field: "left" }]), blockContextFor(store, null, node));
    expect(spent).toMatchObject({ t: "field", text: "2 h 15 min" });
    expect(left).toMatchObject({ t: "field", text: "7 h 45 min" });
    // Read by a record's facts as worked out for it.
    expect(readableFields({ ...node, spent: 135 }, app.schema.tryDefinition("project"), { locale: "en-US" }).find((f) => f.key === "spent")).toMatchObject({ value: "2 h 15 min" });
  });

  it("keep their durations said through a compiled app handed to a page", () => {
    const result = compileDocument(sessions(), { today: () => "2026-10-13" });
    if (!result.ok) throw new Error("compiles");
    const again = appFrom(JSON.parse(JSON.stringify(serializeCompiled(result))));
    if (!again.ok) throw new Error("builds");
    expect(fieldSays(again.app.schema.tryDefinition("project"), "spent")).toBe("duration");
    expect(typedFieldOf((again.app.schema.tryDefinition("session")!.fields as { shape: Record<string, unknown> }).shape["length"])).toBe("duration");
  });

  it("are read from a spreadsheet's cells, and a cell that is none is refused in words", () => {
    expect(coerceCell({ type: "phone" }, " 555-123-4567 ", "Phone")).toEqual({ ok: true, value: "555-123-4567" });
    expect(coerceCell({ type: "phone" }, 5551234567, "Phone")).toEqual({ ok: true, value: "5551234567" });
    expect(coerceCell({ type: "phone" }, "ask Sam", "Phone")).toEqual({ ok: false, why: "“ask Sam” under Phone is not a phone number" });
    expect(coerceCell({ type: "place" }, " Town Hall ", "Venue")).toEqual({ ok: true, value: "Town Hall" });
    expect(coerceCell({ type: "duration" }, "1h 30m", "Length")).toEqual({ ok: true, value: 90 });
    expect(coerceCell({ type: "duration" }, "1:30:00", "Length")).toEqual({ ok: true, value: 90 });
    expect(coerceCell({ type: "duration" }, 45, "Length")).toEqual({ ok: true, value: 45 });
    expect(coerceCell({ type: "duration" }, "a while", "Length")).toEqual({ ok: false, why: "“a while” under Length is not a length of time, like 1h 30m or 90 (minutes)" });
  });

  it("are written as TypeScript by graview types: a phone and a place as strings, a duration as a number of minutes", () => {
    const types = documentTypes(sessions());
    expect(types).toMatch(/A phone number[^\n]*\n\s*readonly phone\?: string;/);
    expect(types).toMatch(/maps app[^\n]*\n\s*readonly venue\?: string;/);
    expect(types).toMatch(/whole minutes[^\n]*\n\s*readonly length\?: number;/);
  });

  it("sort a list of durations as numbers", () => {
    const store = storeOf(compiled());
    store.apply({ name: "edit-session", args: { id: "s1", length: 600 } });
    expect(typeof store.graph.getNode("s1")?.["length"]).toBe("number");
  });
});

describe("a TypeScript declaration's phone, place and duration fields", () => {
  const session = defineNode("session", { fields: z.object({ name: z.string(), phone: phoneField().optional().describe("who to call"), venue: placeField().optional(), length: durationField() }) });

  it("are marked through optional and describe, and written as a document's", () => {
    expect(typedFieldOf(session.fields.shape.phone)).toBe("phone");
    expect(typedFieldOf(session.fields.shape.venue)).toBe("place");
    expect(typedFieldOf(session.fields.shape.length)).toBe("duration");
    expect(typedFieldOf(z.string())).toBeUndefined();
    expect(fieldSpecOf(durationField())).toEqual({ type: "duration", required: true });
    const { document, findings } = toDocument(defineApp({ name: "sessions", schema: createSchema([session]) }));
    expect(findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(document.kinds["session"]!.fields).toMatchObject({ phone: { type: "phone", description: "who to call" }, venue: { type: "place" }, length: { type: "duration", required: true } });
  });

  it("refuse what is none", () => {
    expect(phoneField().safeParse("555 1234").success).toBe(true);
    expect(phoneField().safeParse("call me").success).toBe(false);
    expect(placeField().safeParse("").success).toBe(false);
    expect(durationField().safeParse(90).success).toBe(true);
    expect(durationField().safeParse(1.5).success).toBe(false);
  });

  it("say a computed field declared as: \"duration\" as a duration, and read nothing from an expression's words", () => {
    const week = defineNode("week", {
      fields: z.object({ name: z.string(), extra: durationField().optional() }),
      edges: { sessions: { to: ["session"] } },
      computed: { total: { expr: "sum(out('sessions'), length)", as: "duration" }, guessed: "sum(out('sessions'), length)", said: { expr: "extra * 2", as: "duration" }, count: "count(out('sessions'))" },
    });
    createSchema([session, week]);
    expect(fieldSays(week, "total")).toBe("duration");
    expect(fieldSays(week, "said")).toBe("duration");
    // A TypeScript declaration has no compile step to read its parse: it says what it works out.
    expect(fieldSays(week, "guessed")).toBeUndefined();
    expect(fieldSays(week, "count")).toBeUndefined();
  });

  it("read a document's computed durations from the parsed expression, not its words", () => {
    const doc = sessions() as unknown as { kinds: Record<string, { computed: Record<string, string> }> };
    // Words that looked like a sum of durations to a reading of the text, and are not one.
    doc.kinds["project"]!.computed = {
      spent: "sum(out('sessions'), length)",
      negated: "-spent",
      across: "budget - sum(in('sessions'), length)",
      ratio: "spent / 2",
    };
    const project = compiled(doc).schema.tryDefinition("project");
    expect(fieldSays(project, "spent")).toBe("duration");
    expect(fieldSays(project, "negated")).toBe("duration");
    expect(fieldSays(project, "across")).toBeUndefined();
    expect(fieldSays(project, "ratio")).toBeUndefined();
  });

  it("are said by a record's facts as a document's are", () => {
    const read = readableFields({ id: "s", kind: "session", name: "Kickoff", phone: "555 123 4567", length: 135 }, session, { locale: "en-US" });
    expect(read.find((f) => f.key === "phone")).toMatchObject({ value: "(555) 123-4567", href: "tel:5551234567" });
    expect(read.find((f) => f.key === "length")).toMatchObject({ value: "2 h 15 min" });
  });
});
