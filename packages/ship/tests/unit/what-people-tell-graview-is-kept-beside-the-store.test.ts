import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSchema, defineNode, Store, type Principal } from "@graview/core";
import { memoryTold, toldOver, type TellingDraft } from "@graview/core/told";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createFileAdapter, fileTold, toldDoor, toldFileOf } from "../../src/index.js";

/*
 * WHAT PEOPLE TELL GRAVIEW ON THE WIRE (Roadmap f-menu-learns): one route,
 * `/graview/told`, its author the session's; `told.json` beside the store.
 */
const ada: Principal = { kind: "human", id: "ada" };
const bo: Principal = { kind: "human", id: "bo" };
const owner: Principal = { kind: "human", id: "olu", roles: ["owner"] };
const draft = (extra: Partial<TellingDraft> = {}): TellingDraft => ({ words: "mark these done", target: { on: "record", kind: "list", id: "week" }, reading: { which: "held", kind: "task", records: ["a", "b"] }, decided: { type: "act", act: "finish", records: 2 }, outcome: "previewed", ...extra });
const post = (body: unknown) => JSON.stringify(body);

describe("a telling is kept with what it did and how it ended, on the wire", () => {
  it("keeps it as the session's author, never the body's, and its teller says how it ended and rates it", async () => {
    const store = memoryTold();
    const door = toldDoor({ store, curates: (seat) => seat.roles?.includes("owner") === true });
    const kept = await door("POST", "", post({ telling: { ...draft(), id: "tl-1", by: { kind: "human", id: "mallory" } } }), ada);
    expect(kept.status).toBe(201);
    expect(store.list()[0]!.by).toEqual({ kind: "human", id: "ada" });
    expect((await door("PATCH", "/tl-1", post({ change: { outcome: "accepted", rating: "down", should: "Only the open ones" } }), ada)).status).toBe(200);
    expect(store.list()[0]).toMatchObject({ outcome: "accepted", rating: "down", should: "Only the open ones" });
    // Somebody else may not rate it, nor see it as theirs.
    expect((await door("PATCH", "/tl-1", post({ change: { rating: "up" } }), bo)).status).toBe(404);
    // Its teller may not exclude it; an owner may, and may not rate it.
    expect((await door("PATCH", "/tl-1", post({ change: { excluded: true } }), ada)).status).toBe(403);
    expect((await door("PATCH", "/tl-1", post({ change: { rating: "up" } }), owner)).status).toBe(403);
    expect((await door("PATCH", "/tl-1", post({ change: { excluded: true } }), owner)).status).toBe(200);
    expect(store.list()[0]!.excluded).toBe(true);
    expect((await door("DELETE", "/tl-1", "", owner)).status).toBe(204);
    expect(store.list()).toEqual([]);
  });

  it("keeps nothing of a visitor's, and tells a visitor nothing", async () => {
    const store = memoryTold();
    const door = toldDoor({ store });
    expect((await door("POST", "", post({ telling: draft() }), { kind: "visitor", id: "v" })).status).toBe(202);
    expect((await door("GET", "", "", { kind: "visitor", id: "v" })).status).toBe(403);
    expect(store.list()).toEqual([]);
  });

  it("serves a reader their own and another person's only once two others' agree; an owner every one", async () => {
    const store = memoryTold();
    const door = toldDoor({ store, curates: (seat) => seat.id === "olu" });
    await door("POST", "", post({ telling: draft({ outcome: "accepted" }) }), bo);
    const read = async (seat: Principal) => ((await door("GET", "", "", seat)).body as { tellings: unknown[] }).tellings.length;
    expect(await read(ada)).toBe(0);
    await door("POST", "", post({ telling: draft({ outcome: "accepted", words: "finish all these" }) }), { kind: "human", id: "cy" });
    expect(await read(ada)).toBe(2);
    expect(await read(owner)).toBe(2);
  });
});

