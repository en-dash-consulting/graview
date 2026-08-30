import { createSchema, defineNode, Graph } from "@graview/core";
import { EMPTY_VIEW, layout, interpolate, toggleExpanded, aggregateId } from "@graview/layout";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  connectorStyle,
  distinguishable,
  fromLayout,
  isAffine,
  packUniform,
  planFrame,
  PLANE_STYLES,
  type PlannedConnector,
  type PlannedView,
} from "../../src/index.js";

/**
 * The renderer's decisions, snapshot-tested with no GPU and no DOM.
 *
 * `planFrame` is the whole policy layer — which fidelity captures, what draws
 * in what order, where each view lands, what each connector looks like — so
 * testing it here is testing the renderer's behaviour, not a stand-in for it.
 * The submission path that turns a plan into draw calls is verified once, in
 * a real browser, by apps/spike.
 */

const view = (id: string, plane: number, extra: Partial<PlannedView> = {}): PlannedView => ({
  id,
  plane,
  x: 100,
  y: 100,
  width: 400,
  height: 240,
  ...extra,
});

const CANVAS = { canvasWidth: 1000, canvasHeight: 600 };

describe("capture budget policy", () => {
  it("captures everything the first time it is seen", () => {
    const plan = planFrame([view("a", 0), view("b", 1), view("c", 2)], [], CANVAS);
    expect(plan.captures).toEqual([
      { viewId: "c", reason: "first" },
      { viewId: "b", reason: "first" },
      { viewId: "a", reason: "first" },
    ]);
  });

  it("captures the focus plane live and leaves the rest cached", () => {
    const capturedAt = { a: 1, b: 1, c: 1 };
    const plan = planFrame([view("a", 0), view("b", 1), view("c", 2)], [], {
      ...CANVAS,
      capturedAt,
    });
    expect(plan.captures).toEqual([{ viewId: "a", reason: "live" }]);
    expect(plan.captureCount).toBe(1);
  });

  it("recaptures a summary view only when its DOM changed", () => {
    const capturedAt = { b: 1 };
    expect(planFrame([view("b", 1)], [], { ...CANVAS, capturedAt }).captures).toEqual([]);
    expect(
      planFrame([view("b", 1, { dirty: true })], [], { ...CANVAS, capturedAt }).captures,
    ).toEqual([{ viewId: "b", reason: "changed" }]);
  });

  it("never recaptures a glyph view, even when it is marked dirty", () => {
    const capturedAt = { c: 1 };
    expect(
      planFrame([view("c", 2, { dirty: true })], [], { ...CANVAS, capturedAt }).captures,
    ).toEqual([]);
  });

  it("keeps a big scene inside the measured ceiling", () => {
    // 200 views is past the ~128-live-capture cliff measured in
    // docs/platform-findings.md. The fidelity split is what keeps it safe:
    // only the focus plane pays per frame.
    const views = Array.from({ length: 200 }, (_, i) =>
      view(`v${i}`, i < 6 ? 0 : i < 60 ? 1 : 2),
    );
    const capturedAt = Object.fromEntries(views.map((v) => [v.id, 1]));
    const plan = planFrame(views, [], { ...CANVAS, capturedAt });
    expect(plan.captureCount).toBe(6);
    expect(plan.draws).toHaveLength(200);
  });
});

describe("plane treatment", () => {
  it("draws back to front, whatever order views arrive in", () => {
    const plan = planFrame([view("a", 0), view("c", 2), view("b", 1)], [], CANVAS);
    expect(plan.draws.map((d) => d.viewId)).toEqual(["c", "b", "a"]);
  });

  it("recedes with scale, blur, falloff and shadow — and nothing else", () => {
    const plan = planFrame([view("a", 0), view("b", 1), view("c", 2)], [], CANVAS);
    const styles = plan.draws.map((d) => d.style);
    expect(styles.map((s) => s.scale)).toEqual([
      PLANE_STYLES[2].scale,
      PLANE_STYLES[1].scale,
      PLANE_STYLES[0].scale,
    ]);
    expect(styles.map((s) => s.blur)).toEqual([
      PLANE_STYLES[2].blur,
      PLANE_STYLES[1].blur,
      PLANE_STYLES[0].blur,
    ]);
    // Recession is monotonic: each plane back is blurrier than the one in front.
    expect(PLANE_STYLES[2].blur).toBeGreaterThan(PLANE_STYLES[1].blur);
    expect(PLANE_STYLES[1].blur).toBeGreaterThan(PLANE_STYLES[0].blur);
    expect(styles[0]!.falloff).toBeGreaterThan(styles[2]!.falloff);
    // Every transform layout may hand the platform must be affine.
    for (const draw of plan.draws) expect(isAffine(draw.transform)).toBe(true);
  });

  it("reports the drawn position of every view it draws", () => {
    const plan = planFrame([view("a", 0), view("b", 1)], [], CANVAS);
    expect(plan.geometry.map((g) => g.viewId)).toEqual(plan.draws.map((d) => d.viewId));
    for (const report of plan.geometry) {
      const draw = plan.draws.find((d) => d.viewId === report.viewId)!;
      expect(report.transform).toEqual(draw.transform);
    }
  });

  it("hands the router the unscaled box, so a click maps back correctly", () => {
    const plan = planFrame([view("b", 1)], [], CANVAS);
    const placement = plan.placements[0]!;
    expect([placement.width, placement.height]).toEqual([400, 240]);
    expect(placement.depth).toBe(1);
    // The draw is scaled; the placement is not — the router divides by the
    // transform's scale to get back to element coordinates.
    expect(plan.draws[0]!.width).toBeCloseTo(400 * PLANE_STYLES[1].scale);
  });

  it("packs the uniform the shader reads", () => {
    const plan = planFrame([view("b", 1, { opacity: 0.5 })], [], CANVAS);
    const packed = packUniform(plan.draws[0]!, 1000, 600, [0.9, 0.9, 0.9]);
    expect(packed).toHaveLength(16);
    // rect.xy is the transform's translation; rect.zw is the drawn size.
    expect([packed[0], packed[1]]).toEqual([
      plan.draws[0]!.transform[12],
      plan.draws[0]!.transform[13],
    ]);
    // Read the expected treatment off the plane rather than restating it, so
    // tuning a plane does not silently break a packing test. Float32 rounding
    // means tolerance, not equality.
    expect(packed[4]).toBeCloseTo(PLANE_STYLES[1].blur, 5);
    expect(packed[5]).toBeCloseTo(PLANE_STYLES[1].falloff, 5);
    expect(packed[6]).toBeCloseTo(PLANE_STYLES[1].shadow, 5);
    expect(packed[7]).toBeCloseTo(0.5, 5);
    expect([packed[8], packed[9]]).toEqual([1000, 600]);
  });
});

