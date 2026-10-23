import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, type Policy, type Presence, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, LIVE_PATH, presenceFrom, presenceSeenBy, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A CARET IS TOLD ONLY TO WHO MAY SEE ITS FIELD (Roadmap f-collab-text,
 * phase 4). A presence may say where somebody's caret stands in a field
 * typed together. Where somebody types says what is there, so a seat whose
 * sight keeps the record or the field from it is told the person and not
 * the caret; and what a client claims is a caret only when it is one.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const task = defineNode("task", { fields: z.object({ label: z.string(), notes: z.string().max(5000).optional() }), plural: "Tasks" });
const schema = createSchema([person, task]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const policy: Policy = {
  grants: [{ roles: ["member", "staff"], mutations: "*" }],
  sees: [
    { roles: ["staff"], kinds: ["task", "person"] },
    { roles: ["member"], kinds: ["task"], hide: ["notes"] },
    { roles: ["member"], kinds: ["person"], own: true },
  ],
};
const snapshot = {
  nodes: [
    { id: "person:ada", kind: "person", label: "Ada" },
    { id: "person:bo", kind: "person", label: "Bo" },
    { id: "t1", kind: "task", label: "Book the hall", notes: "Ask about the deposit" },
  ],
  edges: [],
};
const app = defineApp({ name: "room", schema, mutations: [rename], policy, version: 1 });
const ada: Principal = { kind: "human", id: "person:ada", name: "Ada", roles: ["member"] };
const rhian: Principal = { kind: "human", id: "staff:rhian", name: "Rhian", roles: ["staff"] };
const SEATS: Record<string, Principal> = { ada, rhian };
const at = (path: string, who: string) => new Request(`https://room.example${path}`, { headers: { authorization: who } });
const tick = () => new Promise((settle) => setTimeout(settle, 1));

async function socket(handler: Awaited<ReturnType<typeof createStoreHandler<typeof schema>>>, who: string, caret?: Presence["caret"]) {
  const heard: LiveServerMessage[] = [];
  const connection = await handler.connect(at(LIVE_PATH, who), { send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) });
  if (connection instanceof Response) throw new Error(`Refused: ${connection.status}`);
  connection.receive(JSON.stringify({ t: "hello", seq: -1 }));
  connection.receive(JSON.stringify({ t: "here", presence: { participant: `human:${who}:tab`, hue: 1, stop: "/", at: "", ...(caret ? { caret } : {}) } }));
  for (let tries = 0; tries < 50; tries++) await tick();
  return { lastWho: () => (heard.filter((message) => message.t === "presence").at(-1) as Extract<LiveServerMessage, { t: "presence" }> | undefined)?.who ?? [] };
}

describe("a caret in a presence", () => {
  it("is told to a seat that sees the field, and kept from one whose sight keeps the field or the record", async () => {
    for (const [caret, told] of [
      [{ node: "t1", field: "label", anchor: 2, head: 4, rev: 3 }, true],
      [{ node: "t1", field: "notes", anchor: 2, head: 2, rev: 3 }, false],
      [{ node: "person:bo", field: "label", anchor: 0, head: 0, rev: 3 }, false],
    ] as const) {
      const handler = await createStoreHandler({ app, store: new Store({ schema, mutations: [rename], policy, snapshot: snapshot as never }), seatOf: (request) => SEATS[request.headers.get("authorization") ?? ""] ?? ada });
      const seen = await socket(handler, "ada");
      await socket(handler, "rhian", caret);
      const her = seen.lastWho().find((one) => one.name === "Rhian");
      expect(her).toBeDefined();
      expect(her!.caret).toEqual(told ? caret : undefined);
    }
  });

  it("is kept from a seat by `presenceSeenBy` when it does not see the field", () => {
    const rhianHere: Presence = { participant: "human:staff:rhian:tab", hue: 1, stop: "/", at: "", caret: { node: "t1", field: "notes", anchor: 1, head: 1, rev: 1 } };
    expect(presenceSeenBy([rhianHere], () => true, (_node, field) => field !== "notes")[0]!.caret).toBeUndefined();
    expect(presenceSeenBy([rhianHere], () => true)[0]!.caret).toEqual(rhianHere.caret);
  });

  it("is kept from what a client claims only when it is a record, a field and three counts", () => {
    const now = new Date("2026-10-23T00:00:00Z");
    const said = (caret: unknown) => presenceFrom({ participant: "human:person:ada:tab", hue: 1, stop: "/", at: "", caret } as Presence, ada, now).caret;
    expect(said({ node: "t1", field: "label", anchor: 1, head: 3, rev: 9 })).toEqual({ node: "t1", field: "label", anchor: 1, head: 3, rev: 9 });
    expect(said({ node: "t1", field: "label", anchor: -1, head: 3, rev: 9 })).toBeUndefined();
    expect(said({ node: "t1", field: "label", anchor: 1, head: 3, rev: 9, extra: "<b>" })).toEqual({ node: "t1", field: "label", anchor: 1, head: 3, rev: 9 });
    expect(said("t1#label")).toBeUndefined();
  });
});
