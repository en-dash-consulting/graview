import { createSchema, defineNode, readableFields, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews } from "../../src/index.js";

/**
 * A CHIP SAYS WHAT IT IS. A song's card at summary read "8 · 4:27 · Yes":
 * a track number, a length and whether it is explicit, and not one word to
 * say which was which. The routed face had already learned this in its list
 * lines; the scene's card and the pages' gallery had not.
 */
const song = defineNode("song", {
  fields: z.object({ label: z.string(), track: z.number(), duration: z.number(), explicit: z.boolean(), status: z.enum(["released", "demo"]) }),
  plural: "Songs",
  label: (node) => node.label,
  display: {
    labels: { track: "Track", duration: "Length" },
    format: { duration: (value) => `${Math.floor(Number(value) / 60)}:${String(Number(value) % 60).padStart(2, "0")}` },
  },
});
const schema = createSchema([song]);
const node = { id: "song:after-midnight", kind: "song" as const, label: "After Midnight", track: 8, duration: 267, explicit: true, status: "released" as const };

describe("a field read on its own", () => {
  it("carries its label when the value is a number or a yes/no, and not when it is a word", () => {
    const alone = readableFields(node, song).map((field) => field.alone);
    expect(alone).toEqual(["Track 8", "Length 4:27", "Explicit: yes", "Released"]);
  });

  it("is what the summary card's chips say", () => {
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [node] as never, edges: [] } });
    const views = registerDefaultViews(schema, createViews(schema));
    const Summary = views.lookup("song", { cardinality: "one", fidelity: "summary" })!;
    const html = renderToStaticMarkup(
      <GraviewProvider store={store} views={views} initialView={EMPTY_VIEW}>
        <Summary node={node as never} fidelity="summary" cardinality="one" mode="scene" selected={false} />
      </GraviewProvider>,
    );
    expect(html).toContain("Track 8");
    expect(html).toContain("Length 4:27");
    expect(html).toContain("Explicit: yes");
    expect(html).not.toMatch(/>Yes</);
  });
});