describe("connectors carry meaning", () => {
  const connector = (id: string, kind: string, from: string, to: string): PlannedConnector => ({
    id,
    kind,
    from,
    to,
  });

  it("joins the centres of two drawn views", () => {
    const plan = planFrame(
      [view("a", 0, { x: 0, y: 0 }), view("b", 0, { x: 500, y: 300 })],
      [connector("e1", "assigned-to", "a", "b")],
      CANVAS,
    );
    const drawn = plan.connectors[0]!;
    expect([drawn.x1, drawn.y1]).toEqual([200, 120]);
    expect([drawn.x2, drawn.y2]).toEqual([700, 420]);
  });

  it("drops a connector whose other end is off scene", () => {
    const plan = planFrame([view("a", 0)], [connector("e1", "assigned-to", "a", "missing")], CANVAS);
    expect(plan.connectors).toEqual([]);
  });

  it("gives every edge kind a distinct treatment, without anyone choosing one", () => {
    const the household exampleEdges = [
      "assigned-to",
      "participates-in",
      "protects",
      "applies-to",
      "justifies",
      "excepts",
    ];
    const check = distinguishable(the household exampleEdges);
    expect(check.collisions).toEqual([]);
    expect(check.ok).toBe(true);
    // The point of the rule, stated directly.
    expect(connectorStyle("protects")).not.toEqual(connectorStyle("assigned-to"));
  });

  it("gives the same edge kind the same treatment every time", () => {
    expect(connectorStyle("protects")).toEqual(connectorStyle("protects"));
  });

  it("lets an app override a treatment it cares about", () => {
    const styled = connectorStyle("protects", { protects: { pattern: "double", width: 4 } });
    expect(styled.pattern).toBe("double");
    expect(styled.width).toBe(4);
    // Everything not overridden stays derived.
    expect(styled.hue).toBe(connectorStyle("protects").hue);
  });
});

describe("driven from a real layout", () => {
  const person = defineNode("person", {
    fields: z.object({ label: z.string() }),
    plural: "People",
    edges: { "assigned-to": { to: ["duty"] } },
  });
  const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Runs" });
  const weekKind = defineNode("week", { fields: z.object({ label: z.string() }) });
  const schema = createSchema([person, duty, weekKind]);

  const graph = Graph.from(schema, {
    nodes: [
      { id: "week-1", kind: "week", label: "This week" },
      { id: "ana", kind: "person", label: "Ana" },
      { id: "bo", kind: "person", label: "Bo" },
      { id: "morning", kind: "duty", label: "Morning" },
    ],
    edges: [{ kind: "assigned-to", from: "ana", to: "morning" }],
  });

  it("turns a layout into a frame with no decisions of its own", () => {
    const result = layout(graph, schema, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
    });
    const { views, connectors } = fromLayout(result);
    const plan = planFrame(views, connectors, {
      canvasWidth: result.width,
      canvasHeight: result.height,
    });

    expect(plan.draws.map((d) => d.viewId)).toContain("week-1");
    expect(plan.draws.map((d) => d.viewId)).toContain("ana");
    // The focus draws last, so it lands on top.
    expect(plan.draws.at(-1)?.viewId).toBe("week-1");
  });

  it("carries a transition's fractional planes and fading opacity through", () => {
    const closed = layout(graph, schema, { ...EMPTY_VIEW, focusId: "week-1" });
    const open = layout(
      graph,
      schema,
      toggleExpanded({ ...EMPTY_VIEW, focusId: "week-1" }, aggregateId("person")),
    );
    const mid = interpolate(closed, open, 0.5);
    const { views } = fromLayout(mid);

    const ana = views.find((v) => v.id === "ana")!;
    expect(ana.opacity).toBeCloseTo(0.5);
    const plan = planFrame(views, [], { canvasWidth: mid.width, canvasHeight: mid.height });
    expect(plan.draws.find((d) => d.viewId === "ana")?.opacity).toBeCloseTo(0.5);
  });

  it("marks only the views an edit touched as needing recapture", () => {
    const result = layout(graph, schema, {
      ...EMPTY_VIEW,
      focusId: "week-1",
      relation: "person",
    });
    const { views } = fromLayout(result, new Set(["ana"]));
    expect(views.find((v) => v.id === "ana")?.dirty).toBe(true);
    expect(views.find((v) => v.id === "bo")?.dirty).toBe(false);
  });
});