describe("a viewer never sees a telling about a record they cannot see, on the wire", () => {
  it("leaves out a telling naming a record hidden from the asker", async () => {
    const note = defineNode("note", { fields: z.object({ label: z.string() }), label: (node) => node.label });
    const task = defineNode("task", { fields: z.object({ label: z.string() }), label: (node) => node.label });
    const app = new Store({
      schema: createSchema([note, task]),
      mutations: [],
      policy: { grants: [], sees: [{ roles: "*", kinds: ["task"] }, { roles: ["staff"], kinds: ["note"] }] } as never,
      snapshot: { nodes: [{ id: "mine", kind: "task", label: "Mine" }, { id: "theirs", kind: "note", label: "Staff only" }] as never, edges: [] },
    });
    const store = memoryTold();
    const door = toldDoor({ store, app: app as never, curates: () => true });
    await door("POST", "", post({ telling: draft({ target: { on: "record", kind: "task", id: "mine" }, reading: undefined }) }), ada);
    await door("POST", "", post({ telling: draft({ target: { on: "record", kind: "note", id: "theirs" }, reading: undefined }) }), ada);
    const seen = ((await door("GET", "", "", ada)).body as { tellings: { target: { id: string } }[] }).tellings.map((one) => one.target.id);
    expect(seen).toEqual(["mine"]);
  });
});

describe("told.json", () => {
  it("is kept beside the store, and read again by another process", () => {
    const root = mkdtempSync(join(tmpdir(), "told-"));
    const path = toldFileOf({ adapter: createFileAdapter(root), where: root }, "todo");
    expect(path).toBe(join(root, "todo", "told.json"));
    const one = fileTold(path);
    const door = toldDoor({ store: one });
    return door("POST", "", post({ telling: { ...draft(), id: "tl-9" } }), ada).then(() => {
      const other = fileTold(path);
      expect(other.list().map((telling) => telling.id)).toEqual(["tl-9"]);
      other.change("tl-9", { rating: "up" });
      expect(one.list()[0]!.rating).toBe("up");
      other.remove("tl-9");
      expect(one.list()).toEqual([]);
    });
  });

  it("is what a page reaches through toldOver, which stops asking a host that keeps none", async () => {
    const calls: string[] = [];
    const told = toldOver("https://app.test", { fetch: (async (url: string, init?: RequestInit) => (calls.push(`${init?.method ?? "GET"} ${url}`), new Response("{}", { status: 410 }))) as never });
    await told.add({ id: "tl-1" } as never);
    await told.change("tl-1", { rating: "up" });
    expect(calls).toEqual(["POST https://app.test/graview/told"]);
    expect(await told.list()).toEqual([]);
  });
});

describe("a host that keeps what people tell Graview, checked as Graview checks its own", () => {
  it("graview serve's door passes the told-host check", async () => {
    const { checkToldHost } = await import("@graview/core/conformance");
    const note = defineNode("note", { fields: z.object({ label: z.string() }), label: (node) => node.label });
    const task = defineNode("task", { fields: z.object({ label: z.string() }), label: (node) => node.label });
    const app = new Store({
      schema: createSchema([note, task]),
      mutations: [],
      policy: { grants: [], sees: [{ roles: "*", kinds: ["task"] }, { roles: ["staff"], kinds: ["note"] }] } as never,
      snapshot: { nodes: [{ id: "open", kind: "task", label: "Open" }, { id: "staff", kind: "note", label: "Staff only" }] as never, edges: [] },
    });
    const store = memoryTold();
    const door = toldDoor({ store, app: app as never });
    const host = {
      as: (seat: Principal) => ({
        add: async (telling: unknown) => void (await door("POST", "", JSON.stringify({ telling }), seat)),
        change: async (id: string, change: unknown) => void (await door("PATCH", `/${id}`, JSON.stringify({ change }), seat)),
        remove: async (id: string) => void (await door("DELETE", `/${id}`, "", seat)),
        list: async () => ((await door("GET", "", "", seat)).body as { tellings?: never[] }).tellings ?? [],
      }),
    };
    const report = await checkToldHost(host, { people: [ada, bo, { kind: "human", id: "cy" }], seen: "open", hidden: "staff" });
    expect(report.said).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
