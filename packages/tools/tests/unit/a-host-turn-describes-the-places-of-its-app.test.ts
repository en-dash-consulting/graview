import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import type { PlaceDescription } from "@graview/core/describe";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createToolRuntime, llmResponder, seatResponder, turnThroughMessages, type MessagesBlock, type MessagesStepRequest } from "../../src/index.js";

/**
 * A HOST'S TURN KNOWS THE APP IT IS MOUNTED WITH. Inside `HostAi.turn` the
 * seat built its read tools from the store alone, so `describe_place` could
 * say a kind's list and a record but not a lens: asked for "the-offers",
 * a model was told it is not a place this app has. Handed the app
 * (`context.app`, which the chat takes from its provider), the turn's
 * `describe_place` answers as `graview mcp` does, for the seat that asked.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("lifelogics.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the LifeLogics fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("lifelogics.seed.json", fixtures), "utf8"));
const store = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const partner: Principal = { kind: "agent", id: "keel-agent", roles: ["partner"], onBehalfOf: { kind: "human", id: "party-delivery", roles: ["partner"] } };

/** A host's model, scripted: it asks what a place shows, then answers. What the tool handed back is kept. */
function scripted(place: string) {
  const results: { content: string; is_error?: boolean }[] = [];
  const step = async (request: MessagesStepRequest) => {
    const last = request.messages.at(-1)!;
    if (Array.isArray(last.content)) {
      results.push(...(last.content as readonly MessagesBlock[]).map((block) => ({ content: String(block["content"]), ...(block["is_error"] ? { is_error: true } : {}) })));
      return { content: [{ type: "text", text: '{"say": "Read it.", "proposals": []}' }], stop_reason: "end_turn" };
    }
    return { content: [{ type: "tool_use", id: "t1", name: "describe_place", input: { place, width: 390 } }], stop_reason: "tool_use" };
  };
  return { turn: turnThroughMessages(step), results };
}

const offersIn = (description: PlaceDescription): string[] =>
  description.parts.flatMap((part) => (part.t === "list" ? part.groups.flatMap((group) => group.items.map((item) => item.id)) : []));

describe("describe_place in a host's turn", () => {
  it("describes a lens place, for the seat that asked, exactly as the runtime graview mcp serves does", async () => {
    const { turn, results } = scripted("the-offers");
    const reply = await llmResponder<AnySchema>({ turn })(store(), "what does the offers page show a partner?", { principal: partner, app });
    expect(reply.say).toBe("Read it.");
    expect(results).toHaveLength(1);
    expect(results[0]!.is_error).toBeUndefined();
    const described = JSON.parse(results[0]!.content) as PlaceDescription;
    const served = await createToolRuntime(store(), { author: partner, app, readOnly: true }).call("describe_place", { place: "the-offers", width: 390 });
    if (!served.ok) throw new Error(served.error);
    expect(described).toEqual(served.data);
    expect(described.drawnBy).toMatch(/^lens:/);
    expect(offersIn(described)).toEqual(["offer-analysis", "offer-suite"]);
  });

  it("describes the app's home as the app declares it, through seatResponder as well", async () => {
    const { turn, results } = scripted("home");
    await seatResponder<AnySchema>({ turn })(store(), "what is on the front page?", { principal: partner, app });
    expect((JSON.parse(results[0]!.content) as PlaceDescription).text).toContain("# A small start, on two fronts.");
  });

  it("without the app, refuses a lens place and names the places it does know", async () => {
    const { turn, results } = scripted("the-offers");
    await llmResponder<AnySchema>({ turn })(store(), "what does the offers page show?", { principal: partner });
    expect(results[0]!.is_error).toBe(true);
    expect(results[0]!.content).toContain("is not a place this app has");
  });
});
