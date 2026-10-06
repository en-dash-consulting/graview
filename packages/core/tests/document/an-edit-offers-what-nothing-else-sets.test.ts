import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { ActRefusal, refusalOf, Store, unwrittenFields, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * FR-110. A DERIVED EDIT OFFERS EVERY FIELD NOTHING ELSE REALLY SETS, AND
 * REFUSES WHAT IT CANNOT TAKE.
 *
 * From building En Dash Org on Graview Cloud: `note-strength` acts on a
 * person and makes a strength named `$name`. With no `writes` of its own,
 * the derived edit guessed from its argument names that it wrote the
 * person's name — so "Change the person" offered notes and role, and a
 * person could never be renamed. Then `edit-person { id, name }` parsed to
 * `{ id }` and threw a bare "Nothing to change", which the host could only
 * call something going wrong on its side.
 *
 * A document's act writes what its sets and effects set on its subject —
 * read off the act, never guessed from the names of its arguments.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const org = read("org.gdd.json");
const seed = read("org.seed.json");

function compiled(doc: unknown = org): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-06" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) => new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: structuredClone(seed) as never });
const refused = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected a refusal");
};

describe("an act that makes a record on another kind, with an argument named like a field of its subject", () => {
  it("writes nothing on its subject: what it sets is on the record it makes", () => {
    const app = compiled();
    expect(app.mutations!.find((m) => m.name === "note-strength")!.writes).toEqual([]);
    expect(app.mutations!.find((m) => m.name === "set-level")!.writes).toEqual(["level"]);
  });

  it("leaves the person's name to the derived edit, which offers name, role and notes", () => {
    const app = compiled();
    expect(unwrittenFields(app.schema, app.mutations ?? [], "person")).toEqual(["name", "role", "notes"]);
    const edit = storeOf(app).mutation("edit-person");
    expect(edit.writes).toEqual(["name", "role", "notes"]);
  });

  it("renames a person through the derived edit, and the strength it notes keeps its own name", () => {
    const store = storeOf(compiled());
    store.apply({ name: "note-strength", args: { id: "person-john", name: "Hiring", level: 4 } });
    store.apply({ name: "edit-person", args: { id: "person-john", name: "John H." } });
    expect(store.graph.getNode("person-john")).toMatchObject({ name: "John H.", role: "Head of Consulting Operations" });
    expect(store.graph.out("person-john", "strengths").map((s) => s["name"])).toContain("Hiring");
  });
});

describe("the derived edit's arguments", () => {
  it("refuses an argument it does not take as invalid, naming the arguments it does take", () => {
    const store = storeOf(compiled());
    const error = refused(() => store.apply({ name: "edit-person", args: { id: "person-john", colour: "red" } }));
    expect(refusalOf(error).reason).toBe("invalid");
    expect(refusalOf(error).sentence).toContain('does not take "colour"; it takes "id", "name", "role", "notes"');
    expect(store.graph.getNode("person-john")).toMatchObject({ name: "John Halberstadt" });
  });

  it("refuses a call that changes nothing with a typed refusal a host can show", () => {
    const store = storeOf(compiled());
    const error = refused(() => store.apply({ name: "edit-person", args: { id: "person-john" } }));
    expect(error).toBeInstanceOf(ActRefusal);
    expect(error).toMatchObject({ reason: "invalid", sentence: "Nothing to change — give at least one of name, role, notes a value." });
    expect(refusalOf(error)).toEqual({ reason: "invalid", sentence: "Nothing to change — give at least one of name, role, notes a value." });
  });
});

describe("a field an act sets on the record at the other end of a link (FR-115's setsOther)", () => {
  const doc = {
    format: "graview-document",
    formatVersion: 1,
    name: "Sharing",
    kinds: {
      person: { fields: { name: { type: "string", required: true } }, edges: { owns: { to: ["thing"] } } },
      thing: { fields: { name: { type: "string", required: true }, state: { type: "enum", options: ["open", "shared"], default: "open" } } },
    },
    acts: {
      "add-person": { creates: "person" },
      "add-thing": { creates: "thing" },
      share: { on: "person", connects: "owns", setsOther: { state: "shared" } },
    },
  };

  it("is written by that act, so the derived edit of the other kind does not offer it", () => {
    const app = compiled(doc);
    expect(app.mutations!.find((m) => m.name === "share")).toMatchObject({ writes: [], writesOther: { thing: ["state"] } });
    expect(unwrittenFields(app.schema, app.mutations ?? [], "thing")).toEqual(["name"]);
  });
});
