import { defineApp, type AnySchema, type MutationCall, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { guest, keeper, MUTATIONS, policy, said, schema, world } from "../../../core/tests/support/hidden-holds.js";
import { createStoreHandler, LIVE_PATH, openRemote, type LiveServerMessage, type LiveSocketLike, type RemoteRefusal, type StoreHandler } from "../../src/index.js";

/**
 * AN ACT ON THE WIRE RUNS UNDER ITS SEAT'S SIGHT (FR-55).
 *
 * `graview serve` judges every call a seat sends on the whole store, and an
 * act's own body read the whole store too: a guest's booking was refused
 * for a hold it could not see — on the socket, on POST /graview/ops, and
 * to the page, which had shown the booking from the guest's view and then
 * took it back after a second answer. Now the act reads what the seat is
 * served, so a world with the hold and the same world without it answer
 * the seat alike on every road, and the page's own guess is the host's.
 */
const app = defineApp({ name: "holds", schema, mutations: MUTATIONS as never, invariants: [said] as never, policy, version: 1 });
const ROOM = "room:blue";
const CALLS: readonly MutationCall[] = [
  { name: "book-room", args: { id: ROOM } },
  { name: "release-room", args: { id: ROOM } },
  { name: "tally-room", args: { id: ROOM } },
  { name: "tidy-room", args: { id: ROOM } },
];

/** Minted ids, clocks and the store's own tokens said alike: what is left is what the seat is told. */
const alike = (value: unknown) =>
  JSON.stringify(value)
    .replace(/(batch|op|preview):[a-z0-9:-]+/g, "$1:minted")
    .replace(/"(at|build|server|token|epoch|participant)":"[^"]*"/g, '"$1":"-"');

const served = (held: boolean, seat: Principal) => createStoreHandler({ app: app as never, store: world(held) as never, seatOf: () => seat }) as Promise<StoreHandler<AnySchema>>;

async function posted(held: boolean, seat: Principal): Promise<string[]> {
  const out: string[] = [];
  for (const call of CALLS) {
    const handler = await served(held, seat);
    const response = await handler.handle(new Request("https://store.example/graview/ops", { method: "POST", body: JSON.stringify({ calls: [call], batch: "batch:tab:1" }) }));
    out.push(alike({ status: response.status, body: await response.json(), state: await (await handler.handle(new Request("https://store.example/graview/state"))).json() }));
  }
  return out;
}

const until = async (holds: () => boolean, ms = 2000) => {
  const start = Date.now();
  while (!holds()) {
    if (Date.now() - start > ms) throw new Error("It never came true.");
    await new Promise((tick) => setTimeout(tick, 2));
  }
};

async function socketed(held: boolean, seat: Principal): Promise<string[]> {
  const out: string[] = [];
  for (const call of CALLS) {
    const heard: LiveServerMessage[] = [];
    const handler = await served(held, seat);
    const connection = await handler.connect(new Request(`https://store.example${LIVE_PATH}`), { send: (text) => heard.push(JSON.parse(text) as LiveServerMessage) });
    if (connection instanceof Response) throw new Error(`refused: ${connection.status}`);
    connection.receive(JSON.stringify({ t: "hello", seq: -1 }));
    connection.receive(JSON.stringify({ t: "call", cid: "c1", calls: [call] }));
    await until(() => heard.some((message) => "cid" in message && message.cid === "c1"));
    out.push(alike(heard.filter((message) => message.t !== "presence")));
  }
  return out;
}

/** `openRemote` over the handler, in process, counting what the page sends. */
function wired(handler: StoreHandler<AnySchema>) {
  let sent = 0;
  const fetcher = ((url: string, init?: RequestInit) => {
    sent++;
    return handler.handle(new Request(url, init));
  }) as typeof fetch;
  const socket = (url: string): LiveSocketLike => {
    let deliver: (text: string) => void = () => {};
    const fake: LiveSocketLike & { readyState: number } = {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: (text) => {
        sent++;
        deliver(text);
      },
      close() {
        fake.readyState = 3;
      },
    };
    void handler
      .connect(new Request(url.replace(/^ws/, "http")), { send: (text) => setTimeout(() => fake.onmessage?.({ data: text }), 0) })
      .then((connection) => {
        if (connection instanceof Response) throw new Error("refused");
        deliver = (text) => connection.receive(text);
        fake.readyState = 1;
        fake.onopen?.({});
      });
    return fake;
  };
  return { fetch: fetcher, socket, sent: () => sent };
}

describe("an act on the wire runs under its seat's sight", () => {
  it("answers POST /graview/ops alike — status, body and the state after — whether a hold the seat may not see exists", async () => {
    const [held, none] = [await posted(true, guest), await posted(false, guest)];
    for (const [at, call] of CALLS.entries()) expect(held[at], call.name).toBe(none[at]);
    expect(held.join("\n")).not.toContain("Freya");
  });

  it("answers on the socket alike", async () => {
    const [held, none] = [await socketed(true, guest), await socketed(false, guest)];
    for (const [at, call] of CALLS.entries()) expect(held[at], call.name).toBe(none[at]);
    expect(held.join("\n")).not.toContain("Freya");
  });

  it("still refuses a seat that sees the hold, in the act's own words", async () => {
    const response = await (await served(true, keeper)).handle(new Request("https://store.example/graview/ops", { method: "POST", body: JSON.stringify({ calls: [CALLS[0]] }) }));
    const body = await response.json();
    expect([response.status, body]).toMatchObject([409, { refused: true, reason: "refused" }]);
    expect(JSON.stringify(body)).toContain("Freya Davies holds it.");
  });

  for (const live of [true, false]) {
    it(`keeps the page's booking as it showed it, with no refusal after and nothing more sent, in either world (${live ? "socket" : "HTTP"})`, async () => {
      const seen: Record<string, unknown> = {};
      for (const held of [true, false]) {
        const handler = await served(held, guest);
        const wire = wired(handler);
        const remote = await openRemote({ app: app as never, url: "https://store.example", principal: guest, live, pollMs: 0, fetch: wire.fetch, socket: wire.socket });
        const refusals: RemoteRefusal[] = [];
        remote.onRefusal((_sentence, refusal) => refusals.push(refusal));
        await remote.settled();
        const before = wire.sent();
        remote.store.apply({ name: "book-room", args: { id: ROOM } });
        const shown = remote.store.graph.getNode(ROOM);
        await remote.settled();
        seen[String(held)] = { refusals, shown, after: remote.store.graph.getNode(ROOM), sent: wire.sent() - before, host: handler.store.graph.getNode(ROOM) };
        remote.close();
      }
      expect(seen["true"]).toEqual(seen["false"]);
      expect(seen["true"]).toMatchObject({ refusals: [], after: { booked: true }, host: { booked: true } });
    });
  }
});
