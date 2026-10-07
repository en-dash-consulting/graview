import { bindSchema, createSchema, DARK, defineNode, LIGHT, nodeRef, Store, type KitOverrides } from "@graview/core";
import { EMPTY_VIEW, aggregateId, fromUrl, kindCardId, layout, toUrl, withZoom } from "@graview/layout";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createViews,
  GraviewProvider,
  onScreen,
  Scene,
  useNavigation,
  useSelection,
  type ViewProps,
} from "../../src/index.js";

/**
 * The binding, rendered through `react-dom/server`.
 *
 * Static rendering is enough to hold the contracts that matter here: which
 * view resolves for which cell, that views are IMMEDIATE children of the
 * canvas, and that the same component renders correctly in both modes. The
 * live scene is verified in a browser by apps/spike.
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string(), role: z.string() }),
  plural: "People",
  edges: { "assigned-to": { to: ["duty"] } },
});
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Runs" });
const week = defineNode("week", { fields: z.object({ label: z.string() }) });
const schema = createSchema([person, duty, week]);
const { defineMutation } = bindSchema(schema);

const rename = defineMutation("rename", {
  subject: { kinds: ["person"], arg: "id" },
  input: z.object({ id: nodeRef(["person"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

function store() {
  return new Store({
    schema,
    mutations: [rename],
    snapshot: {
      nodes: [
        { id: "week-1", kind: "week", label: "This week" },
        { id: "ana", kind: "person", label: "Ana", role: "parent" },
        { id: "bo", kind: "person", label: "Bo", role: "caregiver" },
        { id: "morning", kind: "duty", label: "Morning" },
      ],
      edges: [{ kind: "assigned-to", from: "ana", to: "morning" }],
    },
  });
}

/**
 * An ordinary React component. No scene API, no special base class — this is
 * the entire authoring surface, and the reason the capture approach is worth
 * its cost.
 */
function PersonView({ node, fidelity, mode, selected }: ViewProps<typeof schema, "person">) {
  if (!node) return null;
  if (fidelity === "glyph") return <span data-mode={mode}>{node.label.slice(0, 2)}</span>;
  return (
    <article data-mode={mode} data-selected={selected || undefined}>
      <h3>{node.label}</h3>
      {/* A full-fidelity view shows more, but is the SAME component. */}
      {fidelity === "full" ? <p>{node.role}</p> : null}
    </article>
  );
}

function PeopleView({ nodes, label, mode }: ViewProps<typeof schema>) {
  return (
    <section data-mode={mode}>
      <h3>{label}</h3>
      <p>{nodes?.length ?? 0} people</p>
    </section>
  );
}

function views() {
  return createViews(schema)
    .register("person", { cardinality: "one", fidelity: "full" }, PersonView)
    .register("person", { cardinality: "one", fidelity: "summary" }, PersonView)
    .register("person", { cardinality: "one", fidelity: "glyph" }, PersonView)
    .register("person", { cardinality: "many", fidelity: "summary" }, PeopleView);
}

function render(ui: React.ReactElement, view = EMPTY_VIEW) {
  return renderToStaticMarkup(
    <GraviewProvider store={store()} views={views()} initialView={view}>
      {ui}
    </GraviewProvider>,
  );
}

