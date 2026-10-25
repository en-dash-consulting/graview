import { createSchema, defineNode, Store, z, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { unreadEdges, unreadEdgesSentence, type WorkerViewManifest } from "../../src/host/views.js";

/**
 * A VIEW IS TOLD ONLY OF THE RELATIONS ITS CODE USES (Roadmap
 * f-reads-edges-warning). A manifest's `reads.kinds` hands a view records
 * and only `reads.edges` the links between them, and Graview Cloud told
 * every season, game and era view to add every relation joining the kinds
 * it read — eras, coachedBy, homeField — though each drew every link it
 * used. Now a relation is said only when the view's code names it and the
 * manifest does not read it.
 */
const season = defineNode("season", {
  fields: z.object({ label: z.string() }),
  edges: { eras: { to: ["era"] }, coachedBy: { to: ["coach"] }, games: { to: ["game"] } },
});
const game = defineNode("game", { fields: z.object({ label: z.string() }), edges: { homeField: { to: ["venue"] }, playedIn: { to: ["season"] } } });
const era = defineNode("era", { fields: z.object({ label: z.string() }) });
const coach = defineNode("coach", { fields: z.object({ label: z.string() }) });
const venue = defineNode("venue", { fields: z.object({ label: z.string() }) });
const store = new Store({ schema: createSchema([season, game, era, coach, venue]) }) as unknown as Store<AnySchema>;

const seasons: WorkerViewManifest = { name: "seasons", attach: "season", cardinality: "many", reads: { kinds: ["game", "era", "coach", "venue"], edges: ["games"] } };
const DRAWS_GAMES = `graview.onProps((p) => graview.render(p.nodes.filter((n) => n.kind === "season").map((s) => p.edges.filter((e) => e.kind === "games" && e.from === s.id).length).join(" ")));`;

describe("the relations a view is told to read", () => {
  it("are none when it reads every relation its code names", () => {
    expect(unreadEdges(store, seasons, DRAWS_GAMES)).toEqual([]);
    expect(unreadEdgesSentence(store, seasons, DRAWS_GAMES)).toBeUndefined();
  });

  it("are the relations its code names and its manifest does not read, said with how to read them", () => {
    const source = `${DRAWS_GAMES} const coached = (p, s) => p.edges.filter((e) => e.kind === 'coachedBy' && e.from === s.id); const at = \`homeField\`;`;
    expect(unreadEdges(store, seasons, source)).toEqual(["coachedBy", "homeField"]);
    expect(unreadEdgesSentence(store, seasons, source)).toBe('"seasons" names coachedBy and homeField but does not read them, so the view is handed no such links: add "coachedBy" and "homeField" to its manifest\'s reads.edges.');
  });

  it("never a relation the code mentions only as part of a longer word, or joining a kind the view is not handed", () => {
    expect(unreadEdges(store, seasons, `const word = "erasure"; const x = p.eras;`)).toEqual([]);
    expect(unreadEdges(store, { ...seasons, reads: { kinds: ["game"], edges: ["games"] } }, `"eras" "coachedBy"`)).toEqual([]);
  });
});
