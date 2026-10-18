import { createSchema, defineApp, defineNode, SCHEMES, Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime } from "../../src/index.js";

/*
 * AN AGENT'S ACT SAYS A TIME ON THE APP'S CLOCK (Roadmap f-app-time-zone).
 * A bug report: an act given `2026-10-16T10:47:00-04:00` echoed "2:47 PM",
 * because the server answering the agent runs on UTC and nothing drew a
 * provider to say otherwise. A runtime handed the app says its sentence in
 * the app's `brand.timeZone`.
 */
const visit = defineNode("visit", { fields: z.object({ title: z.string(), at: z.string().optional() }), plural: "Visits" });
const schema = createSchema([visit]);
const app = defineApp({ name: "Practice", schema, brand: { name: "Practice", schemes: SCHEMES, timeZone: "America/New_York" } });

describe("an agent's act", () => {
  it("echoes a time given with an offset in the app's zone", async () => {
    const store = new Store<AnySchema>({ schema: schema as AnySchema, mutations: [], snapshot: { nodes: [{ id: "v1", kind: "visit", title: "Checkup" }], edges: [] } as never });
    const runtime = createToolRuntime(store, { author: { kind: "agent" }, app: app as never });
    const result = await runtime.call("edit-visit", { id: "v1", at: "2026-10-16T10:47:00-04:00" });
    expect(result.ok).toBe(true);
    expect((result as { data: { intent: string } }).data.intent).toMatch(/to Oct 16, 2026, 10:47 AM EDT$/);
  });

  it("in Tokyo, says Tokyo's time", async () => {
    const store = new Store<AnySchema>({ schema: schema as AnySchema, mutations: [], snapshot: { nodes: [{ id: "v1", kind: "visit", title: "Checkup" }], edges: [] } as never });
    const tokyo = defineApp({ ...app, brand: { name: "Practice", schemes: SCHEMES, timeZone: "Asia/Tokyo" } });
    const runtime = createToolRuntime(store, { author: { kind: "agent" }, app: tokyo as never });
    const result = await runtime.call("edit-visit", { id: "v1", at: "2026-10-16T10:47:00-04:00" });
    expect((result as { data: { intent: string } }).data.intent).toMatch(/to Oct 16, 2026, 11:47 PM GMT\+9$/);
  });
});
