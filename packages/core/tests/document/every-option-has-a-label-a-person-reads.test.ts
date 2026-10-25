import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { argumentWords } from "../../src/mutations/words.js";
import { arrange } from "../../src/arrange.js";
import { readableFields, valueWords } from "../../src/words.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * EVERY OPTION HAS A LABEL A PERSON READS (Roadmap f-option-labels). Option
 * values added to an enum field showed as their ids. An option is said by
 * the label its field gives it (`optionLabels`), else by its id spoken —
 * `state-sponsored` is "State sponsored" — on a record's facts, a form's
 * picker, a group's heading and a change's sentence; and `set-options`
 * carries a label for an option it adds, or for one already offered.
 */
const threats = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Threats",
    kinds: {
      actor: {
        fields: {
          name: { type: "string", required: true },
          motive: { type: "enum", options: ["espionage", "financial"] },
        },
      },
    },
    acts: { "add-actor": { title: "Add an actor", creates: "actor" } },
  }) as unknown as GraviewDocument;

function edited(edits: readonly unknown[]): { document: GraviewDocument; said: readonly string[] } {
  const outcome = editDocument(threats(), edits);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return { document: outcome.document, said: outcome.said };
}

function open(document: GraviewDocument) {
  const compiled = compileDocument(document, { today: () => "2026-10-25" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: { nodes: [], edges: [] } as never });
}

describe("an option added with a label", () => {
  const { document, said } = edited([{ op: "set-options", kind: "actor", field: "motive", add: ["state-sponsored", "hacktivism"], labels: { "state-sponsored": "State-sponsored" } }]);

  it("is kept with its label, and the edit says it", () => {
    const field = (document as unknown as { kinds: { actor: { fields: { motive: { options: string[]; optionLabels: Record<string, string> } } } } }).kinds.actor.fields.motive;
    expect(field.options).toEqual(["espionage", "financial", "state-sponsored", "hacktivism"]);
    expect(field.optionLabels).toEqual({ "state-sponsored": "State-sponsored" });
    expect(said.join(" ")).toContain(`"state-sponsored" (State-sponsored)`);
  });

  it("is said by its label on every face, and an option without one by its id spoken", () => {
    const store = open(document);
    const definition = store.schema.tryDefinition("actor");
    expect(valueWords(definition, "motive", "state-sponsored")).toBe("State-sponsored");
    expect(valueWords(definition, "motive", "hacktivism")).toBe("Hacktivism");
    expect(argumentWords(store.schema, store.allMutations().find((one) => one.name === "add-actor"), "motive").option("state-sponsored")).toBe("State-sponsored");
    store.apply({ name: "add-actor", args: { id: "actor:apt1", name: "APT1", motive: "state-sponsored" } });
    store.apply({ name: "add-actor", args: { id: "actor:fin7", name: "FIN7", motive: "financial" } });
    expect(readableFields(store.graph.getNode("actor:apt1") as never, definition).find((fact) => fact.key === "motive")?.value).toBe("State-sponsored");
    const grouped = arrange(store.graph.nodesOfKind("actor" as never) as never, { group: { by: "motive" } } as never, { schema: store.schema, graph: store.graph } as never);
    expect(grouped.groups.map((group) => group.label)).toEqual(expect.arrayContaining(["State-sponsored", "Financial"]));
    const changed = store.apply({ name: "edit-actor", args: { id: "actor:fin7", motive: "state-sponsored" } });
    expect(changed.ops[0]?.intent).toContain("State-sponsored");
  });

  it("is relabeled, or given back its id's words, by set-options alone", () => {
    const relabeled = editDocument(document, [{ op: "set-options", kind: "actor", field: "motive", labels: { "state-sponsored": null, hacktivism: "Hacktivist" } }]);
    if (!relabeled.ok) throw new Error(JSON.stringify(relabeled.findings));
    const definition = open(relabeled.document).schema.tryDefinition("actor");
    expect(valueWords(definition, "motive", "state-sponsored")).toBe("State sponsored");
    expect(valueWords(definition, "motive", "hacktivism")).toBe("Hacktivist");
    expect(relabeled.said.join(" ")).toContain(`says "hacktivism" as Hacktivist`);
  });

  it("loses its label with the option, and a label for no option is refused", () => {
    const removed = editDocument(document, [{ op: "set-options", kind: "actor", field: "motive", remove: ["state-sponsored"] }]);
    if (!removed.ok) throw new Error(JSON.stringify(removed.findings));
    expect((removed.document as unknown as { kinds: { actor: { fields: { motive: Record<string, unknown> } } } }).kinds.actor.fields.motive).not.toHaveProperty("optionLabels");
    expect(editDocument(document, [{ op: "set-options", kind: "actor", field: "motive", labels: { ransom: "Ransom" } }]).ok).toBe(false);
    const written = { ...threats(), kinds: { actor: { fields: { name: { type: "string", required: true }, motive: { type: "enum", options: ["espionage"], optionLabels: { ransom: "Ransom" } } } } } } as unknown as GraviewDocument;
    expect(compileDocument(written, { today: () => "2026-10-25" }).ok).toBe(false);
  });
});
