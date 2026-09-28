import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, withQuery, withWithin } from "@graview/layout";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { adjustment, createViews, GraviewProvider, NOTHING_FOUND, useFound, useImplicated, useReached } from "../../src/index.js";

/**
 * A SEARCH IS A STOP, AND THE PICTURE IS THE RESULT LIST.
 *
 * `#q=` lights what the words find through the set every view already dims
 * by, so no lens learns anything new to take part; the words that find
 * nothing dim it all rather than leaving the picture looking unsearched;
 * and typing, in the Find box or in a row, is an adjustment of the stop
 * rather than a history entry per letter.
 */
const person = defineNode("person", { fields: z.object({ label: z.string(), notes: z.string().optional() }), plural: "People" });
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), edges: { "assigned-to": { to: ["person"] } } });
const schema = createSchema([person, duty]);
const store = () =>
  new Store({
    schema,
    snapshot: {
      nodes: [
        { id: "ana", kind: "person", label: "Ana", notes: "drives the van" },
        { id: "bo", kind: "person", label: "Bo" },
        { id: "morning", kind: "duty", label: "Morning run" },
        { id: "van", kind: "duty", label: "Van check" },
      ],
      edges: [{ kind: "assigned-to", from: "morning", to: "bo" }],
    } as never,
  });

function Probe() {
  const found = useFound();
  const implicated = useImplicated();
  const reached = useReached();
  return (
    <output
      data-found={found ? JSON.stringify(found.byKind) : "none"}
      data-implicated={[...implicated].sort().join(",")}
      data-reached={[...reached].sort().join(",")}
    />
  );
}

const read = (view: typeof EMPTY_VIEW) => {
  const html = renderToStaticMarkup(
    <GraviewProvider store={store()} views={createViews(schema)} initialView={view}>
      <Probe />
    </GraviewProvider>,
  );
  const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(html)?.[1]?.replace(/&quot;/g, '"');
  return { found: attr("data-found"), implicated: attr("data-implicated"), reached: attr("data-reached") };
};

describe("the words light the picture", () => {
  it("lights the hits through the implicated set, and counts them per kind", () => {
    const seen = read(withQuery(EMPTY_VIEW, "van"));
    expect(seen.found).toBe('{"person":1,"duty":1}');
    expect(seen.implicated).toBe("ana,van");
    // What the selection reaches is its own reading: nothing is selected.
    expect(seen.reached).toBe("");
  });

  it("joins the hits to what the selection reaches, never replacing it", () => {
    const seen = read({ ...withQuery(EMPTY_VIEW, "van"), selection: ["morning"] });
    expect(seen.implicated).toBe("ana,bo,morning,van");
    expect(seen.reached).toBe("bo,morning");
  });

  it("dims everything when the words find nothing, and is silent with no words", () => {
    expect(read(withQuery(EMPTY_VIEW, "zzz")).implicated).toBe(NOTHING_FOUND);
    expect(read(EMPTY_VIEW)).toEqual({ found: "none", implicated: "", reached: "" });
  });
});

describe("typing is not travelling", () => {
  const at = { ...EMPTY_VIEW, focusId: "aggregate:duty" };
  it("replaces the address for every keystroke of the Find box", () => {
    expect(adjustment(at, withQuery(at, "v"))).toBe(true);
    expect(adjustment(withQuery(at, "v"), withQuery(at, "va"))).toBe(true);
    expect(adjustment(withQuery(at, "van"), at)).toBe(true);
  });

  it("and of a row's own words, while the rest of the row is still travel", () => {
    const narrowed = withWithin(at, "q", "van");
    expect(adjustment(at, narrowed)).toBe(true);
    expect(adjustment(narrowed, withWithin(narrowed, "q", "vans"))).toBe(true);
    expect(adjustment(narrowed, withWithin(narrowed, "sort", "label"))).toBe(false);
  });
});
