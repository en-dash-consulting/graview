import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DerivedForm } from "../../src/index.js";

/**
 * THE BUTTON SAYS WHAT THE HEADING SAYS. An act that ties is offered from
 * both ends; standing on a song, "Place it in an era" was the heading and
 * "Put it in the era" — the era's own words — the button under it.
 */
const song = defineNode("song", { fields: z.object({ label: z.string() }), plural: "Songs" });
const era = defineNode("era", {
  fields: z.object({ label: z.string() }),
  plural: "Eras",
  edges: { spans: { to: ["song"], description: "the songs in it", inverse: "the era it belongs to" } },
});
const schema = createSchema([song, era]);
const span = bindSchema(schema).defineMutation("span", {
  title: "Put it in the era",
  fromTheOtherEnd: "Place it in an era",
  subject: { kinds: ["era"], arg: "eraId" },
  connects: ["spans"],
  input: z.object({ eraId: nodeRef(["era"]), songId: nodeRef(["song"]) }),
  apply: (ctx, args) => ctx.addEdge({ kind: "spans", from: args.eraId, to: args.songId }),
});

describe("a form offered from the far end", () => {
  it("submits under the affordance's words when it is handed them", () => {
    const store = new Store({ schema, mutations: [span], invariants: [] });
    const html = renderToStaticMarkup(<DerivedForm store={store} mutation={span as never} prefilled={{ songId: "s" }} label="Place it in an era" />);
    expect(html).toContain(">Place it in an era</button>");
    expect(html).not.toContain("Put it in the era");
  });
  it("says the act's own title when nobody says otherwise", () => {
    const store = new Store({ schema, mutations: [span], invariants: [] });
    expect(renderToStaticMarkup(<DerivedForm store={store} mutation={span as never} />)).toContain(">Put it in the era</button>");
  });
});
