import { readFileSync } from "node:fs";
import { createMemoryAdapter, isWithheld, type Operation, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createStoreHandler, seatHeaders } from "../../src/index.js";

/**
 * A GIVER IS SERVED ONLY THEIR OWN MATCH (the Roadmap's "visibility scoped
 * by relation"). The Secret Santa document shows a participant a match only
 * via `givenBy`; over the wire — the state, a poll, the export — Ann is
 * sent the match she gives in, and the match she receives in is withheld in
 * place, never its note, its id or who drew it.
 */
const santa = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/secret-santa.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(santa);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app;
const organizer: Principal = { kind: "human", id: "p_org", roles: ["organizer"] };
const ann: Principal = { kind: "human", id: "p_ann", roles: ["participant"] };
const at = (path: string, principal: Principal) => new Request(`https://store.example${path}`, { headers: { "content-type": "application/json", ...seatHeaders(principal) } });

async function drawn() {
  const seed = {
    nodes: [
      { id: "p_ann", kind: "participant", name: "Ann" },
      { id: "p_bo", kind: "participant", name: "Bo" },
    ],
    edges: [],
  };
  const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
  handler.store.apply({ name: "draw", args: { note: "Ann for Bo", giver: "p_ann", receiver: "p_bo" } }, { author: organizer });
  handler.store.apply({ name: "draw", args: { note: "Bo for Ann", giver: "p_bo", receiver: "p_ann" } }, { author: organizer });
  return handler;
}

describe("a sight via a relation, over the wire", () => {
  it("serves a giver the match they give in and withholds the one they receive in", async () => {
    const handler = await drawn();
    const theirs = handler.store.graph.in("p_ann", "givesTo")[0]!.id;
    const state = (await (await handler.handle(at("/graview/state", ann))).json()) as { snapshot: { nodes: { id: string; kind: string }[] }; log: Operation[] };
    expect(state.snapshot.nodes.filter((node) => node.kind === "match").map((node) => (node as { note?: string }).note)).toEqual(["Ann for Bo"]);
    expect(state.log.map(isWithheld)).toEqual([false, true]);
    for (const path of ["/graview/state", "/graview/since?seq=-1", "/graview/export"]) {
      const said = JSON.stringify(await (await handler.handle(at(path, ann))).json());
      expect(said, path).toContain("Ann for Bo");
      expect(said, path).not.toContain("Bo for Ann");
      expect(said, path).not.toContain(theirs);
    }
  });
});
