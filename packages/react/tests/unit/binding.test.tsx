import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW, aggregateId, kindCardId, toUrl } from "@graview/layout";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createViews,
  GraviewProvider,
  JackedIn,
  Scene,
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

  it("labels every view for assistive technology", () => {
    const html = render(<Scene renderer="dom" />, { ...EMPTY_VIEW, focusId: "week-1" });
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="People"');
    // Views stay focusable: content under a layoutsubtree canvas is real DOM,
    // which is the half of the accessibility bet that already holds.
    expect(html).toContain('tabindex="0"');
  });
});

describe("the two-mode contract", () => {
  it("renders the same component captured in-scene and jacked in", () => {
    const scene = render(<Scene renderer="dom" />, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
    });
    const full = renderToStaticMarkup(
      <GraviewProvider
        store={store()}
        views={views()}
        initialView={{ ...EMPTY_VIEW, focusId: "week-1", relation: "person" }}
        initialJackedIn="ana"
      >
        <JackedIn />
      </GraviewProvider>,
    );

    expect(scene).toContain('data-mode="scene"');
    expect(full).toContain('data-mode="fullscreen"');
    // Same content, both ways — that is the contract.
    expect(scene).toContain("Ana");
    expect(full).toContain("Ana");
    // Jacking in forces full fidelity, so the detail the plane omitted returns.
    expect(full).toContain("parent");
  });

  it("gives a jacked-in view the dialog semantics a full page needs", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={store()}
        views={views()}
        initialView={EMPTY_VIEW}
        initialJackedIn="ana"
      >
        <JackedIn />
      </GraviewProvider>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    // A way out, and — the part that was missing — a header saying WHERE YOU
    // ARE. A full page raises exactly one question the scene did not already
    // answer, and a lone button in an empty bar does not answer it.
    expect(html).toContain("← Back");
    // The KIND in the chrome; the NAME is the document's own heading. Chrome
    // that repeats the h1 reads as a mistake even when both are correct.
    expect(html).toContain("person");
    expect(html).toContain("Ana");
    // Named for assistive technology by the thing itself, not by its id.
    expect(html).toContain('aria-label="Ana in full view"');
  });

  it("renders nothing when nothing is jacked in", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
        <JackedIn />
      </GraviewProvider>,
    );
    expect(html).toBe("");
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
    const [naturalWidth, naturalHeight] = [Number(scaled![1]), Number(scaled![2])];

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
    // The GPU path rasterises the host subtree; the scale is part of the paint
    // rather than something the shader has to know about.
    expect(graview("gpu")).toContain("data-graview-natural");
  });
});
