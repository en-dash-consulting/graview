import { bindSchema, createSchema, defineApp, defineNode, memorySubscriptions, nodeRef, Store, type Principal } from "@graview/core";
import { matchSubscriptions } from "@graview/core/subscriptions";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/**
 * NOTIFY ME FROM A CHAT (Roadmap f-notify-subscriptions). A seat whose
 * host keeps subscriptions lists `subscribe`, `unsubscribe` and
 * `list_subscriptions`; a call keeps a subscription for the PERSON the seat
 * acts for — never the agent — judged as that person sees the app, in the
 * same store the menu's sheet keeps them in, and the matcher tells it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean() }), plural: "Tasks" });
const secret = defineNode("secret", { fields: z.object({ label: z.string() }), plural: "Secrets" });
const schema = createSchema([task, secret]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const policy = { grants: [{ roles: "*" as const, mutations: "*" as const }], sees: [{ roles: "*" as const, kinds: ["task"] }, { roles: ["boss"], kinds: ["secret"] }] };
const app = defineApp({ name: "chores", schema, mutations: [finish], policy, version: 1 });
const nick: Principal = { kind: "human", id: "nick", name: "Nick", roles: ["member"] };
const claude: Principal = { kind: "agent", id: "claude", onBehalfOf: nick };

function store() {
  return new Store({
    schema,
    mutations: [finish],
    policy,
    snapshot: {
      nodes: [
        { id: "task:milk", kind: "task", label: "Buy milk", done: false },
        { id: "secret:safe", kind: "secret", label: "The safe" },
      ] as never,
      edges: [],
    },
  });
}

describe("a chat that subscribes", () => {
  it("lists the subscription tools only where the host keeps subscriptions", () => {
    const names = (subscriptions: boolean) => toolDefinitions(app, claude, { subscriptions }).definitions.map((tool) => tool.name);
    expect(names(true)).toEqual(expect.arrayContaining(["subscribe", "unsubscribe", "list_subscriptions"]));
    expect(names(false)).not.toContain("subscribe");
    expect(createToolRuntime(store(), { author: claude }).definitions.map((tool) => tool.name)).not.toContain("subscribe");
  });

  it("keeps a subscription for its person, by a record's name, and the matcher tells them of somebody else's change", async () => {
    const kept = memorySubscriptions();
    const s = store();
    const runtime = createToolRuntime(s, { author: claude, app, subscriptions: kept });
    const answer = await runtime.call("subscribe", { on: "changed", record: "Buy milk" });
    expect(answer.ok).toBe(true);
    const [subscription] = await kept.list("nick");
    expect(subscription?.who).toEqual({ kind: "human", id: "nick", name: "Nick", roles: ["member"] });
    expect(subscription?.when).toEqual({ on: "changed", record: "task:milk" });
    expect((answer as { data: { subscription: { said: string } } }).data.subscription.said).toBe("When someone else changes “Buy milk”");

    const listed = await runtime.call("list_subscriptions", {});
    expect((listed as { data: { subscriptions: { id: string }[] } }).data.subscriptions.map((one) => one.id)).toEqual([subscription!.id]);

    let ops: readonly import("@graview/core").Operation[] = [];
    const off = s.subscribe((_diff, landed) => (ops = landed));
    s.apply({ name: "finish", args: { id: "task:milk" } }, { author: { kind: "human", id: "ana", roles: ["member"] } });
    off();
    expect(matchSubscriptions(s, ops, await kept.list(), { app: "chores" })).toHaveLength(1);

    expect((await runtime.call("unsubscribe", { id: subscription!.id })).ok).toBe(true);
    expect(await kept.list()).toEqual([]);
  });

  it("refuses a subscription its person could never be told of, and keeps nothing", async () => {
    const kept = memorySubscriptions();
    const runtime = createToolRuntime(store(), { author: claude, app, subscriptions: kept });
    // Nick may not see the secrets: the safe is not there for him.
    const hidden = await runtime.call("subscribe", { on: "changed", record: "secret:safe" });
    expect(hidden.ok).toBe(false);
    const nonsense = await runtime.call("subscribe", { on: "reaches", kind: "task", condition: "done ==" });
    expect(nonsense).toMatchObject({ ok: false, error: expect.stringMatching(/does not read/) });
    expect(await kept.list()).toEqual([]);
  });
});
