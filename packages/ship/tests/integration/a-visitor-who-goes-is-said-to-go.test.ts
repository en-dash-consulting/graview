import { createMemoryAdapter, createSchema, defineApp, defineNode, nextExpiry, type Presence, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { announcePresence, createStoreHandler, LIVE_PATH, seatHeaders, visitorPresence, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A VISITOR WHO GOES IS SAID TO GO.
 *
 * `announcePresence` stamps a visitor without a socket — an agent over MCP,
 * an RPC — with an `until`, and answers the new `who`; nothing told a host
 * when that `until` passed. A hibernating host had nothing to set an alarm
 * by, and `createStoreHandler` dropped the visitor only when something else
 * happened to tell the room, so "Claude, for Ada" stood on every map long
 * after it had gone. Now `nextExpiry(who)` says when the next visitor goes,
 * for a host's alarm, and the in-memory handler keeps a timer by it and
 * tells every socket when a visitor expires.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const app = defineApp({ name: "room", schema, mutations: [], version: 1 });
const sam: Principal = { kind: "human", id: "sam", name: "Sam", roles: [] };
const claude: Principal = { kind: "agent", id: "claude", name: "Claude", roles: [] };

const at = (iso: number) => new Date(iso).toISOString();
const someone = (participant: string, extra: Partial<Presence> = {}): Presence => ({ participant, hue: 1, stop: "/", at: at(0), ...extra });

describe("a visitor who goes is said to go", () => {
  it("nextExpiry names when the next visitor still standing goes, and nothing when none will", () => {
    const now = 1_000_000;
    const who = [
      someone("human:sam:tab", { held: "socket" }),
      someone("human:bo:poll"),
      someone("agent:claude:visit", { until: at(now + 5000) }),
      someone("agent:codex:visit", { until: at(now + 2000) }),
      someone("agent:gone:visit", { until: at(now - 1) }),
    ];
    expect(nextExpiry(who, now)).toBe(now + 2000);
    expect(nextExpiry(who.slice(0, 2), now)).toBeUndefined();
    expect(nextExpiry([], now)).toBeUndefined();

    // What announcePresence answers is what a hibernating host sets its alarm by.
    const announced = announcePresence([], visitorPresence(claude), 30_000, now);
    expect(nextExpiry(announced, now)).toBe(now + 30_000);
  });

  it("the in-memory handler tells every socket when a visitor's time is up, with nothing else happening", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: { nodes: [], edges: [] } as never, trustSeatHeaders: true });
    const heard: LiveServerMessage[] = [];
    const connection = await handler.connect(new Request(`http://room.example${LIVE_PATH}`, { headers: seatHeaders(sam) }), { send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) });
    if (connection instanceof Response) throw new Error("refused");
    connection.receive(JSON.stringify({ t: "hello", seq: -1 }));
    await new Promise((tick) => setTimeout(tick, 5));
    const lastWho = () => (heard.filter((message) => message.t === "presence").at(-1) as Extract<LiveServerMessage, { t: "presence" }> | undefined)?.who ?? [];

    handler.announce(visitorPresence(claude), 60);
    expect(lastWho().map((one) => one.name)).toEqual(["Claude"]);
    const told = heard.length;
    await new Promise((tick) => setTimeout(tick, 150));
    expect(heard.length).toBeGreaterThan(told);
    expect(lastWho()).toEqual([]);
    await handler.close();
  });
});
