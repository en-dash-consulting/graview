import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { FIXTURES } from "@graview/core/conformance";
import { describe, expect, it } from "vitest";
import { createMcpAdapter, createToolRuntime } from "../../src/index.js";

/**
 * FR-119, on the agent's surface. A tool's refusal carried a sentence and
 * nothing else, so an agent told "the rules say no" from "you sent the
 * wrong thing" by reading words. A refused call now says the reason
 * `refusalOf` reads — `refused` when the act's own rule said no, `invalid`
 * for the call as sent — on the runtime's answer and on MCP's
 * `structuredContent`, beside the sentence it always said.
 */
const vendors = FIXTURES.find((fixture) => fixture.id === "document:vendors")!;
const compiled = compileDocument(vendors.document);
if (!compiled.ok) throw new Error("the vendors fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const planner = { kind: "agent" as const, id: "helper", roles: ["planner"] };

async function withADeclinedVendor() {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}) });
  const runtime = createToolRuntime(store, { author: planner });
  const made = await runtime.call("add-vendor", { id: "vendor-bloom", name: "Bloom & Co" });
  expect(made.ok).toBe(true);
  expect((await runtime.call("decline", { id: "vendor-bloom" })).ok).toBe(true);
  return runtime;
}

describe("a tool says why it was refused", () => {
  it("refused: booking a declined vendor is the act's own rule saying no", async () => {
    const runtime = await withADeclinedVendor();
    expect(await runtime.call("book", { id: "vendor-bloom" })).toEqual({ ok: false, error: "Bloom & Co was declined; reopen them first", reason: "refused" });
  });

  it("invalid: a call that changes nothing is the call as sent", async () => {
    const runtime = await withADeclinedVendor();
    expect(await runtime.call("edit-vendor", { id: "vendor-bloom" })).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("says the reason to an MCP client as structured content, beside the sentence", async () => {
    const adapter = createMcpAdapter(await withADeclinedVendor());
    expect(await adapter.callTool("book", { id: "vendor-bloom" })).toEqual({
      content: [{ type: "text", text: "Bloom & Co was declined; reopen them first" }],
      structuredContent: { reason: "refused", error: "Bloom & Co was declined; reopen them first" },
      isError: true,
    });
  });
});
