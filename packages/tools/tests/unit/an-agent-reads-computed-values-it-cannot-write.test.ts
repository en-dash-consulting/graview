import { readFileSync } from "node:fs";
import { Store, type AnySchema, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createToolRuntime } from "../../src/index.js";

/**
 * FR-83 on the agent tool surface: get_node says a record's computed values
 * as read-only, worked out from what the seat may see; no act's tool takes
 * one. A partner who may not see the client is told the package's price
 * before the discount, and nothing of the client.
 */
const proposal = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/proposal.gdd.json", import.meta.url), "utf8"));

function store() {
  const compiled = compileDocument(proposal);
  if (!compiled.ok) throw new Error("the proposal compiles");
  const app = compiled.app;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: {
      nodes: [
        { id: "party:acme", kind: "party", name: "Acme", role: "client", discount: 20 },
        { id: "offer:workshop", kind: "offer", name: "Workshop", list: 10_000, units: 1 },
        { id: "offer:build", kind: "offer", name: "Build", list: 20_000, units: 3 },
        { id: "package:middle", kind: "package", name: "The middle", standing: 5 },
      ] as never,
      edges: [
        { kind: "includes", from: "package:middle", to: "offer:workshop" },
        { kind: "includes", from: "package:middle", to: "offer:build" },
      ] as never,
    },
  });
}
const owner: Principal = { kind: "agent", id: "helper", onBehalfOf: { kind: "human", id: "u:olu", roles: ["owner"] } };
const partner: Principal = { kind: "agent", id: "helper", onBehalfOf: { kind: "human", id: "u:pat", roles: ["partner"] } };

describe("an agent reads computed values it cannot write", () => {
  it("get_node says the package's net, worked out for the seat that asks", async () => {
    const s = store();
    const asOwner = await createToolRuntime(s, { author: owner }).call("get_node", { id: "package:middle" });
    const asPartner = await createToolRuntime(s, { author: partner }).call("get_node", { id: "package:middle" });
    expect(asOwner.ok && (asOwner.data as { computed?: unknown }).computed).toEqual({ net: 56_000 });
    expect(asPartner.ok && (asPartner.data as { computed?: unknown }).computed).toEqual({ net: 70_000 });
    for (const secret of ["Acme", "party:acme", "56000", "discount"]) expect(JSON.stringify(asPartner)).not.toContain(secret);
  });

  it("get_node's description says computed values are read-only", () => {
    const tools = createToolRuntime(store(), { author: owner });
    expect(tools.definitions.find((tool) => tool.name === "get_node")?.description).toMatch(/computed values: read-only/);
  });

  it("no act's tool takes a computed field as an argument", () => {
    const tools = createToolRuntime(store(), { author: owner });
    const edit = tools.definitions.find((tool) => tool.act === "edit-package");
    expect(edit).toBeDefined();
    for (const tool of tools.definitions) expect(Object.keys((tool.inputSchema as { properties?: object }).properties ?? {}), tool.name).not.toContain("net");
  });
});
