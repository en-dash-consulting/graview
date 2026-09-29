// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, type ViewComponent, type ViewProps } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ArrangeBar, registerDefaultViews, THUMBNAIL_BUDGET, withMore } from "../../src/index.js";
import { FAR_ENDS } from "../../src/arrange-bar.js";
import { Graph } from "@graview/core";

/**
 * A THUMBNAIL IS A PICTURE OF THE LENS, NOT THE LENS (docs/scale.md). A
 * drive-in hands its lens the most relevant members — never the population
 * — and says how many there are; a built-in lens handed fewer than there
 * are says how many more.
 */
const song = defineNode("song", { fields: z.object({ label: z.string(), at: z.string().optional() }), plural: "Songs" });
const schema = createSchema([song]);
const seen: { nodes: number; budget?: number; total?: number }[] = [];
const Lens: ViewComponent<typeof schema> = (props: ViewProps<typeof schema>) => {
  seen.push({ nodes: props.nodes?.length ?? 0, ...(props.budget !== undefined ? { budget: props.budget } : {}), ...(props.total !== undefined ? { total: props.total } : {}) });
  return <div>the lens</div>;
};
const members = Array.from({ length: 500 }, (_, i) => ({ id: `s${i}`, kind: "song", label: `Song ${i}` }));
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

describe("a drive-in's thumbnail", () => {
  it("hands its lens the most relevant members and the true total, never all of them", async () => {
    const registry = registerDefaultViews(schema, createViews(schema)).register("song", { cardinality: "many", fidelity: "full" }, Lens, { title: "The songs" });
    const store = new Store({ schema, snapshot: { nodes: members as never, edges: [] } });
    const Card = registry.lookup("song", { cardinality: "many", fidelity: "glyph" }) as ViewComponent<typeof schema>;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    seen.length = 0;
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={registry} initialView={{ ...EMPTY_VIEW, overview: true }}>
          <Card nodes={store.graph.nodesOfKind("song" as never) as never} fidelity="glyph" cardinality="many" mode="card" selected={false} label="Songs" />
        </GraviewProvider>,
      ),
    );
    // Thumbnails mount one a frame, once the scene is still: give it the frames.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));
    expect(seen.length, JSON.stringify(seen)).toBeGreaterThan(0);
    expect(seen.map((call) => call.nodes), JSON.stringify(seen)).toEqual(seen.map(() => THUMBNAIL_BUDGET));
    expect(seen.every((call) => call.nodes === THUMBNAIL_BUDGET && call.budget === THUMBNAIL_BUDGET && call.total === 500)).toBe(true);
    expect(host.querySelector('[data-graview-thumbnail="drawn"]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});

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
  it("holds the most connected, never the whole catalogue", () => {
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
