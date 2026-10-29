import { createMemoryAdapter, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import type { GraviewDocument } from "@graview/core/document";
import { compileDocument } from "@graview/core/check";
import { createStoreHandler, openRemote, seatHeaders } from "@graview/ship";
import { describe, expect, it } from "vitest";
import { createToolRuntime } from "../../src/index.js";

/**
 * A SENDER SEES THEIR OWN TICKET WITHOUT WHAT A SIGHT HIDES (Roadmap
 * f-sight-own-with-hide, request:sight-own-with-hide-drops-the-record).
 * Graview Public's tickets are seen by their sender (`own`) and by staff;
 * triage labels each one, and the label is staff's. With
 * `{ roles: "*", kinds: ["ticket"], own: true, hide: ["triage"] }` a sender
 * with no role is served their own ticket on every surface a seat is
 * served through — the routes, a page `openRemote` opened, an agent's
 * tools — whole but for its label, and never anybody else's.
 */
const desk = (sight: object): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Public",
    kinds: {
      ticket: {
        noun: "ticket",
        plural: "tickets",
        label: "{what}",
        fields: {
          what: { type: "string", required: true },
          status: { type: "enum", options: ["new", "reviewing"], default: "new", required: true },
          filed: { type: "datetime" },
          triage: { type: "enum", options: ["spam", "needs-a-look", "good-to-show"] },
        },
      },
    },
    acts: {
      "file-ticket": { title: "Send feedback", creates: "ticket", description: "A ticket from a person.", effects: [{ set: { filed: "$now" }, target: "$new" }] },
      "set-triage": { title: "Label it", on: "ticket", writes: ["triage"], description: "Say what triage found." },
    },
    roles: ["owner", "editor", "viewer"],
    policy: {
      grants: [{ roles: ["owner", "editor"], mutations: "*" }, { roles: "*", mutations: ["file-ticket"] }],
      sees: [sight, { roles: ["owner", "editor"], kinds: ["ticket"] }],
    },
  }) as unknown as GraviewDocument;

const sam: Principal = { kind: "human", id: "acct_sam", name: "Sam", roles: [] };
const kim: Principal = { kind: "human", id: "acct_kim", name: "Kim", roles: [] };
const triage: Principal = { kind: "system", id: "workflow:triage", name: "Graview, triage" };

async function served(sight: object) {
  const compiled = compileDocument(desk(sight));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), trustSeatHeaders: true });
  const mine = handler.store.apply({ name: "file-ticket", args: { what: "Calendar sync drops events" } }, { author: sam }).minted?.[0] as string;
  const theirs = handler.store.apply({ name: "file-ticket", args: { what: "Dark mode please" } }, { author: kim }).minted?.[0] as string;
  for (const id of [mine, theirs]) handler.store.apply({ name: "set-triage", args: { id, triage: "needs-a-look" } }, { author: triage });
  return { app, handler, mine, theirs };
}

describe("a sight that is own and hides a field", () => {
  for (const [said, sight] of [
    ["hide", { roles: "*", kinds: ["ticket"], own: true, hide: ["triage"] }],
    ["fields", { roles: "*", kinds: ["ticket"], own: true, fields: ["what", "status", "filed"] }],
  ] as const) {
    it(`(${said}) serves the sender their own ticket without its label, on the routes, a page and an agent's tools`, async () => {
      const { app, handler, mine, theirs } = await served(sight);
      const state = (await (await handler.handle(new Request("https://store.example/graview/state", { headers: seatHeaders(sam) }))).json()) as { snapshot: { nodes: Record<string, unknown>[] } };
      const routed = state.snapshot.nodes.filter((node) => node["kind"] === "ticket");
      expect(routed.map((node) => node["id"])).toEqual([mine]);
      expect(routed[0]).toMatchObject({ what: "Calendar sync drops events", status: "new" });
      expect(routed[0]).not.toHaveProperty("triage");

      const page = await openRemote({ app: app as never, url: "https://store.example", principal: sam, live: false, fetch: ((input: RequestInfo, init?: RequestInit) => handler.handle(new Request(input, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers).entries()), ...seatHeaders(sam) } }))) as typeof fetch } as never);
      const held = (page as unknown as { store: { seenBy(p: Principal): { graph: { getNode(id: string): unknown; nodesOfKind(kind: string): { id: string }[] } } } }).store.seenBy(sam).graph;
      expect(held.nodesOfKind("ticket").map((node) => node.id)).toEqual([mine]);
      expect(held.getNode(mine)).not.toHaveProperty("triage");
      (page as unknown as { close?(): void }).close?.();

      const runtime = createToolRuntime(handler.store, { author: sam });
      const answer = JSON.stringify(await runtime.call("get_node", { id: mine }));
      expect(answer).toContain("Calendar sync drops events");
      expect(answer).not.toContain("needs-a-look");
      expect(JSON.stringify(await runtime.call("get_graph", {}))).not.toContain(theirs);
    });
  }
});