describe("the scene", () => {
  it("renders views as immediate children of a layoutsubtree canvas", () => {
    // The capture path only. `renderer="gpu"` selects it without needing a
    // real GPU: the canvas is a rendering decision, not a device one.
    const html = render(<Scene renderer="gpu" />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
    });
    expect(html).toContain("layoutsubtree");
    // The platform rejects anything deeper than a direct child, so the view
    // hosts must sit immediately inside the canvas.
    const canvasOpen = html.indexOf("<canvas");
    const afterCanvasTag = html.slice(html.indexOf(">", canvasOpen) + 1);
    // Nothing may sit between the canvas and a view host — not a wrapper, not
    // a fragment's stray text node.
    expect(afterCanvasTag.startsWith("<div data-graview-view=")).toBe(true);
  });

  it("uses an ordinary container on the DOM path, with no capture canvas", () => {
    const html = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
    });
    // `layoutsubtree` changes how the browser lays these elements out, and
    // combining it with this path's CSS transforms crashes the renderer
    // process in Chromium 154 — silently, on first paint. The DOM path
    // captures nothing, so it needs no canvas at all.
    expect(html).not.toContain("layoutsubtree");
    expect(html).not.toContain("<canvas");
    expect(html).toContain('data-graview-stage="dom"');
    // Views are still direct children of the stage, so both paths agree about
    // structure and a test written against one holds for the other.
    const stage = html.indexOf('data-graview-stage="dom"');
    expect(
      html.slice(html.indexOf(">", stage) + 1).startsWith("<div data-graview-view="),
    ).toBe(true);
  });

  it("puts the focus on plane 0 and the relation on plane 1", () => {
    const html = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
    });
    expect(html).toContain('data-graview-view="week-1" data-graview-plane="0"');
    expect(html).toContain('data-graview-view="ana" data-graview-plane="1"');
  });

  it("uses the aggregate view for a group and the single view for a node", () => {
    const grouped = render(<Scene renderer="dom" />, { ...EMPTY_VIEW, focusId: "week-1" });
    // People are grouped on plane 2 and get the `many` view.
    expect(grouped).toContain("people");
    expect(grouped).toContain("2 people");

    const expanded = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      expanded: [kindCardId("person")],
    });
    // Expanded, each person gets the `one` view at glyph fidelity.
    expect(expanded).not.toContain("2 people");
    expect(expanded).toContain("An");
  });

  it("falls back to a primitive for a kind with no registered view", () => {
    const html = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
    });
    // `duty` has no view; the fallback still says what it is.
    expect(html).toContain("Runs");
  });

  it("applies the plane transform as an affine CSS matrix on the DOM path", () => {
    const html = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
    });
    const matrix = /matrix3d\(([^)]+)\)/.exec(html);
    expect(matrix).not.toBeNull();
    const values = matrix![1]!.split(",").map(Number);
    // The perspective row must be untouched — the DOM path is affine for the
    // same reason the GPU path is.
    expect([values[3], values[7], values[11], values[15]]).toEqual([0, 0, 0, 1]);
  });

  it("draws connectors between nodes that are both placed", () => {
    const html = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
      expanded: [kindCardId("duty")],
    });
    expect(html).toContain('data-graview-connector="assigned-to"');
  });

  it("says which two things each connector joins, in the edge's direction", () => {
    const html = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
      expanded: [kindCardId("duty")],
    });
    const line = /<path data-graview-connector="assigned-to"[^>]*>/.exec(html)?.[0] ?? "";
    expect(line).toContain('data-graview-from="ana"');
    expect(line).toContain('data-graview-to="morning"');
  });

  /*
   * THE KIT IS THE BRAND'S SAY over the lines: a kind it keeps quiet is not
   * drawn, its route is one of the declared strategies, its color is what
   * the brand said. All of it arrives through the brand on the provider —
   * nothing in the scene reads a literal.
   */
  describe("the kit", () => {
    const stop = { ...EMPTY_VIEW, focusId: "week-1", relation: "person", expanded: [kindCardId("duty")] };
    const dressed = (kit: KitOverrides) =>
      renderToStaticMarkup(
        <GraviewProvider store={store()} views={views()} initialView={stop} brand={{ name: "Kit", schemes: { dark: DARK, light: LIGHT }, kit }}>
          <Scene renderer="dom" />
        </GraviewProvider>,
      );

    it("keeps a kind quiet when the brand says so", () => {
      expect(dressed({})).toContain('data-graview-connector="assigned-to"');
      expect(dressed({ connectors: { byEdge: { "assigned-to": { visible: false } } } })).not.toContain('data-graview-connector="assigned-to"');
    });

    it("routes with elbows or a chord on request, and paints the brand's color", () => {
      const path = (html: string) => /<path data-graview-connector="assigned-to"[^>]*>/.exec(html)?.[0] ?? "";
      expect(path(dressed({}))).toMatch(/ d="M [^"]* Q /);
      expect(path(dressed({ connectors: { all: { route: "orthogonal" } } }))).toMatch(/ d="M [^"]* L /);
      expect(path(dressed({ connectors: { all: { route: "orthogonal" } } }))).not.toMatch(/ Q /);
      expect(path(dressed({ connectors: { byEdge: { "assigned-to": { color: "#1d3f8a", pattern: "dotted" } } } }))).toContain('stroke="#1d3f8a"');
    });
  });

  it("labels every view for assistive technology", () => {
    const html = render(<Scene renderer="dom" />, { ...EMPTY_VIEW, focusId: "week-1" });
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="People"');
    // Views stay focusable: content under a layoutsubtree canvas is real DOM,
    // which is the half of the accessibility bet that already holds.
    expect(html).toContain('tabindex="0"');
  });
});

