import { createMemoryAdapter, profilePersonId, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createStoreHandler, openRemote } from "../../src/index.js";

/**
 * A PROFILE'S FIRST ACT, OVER THE WIRE (Roadmap
 * f-viewer-state-and-me-framework). A page applies first and a server decides,
 * so the person made on first use is made in both, in the batch that used it:
 * the server's stands, the page's is rebased away, and the two logs agree. And
 * a server that asks its own `seatOf` believes no profile header.
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
  acts: { "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] } },
  policy: { grants: [{ roles: ["family"], mutations: ["find-rock"] }] },
};
const seed = {
  nodes: [
    { id: "user:nick", kind: "explorer", name: "Nick" },
    { id: "rock:quartz", kind: "rock", title: "Quartz" },
    { id: "rock:opal", kind: "rock", title: "Opal" },
  ],
  edges: [],
};
const compiled = compileDocument(DOCUMENT);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;
const mia: Principal = { kind: "human", id: "user:nick", name: "Nick", roles: ["family"], profile: { id: "prf_mia", name: "Mia" } };
const person = profilePersonId("user:nick", { id: "prf_mia" });

describe("a profile's first act over the wire", () => {
  it("makes its person once on the server, and the page's log and graph agree with it", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const remote = await openRemote({ app, url: "http://store.test", fetch: ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch, principal: mia, pollMs: 0 });
    const page = remote.store;
    page.apply({ name: "find-rock", args: { id: "rock:quartz" } });
    expect(page.graph.getNode(person)).toMatchObject({ name: "Mia" });
    await remote.settled();
    const held = handler.store;
    expect(held.graph.getNode(person)).toMatchObject({ kind: "explorer", name: "Mia" });
    expect(held.graph.out("rock:quartz", "foundBy" as never).map((one) => one.id)).toEqual([person]);
    expect(held.log.all().map((op) => op.intent)).toEqual(["Mia joins", "I found it: Quartz"]);
    expect(held.log.all().at(-1)!.author.profile).toEqual(mia.profile);
    expect(page.log.all().map((op) => op.id)).toEqual(held.log.all().map((op) => op.id));

    page.apply({ name: "find-rock", args: { id: "rock:opal" } });
    await remote.settled();
    expect(held.log.all().filter((op) => op.intent === "Mia joins")).toHaveLength(1);
    expect(page.log.all().map((op) => op.id)).toEqual(held.log.all().map((op) => op.id));
    remote.close();
  });

  it("is the host's to say where it asks its own seatOf: a client's profile header is not believed", async () => {
    const nick: Principal = { kind: "human", id: "user:nick", name: "Nick", roles: ["family"] };
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, seatOf: () => nick });
    const response = await handler.handle(
      new Request("http://store.test/graview/ops", {
        method: "POST",
        headers: { "content-type": "application/json", "x-graview-profile": "prf_someone", "x-graview-profile-name": "Somebody" },
        body: JSON.stringify({ calls: [{ name: "find-rock", args: { id: "rock:quartz" } }] }),
      }),
    );
    expect(response.ok).toBe(true);
    expect(handler.store.graph.out("rock:quartz", "foundBy" as never).map((one) => one.id)).toEqual(["user:nick"]);
    expect(handler.store.log.all().at(-1)!.author.profile).toBeUndefined();
  });
});
