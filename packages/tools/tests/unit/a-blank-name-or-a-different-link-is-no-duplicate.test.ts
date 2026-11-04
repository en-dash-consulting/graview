import { createSchema, defineNode, Store, z, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { blocksOf } from "../../src/tidy/blocking.js";
import { duplicates, placeholderName, type JudgeContext } from "../../src/tidy/judges.js";

/*
 * A BLANK NAME, OR A DIFFERENT LINK, IS NO DUPLICATE. Seen on Staffing
 * Placement: four placements were merged because their labels all drew
 * "—", and the duplicates judge grouped them by that name and said "Same
 * name" at 0.9. A placeholder name — blank, dashes, punctuation alone,
 * "Untitled", "TBD", "N/A" — says nothing of which record it is; and two
 * records whose one-link relation points at different records (two
 * placements of different people, two Ada Lovelaces on different teams) are
 * two, whatever they are called. Neither the judge nor pair blocking pairs
 * them.
 */
const team = defineNode("team", { fields: z.object({ label: z.string() }) });
const placement = defineNode("placement", { fields: z.object({ label: z.string() }), edges: { team: { to: ["team"], cardinality: "one" }, helpers: { to: ["team"] } } });
const schema = createSchema([team, placement]);
const NOW = "2026-10-20T09:00:00.000Z";

type Row = { id: string; kind: string; label: string };
const teams: Row[] = [
  { id: "team:red", kind: "team", label: "Red team" },
  { id: "team:blue", kind: "team", label: "Blue team" },
];
const placements = (...labels: string[]): Row[] => labels.map((label, at) => ({ id: `placement:${at + 1}`, kind: "placement", label }));

function contextOf(nodes: readonly Row[], edges: readonly { kind: string; from: string; to: string }[] = []): JudgeContext {
  const store = new Store<AnySchema>({ schema: schema as unknown as AnySchema, now: () => NOW, snapshot: { nodes: [...teams, ...nodes], edges } as never });
  return { store, now: Date.parse(NOW), touched: new Map(), quietFor: 0, olderThanDays: 30 };
}
const merges = (context: JudgeContext) => duplicates.judge(context).map((one) => [one.calls[0]!.args, one.basis]);
const pairs = async (context: JudgeContext) => (await blocksOf(context, { families: new Set(["duplicates"]) })).pairs.filter((pair) => pair.kind === "placement").map((pair) => [pair.keeper.id, pair.other.id]);

describe("a placeholder name", () => {
  it("is blank, dashes, punctuation alone, or a word that stands in for a name", () => {
    for (const blank of ["", "  ", "—", "–", "-", "— · —", "–/–", "...", "Untitled", "untitled 3", "Untitled placement", "TBD", "tba", "N/A", "n.a.", "None", "Unknown", "?", "New placement"]) expect(placeholderName(blank, "placement"), blank).toBe(true);
    for (const name of ["Ada Lovelace", "Red team", "Notes", "TBD Studios", "A", "Untitled Goose Game"]) expect(placeholderName(name, "placement"), name).toBe(false);
  });

  it("groups no records as one, by the judge or by pair blocking", async () => {
    const context = contextOf(placements("—", "—", "— · —", "— · —", "Untitled", "Untitled", "TBD", "TBD", "N/A", "N/A", "-", "–"));
    expect(merges(context)).toEqual([]);
    expect(await pairs(context)).toEqual([]);
  });

  it("leaves a real shared name a duplicate", async () => {
    const context = contextOf(placements("Ada at the front desk", "Ada at the front desk", "—", "—"));
    expect(merges(context)).toEqual([[{ id: "placement:2", into: "placement:1" }, "Same name"]]);
    expect(await pairs(context)).toEqual([["placement:1", "placement:2"]]);
  });
});

describe("two records whose one-link relation points at different records", () => {
  it("are not merged, nor paired, though their names are the same", async () => {
    const context = contextOf(placements("Ada Lovelace", "Ada Lovelace"), [
      { kind: "team", from: "placement:1", to: "team:red" },
      { kind: "team", from: "placement:2", to: "team:blue" },
    ]);
    expect(merges(context)).toEqual([]);
    expect(await pairs(context)).toEqual([]);
  });

  it("are a duplicate when the relation points at the same record, or one of them is empty, or it is a many-link relation", async () => {
    const same = contextOf(placements("Ada Lovelace", "Ada Lovelace"), [
      { kind: "team", from: "placement:1", to: "team:red" },
      { kind: "team", from: "placement:2", to: "team:red" },
      { kind: "helpers", from: "placement:1", to: "team:red" },
      { kind: "helpers", from: "placement:2", to: "team:blue" },
    ]);
    expect(merges(same)).toHaveLength(1);
    const one = contextOf(placements("Ada Lovelace", "Ada Lovelace"), [{ kind: "team", from: "placement:1", to: "team:red" }]);
    expect(merges(one)).toHaveLength(1);
  });
});
