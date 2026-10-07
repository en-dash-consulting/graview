// @vitest-environment jsdom
import { createSchema, defineNode } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ArrangeBar, withMore } from "../../src/index.js";
import { FAR_ENDS } from "../../src/arrange-bar.js";
import { Graph } from "@graview/core";

/**
 * A LENS HANDED FEWER THAN THERE ARE SAYS HOW MANY MORE (docs/scale.md),
 * and a menu of far ends holds the most connected, never the catalog. (A
 * drive-in's thumbnail handed its lens the most relevant twelve; since
 * FR-118 a drive-in says its showings by name and draws no lens small.)
 */
const song = defineNode("song", { fields: z.object({ label: z.string(), at: z.string().optional() }), plural: "Songs" });
const schema = createSchema([song]);
const members = Array.from({ length: 500 }, (_, i) => ({ id: `s${i}`, kind: "song", label: `Song ${i}` }));

describe("a built-in lens handed fewer than there are", () => {
  // The board, the timeline and the calendar all return their picture through `withMore`.
  it("says how many more, in the kind's words, and nothing when it holds them all", () => {
    const drawn = members.slice(0, 3);
    expect(renderToStaticMarkup(withMore({ nodes: drawn, total: 40 }, schema, <div>picture</div>))).toContain("+37 more songs");
    expect(renderToStaticMarkup(withMore({ nodes: drawn, total: 3 }, schema, <div>picture</div>))).not.toContain("more");
    expect(renderToStaticMarkup(withMore({ nodes: drawn }, schema, <div>picture</div>))).not.toContain("more");
  });
});

describe("the row's menu of far ends", () => {
  // A release's "only…" listed every song: 1,177 options in every row that offered it.
  it("holds the most connected, never the whole catalog", () => {
    const release = defineNode("release", { fields: z.object({ label: z.string() }), edges: { tracks: { to: ["song"], description: "the songs on it", inverse: "the releases it is on" } }, plural: "Releases" });
    const both = createSchema([song, release]);
    const graph = Graph.from(both, {
      nodes: [...members, { id: "r1", kind: "release", label: "One" }, { id: "r2", kind: "release", label: "Two" }] as never,
      edges: [{ kind: "tracks", from: "r1", to: "s7" }, { kind: "tracks", from: "r2", to: "s7" }],
    });
    const html = renderToStaticMarkup(<ArrangeBar schema={both} graph={graph as never} kind="release" arrangement={{}} onChange={() => {}} />);
    const options = [...html.matchAll(/<option value="tracks:([^"]+)"/g)].map((match) => match[1]).filter((value) => value !== "*" && value !== "none");
    expect(options.length).toBe(FAR_ENDS);
    // The most connected is among them.
    expect(options).toContain("s7");
  });
});
