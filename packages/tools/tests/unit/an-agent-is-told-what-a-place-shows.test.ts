import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import type { PlaceDescription } from "@graview/core/describe";
import { compileDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createMcpAdapter, createToolRuntime, toolDefinitions } from "../../src/index.js";

/**
 * FR-89, for an agent: `describe_place` says what a place shows the seat
 * asking — read-only, through the same surface `graview mcp` serves — so a
 * chat can check what somebody now sees before it says it is done.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("lifelogics.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the LifeLogics fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("lifelogics.seed.json", fixtures), "utf8"));
const store = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const partner: Principal = { kind: "agent", id: "keel-agent", roles: ["partner"], onBehalfOf: { kind: "human", id: "party-delivery", roles: ["partner"] } };

const offersIn = (description: PlaceDescription): string[] =>
  description.parts.flatMap((part) => (part.t === "list" ? part.groups.flatMap((group) => group.items.map((item) => item.id)) : []));

describe("describe_place", () => {
  it("is a read every seat is offered, read-only and idempotent, and the store-less surface agrees", () => {
    const runtime = createToolRuntime(store(), { author: owner, app, readOnly: true });
    const tool = runtime.definitions.find((one) => one.name === "describe_place")!;
    expect(tool.mutating).toBe(false);
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
    expect(toolDefinitions(app, owner, { readOnly: true }).hash).toBe(runtime.hash);
  });

  it("says what the seat sees: the partner is told of the offers the partner may see, and the call reads only those", async () => {
    const asOwner = await createToolRuntime(store(), { author: owner, app }).call("describe_place", { place: "the-offers", width: 390 });
    const asPartner = await createToolRuntime(store(), { author: partner, app }).call("describe_place", { place: "the-offers", width: 390 });
    if (!asOwner.ok || !asPartner.ok) throw new Error("refused");
    expect(offersIn(asOwner.data as PlaceDescription)).toEqual(["offer-workshop", "offer-analysis", "offer-suite", "offer-advice"]);
    expect(offersIn(asPartner.data as PlaceDescription)).toEqual(["offer-analysis", "offer-suite"]);
    expect(asPartner.reads).not.toContain("offer-workshop");
    expect((asPartner.data as PlaceDescription).variant).toBe("phone");
  });

  it("is served over MCP as text a model reads, and a place there is not is refused with the places there are", async () => {
    const adapter = createMcpAdapter(createToolRuntime(store(), { author: owner, app }));
    expect(adapter.listTools().map((tool) => tool.name)).toContain("describe_place");
    const home = await adapter.callTool("describe_place", { place: "home", width: 390 });
    expect(home.isError).toBeUndefined();
    expect(home.content[0]!.text).toContain("# A small start, on three fronts.");
    const nowhere = await adapter.callTool("describe_place", { place: "nowhere" });
    expect(nowhere.isError).toBe(true);
    expect(nowhere.content[0]!.text).toMatch(/The places are: home, .*the-offers/);
  });

  it("without the app, still says a kind's list and a record", async () => {
    const runtime = createToolRuntime(store(), { author: owner });
    const offers = await runtime.call("describe_place", { place: "offers" });
    if (!offers.ok) throw new Error(offers.error);
    expect((offers.data as PlaceDescription).text).toContain("- Two-day workshop");
  });
});
