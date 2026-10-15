import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { describePlace } from "../../src/describe.js";
import { defaultLabelField } from "../../src/document/compiled.js";
import { readableFields } from "../../src/schema/reading.js";
import { Store, fieldWords, labelOf, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * A FIELD CALLED `label` IS AN ORDINARY FIELD WHERE THE KIND IS NAMED BY
 * ANOTHER (2026-10-15, The Beatles).
 *
 * A release kept its record label in a field called `label` ("Parlophone")
 * and was named by its `name`. Every release in a coverage grid read
 * "Parlophone", because the grid took a record's `label` value before the
 * kind's own naming; and the record's page never said the record label,
 * because a field called `label` was always taken to be the name. A kind
 * is named by `name` (then `title`) before a field called `label` unless
 * its label template says otherwise, and a `label` field it is not named by
 * is said as "Label", like any other field.
 */
const document = JSON.parse(readFileSync(new URL("./fixtures/beatles.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/beatles.seed.json", import.meta.url), "utf8"));
const compiled = compileDocument(document, { today: () => "2026-10-15" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const release = store.graph.getNode("release-abbey-road")! as { id: string; kind: string } & Record<string, unknown>;

describe("a field called label on a kind named by its name", () => {
  it("names the record by its name", () => {
    expect(labelOf(app.schema.tryDefinition("release"), release)).toBe("Abbey Road");
  });

  it("names each row of a coverage grid by its name, not its record label", () => {
    const said = describePlace(store, owner, "releases-by-era", { app, width: 1440, today: "2026-10-15" });
    if (!said.ok) throw new Error(said.error);
    expect(said.description.text).toContain("Abbey Road: The studio years");
    expect(said.description.text).not.toContain("Parlophone:");
  });

  it("says the record label as a fact, called Label", () => {
    const definition = app.schema.tryDefinition("release");
    const facts = readableFields(release, definition);
    expect(facts.map((fact) => [fact.label, fact.value])).toContainEqual(["Label", "Parlophone"]);
    expect(fieldWords(definition, "label")).toBe("Label");
  });

  it("takes name or title before a field called label when nothing is required", () => {
    expect(defaultLabelField({ fields: { label: { type: "string" }, name: { type: "string" } } } as never)).toBe("name");
    expect(defaultLabelField({ fields: { label: { type: "string" }, title: { type: "string" } } } as never)).toBe("title");
    expect(defaultLabelField({ fields: { label: { type: "string", required: true }, notes: { type: "text", required: true } } } as never)).toBe("label");
  });

  it("keeps a label template's word: a kind named by {label} is named by it", () => {
    const named = structuredClone(document);
    named.kinds.release.label = "{label}";
    const again = compileDocument(named, { today: () => "2026-10-15" });
    if (!again.ok) throw new Error("did not compile");
    const definition = (again.app as GraviewApp<AnySchema>).schema.tryDefinition("release");
    expect(labelOf(definition, release)).toBe("Parlophone");
    expect(readableFields(release, definition).map((fact) => fact.key)).not.toContain("label");
  });
});