describe("a raised crowd", () => {
  /*
   * Summary panels need room; a crowd divides the width until they have
   * none. Below the legibility floor a raised card renders its GLYPH — the
   * chip that stays readable at any width — which is what the fidelity
   * axis exists for. The bid-desk example's ten requirements in 130-pixel slivers,
   * each title wrapped to five lines, is the picture this replaces.
   */
  it("drops crowded raised cards to glyph fidelity", () => {
    const roomy = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
    });
    // Three people across the default 1200 canvas: summaries fit.
    expect(roomy).not.toContain("data-graview-crowded");

    const crowded = render(
      <Scene renderer="dom" options={{ width: 380, height: 700 }} />,
      { ...EMPTY_VIEW, focusId: "week-1", relation: "person" },
    );
    // The same people over 380px are slivers: the hosts say so and render
    // glyphs instead.
    expect(crowded).toContain("data-graview-crowded");
  });
});

describe("zooming in", () => {
  /*
   * Jacking in ZOOMS: the same scene with the focus grown to most of it,
   * not a modal page that replaced it. The shelf stays, receded, so the
   * zoomed stop still reads as a place among its relations — which is the
   * thing the full-page lift could never do.
   */
  it("grows the focus to most of the scene, in the same scene", () => {
    const before = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: aggregateId("person"),
    });
    const after = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: aggregateId("person"),
      zoom: true,
    });
    // Most, not all: the default 1200-wide canvas, less the rails the scene
    // reserves for chrome (264 left, 128 right), less five gaps of 16.
    expect(after).toContain("width:728px");
    expect(before).not.toContain("width:728px");
    // Still the scene — same mode, same components, no dialog.
    expect(after).toContain('data-mode="scene"');
    expect(after).not.toContain('role="dialog"');
    // The kinds shelf recedes rather than vanishing.
    expect(after).toContain('data-graview-view="kind:person"');
    expect(after).toContain('data-graview-view="kind:duty"');
  });

  it("gives a zoomed record a reading column, not a letterbox", () => {
    const html = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: "ana",
      zoom: true,
    });
    // A two-line record set wall to wall is unreadable; 880 is a document.
    // A reading column: the lesser of 880 and the span less five gaps (728).
    expect(html).toContain("width:728px");
  });

  it("is a stop: in the URL, and back out of it", () => {
    const zoomed = withZoom({ ...EMPTY_VIEW, focusId: "ana" }, true);
    expect(toUrl(zoomed)).toContain("zoom=1");
    expect(fromUrl(toUrl(zoomed)).zoom).toBe(true);
    expect(fromUrl(toUrl(withZoom(zoomed, false))).zoom).toBeUndefined();
  });
});

