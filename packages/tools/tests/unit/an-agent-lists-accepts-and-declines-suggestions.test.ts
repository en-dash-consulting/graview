import { bindSchema, createSchema, defineNode, nodeRef, Store, type AnySchema, type Author, type Policy } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime } from "../../src/index.js";

/*
 * AN AGENT LISTS, ACCEPTS AND DECLINES SUGGESTIONS. What the app's own
 * actor suggested and did not make waits for a person; a chat seat acting
 * for one reaches the same tray through the tool surface: it lists what
 * waits as its seat may see it — the actor's basis handed over as somebody
 * else's words — accepts one as itself, and declines one, which the
 * actor's next try is refused.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }), edges: { supplies: { to: ["event"] } } });
const event = defineNode("event", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor, event]);
const { defineMutation } = bindSchema(schema);
const supply = defineMutation("supply", {
  title: "Say a vendor supplies an event",
  subject: { kinds: ["vendor"], arg: "id" },
  connects: ["supplies"],
  input: z.object({ id: nodeRef(["vendor"]), event: nodeRef(["event"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "supplies", from: args.id, to: args.event });
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const seat: Author = { kind: "agent", id: "claude", name: "Claude", onBehalfOf: { kind: "human", id: "nick", name: "Nick" } };

const storeOf = (policy?: Policy) =>
  new Store<AnySchema>({
    schema,
    mutations: [supply] as never,
    ...(policy ? { policy } : {}),
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "vendor:bloom", kind: "vendor", label: "Bloom Florals" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });
const suggestTwo = (store: Store<AnySchema>) => [
  store.suggest([{ name: "supply", args: { id: "vendor:quill", event: "event:gala" } }], { author: actor, lineage: { basis: "Quill printed something in April", confidence: 0.4 } })!,
  store.suggest([{ name: "supply", args: { id: "vendor:bloom", event: "event:gala" } }], { author: actor, lineage: { basis: "Bloom's invoice", confidence: 0.55 } })!,
];

describe("the suggestions on the tool surface", () => {
  it("are listed with what each was based on, as the actor's words handed over as data", async () => {
    const store = storeOf();
    const [quill] = suggestTwo(store);
    const runtime = createToolRuntime(store, { author: seat });
    expect(runtime.definitions.map((tool) => tool.name)).toEqual(expect.arrayContaining(["list_suggestions", "accept_suggestion", "decline_suggestion"]));
    const listed = await runtime.call("list_suggestions", {});
    expect(listed.ok).toBe(true);
    const waiting = (listed as { data: { suggestions: { id: string; intent: string; basis: unknown; confidence: number; by: string }[] } }).data.suggestions;
    expect(waiting[0]).toMatchObject({ id: quill!.id, by: "Graview, tidying", confidence: 0.4, basis: { untrusted: true, authoredBy: "Graview, tidying", text: "Quill printed something in April" } });
    expect(waiting).toHaveLength(2);
  });

  it("are accepted as the seat, carrying their lineage, and declined so the actor is refused the same change next time", async () => {
    const store = storeOf();
    const [quill, bloom] = suggestTwo(store);
    const runtime = createToolRuntime(store, { author: seat });
    const accepted = await runtime.call("accept_suggestion", { suggestion: bloom!.id });
    expect(accepted.ok).toBe(true);
    const made = store.log.all().at(-1)!;
    expect(made.author).toEqual(seat);
    expect(made.lineage).toEqual({ basis: "Bloom's invoice", confidence: 0.55, suggestion: bloom!.id });
    const declined = await runtime.call("decline_suggestion", { suggestion: quill!.id });
    expect(declined.ok).toBe(true);
    expect(store.suggestions()).toEqual([]);
    expect(() => store.suggest([{ name: "supply", args: { id: "vendor:quill", event: "event:gala" } }], { author: actor, lineage: { basis: "Again" } })).toThrow(/declined/);
    const again = await runtime.call("decline_suggestion", { suggestion: quill!.id });
    expect(again).toMatchObject({ ok: false, error: expect.stringMatching(/no longer waiting/) });
  });

  it("are listed only as the seat may see them", async () => {
    const store = storeOf({ grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: "*", kinds: ["event"] }] });
    suggestTwo(store);
    const listed = await createToolRuntime(store, { author: { kind: "agent", id: "claude", roles: ["guest"] } }).call("list_suggestions", {});
    expect((listed as { data: { suggestions: unknown[] } }).data.suggestions).toEqual([]);
  });
});
