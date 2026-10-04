import { createSchema, defineNode, Store, type AnySchema, type Presence, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { liveProtocol, type LivePeer, type LiveProtocol, type LiveServerMessage } from "../../src/runtime.js";

/**
 * A SOCKET HOLDS ITS PRESENCE, WHOEVER REBUILT IT.
 *
 * A presence a socket holds is stamped `held: "socket"`, and a client keeps
 * it for as long as the server lists it — an idle tab says nothing and
 * stays in the room. But a host that keeps who is here itself builds the
 * presences it hands `tell` and `receive` again from its own records, and
 * Graview Cloud's spike dropped the stamp on the way: every client then
 * expired the idle tabs by their `at`, and people vanished from the room
 * while their tabs stood open. Now the protocol stamps it: a presence whose
 * participant is held by one of the sockets the host hands in is said
 * `held: "socket"`, whatever the host built, and a visitor keeps the
 * `until` the host gave it.
 */
const schema = createSchema([defineNode("task", { fields: z.object({ label: z.string() }) })]);
const store = () => new Store({ schema, mutations: [], snapshot: { nodes: [], edges: [] } as never });
const ada: Principal = { kind: "human", id: "ada", name: "Ada" };
const bo: Principal = { kind: "human", id: "bo", name: "Bo" };
const cy: Principal = { kind: "human", id: "cy", name: "Cy" };

function peerOf(live: Pick<LiveProtocol<AnySchema>, "open">, seat: Principal) {
  const heard: LiveServerMessage[] = [];
  const peer: LivePeer = { ...live.open(seat, "web"), send: (text) => void heard.push(JSON.parse(text) as LiveServerMessage) };
  return { peer, heard, presences: () => heard.flatMap((message) => (message.t === "presence" ? [message.who] : [])) };
}

/** Who is here as a host rebuilds it from its own records: no `held`, a stale `at`, and a visitor with its `until`. */
function rebuilt(...participants: string[]): Presence[] {
  const at = new Date(Date.now() - 60_000).toISOString();
  return [
    ...participants.map((participant) => ({ participant, kind: "human" as const, name: participant, hue: 10, stop: "/", at })),
    { participant: "agent:claude:visit", kind: "agent", name: "Claude", hue: 200, stop: "", at, until: new Date(Date.now() + 30_000).toISOString() },
  ];
}

describe("a socket holds its presence, whoever rebuilt it", () => {
  it("stamps held on every participant a socket handed to tell holds, and keeps a visitor's until", async () => {
    const live = liveProtocol({ store: store() });
    const a = peerOf(live, ada);
    const b = peerOf(live, bo);
    await live.receive(a.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(b.peer, JSON.stringify({ t: "hello", seq: -1 }));
    const who = rebuilt(a.peer.participant!, b.peer.participant!, "human:dee:gone");
    live.tell(who, [a.peer, b.peer]);
    const toBo = b.presences().at(-1)!;
    expect(toBo.find((one) => one.participant === a.peer.participant)).toMatchObject({ held: "socket" });
    expect(toBo.find((one) => one.participant === a.peer.participant)).not.toHaveProperty("until");
    // Nobody's socket holds Dee: said as the host built it.
    expect(toBo.find((one) => one.participant === "human:dee:gone")).not.toHaveProperty("held");
    expect(toBo.find((one) => one.participant === "agent:claude:visit")).toMatchObject({ until: who.at(-1)!.until });
    expect(toBo.find((one) => one.participant === "agent:claude:visit")).not.toHaveProperty("held");
    // What the host handed in is not changed under it.
    expect(who.some((one) => one.held !== undefined)).toBe(false);
  });

  it("stamps held on the presence a welcome is followed by, from the sockets the host hands receive", async () => {
    const live = liveProtocol({ store: store() });
    const a = peerOf(live, ada);
    const b = peerOf(live, bo);
    const c = peerOf(live, cy);
    await live.receive(a.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(b.peer, JSON.stringify({ t: "hello", seq: -1 }));
    await live.receive(c.peer, JSON.stringify({ t: "hello", seq: -1 }), rebuilt(a.peer.participant!, b.peer.participant!), [a.peer, b.peer, c.peer]);
    const toCy = c.presences().at(-1)!;
    expect(toCy.filter((one) => one.held === "socket").map((one) => one.participant).sort()).toEqual([a.peer.participant, b.peer.participant].sort());
    expect(toCy.find((one) => one.participant === "agent:claude:visit")).toMatchObject({ until: expect.any(String) });
  });
});
