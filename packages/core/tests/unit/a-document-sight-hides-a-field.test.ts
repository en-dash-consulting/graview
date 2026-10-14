import { describe, expect, it } from "vitest";
import "../../src/field-sight.js";
import { checkApp, compileDocument } from "../../src/check.js";
import { computedValues } from "../../src/blocks.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { keptArguments } from "../../src/forms.js";
import { importRows, ImportMappingError } from "../../src/import/index.js";
import { checkApp as checkTs } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { coach, MUTATIONS, parent, policy, schema, world } from "../support/hidden-phones.js";

/**
 * A SIGHT THAT HIDES A FIELD, SAID IN A DOCUMENT AND ASKED OF BY EVERY
 * SURFACE THAT IS NOT THE SEAT VIEW ITSELF (Roadmap f-field-sight): a
 * document says `hide` (or `fields`) and an edit adds one; a computed field
 * is worked out over what the seat is served; `graview check` names a
 * field a sight misspells, one a record cannot do without, and a label that
 * reads one; a form does not ask for a field the seat may not write, and an
 * import refuses a column that goes to one as it refuses a column that goes
 * to no field at all.
 */
const roster: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Roster",
  kinds: {
    person: { noun: "person", plural: "people", people: true, fields: { name: { type: "string", required: true } } },
    player: {
      noun: "player",
      plural: "players",
      label: "{name}",
      fields: { name: { type: "string", required: true }, phone: { type: "string" }, medical: { type: "text" } },
      computed: { reach: { expr: "either(phone, 'no number')", label: "How to reach them" } },
    },
  },
  acts: { "add-player": { title: "Add a player", creates: "player" } },
  roles: ["coach", "parent"],
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["coach"], kinds: ["player", "person"] },
      { roles: ["parent"], kinds: ["player"], hide: ["phone", "medical"] },
      { roles: ["parent"], kinds: ["person"] },
    ],
  },
} as unknown as GraviewDocument;

function opened(document: GraviewDocument): Store<AnySchema> {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: { nodes: [{ id: "player:ann", kind: "player", name: "Ann", phone: "555 0101", medical: "asthma" }] as never, edges: [] },
  });
}

describe("a document's sight that hides a field", () => {
  it("compiles, and serves a parent each player without the fields it hides", () => {
    const store = opened(roster);
    expect(store.seenBy(parent).graph.getNode("player:ann")).toEqual({ id: "player:ann", kind: "player", name: "Ann" });
    expect(store.seenBy(coach).graph.getNode("player:ann")).toMatchObject({ phone: "555 0101" });
  });

  it("works a computed field out over what the seat is served: a parent's reads no phone number", () => {
    const store = opened(roster);
    const reach = (seat: Principal) => {
      const graph = store.seenBy(seat).graph;
      return computedValues(store.schema, graph as never, graph.getNode("player:ann") as never).values["reach"];
    };
    expect(reach(coach)).toBe("555 0101");
    expect(reach(parent)).toBe("no number");
  });

  it("is added by an edit, said in words, and refused when it names a field the kind does not have", () => {
    const plain = { ...roster, policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: "*", kinds: ["player", "person"] }] } } as unknown as GraviewDocument;
    const added = editDocument(plain, [{ op: "add-sight", roles: ["parent"], kinds: ["player"], hide: ["phone"] }]);
    expect(added.ok).toBe(true);
    if (added.ok) {
      expect(added.said.join(" ")).toContain("A parent sees players, without their phone.");
      expect(added.document.policy?.sees?.at(-1)).toEqual({ roles: ["parent"], kinds: ["player"], hide: ["phone"] });
    }
    const allowed = editDocument(plain, [{ op: "add-sight", roles: ["parent"], kinds: ["player"], fields: ["name"] }]);
    expect(allowed.ok && allowed.said.join(" ")).toContain("only their name");
    const wrong = editDocument(plain, [{ op: "add-sight", roles: ["parent"], kinds: ["player"], hide: ["phnoe"] }]);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.findings[0]).toMatchObject({ code: "sight-field" });
  });

  it("is checked: a misspelled field, a field a record cannot do without, and a label that reads a hidden field", () => {
    // `graview check` judges a document as it compiles it: an error stops the compile, a warning rides along.
    const findings = (document: unknown) => {
      const compiled = compileDocument(document as GraviewDocument);
      const all = compiled.ok ? checkApp(compiled.app).findings : compiled.findings;
      return all.flatMap((finding) => {
        const code = finding.code.replace(/^check:/, "");
        return code.startsWith("sight-") ? [{ ...finding, code }] : [];
      });
    };
    expect(findings(roster)).toEqual([]);
    const sees = (sight: object) => ({ ...roster, policy: { ...roster.policy, sees: [...roster.policy!.sees!.slice(0, 1), sight, ...roster.policy!.sees!.slice(2)] } });
    expect(findings(sees({ roles: ["parent"], kinds: ["player"], hide: ["phnoe"] })).map((one) => one.code)).toEqual(["sight-names-an-unknown-field"]);
    expect(findings(sees({ roles: ["parent"], kinds: ["player"], hide: ["name"] }))).toContainEqual(expect.objectContaining({ code: "sight-hides-a-required-field", severity: "error" }));
    const labeled = { ...roster, kinds: { ...roster.kinds, player: { ...roster.kinds["player"]!, label: "{name} ({phone})" } } };
    expect(findings(labeled)).toEqual([expect.objectContaining({ code: "sight-hides-a-labeled-field", severity: "warning" })]);
  });
});

describe("a form and an import under a sight that hides a field", () => {
  const add = MUTATIONS.find((one) => one.name === "add-contact")!;
  const set = MUTATIONS.find((one) => one.name === "set-phone")!;

  it("does not ask a seat for a field it may not write — on the record it acts on, or one it makes", () => {
    const store = world("555 0101");
    expect([...keptArguments(store, parent, add as never)]).toEqual(["phone"]);
    expect([...keptArguments(store, parent, set as never, "player:ann")]).toEqual(["phone"]);
    // Pat's own child is shown whole, so the form asks for her phone.
    expect([...keptArguments(store, parent, set as never, "player:bea")]).toEqual([]);
    expect([...keptArguments(store, coach, set as never, "player:ann")]).toEqual([]);
  });

  it("refuses an import column that goes to a hidden field as it refuses one that goes to no field", () => {
    const store = world(undefined);
    const refused = (mapping: Record<string, unknown>) => {
      try {
        importRows(store, "contact", [{ Name: "Cal", Phone: "555 0404" }], mapping as never, { by: parent });
        return undefined;
      } catch (error) {
        return error instanceof ImportMappingError ? error.message.replace(/phone|fax/g, "<field>") : String(error);
      }
    };
    expect(refused({ Name: "name", Phone: "phone" })).toBeDefined();
    expect(refused({ Name: "name", Phone: "phone" })).toBe(refused({ Name: "name", Phone: "fax" }));
    expect(refused({ Name: "name", Phone: { field: "phone" } })).toBe(refused({ Name: "name", Phone: { field: "fax" } }));
    expect(() => importRows(store, "contact", [{ Name: "Cal", Phone: "555 0404" }], { Name: "name", Phone: "phone" } as never, { by: coach })).not.toThrow();
  });

  it("is checked in a TypeScript declaration too: the contact's label reads the phone a parent may not see", () => {
    const result = checkTs({ name: "roster", schema, mutations: MUTATIONS, policy } as never);
    expect(result.findings.filter((finding) => finding.code.startsWith("sight-"))).toEqual([expect.objectContaining({ code: "sight-hides-a-labeled-field", where: "contact.label" })]);
  });
});