describe("navigation", () => {
  it("makes every stop a URL", () => {
    const view = { ...EMPTY_VIEW, focusId: "week-1", relation: "person" };
    expect(toUrl(view)).toBe("#focus=week-1&relation=person");
  });

  it("hands view control to the host when one is supplied", () => {
    const seen: string[] = [];
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={store()}
        views={views()}
        view={{ ...EMPTY_VIEW, focusId: "ana" }}
        onViewChange={(next) => seen.push(toUrl(next))}
      >
        <Scene renderer="dom" />
      </GraviewProvider>,
    );
    // The controlled view is the one that rendered.
    expect(html).toContain('data-graview-view="ana" data-graview-plane="0"');
  });
});

/**
 * A view drawn smaller than it was designed for.
 *
 * "Shrunk down" has to mean the picture SCALED, not the view re-solving its
 * layout in a third of the width. A matrix asked to lay itself out at 340
 * pixels piles its rotated column headers into a corner and clips its rows —
 * it looks broken because it is. Rendering at the natural size and scaling
 * the result is literally the same image, smaller, and it stays live.
 */
describe("a node with a natural size is drawn scaled, not re-laid-out", () => {
  const graview = (renderer: "dom" | "gpu") =>
    render(<Scene renderer={renderer} />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      overview: true,
    });

  it("lays the focus out at its natural size inside the smaller slot", () => {
    const html = graview("dom");
    const scaled = /data-graview-natural="([\d.]+)x([\d.]+)"/.exec(html);
    expect(scaled).not.toBeNull();
    const naturalWidth = Number(scaled![1]);

    // The box the view lays itself out in is the FULL one, not the slot.
    const host = html.slice(html.indexOf('data-graview-view="week-1"'));
    const drawnWidth = Number(/width:([\d.]+)px/.exec(host)![1]);
    expect(naturalWidth).toBeGreaterThan(drawnWidth);
  });

  it("scales uniformly, so nothing is stretched", () => {
    const html = graview("dom");
    const scaled = /data-graview-natural="([\d.]+)x([\d.]+)"/.exec(html)!;
    const [naturalWidth, naturalHeight] = [Number(scaled[1]), Number(scaled[2])];
    const inner = html.slice(scaled.index);
    const factor = Number(/scale\(([\d.]+)\)/.exec(inner)![1]);

    const host = html.slice(html.indexOf('data-graview-view="week-1"'));
    const drawnWidth = Number(/width:([\d.]+)px/.exec(host)![1]);
    const drawnHeight = Number(/height:([\d.]+)px/.exec(host)![1]);

    // One factor for both axes, and the result fits the slot it was given.
    expect(naturalWidth * factor).toBeLessThanOrEqual(drawnWidth + 1);
    expect(naturalHeight * factor).toBeLessThanOrEqual(drawnHeight + 1);
    expect(factor).toBeLessThan(1);
  });

  it("does not wrap a view that is drawn at the size it laid out at", () => {
    // Inside the stack nothing is shrunk, so there is nothing to scale and no
    // extra element between the host and the view.
    const html = render(<Scene renderer="dom" />, { ...EMPTY_VIEW, focusId: "week-1" });
    expect(html).not.toContain("data-graview-natural");
  });

  it("scales on the capture path too, so both renderers draw the same picture", () => {
    // The GPU path rasterizes the host subtree; the scale is part of the paint
    // rather than something the shader has to know about.
    expect(graview("gpu")).toContain("data-graview-natural");
  });
});

/**
 * The constellation, when something is already selected.
 *
 * A connector in the overview names whatever is DRAWN, which up there is
 * always a kind card; a selection names real nodes. Comparing them directly
 * matched nothing, so carrying an ordinary selection into the Graview — or
 * clicking a target inside the shrunk picture, which the shrunk-interface
 * harness explicitly exercises — receded every line at once and blanked the
 * thing you rose to look at.
 */
