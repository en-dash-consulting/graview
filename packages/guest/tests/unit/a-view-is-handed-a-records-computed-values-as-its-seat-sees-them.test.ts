import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import type { GraviewDocument } from "@graview/core/document";
import "@graview/core/field-sight";
import { describe, expect, it } from "vitest";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { computedOn } from "../../src/host/computed.js";
import { readsComputed, workerViewProps as handed, type WorkerViewManifest, type WorkerViewPropsInput } from "../../src/host/manifest.js";

/**
 * A VIEW IS HANDED A RECORD'S COMPUTED VALUES AS ITS SEAT SEES THEM
 * (Roadmap f-computed-in-views). A kind's computed values showed on the
 * built-in pages and were missing from the records a worker view was
 * handed, so a view counted again from the edges. Now each record a view
 * is handed carries its computed values beside its fields, worked out over
 * what the viewer may see: a field a sight hides, and a record it hides,
 * add nothing to one, so a value never says what its seat was not served.
 */
const roster = {
  format: "graview-document",
  formatVersion: 1,
  name: "Roster",
  kinds: {
    person: { noun: "person", plural: "people", people: true, fields: { name: { type: "string", required: true } } },
    team: {
      noun: "team",
      plural: "teams",
      label: "{name}",
      fields: { name: { type: "string", required: true } },
      edges: { has: { to: ["player", "prospect"] } },
      computed: { squad: { expr: "count(out('has'))", label: "Players" }, captain: { expr: "first(sort(out('has'), [name]))", label: "Captain" } },
    },
    player: {
      noun: "player",
      plural: "players",
      label: "{name}",
      fields: { name: { type: "string", required: true }, phone: { type: "string" } },
      computed: { reach: { expr: "either(phone, 'no number')", label: "How to reach them" } },
    },
    prospect: { noun: "prospect", plural: "prospects", label: "{name}", fields: { name: { type: "string", required: true } } },
  },
  acts: { "add-player": { title: "Add a player", creates: "player" } },
  roles: ["coach", "parent"],
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["coach"], kinds: ["player", "prospect", "person", "team"] },
      { roles: ["parent"], kinds: ["player"], hide: ["phone"] },
      { roles: ["parent"], kinds: ["person", "team"] },
    ],
  },
} as unknown as GraviewDocument;

const coach: Principal = { kind: "human", id: "person:cora", roles: ["coach"] };
const parent: Principal = { kind: "human", id: "person:pat", roles: ["parent"] };

function opened(): Store<AnySchema> {
  const compiled = compileDocument(roster);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: {
      nodes: [
        { id: "team:owls", kind: "team", name: "Owls" },
        { id: "player:ann", kind: "player", name: "Ann", phone: "555 0101" },
        { id: "prospect:aaron", kind: "prospect", name: "Aaron" },
        { id: "person:cora", kind: "person", name: "Cora" },
        { id: "person:pat", kind: "person", name: "Pat" },
      ] as never,
      edges: [
        { kind: "has", from: "team:owls", to: "player:ann" },
        { kind: "has", from: "team:owls", to: "prospect:aaron" },
      ] as never,
    },
  });
}

/** What a view is handed as the page hands it: with what works out its records' computed values. */
const workerViewProps = (store: Store<AnySchema>, principal: Principal, given: WorkerViewPropsInput) => handed(store, principal, { ...given, computed: computedOn(store.schema) });

const players: WorkerViewManifest = { name: "players", attach: "player", cardinality: "many" };
const team: WorkerViewManifest = { name: "team-sheet", attach: "team", cardinality: "one", reads: { kinds: ["player", "prospect"], edges: ["has"] } };

describe("the records a view is handed", () => {
  it("carry their computed values beside their fields, as the page shows them", () => {
    const props = workerViewProps(opened(), coach, { manifest: players });
    expect(props.nodes!.find((one) => one.id === "player:ann")).toMatchObject({ name: "Ann", phone: "555 0101", reach: "555 0101" });
    const sheet = workerViewProps(opened(), coach, { manifest: team, input: { node: { id: "team:owls" } } });
    // A count the view would have made from the edges, and a record a value names as its id, kind and name.
    expect(sheet.node).toMatchObject({ name: "Owls", squad: 2, captain: { id: "prospect:aaron", kind: "prospect", label: "Aaron" } });
  });

  it("never carry a computed value worked out from a field the viewer's sight hides", () => {
    const props = workerViewProps(opened(), parent, { manifest: players });
    const ann = props.nodes!.find((one) => one.id === "player:ann");
    expect(ann).not.toHaveProperty("phone");
    expect(ann).toMatchObject({ reach: "no number" });
    expect(JSON.stringify(props)).not.toContain("555 0101");
  });

  it("never carry a computed value worked out from a record the viewer may not see", () => {
    const sheet = workerViewProps(opened(), parent, { manifest: team, input: { node: { id: "team:owls" } } });
    expect(sheet.node).toMatchObject({ squad: 1, captain: { id: "player:ann", label: "Ann" } });
    expect(JSON.stringify(sheet)).not.toContain("Aaron");
    expect(JSON.stringify(sheet)).not.toContain("prospect:aaron");
  });

  it("are worked out only for a view whose kinds have computed values, which the host fetches the evaluator for", () => {
    expect(readsComputed(opened(), players)).toBe(true);
    expect(readsComputed(opened(), { name: "people", attach: "person", cardinality: "many" })).toBe(false);
    expect(readsComputed(opened(), { name: "front", attach: "home", cardinality: "many", reads: { kinds: ["team"] } })).toBe(true);
  });

  it("are what a view run headless draws from, as the seat it is run as", async () => {
    const source = "graview.onProps((p) => graview.render(graview.html`<p>${p.node.name}: ${p.node.squad} on the sheet</p>`));";
    const run = nodeIsolate();
    const asCoach = await runWorkerViewHeadless({ store: opened(), principal: coach, run, manifest: team, source, input: { node: { id: "team:owls" } } });
    const asParent = await runWorkerViewHeadless({ store: opened(), principal: parent, run, manifest: team, source, input: { node: { id: "team:owls" } } });
    if (!asCoach.ok || !asParent.ok) throw new Error(JSON.stringify([asCoach, asParent]));
    expect(asCoach.description.text).toContain("Owls: 2 on the sheet");
    expect(asParent.description.text).toContain("Owls: 1 on the sheet");
    expect(JSON.stringify(asParent)).not.toContain("Aaron");
  });
});
