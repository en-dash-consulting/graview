import { describe, expect, it } from "vitest";
import { buildTracklists } from "../src/ui/tracklist.js";

/** The tracklist lens, pointed at a setlist: gigs, what they played, in what order. */
describe("the tracklist lens in a domain it was not written for", () => {
  it("lists a gig's songs in the order they were played", () => {
    const gigs = [{ id: "gig-1", kind: "gig", label: "The Roundhouse" }];
    const plays: Record<string, { id: string; kind: string; label: string; position?: number }[]> = {
      "gig-1": [
        { id: "s2", kind: "number", label: "Encore", position: 3 },
        { id: "s1", kind: "number", label: "Opener", position: 1 },
        { id: "s3", kind: "number", label: "The quiet one" },
      ],
    };
    const graph = { out: (id: string) => plays[id] ?? [] };
    const built = buildTracklists(gigs, graph, { entries: "plays", order: "position" }, (node) => String(node["label"]));
    expect(built[0]!.entries.map((entry) => entry.label)).toEqual(["Opener", "Encore", "The quiet one"]);
  });
});
