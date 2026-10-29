import { createSchema, defineNode, Store, type AnySchema, type Policy, type Principal } from "@graview/core";
import { acceptSuggestion, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/*
 * AN AGENT PROPOSES CHANGES FOR THE PERSON IT ACTS FOR (Roadmap
 * f-proposals-for-review). A seat acting for somebody the policy lets
 * propose an act they may not run (a grant's `propose`) is offered
 * `propose_changes`: its calls kept as the person's proposal, which
 * changes nothing until somebody who may run them accepts it, and which
 * list_suggestions says who proposed. A seat that may propose nothing is
 * not offered it.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }), edges: { supplies: { to: ["event"] } } });
const event = defineNode("event", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor, event]);
const policy: Policy = { grants: [{ roles: ["keeper"], mutations: "*" }, { roles: ["helper"], mutations: [], propose: ["connect-vendor-supplies"] }] };
const ada: Principal = { kind: "human", id: "ada", name: "Ada", roles: ["helper"] };
const agent: Principal = { kind: "agent", id: "claude", name: "Claude", onBehalfOf: ada };
const kay: Principal = { kind: "human", id: "kay", name: "Kay", roles: ["keeper"] };
const storeOf = () =>
  new Store<AnySchema>({
    schema,
    policy,
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });
const link = { calls: [{ act: "connect-vendor-supplies", args: { id: "vendor:quill", to: "event:gala" } }], intent: "Quill printed the invitations" };

describe("propose_changes", () => {
  it("is offered to an agent acting for somebody who may propose, and to nobody who may propose nothing", () => {
    expect(createToolRuntime(storeOf(), { author: agent }).definitions.map((tool) => tool.name)).toContain("propose_changes");
    expect(toolDefinitions({ schema, policy }, agent).definitions.map((tool) => tool.name)).toContain("propose_changes");
    expect(createToolRuntime(storeOf(), { author: kay }).definitions.map((tool) => tool.name)).not.toContain("propose_changes");
    expect(toolDefinitions({ schema }, agent).definitions.map((tool) => tool.name)).not.toContain("propose_changes");
  });

  it("keeps the calls as the person's proposal, changing nothing until a reviewer accepts it", async () => {
    const store = storeOf();
    const runtime = createToolRuntime(store, { author: agent });
    const answer = await runtime.call("propose_changes", link);
    expect(answer.ok).toBe(true);
    expect(store.graph.allEdges()).toEqual([]);
    const listed = await createToolRuntime(store, { author: kay }).call("list_suggestions", {});
    expect((listed as { data: { suggestions: unknown[] } }).data.suggestions[0]).toMatchObject({ proposedBy: "ada", by: "Claude, for Ada" });
    const [waiting] = suggestions(store, kay);
    expect((answer as { data: { proposal: string } }).data.proposal).toBe(waiting!.id);
    const made = acceptSuggestion(store, waiting!.id, { author: kay });
    expect(made.ops[0]).toMatchObject({ author: kay, lineage: { suggestion: waiting!.id, proposedBy: "ada", basis: "Quill printed the invitations" } });
    expect(store.graph.allEdges()).toHaveLength(1);
  });

  it("is refused, in a sentence, an act the person may neither run nor propose", async () => {
    const runtime = createToolRuntime(storeOf(), { author: agent });
    const answer = await runtime.call("propose_changes", { calls: [{ act: "edit-event", args: { id: "event:gala", label: "Gala" } }] });
    expect(answer).toMatchObject({ ok: false, error: expect.stringMatching(/Not permitted to propose this/) });
  });
});
