import { createMemoryAdapter, profilePersonId, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createStoreHandler, presenceFrom, seatFromHeaders, SEAT_HEADERS, visitorPresence } from "../../src/runtime.js";

/**
 * WHAT A SERVED STORE MAKES OF A PROFILE (Roadmap
 * f-viewer-state-and-me-framework): presence says who at the screen on every
 * path, a header's profile is held to its shape before it is kept, and a
 * request naming a profile's person's id is refused.
 */
const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Rocks",
  roles: ["family"],
  kinds: {
    explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true } } },
    rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true } }, edges: { foundBy: { to: ["explorer"], description: "who found it", inverse: "what they found" } } },
  },
  acts: { "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] }, "add-explorer": { title: "Add", creates: "explorer" } },
  policy: { grants: [{ roles: ["family"], mutations: "*" }] },
};
const seed = { nodes: [{ id: "explorer:nick", kind: "explorer", name: "Nick" }, { id: "rock:quartz", kind: "rock", title: "Quartz" }, { id: "rock:opal", kind: "rock", title: "Opal" }], edges: [] };
const compiled = compileDocument(DOCUMENT);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;
const nick: Principal = { kind: "human", id: "explorer:nick", name: "Nick", roles: ["family"] };
const mia: Principal = { ...nick, profile: { id: "prf_mia", name: "Mia" } };
const posted = (headers: Record<string, string>, calls: unknown[]) => new Request("http://s.test/graview/ops", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ calls }) });

describe("presence on a served store", () => {
  it("says who at the screen from the wire as it does for a visitor, and just the account without a profile", () => {
    const said = { participant: "human:explorer:nick:s", stop: "x", name: "somebody else" };
    expect(presenceFrom(said as never, mia).name).toBe("Mia (Nick)");
    expect(visitorPresence(mia as never, { stop: "x" }).name).toBe("Mia (Nick)");
    expect(presenceFrom(said as never, nick).name).toBe("Nick");
    expect(presenceFrom(said as never, { ...nick, profile: { id: "bad~id", name: "X" } }).name).toBe("Nick");
  });
});

describe("a profile in a trusted header", () => {
  const seat = (profile: string, name?: string) => ({ [SEAT_HEADERS.seat]: "explorer:nick", [SEAT_HEADERS.roles]: "family", [SEAT_HEADERS.profile]: profile, ...(name === undefined ? {} : { [SEAT_HEADERS.profileName]: name }) });

  it("is read as no profile with a bad id or no name, and is kept on no op", async () => {
    for (const headers of [seat("../bad~x", "Ann"), seat("prf_noname"), seat("prf_blank", "%20%20")]) {
      expect(seatFromHeaders(new Request("http://s.test/", { headers })).profile).toBeUndefined();
    }
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const response = await handler.handle(posted(seat("../bad~x", "Ann"), [{ name: "find-rock", args: { id: "rock:quartz" } }]));
    expect(response.ok).toBe(true);
    expect(handler.store.log.all().at(-1)!.author.profile).toBeUndefined();
    expect(handler.store.graph.out("rock:quartz", "foundBy" as never).map((one) => one.id)).toEqual(["explorer:nick"]);
  });

  it("has its name held to 200 before it is kept", () => {
    const read = seatFromHeaders(new Request("http://s.test/", { headers: seat("prf_long", "M".repeat(500)) }));
    expect(read.profile).toEqual({ id: "prf_long", name: "M".repeat(200) });
  });
});

describe("a request for a profile's person's id", () => {
  it("is refused over the wire, by id and ignored as a hint, and the profile's own first act makes it", async () => {
    const person = profilePersonId("explorer:nick", { id: "prf_mia" });
    let at: Principal = { kind: "human", id: "explorer:ann", roles: ["family"] };
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, seatOf: () => at });
    const byId = await handler.handle(posted({}, [{ name: "add-explorer", args: { name: "Evil", id: person } }]));
    expect(byId.ok).toBe(false);
    await handler.handle(posted({}, [{ name: "add-explorer", args: { name: "Evil" }, mintedHint: person }]));
    expect(handler.store.graph.has(person)).toBe(false);
    at = mia;
    await handler.handle(posted({}, [{ name: "find-rock", args: { id: "rock:quartz" } }]));
    expect(handler.store.graph.getNode(person)).toMatchObject({ name: "Mia" });
  });
});
