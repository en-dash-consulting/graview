import { createSchema, defineNode, Store, type AnySchema, type Author, type Policy, type Principal } from "@graview/core";
import { declineSuggestion, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/*
 * THE APP'S OWN ACTOR SUGGESTS THROUGH ITS TOOLS. A host that judges the
 * graph off the page — a schedule, an alarm — reaches the store the way an
 * agent does, and leaves its changes for a person with `suggest_changes`.
 * Only an author that says `automated: true` is offered it; a chat seat
 * or a person asking for it is told it is the actor's.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }), edges: { supplies: { to: ["event"] } } });
const event = defineNode("event", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor, event]);
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const seat: Author = { kind: "agent", id: "claude", name: "Claude" };
const storeOf = () =>
  new Store<AnySchema>({
    schema,
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });
const link = { calls: [{ act: "connect-vendor-supplies", args: { id: "vendor:quill", to: "event:gala" } }], basis: "Quill's invoice names the gala", confidence: 0.6 };

describe("suggest_changes", () => {
  it("keeps the actor's calls as one suggestion that changes nothing, with its basis and confidence", async () => {
    const store = storeOf();
    const runtime = createToolRuntime(store, { author: actor });
    expect(runtime.definitions.map((tool) => tool.name)).toContain("suggest_changes");
    const answer = await runtime.call("suggest_changes", link);
    expect(answer.ok).toBe(true);
    expect(store.graph.allEdges()).toEqual([]);
    const [waiting] = suggestions(store);
    expect(waiting).toMatchObject({ author: actor, lineage: { basis: "Quill's invoice names the gala", confidence: 0.6 }, calls: [{ name: "connect-vendor-supplies", args: { id: "vendor:quill", to: "event:gala" } }] });
    expect((answer as { data: { suggestion: string } }).data.suggestion).toBe(waiting!.id);
  });

  it("is refused what a person declined, in a sentence", async () => {
    const store = storeOf();
    const runtime = createToolRuntime(store, { author: actor });
    await runtime.call("suggest_changes", link);
    declineSuggestion(store, suggestions(store)[0]!.id, { author: { kind: "human", id: "nick" } });
    expect(await runtime.call("suggest_changes", link)).toMatchObject({ ok: false, error: expect.stringMatching(/declined/) });
  });

  it("is not offered to a seat that is not the app's own actor, and refuses one that asks", async () => {
    const runtime = createToolRuntime(storeOf(), { author: seat });
    expect(runtime.definitions.map((tool) => tool.name)).not.toContain("suggest_changes");
    expect(toolDefinitions({ schema }, seat).definitions.map((tool) => tool.name)).not.toContain("suggest_changes");
    expect(toolDefinitions({ schema }, actor).definitions.map((tool) => tool.name)).toContain("suggest_changes");
    expect(await runtime.call("suggest_changes", link)).toMatchObject({ ok: false, reason: "forbidden", error: expect.stringMatching(/Only the app's own actor/) });
  });
});

/*
 * A SEAT THAT MAY NOT MAKE THE CHANGE VOTES THROUGH THE SAME TOOLS (Roadmap
 * f-suggestion-votes): accept_suggestion answers `voted: "for"` and keeps
 * nothing of the change, decline_suggestion `voted: "against"`, and
 * list_suggestions counts the seat's own vote in each suggestion's tally.
 */
describe("accept_suggestion and decline_suggestion from a seat that may not make the change", () => {
  const policy: Policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] };
  const ria: Author = { kind: "agent", id: "claude", name: "Claude", onBehalfOf: { kind: "human", id: "ria", name: "Ria", roles: ["reader"] } };

  it("answer with the seat's vote, which list_suggestions counts, and the suggestion still waits", async () => {
    const store = new Store<AnySchema>({ schema, policy, snapshot: storeOf().graph.snapshot() });
    await createToolRuntime(store, { author: actor }).call("suggest_changes", link);
    const [waiting] = suggestions(store);
    const reader = createToolRuntime(store, { author: ria });
    const accepted = (await reader.call("accept_suggestion", { suggestion: waiting!.id })) as { ok: boolean; data: { voted?: string } };
    expect(accepted.ok).toBe(true);
    expect(accepted.data.voted).toBe("for");
    expect(store.graph.allEdges()).toEqual([]);
    expect(suggestions(store)).toHaveLength(1);
    const listed = (await reader.call("list_suggestions", {})) as { data: { suggestions: { tally: unknown }[] } };
    expect(listed.data.suggestions[0]!.tally).toEqual({ for: 1, against: 0, mine: "for" });
    const declined = (await reader.call("decline_suggestion", { suggestion: waiting!.id })) as { data: { voted?: string } };
    expect(declined.data.voted).toBe("against");
    expect(suggestions(store)).toHaveLength(1);
    // The keeper decides it as ever: no vote, the change made.
    const keeper = createToolRuntime(store, { author: { kind: "human", id: "kay", roles: ["keeper"] } as Principal });
    const made = (await keeper.call("accept_suggestion", { suggestion: waiting!.id })) as { ok: boolean; data: { voted?: string } };
    expect(made.ok).toBe(true);
    expect(made.data.voted).toBeUndefined();
    expect(store.graph.allEdges()).toHaveLength(1);
  });
});
