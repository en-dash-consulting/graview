import { readFileSync } from "node:fs";
import { Store, type AnySchema, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createToolRuntime } from "../../src/index.js";

/**
 * A SEAT READS ONLY THE MATCH IT GIVES IN (the Roadmap's "visibility scoped
 * by relation"). The Secret Santa document shows a participant a match only
 * via `givenBy`; an agent acting for Ann lists, searches, describes and
 * derives acts over what Ann may see — her own match, and never the one Bo
 * gives her.
 */
const santa = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/secret-santa.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(santa);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app;
const organizer: Principal = { kind: "human", id: "p_org", roles: ["organizer"] };
const helper: Principal = { kind: "agent", id: "helper", onBehalfOf: { kind: "human", id: "p_ann", roles: ["participant"] } };

function drawn() {
  const store = new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    policy: app.policy!,
    snapshot: { nodes: [{ id: "p_ann", kind: "participant", name: "Ann" }, { id: "p_bo", kind: "participant", name: "Bo" }] as never, edges: [] },
  });
  store.apply({ name: "draw", args: { note: "Ann for Bo", giver: "p_ann", receiver: "p_bo" } }, { author: organizer });
  store.apply({ name: "draw", args: { note: "Bo for Ann", giver: "p_bo", receiver: "p_ann" } }, { author: organizer });
  return store;
}

describe("an agent seat over a sight via a relation", () => {
  it("lists, searches and derives acts over the match its person gives in, and not the one they receive in", async () => {
    const store = drawn();
    const theirs = store.graph.in("p_ann", "givesTo")[0]!.id;
    const tools = createToolRuntime(store, { author: helper });
    for (const [name, args] of [
      ["get_graph", {}],
      ["search_graph", { query: "for" }],
      ["get_affordances", { selection: [theirs] }],
    ] as const) {
      const result = await tools.call(name, args);
      expect(result.ok, name).toBe(true);
      expect(JSON.stringify(result), name).not.toContain("Bo for Ann");
    }
    expect(JSON.stringify(await tools.call("get_graph", {}))).toContain("Ann for Bo");
  });

  it("answers its own draw of a match it does not give in as a change it cannot see, never the match's note", async () => {
    // A draw a participant may make too, so an agent acting for Cy can make what Cy's sight does not reach.
    const open = JSON.parse(JSON.stringify(santa));
    open.policy.grants.push({ roles: ["participant"], mutations: ["draw"] });
    const opened = compileDocument(open);
    if (!opened.ok) throw new Error(JSON.stringify(opened.findings));
    const store = new Store<AnySchema>({
      schema: opened.app.schema,
      mutations: opened.app.mutations ?? [],
      policy: opened.app.policy!,
      snapshot: { nodes: [{ id: "p_ann", kind: "participant", name: "Ann" }, { id: "p_bo", kind: "participant", name: "Bo" }, { id: "p_cy", kind: "participant", name: "Cy" }] as never, edges: [] },
    });
    const forCy: Principal = { kind: "agent", id: "helper", onBehalfOf: { kind: "human", id: "p_cy", roles: ["participant"] } };
    const result = await createToolRuntime(store, { author: forCy }).call("draw", { note: "Ann gives to Bo", giver: "p_ann", receiver: "p_bo" });
    expect(result.ok).toBe(true);
    expect((result as { data: { intent: string } }).data.intent).toBe("A change you cannot see");
    expect(JSON.stringify(result)).not.toContain("Ann gives to Bo");
  });
});
