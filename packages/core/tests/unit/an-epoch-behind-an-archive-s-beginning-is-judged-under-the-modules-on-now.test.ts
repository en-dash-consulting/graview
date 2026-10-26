import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, Store, type AnySchema, type LogArchive, type Principal } from "../../src/index.js";
import { archivedSeenBy, archiveFrom } from "../../src/seat.js";

/**
 * AN EPOCH BEHIND AN ARCHIVE'S BEGINNING IS JUDGED UNDER THE MODULES ON
 * NOW (FR-12, FR-198, FR-214). `archivedSeenBy` judged each checkpoint kept
 * behind where a windowed archive begins in a store of its own, made with
 * the starting modules and an empty log: a module the workspace had turned
 * off since was on there, so a seat was served that module's records — and,
 * with no sight declared, the epoch as the store keeps it, `removed` and
 * all. Now each is judged under the modules on now, as the seat's own view
 * and the whole archive are, and what only the store judges by is never
 * served.
 */
const SCHEMA = createSchema([defineNode("memo", { fields: z.object({ title: z.string() }) }), defineNode("vaultItem", { fields: z.object({ title: z.string() }) })]);
const { defineMutation } = bindSchema(SCHEMA);
const put = defineMutation("put", {
  title: "Put",
  creates: ["memo", "vaultItem"],
  input: z.object({ kind: z.enum(["memo", "vaultItem"]), title: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.title, args.kind), kind: args.kind, title: args.title } as never);
  },
});
const MODULES = { vault: { kinds: ["vaultItem"] } };
const seat: Principal = { kind: "human", id: "bea", roles: ["member"] };
const SEES = { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: "*", kinds: ["memo", "vaultItem"] }] } as never;

function served(policy: unknown, offBeforeCompacting: boolean) {
  const store = new Store<AnySchema>({ schema: SCHEMA as never, mutations: [put] as never, modules: MODULES, ...(policy ? { policy } : {}) } as never);
  const apply = (kind: string, title: string) => store.apply({ name: "put", args: { kind, title } } as never);
  apply("vaultItem", "Vault one");
  apply("memo", "M0");
  apply("memo", "M1");
  const archives: LogArchive[] = [store.compact(store.checkpoint({ seq: 2 })!)];
  apply("memo", "M2");
  apply("memo", "M3");
  if (offBeforeCompacting) store.setEnabledModules([]);
  apply("memo", "M4");
  archives.push(store.compact(store.checkpoint({ seq: store.log.length })!));
  if (!offBeforeCompacting) store.setEnabledModules([]);
  const archive: LogArchive = { ops: archives.flatMap((one) => one.ops), epochs: archives.flatMap((one) => one.epochs) };
  const window = archiveFrom(store, archive, store.log.horizon - 1);
  const begins = window.epochs[0]!.seq;
  const behind = archive.epochs.filter((epoch) => epoch.seq < begins && epoch.removed !== undefined);
  expect(behind.length).toBeGreaterThan(0);
  return archivedSeenBy(store, { ops: window.ops, epochs: [...behind, ...window.epochs] }, seat, { from: 0, to: begins });
}

describe("an epoch behind an archive's beginning is judged under the modules on now", () => {
  for (const [label, policy] of [
    ["with no sight declared", undefined],
    ["with a sight that sees both kinds", SEES],
  ] as const) {
    for (const off of [false, true]) {
      it(`serves no record of a module turned off ${off ? "before the last compaction" : "since the last compaction"}, ${label}`, () => {
        const answer = served(policy, off);
        expect(answer.epochs.length).toBeGreaterThan(0);
        const kinds = answer.epochs.flatMap((epoch) => epoch.base.nodes.map((node) => node.kind));
        expect(kinds).toContain("memo");
        expect(kinds).not.toContain("vaultItem");
        for (const epoch of answer.epochs) {
          expect(epoch).not.toHaveProperty("removed");
          expect(epoch).not.toHaveProperty("writers");
        }
      });
    }
  }
});
