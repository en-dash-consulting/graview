import { bindSchema, createSchema, defineNode, nodeRef, Store, type AnySchema, type Author, type Dismissal, type DismissalStore } from "@graview/core";
import { suggest, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, DISMISS_SUGGESTION, withNotNow, type ToolCall } from "../../src/index.js";

/*
 * A SEAT SAYS "NOT NOW" FOR THE PERSON IT SITS WITH. A seat whose host keeps
 * that person's own state lists `dismiss_suggestion` beside list, accept and
 * decline: it puts a waiting suggestion out of the person's sight until
 * tomorrow, in the host's store, and the log says nothing of it — so it
 * still waits for everyone else, and the app's own actor is bound to
 * nothing. Its `list_suggestions` then leaves it out. A runtime the host
 * gives no such store lists none of it.
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

function tidied() {
  const store = new Store<AnySchema>({
    schema,
    mutations: [supply] as never,
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "vendor:bloom", kind: "vendor", label: "Bloom Florals" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });
  const quill = suggest(store, [{ name: "supply", args: { id: "vendor:quill", event: "event:gala" } }], { author: actor, lineage: { basis: "Quill printed something in April", confidence: 0.4 } })!;
  const bloom = suggest(store, [{ name: "supply", args: { id: "vendor:bloom", event: "event:gala" } }], { author: actor, lineage: { basis: "Bloom's invoice", confidence: 0.55 } })!;
  return { store, quill, bloom };
}

const kept = (): DismissalStore & { held: Dismissal[] } => {
  const store = { held: [] as Dismissal[], list: () => store.held, dismiss: (one: Dismissal) => void (store.held = [...store.held, one]) };
  return store;
};
const NOW = Date.parse("2026-10-22T21:00:00Z");
const listedIds = (answer: unknown) => (answer as { data: { suggestions: { id: string }[] } }).data.suggestions.map((one) => one.id);

describe("Not now on the tool surface", () => {
  it("is listed beside list, accept and decline only where the host keeps the person's own state", () => {
    const { store } = tidied();
    expect(createToolRuntime(store, { author: seat }).definitions.map((tool) => tool.name)).not.toContain("dismiss_suggestion");
    const runtime = withNotNow(createToolRuntime(store, { author: seat }), kept());
    expect(runtime.definitions.map((tool) => tool.name)).toEqual(expect.arrayContaining(["list_suggestions", "accept_suggestion", "decline_suggestion", "dismiss_suggestion"]));
    // A surface with one more tool is a surface of its own: its fingerprint moves with it.
    expect(runtime.hash).not.toBe(createToolRuntime(store, { author: seat }).hash);
    expect(DISMISS_SUGGESTION.annotations.destructiveHint).toBe(false);
  });

  it("hides one from the person until tomorrow, kept by the host, with nothing in the log, so it still waits for everyone else", async () => {
    const { store, quill, bloom } = tidied();
    const held = kept();
    const runtime = withNotNow(createToolRuntime(store, { author: seat }), held, () => NOW);
    const ops = store.log.length;
    const dismissed = await runtime.call("dismiss_suggestion", { suggestion: quill.id });
    expect(dismissed).toMatchObject({ ok: true, data: { suggestion: quill.id, until: "2026-10-23T21:00:00.000Z" } });
    expect(held.held).toEqual([{ suggestion: quill.id, at: "2026-10-22T21:00:00.000Z", until: "2026-10-23T21:00:00.000Z" }]);
    expect(store.log.length).toBe(ops);
    expect(listedIds(await runtime.call("list_suggestions", {}))).toEqual([bloom.id]);
    // The person's own: for anyone else, and the actor, it still waits.
    expect(suggestions(store).map((one) => one.id)).toEqual([quill.id, bloom.id]);
    expect(listedIds(await createToolRuntime(store, { author: seat }).call("list_suggestions", {}))).toEqual([quill.id, bloom.id]);
  });

  it("shows it again once its time has passed, and takes a time the person said", async () => {
    const { store, quill } = tidied();
    let now = NOW;
    const runtime = withNotNow(createToolRuntime(store, { author: seat }), kept(), () => now);
    await runtime.call("dismiss_suggestion", { suggestion: quill.id, until: "2026-10-22T23:00:00Z" });
    expect(listedIds(await runtime.call("list_suggestions", {}))).not.toContain(quill.id);
    now = Date.parse("2026-10-23T00:00:00Z");
    expect(listedIds(await runtime.call("list_suggestions", {}))).toContain(quill.id);
  });

  it("refuses, in a sentence, a suggestion that is not waiting for the person, and a time that is not one", async () => {
    const { store, quill } = tidied();
    const held = kept();
    const runtime = withNotNow(createToolRuntime(store, { author: seat }), held, () => NOW);
    expect(await runtime.call("dismiss_suggestion", { suggestion: "op99" })).toMatchObject({ ok: false, reason: "missing", argument: "suggestion", error: expect.stringMatching(/not waiting for this person/) });
    expect(await runtime.call("dismiss_suggestion", { suggestion: quill.id, until: "after lunch" })).toMatchObject({ ok: false, reason: "invalid", argument: "until", error: expect.stringMatching(/"after lunch" is not a time/) });
    await runtime.call("dismiss_suggestion", { suggestion: quill.id });
    expect(await runtime.call("dismiss_suggestion", { suggestion: quill.id })).toMatchObject({ ok: false, reason: "missing" });
    expect(held.held).toHaveLength(1);
  });

  it("is told to whoever watches the seat's calls, as it starts and as it settles", async () => {
    const { store, quill } = tidied();
    const runtime = withNotNow(createToolRuntime(store, { author: seat }), kept(), () => NOW);
    const calls: ToolCall[] = [];
    runtime.onCall((call) => calls.push(call));
    await runtime.call("dismiss_suggestion", { suggestion: quill.id });
    expect(calls.filter((call) => call.name === "dismiss_suggestion").map((call) => call.phase)).toEqual(["running", "ok"]);
  });
});
