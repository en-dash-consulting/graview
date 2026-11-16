import { createMemoryAdapter, nameOfAuthor, PERSON_SEAT, type AnySchema, type Epoch, type GraviewApp, type LogArchive, type Operation, type PersistenceAdapter, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { serve } from "../../src/cli.js";
import { createFileAdapter } from "../../src/file-adapter.js";
import { exportBundle, migrateProfilePeople, openStore, profilePeopleCount } from "../../src/index.js";

/**
 * A STORE KEPT BY AN EARLIER VERSION, OPENED BY THIS ONE: each profile's
 * person is given an id of its own and its seat's mark, in the graph, every
 * link and field, every op and history entry, each epoch and checkpoint and
 * what a compaction archived — so history still says who did it and undo
 * still takes it back. Run again, it changes nothing; a run that stopped
 * part way finishes with the same ids; a dry run counts and writes nothing.
 */
const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Rocks",
  roles: ["family"],
  kinds: {
    explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true } } },
    rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true }, signed: { type: "string" } }, edges: { foundBy: { to: ["explorer"], description: "who found it", inverse: "what they found" } } },
  },
  acts: {
    "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] },
    sign: { title: "Sign it", on: "rock", effects: [{ set: { signed: "$me" } }] },
  },
  policy: { grants: [{ roles: ["family"], mutations: "*" }], sees: [{ roles: ["family"], kinds: ["rock", "explorer"] }] },
};
const compiled = compileDocument(DOCUMENT);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;
const seed = { nodes: [{ id: "user:ann", kind: "explorer", name: "Ann" }, ...["quartz", "opal", "jade", "onyx"].map((rock) => ({ id: `rock:${rock}`, kind: "rock", title: rock }))], edges: [] };
const ACCOUNT = "acct-4d8w";
const SEAT = `${ACCOUNT}~prf_mia`;
const mia: Principal = { kind: "human", id: ACCOUNT, name: "Household", roles: ["family"], profile: { id: "prf_mia", name: "Mia" } };
const ann: Principal = { kind: "human", id: "user:ann", name: "Ann", roles: ["family"] };

type Adapter = ReturnType<typeof createMemoryAdapter>;

/** Everything an adapter keeps for the scope, as JSON. */
async function keptOf(adapter: PersistenceAdapter<string>, scope = app.name) {
  return {
    snapshot: await adapter.load(scope),
    log: await adapter.loadLog!(scope),
    epochs: await adapter.loadEpochs!(scope),
    archive: await adapter.loadArchive!(scope),
  };
}

/** A value as the earlier version kept it: `to` for `from`, and no seat mark. */
function earlier(value: unknown, from: string, to: string): unknown {
  if (typeof value === "string") return value === from ? to : value;
  if (Array.isArray(value)) return value.map((one) => earlier(one, from, to));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== PERSON_SEAT).map(([key, one]) => [key === from ? to : key, earlier(one, from, to)]));
  return value;
}

/**
 * A store as an earlier version would have kept it: Mia found and signed
 * rocks, took one back, a compaction archived the start, and she went on —
 * then every place her person is named, named the earlier way.
 */
async function keptBefore<A extends PersistenceAdapter<string> = Adapter>(into?: A): Promise<A> {
  const made = createMemoryAdapter();
  const opened = await openStore({ app, adapter: made, seed: seed as never, tick: false });
  const { store } = opened;
  store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
  store.apply({ name: "sign", args: { id: "rock:quartz" } }, { author: mia });
  const opal = store.apply({ name: "find-rock", args: { id: "rock:opal" } }, { author: mia });
  store.undo(opal.batch, { author: mia });
  store.apply({ name: "find-rock", args: { id: "rock:jade" } }, { author: ann });
  await opened.flush();
  await opened.compact({ seq: 3 });
  store.apply({ name: "find-rock", args: { id: "rock:onyx" } }, { author: mia });
  await opened.flush();
  opened.close();
  const person = store.personOf(mia)!;
  const kept = await keptOf(made);
  const adapter = (into ?? createMemoryAdapter()) as A;
  await adapter.save(app.name, earlier(kept.snapshot, person, SEAT) as never);
  await adapter.appendOps!(app.name, earlier(kept.log, person, SEAT) as Operation[]);
  await adapter.saveEpochs!(app.name, earlier(kept.epochs, person, SEAT) as Epoch[]);
  await adapter.replaceArchive!(app.name, earlier(kept.archive, person, SEAT) as LogArchive);
  return adapter;
}

