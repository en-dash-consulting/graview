import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";

/*
 * A VIEW IS HANDED EACH OPTION'S LABEL (Roadmap f-option-labels). Option
 * values added to a choice showed as their ids in views: a record keeps
 * `state-sponsored`, and a view somebody else wrote had nothing but that
 * to draw. Its props now carry `choices`, kind → field → option → the
 * label every other face says ("State-sponsored", or "Hacktivism" for an
 * option given none), for the kinds of the records it is handed.
 */
const compiled = compileDocument(
  {
    format: "graview-document",
    formatVersion: 1,
    name: "Threats",
    kinds: {
      actor: {
        fields: {
          name: { type: "string", required: true },
          motive: { type: "enum", options: ["state-sponsored", "hacktivism"], optionLabels: { "state-sponsored": "State-sponsored" } },
        },
      },
      note: { fields: { text: { type: "string", required: true } } },
    },
    acts: { "add-actor": { title: "Add an actor", creates: "actor" } },
  },
  { today: () => "2026-10-25" },
);
if (!compiled.ok) throw new Error("the document compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const store = () =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    snapshot: { nodes: [{ id: "actor:apt1", kind: "actor", name: "APT1", motive: "state-sponsored" }], edges: [] } as never,
  });
const reader = { kind: "human" as const, id: "u:nick", roles: [] };

describe("a worker view's props", () => {
  it("carry each option of the handed records' choices by its label, the record keeping the option's id", () => {
    const manifest: WorkerViewManifest = { name: "actors", title: "Actors", attach: "actor", cardinality: "many" };
    const props = workerViewProps(store(), reader, { manifest });
    expect(props.nodes?.[0]).toMatchObject({ motive: "state-sponsored" });
    expect(props.choices).toEqual({ actor: { motive: { "state-sponsored": "State-sponsored", hacktivism: "Hacktivism" } } });
  });

  it("carry none for records with no choice", () => {
    const manifest: WorkerViewManifest = { name: "notes", title: "Notes", attach: "note", cardinality: "many" };
    expect(workerViewProps(store(), reader, { manifest })).not.toHaveProperty("choices");
  });
});