describe("selection is part of the stop", () => {
  /*
   * The regression this pins: selection lived beside the view instead of in
   * it, so back/forward restored the place but stranded the pane — an
   * inspector talking about a thing from a stop already left.
   */
  const Probe = () => {
    const { selection } = useSelection();
    const { url } = useNavigation();
    return <output data-sel={selection.join("+")} data-url={url} />;
  };

  it("arrives through the URL like everything else", () => {
    const html = render(<Probe />, fromUrl("#focus=week-1&sel=bo,ana"));
    expect(html).toContain('data-sel="ana+bo"');
    expect(html).toContain("sel=ana%2Cbo");
  });

  it("still honors initialSelection, folding it into the view", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={store()}
        views={views()}
        initialView={{ ...EMPTY_VIEW, focusId: "week-1" }}
        initialSelection={["bo"]}
      >
        <Probe />
      </GraviewProvider>,
    );
    expect(html).toContain('data-sel="bo"');
    expect(html).toContain("sel=bo");
  });
});

describe("a selection, mapped onto what is drawn", () => {
  const above = () =>
    layout(store().graph, schema, { ...EMPTY_VIEW, focusId: "week-1", overview: true }).nodes.map(
      (node) => ({ ...node, plane: node.plane }),
    );

  it("keeps an id that is drawn as itself", () => {
    const nodes = above();
    const card = nodes.find((node) => node.id === kindCardId("person"))!;
    expect([...onScreen(nodes, [card.id])]).toEqual([card.id]);
  });

  it("MAPS a real node id onto the card that stands for it", () => {
    // The regression. `ana` is a person, and up there a person is drawn as
    // part of the People card — which is also what every connector to her
    // actually points at.
    const nodes = above();
    expect([...onScreen(nodes, ["ana"])]).toEqual([kindCardId("person")]);
  });

  it("still means NO EMPHASIS when nothing selected resolves to anything drawn", () => {
    // Not "none of the above". A selection the picture cannot show is the same
    // as no selection, which is the rule every view here follows.
    expect(onScreen(above(), ["nobody-at-all"]).size).toBe(0);
  });

  const graview = (selection?: readonly string[]) =>
    renderToStaticMarkup(
      <GraviewProvider
        store={store()}
        views={views()}
        initialView={{ ...EMPTY_VIEW, focusId: "week-1", overview: true }}
        {...(selection ? { initialSelection: selection } : {})}
      >
        <Scene renderer="dom" />
      </GraviewProvider>,
    );
  const opacities = (html: string) =>
    [...html.matchAll(/data-graview-connector="[^"]*"[^>]*opacity="([\d.]+)"/g)].map((match) =>
      Number(match[1]),
    );

  it("does not blank the picture for a selection the scene has to resolve", () => {
    /*
     * The regression, through the wiring rather than the function. Arriving in
     * the Graview with a real node already chosen used to recede every line at
     * once, and the picture you rose to look at went dark.
     */
    const drawn = opacities(graview(["ana"]));
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.some((value) => value > 0.5)).toBe(true);
  });

  it("draws the relations as roads on the ground from up there, and no line in the air", () => {
    const html = graview();
    // The relations ARE the content up here — as roads between the plots,
    // on the ground layer, one per pair of districts a declared edge joins.
    expect((html.match(/class="graview-road"/g) ?? []).length).toBeGreaterThan(0);
    // A line in the air says only what a road cannot: nothing is chosen, so nothing is drawn.
    expect(opacities(html)).toEqual([]);
  });

  it("says which two plots each road joins, by the ids the plots carry", () => {
    /*
     * A road is drawn between two districts, and a design that lights the
     * roads touching a district needs to know which: by the same id the
     * plot wears, so `[data-graview-plot=x]` and `[data-graview-from=x]`
     * are one selector's worth of work, not a path parsed back to points.
     */
    const html = graview();
    const road = /<g class="graview-road"[^>]*>/.exec(html)?.[0] ?? "";
    expect(road).toContain('data-graview-road="assigned-to"');
    const ends = [/data-graview-from="([^"]*)"/.exec(road)?.[1], /data-graview-to="([^"]*)"/.exec(road)?.[1]];
    expect(ends.sort()).toEqual([kindCardId("duty"), kindCardId("person")]);
    for (const end of ends) expect(html).toContain(`data-graview-plot="${end}"`);
  });
});