/** How many times `id` is said in what is kept, and how many of those are a seat's mark. */
function said(kept: unknown, id: string): { readonly all: number; readonly marks: number } {
  const text = JSON.stringify(kept);
  return { all: text.split(JSON.stringify(id)).length - 1, marks: text.split(`${JSON.stringify(PERSON_SEAT)}:${JSON.stringify(id)}`).length - 1 };
}

describe("a store kept by an earlier version", () => {
  it("holds the earlier ids where this test made them", async () => {
    const kept = await keptOf(await keptBefore());
    expect(said(kept, SEAT).all).toBeGreaterThan(5);
    expect(said(kept, SEAT).marks).toBe(0);
    expect(kept.archive.ops.length).toBeGreaterThan(0);
  });

  it("opens with each profile's person under an id of its own, named nowhere the earlier way but in its seat's mark", async () => {
    const adapter = await keptBefore();
    const opened = await openStore({ app, adapter, tick: false, verify: true });
    expect(opened.rebuilt).toBeUndefined();
    expect(opened.verified?.ok).toBe(true);
    expect(opened.profilePeople?.count).toMatchObject({ records: 1, links: 2 });
    const { store } = opened;
    const person = store.personOf(mia)!;
    expect(person).not.toContain(ACCOUNT);
    expect(store.graph.getNode(person)).toMatchObject({ name: "Mia", [PERSON_SEAT]: SEAT });
    expect(store.graph.out("rock:quartz", "foundBy" as never).map((one) => one.id)).toEqual([person]);
    expect(store.graph.out("rock:onyx", "foundBy" as never).map((one) => one.id)).toEqual([person]);
    expect((store.graph.getNode("rock:quartz") as unknown as { signed: string }).signed).toBe(person);
    const kept = await keptOf(adapter);
    const { all, marks } = said(kept, SEAT);
    expect(all).toBe(marks);
    expect(marks).toBeGreaterThan(0);
    // The full export, archive and all, the same.
    const bundle = await exportBundle(app, store, { full: true });
    expect(said(bundle, SEAT).all).toBe(said(bundle, SEAT).marks);
    opened.close();
  });

  it("serves another member the person as its own record", async () => {
    const { store, close } = await openStore({ app, adapter: await keptBefore(), tick: false });
    const seen = store.seenBy(ann);
    expect(seen.graph.getNode(store.personOf(mia)!)).toMatchObject({ name: "Mia" });
    expect(JSON.stringify(seen.graph.snapshot())).not.toContain(ACCOUNT);
    expect(JSON.stringify(seen.log.all())).not.toContain(ACCOUNT);
    close();
  });

  it("still says who did it, still takes back what they did, and makes no second person", async () => {
    const { store, close } = await openStore({ app, adapter: await keptBefore(), tick: false });
    const where = { graph: store.graph as never, schema: store.schema };
    const last = store.log.all().at(-1)!;
    expect(nameOfAuthor(last.author, where)).toBe("Mia (Household)");
    store.undo(last.batch, { author: mia });
    expect(store.graph.out("rock:onyx", "foundBy" as never)).toEqual([]);
    store.apply({ name: "find-rock", args: { id: "rock:onyx" } }, { author: mia });
    expect(store.graph.out("rock:onyx", "foundBy" as never).map((one) => one.id)).toEqual([store.personOf(mia)]);
    expect(store.graph.allNodes().filter((one) => one.kind === "explorer")).toHaveLength(2);
    expect(store.log.all().filter((op) => op.intent === "Mia joins")).toHaveLength(0);
    close();
  });

  it("is left as it is the second time, and by a store with nobody to rename", async () => {
    const adapter = await keptBefore();
    (await openStore({ app, adapter, tick: false })).close();
    const once = await keptOf(adapter);
    const again = await openStore({ app, adapter, tick: false });
    again.close();
    expect(again.profilePeople?.count.records ?? 0).toBe(0);
    // What another app's links are renamed by is read again from what the store keeps.
    expect(again.profilePeople?.linked.get(`explorer:${SEAT}`)).toBe(`explorer:${again.store.personOf(mia)}`);
    expect(await keptOf(adapter)).toEqual(once);
    expect(await migrateProfilePeople({ app, adapter })).toMatchObject({ count: { records: 0, ops: 0 } });
    expect(await keptOf(adapter)).toEqual(once);

    const none = createMemoryAdapter();
    const plain = await openStore({ app, adapter: none, seed: seed as never, tick: false });
    plain.store.apply({ name: "find-rock", args: { id: "rock:jade" } }, { author: ann });
    await plain.flush();
    plain.close();
    const before = await keptOf(none);
    expect((await migrateProfilePeople({ app, adapter: none })).count).toMatchObject({ records: 0, links: 0, fields: 0, ops: 0, epochs: 0 });
    expect(await keptOf(none)).toEqual(before);
  });

  it("is counted by a dry run that writes nothing", async () => {
    const adapter = await keptBefore();
    const before = await keptOf(adapter);
    const { count } = await profilePeopleCount({ app, adapter });
    expect(count.records).toBe(1);
    expect(count.links).toBe(2);
    expect(count.fields).toBe(1);
    expect(count.ops).toBeGreaterThan(3);
    expect(count.epochs).toBeGreaterThan(0);
    expect(await keptOf(adapter)).toEqual(before);
  });

  it("finishes a run that stopped part way with the same ids", async () => {
    const adapter = await keptBefore();
    const meta = new Map<string, unknown>();
    let fail = true;
    const failing = {
      ...adapter,
      loadMeta: (scope: string) => (meta.get(scope) ?? null) as never,
      saveMeta: (scope: string, value: unknown) => void meta.set(scope, value),
      replaceLog: async (scope: string, ops: readonly Operation[]) => {
        if (fail) throw new Error("the disk went away");
        return adapter.replaceLog!(scope, ops);
      },
    };
    await expect(migrateProfilePeople({ app, adapter: failing, version: 1 })).rejects.toThrow(/disk went away/);
    const half = await keptOf(adapter);
    // The archive and the epochs were written; the log and the graph were not.
    expect(said(half.archive, SEAT).all).toBe(said(half.archive, SEAT).marks);
    expect(said(half.log, SEAT).marks).toBe(0);
    fail = false;
    await migrateProfilePeople({ app, adapter: failing, version: 1 });
    const kept = await keptOf(adapter);
    expect(said(kept, SEAT).all).toBe(said(kept, SEAT).marks);
    const renamed = (meta.get(app.name) as { profilePeople: { renamed: Record<string, string>; done?: true } }).profilePeople;
    expect(renamed.done).toBe(true);
    const person = renamed.renamed[SEAT]!;
    expect(JSON.stringify(kept.archive)).toContain(JSON.stringify(person));
    expect(JSON.stringify(kept.log)).toContain(JSON.stringify(person));
    const opened = await openStore({ app, adapter, tick: false, verify: true });
    expect(opened.verified).toMatchObject({ ok: true });
    expect(opened.store.personOf(mia)).toBe(person);
    opened.close();
  });

  it("is not opened where a write stops part way, and the next open finishes with the same ids, with no meta", async () => {
    const adapter = await keptBefore();
    let fail = true;
    const failing = {
      ...adapter,
      replaceLog: async (scope: string, ops: readonly Operation[]) => {
        if (fail) throw new Error("the disk went away");
        return adapter.replaceLog!(scope, ops);
      },
    };
    await expect(openStore({ app, adapter: failing, tick: false })).rejects.toThrow(/disk went away/);
    fail = false;
    const opened = await openStore({ app, adapter: failing, tick: false, verify: true });
    expect(opened.verified).toMatchObject({ ok: true });
    const person = opened.store.personOf(mia)!;
    opened.close();
    const kept = await keptOf(adapter);
    expect(said(kept, SEAT).all).toBe(said(kept, SEAT).marks);
    // One person, by one id, in the archive, the epochs, the log and the graph alike.
    const ids = new Set(JSON.stringify(kept).match(/"explorer:[a-z0-9-]+"/g));
    expect([...ids]).toEqual([JSON.stringify(person)]);
    const reopened = await openStore({ app, adapter, tick: false, verify: true });
    expect(reopened.verified).toMatchObject({ ok: true });
    reopened.close();
  });

  it("never renames a person onto a record an invitation bound to the same seat since", async () => {
    const adapter = await keptBefore();
    const kept = await keptOf(adapter);
    // Mia's earlier person removed, and her seat bound to Ann's record by the host after.
    const person = kept.snapshot!.nodes.find((node) => node.id === SEAT)!;
    const seq = kept.log.at(-1)!.seq + 1;
    const removed: Operation = { id: "op-removed", seq, batch: "b-removed", author: { kind: "system" }, intent: "Removed", mutation: null, primitives: [{ op: "remove-node", node: person as never }], reads: [], writes: [SEAT], at: "2026-11-16T00:00:00.000Z" };
    const bound: Operation = { id: "op-bound", seq: seq + 1, batch: "b-bound", author: { kind: "system" }, intent: "Bound", mutation: { name: "bind-person", args: { record: "user:ann", seat: SEAT } }, primitives: [{ op: "patch-node", id: "user:ann", before: { [PERSON_SEAT]: null }, after: { [PERSON_SEAT]: SEAT } } as never], reads: [], writes: ["user:ann"], at: "2026-11-16T00:00:01.000Z" };
    await adapter.appendOps!(app.name, [removed, bound]);
    await adapter.save(app.name, { ...kept.snapshot!, nodes: kept.snapshot!.nodes.filter((node) => node.id !== SEAT).map((node) => (node.id === "user:ann" ? { ...node, [PERSON_SEAT]: SEAT } : node)), edges: kept.snapshot!.edges.filter((edge) => edge.to !== SEAT) } as never);
    const opened = await openStore({ app, adapter, tick: false });
    const linked = opened.profilePeople!.linked;
    opened.close();
    const after = await keptOf(adapter);
    const renamedTo = JSON.parse(JSON.stringify(after.log)).find((op: Operation) => op.id === "op-removed").primitives[0].node.id as string;
    expect(renamedTo).not.toBe("user:ann");
    expect(renamedTo).not.toBe(SEAT);
    expect(linked.get(`explorer:${SEAT}`)).toBe(`explorer:${renamedTo}`);
    expect([...linked.values()]).not.toContain("explorer:user:ann");
  });

  it("is not opened by an adapter that cannot write it back, which says so and changes nothing", async () => {
    const adapter = await keptBefore();
    const before = await keptOf(adapter);
    const { replaceLog: _replaceLog, ...unable } = adapter;
    await expect(openStore({ app, adapter: { ...unable, name: "mine" }, tick: false })).rejects.toThrow(/cannot replace a log/);
    expect(await keptOf(adapter)).toEqual(before);
  });

  it("is said by serve's dry run, writing nothing, and then done in a folder by opening it", async () => {
    const folder = mkdtempSync(join(tmpdir(), "graview-profile-people-"));
    try {
      writeFileSync(join(folder, "app.json"), JSON.stringify(DOCUMENT));
      const data = join(folder, "data");
      const adapter = await keptBefore(createFileAdapter(data));
      const before = await keptOf(adapter);
      const out: string[] = [];
      const spied = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (out.push(String(chunk)), true));
      try {
        expect(await serve([join(folder, "app.json"), "--dry-run", "--json", "--data", data])).toBe(0);
      } finally {
        spied.mockRestore();
      }
      const told = JSON.parse(out.join("")) as { steps: unknown[]; profilePeople: { records: number; links: number; ops: number } };
      expect(told.steps).toEqual([]);
      expect(told.profilePeople).toMatchObject({ records: 1, links: 2 });
      expect(told.profilePeople.ops).toBeGreaterThan(3);
      expect(await keptOf(adapter)).toEqual(before);
      expect(adapter.loadMeta(app.name)).toBeNull();

      const opened = await openStore({ app, adapter, tick: false, verify: true });
      expect(opened.verified).toMatchObject({ ok: true });
      opened.close();
      const kept = await keptOf(adapter);
      expect(said(kept, SEAT).all).toBe(said(kept, SEAT).marks);
      expect(adapter.loadMeta(app.name)?.profilePeople).toMatchObject({ done: true, renamed: { [SEAT]: opened.store.personOf(mia) } });
      const reopened = await openStore({ app, adapter, tick: false, verify: true });
      expect(reopened.verified).toMatchObject({ ok: true });
      expect(reopened.store.personOf(mia)).toBe(opened.store.personOf(mia));
      reopened.close();
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("renames another app's link to the person with what the first run says", async () => {
    const adapter = await keptBefore();
    const opened = await openStore({ app, adapter, tick: false });
    const linked = opened.profilePeople!.linked;
    const person = opened.store.personOf(mia)!;
    opened.close();
    expect(linked.get(`explorer:${SEAT}`)).toBe(`explorer:${person}`);
    // Another app, one of whose records links Mia's person the earlier way.
    const far = createMemoryAdapter();
    await far.save("Shelf", { nodes: [{ id: "shelf:1", kind: "rock", title: "Shelf", signed: `explorer:${SEAT}` }], edges: [] } as never);
    await migrateProfilePeople({ app, adapter: far, scope: "Shelf", also: linked });
    expect(((await far.load("Shelf"))!.nodes[0] as unknown as { signed: string }).signed).toBe(`explorer:${person}`);
  });
});
