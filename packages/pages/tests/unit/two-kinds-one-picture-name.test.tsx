import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { registerDefaultViews } from "@graview/primitives";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { galleryOf, PagesApp, type PageContext } from "../../src/index.js";

/**
 * TWO KINDS, ONE PICTURE'S NAME. A program registers "The timetable" on
 * its talks and on its workshops: the scene tells them apart by kind, but
 * the pages addressed a picture by its name alone — both cards linked to
 * the talks' timetable, the workshops' had no page, and React was handed
 * two children keyed "place:the-timetable".
 */
const talk = defineNode("talk", { fields: z.object({ label: z.string() }), plural: "Talks", description: "A talk." });
const workshop = defineNode("workshop", { fields: z.object({ label: z.string() }), plural: "Workshops", description: "A workshop." });
const schema = createSchema([talk, workshop]);
const Timetable: ViewComponent<typeof schema> = ({ nodes }) => (
  <div data-testid="timetable">{(nodes ?? []).map((node) => (node as { label: string }).label).join(", ")}</div>
);
const context = (): PageContext<typeof schema> => ({
  store: new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "t1", kind: "talk", label: "Opening talk" },
        { id: "w1", kind: "workshop", label: "Clay workshop" },
      ] as never,
      edges: [],
    },
  }),
  views: registerDefaultViews(schema, createViews(schema))
    .register("talk", { cardinality: "many", fidelity: "full" }, Timetable, { title: "The timetable" })
    .register("workshop", { cardinality: "many", fidelity: "full" }, Timetable, { title: "The timetable" }),
});

describe("two kinds, one picture's name", () => {
  it("gives each its own key and its own address", () => {
    const entries = galleryOf(context()).filter((entry) => entry.key.startsWith("place:"));
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(2);
    expect(new Set(entries.map((entry) => entry.to)).size).toBe(2);
  });

  it("draws the workshops' timetable at the workshops' address", () => {
    const workshops = galleryOf(context()).find((entry) => entry.kind === "workshop" && entry.key.startsWith("place:"))!;
    const html = renderToStaticMarkup(<PagesApp context={context()} initialPath={workshops.to} />);
    expect(html).toContain("Clay workshop");
    expect(html).not.toContain("Opening talk");
  });
});
