import type { AnySchema } from "@graview/core";
import { aggregateId } from "@graview/layout";
import { useGraph, useGraview, useNavigation, useViolations } from "@graview/react";
import { useMemo, useState } from "react";
import { hueFor } from "../default-views.js";

/**
 * The constellation: the graph seen from outside the plane stack.
 *
 * A third ALTITUDE. The scene shows instances arranged by a lens; a page
 * shows one view close up; this shows the shape of the whole thing — every
 * KIND the schema declares and every EDGE KIND between them — pulled back and
 * tilted so the ground reads as a floor rather than as a wall.
 *
 * Two constraints make it fit the framework rather than fight it. The
 * projection is a plain vertical squash, which is affine, so nothing here
 * breaks the "affine only, no perspective" rule the capture pipeline depends
 * on. And the camera does not move: this is a named stop like any other, not
 * free orbit.
 *
 * It is derived entirely from the declaration plus instance counts, so it
 * needs no bindings and works in any app on the day the app is written — the
 * first surface here that an app gets without saying anything at all.
 *
 * Descending from here into a primary interface is what JACKING IN should
 * mean: you were looking at the whole thing from outside, you pick a place,
 * and you fall into it.
 */

export interface ConstellationOptions {
  /** Kinds to leave out — a desk's own root node, a bookkeeping kind. */
  readonly omit?: readonly string[];
  /** How flat the ground reads. 1 is straight down, 0 is edge on. */
  readonly tilt?: number;
}

export interface ConstellationKind {
  readonly kind: string;
  readonly label: string;
  readonly count: number;
  /** Ground coordinates, before projection. */
  readonly x: number;
  readonly y: number;
  /** True when some edge from this kind may point at any kind at all. */
  readonly universal: boolean;
  /** Implicated in a current violation. */
  readonly flagged: boolean;
}

export interface ConstellationLink {
  readonly id: string;
  readonly edge: string;
  readonly from: string;
  readonly to: string;
  readonly description?: string;
  /** How many edges of this kind actually exist. Zero is a declared but unused relation. */
  readonly count: number;
}

export interface ConstellationShape {
  readonly kinds: readonly ConstellationKind[];
  readonly links: readonly ConstellationLink[];
}

const TAU = Math.PI * 2;

/**
 * The shape of a schema, as a ring of kinds and the relations between them.
 *
 * Placed on a circle in a STABLE order — by kind name, never by connectivity —
 * for the same reason the layout ranks by id: a picture that rearranges
 * itself when the data changes is a picture you cannot remember.
 */
export function buildConstellation(
  schema: AnySchema,
  counts: Readonly<Record<string, number>>,
  edgeCounts: Readonly<Record<string, number>>,
  flagged: readonly string[] = [],
  options: ConstellationOptions = {},
): ConstellationShape {
  const omit = new Set(options.omit ?? []);
  const names = (schema.kinds as readonly string[])
    .filter((kind) => !omit.has(kind))
    .slice()
    .sort();

  const broken = new Set(flagged);
  const kinds: ConstellationKind[] = names.map((kind, index) => {
    const angle = -TAU / 4 + (index / Math.max(1, names.length)) * TAU;
    const edges = (schema.tryDefinition(kind)?.edges ?? {}) as Record<string, { to?: unknown }>;
    return {
      kind,
      label: schema.tryDefinition(kind)?.plural ?? `${kind}s`,
      count: counts[kind] ?? 0,
      x: Math.cos(angle),
      y: Math.sin(angle),
      // An edge declared `to: "*"` would otherwise draw a line to every kind
      // and turn the picture into a hairball. It is a property of the kind.
      universal: Object.values(edges).some((edge) => edge.to === "*"),
      flagged: broken.has(kind),
    };
  });

  const placed = new Set(names);
  const links: ConstellationLink[] = [];
  for (const kind of names) {
    const edges = (schema.tryDefinition(kind)?.edges ?? {}) as Record<
      string,
      { to?: unknown; description?: string }
    >;
    for (const [edgeKind, edge] of Object.entries(edges)) {
      const targets = Array.isArray(edge.to) ? (edge.to as string[]) : [];
      for (const target of targets) {
        if (!placed.has(target) || target === kind) continue;
        const id = `${edgeKind}:${kind}:${target}`;
        if (links.some((link) => link.id === id)) continue;
        links.push({
          id,
          edge: edgeKind,
          from: kind,
          to: target,
          ...(edge.description ? { description: edge.description } : {}),
          count: edgeCounts[edgeKind] ?? 0,
        });
      }
    }
  }
  return { kinds, links };
}

/** The aggregate a kind's instances live in, so descending has somewhere to land. */
export function placeOf(kind: string): string {
  return aggregateId(kind);
}

export interface ConstellationProps {
  readonly options?: ConstellationOptions;
  /**
   * Where descending into a kind should land. Defaults to that kind's own
   * aggregate, which every app has; an app with a lens over a SET of kinds
   * points its own way.
   */
  readonly placeFor?: (kind: string) => string;
}

export function Constellation({ options = {}, placeFor = placeOf }: ConstellationProps) {
  const { store, setOverview } = useGraview<AnySchema>();
  const { focus } = useNavigation();
  const nodes = useGraph();
  const violations = useViolations();
  const [active, setActive] = useState<string | null>(null);

  const tilt = options.tilt ?? 0.52;

  const shape = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
    const edgeCounts: Record<string, number> = {};
    for (const edge of store.graph.allEdges()) {
      edgeCounts[edge.kind] = (edgeCounts[edge.kind] ?? 0) + 1;
    }
    const flagged = [
      ...new Set(
        violations.flatMap((violation) =>
          violation.nodeIds.flatMap((id) => {
            const node = store.graph.getNode(id);
            return node ? [node.kind] : [];
          }),
        ),
      ),
    ];
    return buildConstellation(store.schema, counts, edgeCounts, flagged, options);
  }, [store, nodes, violations, options]);

  const related = useMemo(() => {
    if (!active) return null;
    const near = new Set<string>([active]);
    for (const link of shape.links) {
      if (link.from === active) near.add(link.to);
      if (link.to === active) near.add(link.from);
    }
    return near;
  }, [active, shape.links]);

  /*
   * The projection: a vertical squash and nothing else.
   *
   * Affine, so the plane model and the capture pipeline are untouched, and
   * invertible, so hit-testing is the DOM's ordinary job rather than a
   * raycast. A circle of kinds becomes an ellipse, which is what makes the
   * ground read as a floor you are standing above.
   */
  const project = (x: number, y: number) => ({
    left: `${50 + x * 34}%`,
    top: `${52 + y * 34 * tilt}%`,
  });

  // Back to front, so a plate nearer the viewer occludes one behind it.
  const ordered = [...shape.kinds].sort((a, b) => a.y - b.y);

  return (
    <div
      data-testid="constellation"
      aria-label="The whole graph"
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      onClick={() => setActive(null)}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {/* The ground.
            Rings rather than a grid: the arrangement IS a circle, and drawing
            the circle it actually is beats implying a plane it is not. Three
            of them, because one ellipse reads as an outline and three read as
            a floor going away from you. */}
        {[1, 0.62, 0.28].map((scale, index) => (
          <ellipse
            key={scale}
            cx={50}
            cy={52}
            rx={34 * scale}
            ry={34 * tilt * scale}
            fill="none"
            stroke="var(--graview-edge)"
            strokeWidth={index === 0 ? 1 : 0.6}
            opacity={index === 0 ? 0.9 : 0.45}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* Spokes out to each kind, so the ring reads as a surface things
            stand on rather than as a decorative circle. */}
        {shape.kinds.map((kind) => (
          <line
            key={`spoke-${kind.kind}`}
            x1={50}
            y1={52}
            x2={50 + kind.x * 34}
            y2={52 + kind.y * 34 * tilt}
            stroke="var(--graview-edge)"
            strokeWidth={0.4}
            opacity={related === null || related.has(kind.kind) ? 0.4 : 0.12}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {shape.links.map((link) => {
          const from = shape.kinds.find((kind) => kind.kind === link.from)!;
          const to = shape.kinds.find((kind) => kind.kind === link.to)!;
          const ax = 50 + from.x * 34;
          const ay = 52 + from.y * 34 * tilt;
          const bx = 50 + to.x * 34;
          const by = 52 + to.y * 34 * tilt;
          const lit = related === null || (related.has(link.from) && related.has(link.to));
          const declaredOnly = link.count === 0;
          return (
            <path
              key={link.id}
              data-graview-relation={link.edge}
              // Bowed toward the middle, so two kinds facing each other do not
              // draw a chord straight through everything between them.
              d={`M ${ax} ${ay} Q ${(ax + bx) / 2 + (50 - (ax + bx) / 2) * 0.45} ${(ay + by) / 2 + (52 - (ay + by) / 2) * 0.45} ${bx} ${by}`}
              fill="none"
              stroke={lit ? "var(--graview-accent)" : "var(--graview-edge-bright)"}
              strokeWidth={lit ? 1.6 : 0.9}
              // A relation the schema declares and the data has never used is
              // drawn as an intention rather than as a fact.
              strokeDasharray={declaredOnly ? "2 2" : undefined}
              opacity={related === null ? (declaredOnly ? 0.5 : 0.8) : lit ? 1 : 0.14}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {ordered.map((kind) => {
        const near = related === null || related.has(kind.kind);
        const isActive = active === kind.kind;
        const position = project(kind.x, kind.y);
        return (
          <div
            key={kind.kind}
            style={{
              position: "absolute",
              ...position,
              transform: "translate(-50%, -100%)",
              transition: "opacity 180ms ease",
              opacity: near ? 1 : 0.3,
            }}
          >
            <button
              type="button"
              data-graview-kind={kind.kind}
              aria-pressed={isActive}
              title={
                kind.count === 0
                  ? `${kind.label} — declared, none yet`
                  : `${kind.count} ${kind.label.toLowerCase()} · double click to go there`
              }
              onClick={(event) => {
                event.stopPropagation();
                setActive(isActive ? null : kind.kind);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                // Descending. This is what jacking in should mean: you were
                // outside the whole thing, you picked a place, you fall in.
                focus(placeFor(kind.kind));
                setOverview(false);
              }}
              style={{
                display: "grid",
                gap: 1,
                justifyItems: "center",
                padding: "6px 11px",
                borderRadius: 10,
                fontSize: 12,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                borderColor: kind.flagged
                  ? "var(--graview-warn)"
                  : isActive
                    ? "var(--graview-accent)"
                    : "var(--graview-edge)",
                background: `linear-gradient(hsl(${Math.round(hueFor(kind.kind) * 360)} 55% var(--graview-tint-lightness) / calc(var(--graview-tint-alpha) * 0.5)), transparent), var(--graview-panel)`,
                boxShadow: isActive ? "0 0 18px -4px var(--graview-accent)" : "var(--graview-lift-low)",
              }}
            >
              <span style={{ fontWeight: 500 }}>
                {kind.label}
                {kind.universal ? (
                  <span
                    title="Relates to any kind"
                    style={{ color: "var(--graview-ink-faint)" }}
                  >
                    {" "}
                    ✻
                  </span>
                ) : null}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontVariantNumeric: "tabular-nums",
                  color: kind.flagged
                    ? "var(--graview-warn)"
                    : kind.count === 0
                      ? "var(--graview-ink-faint)"
                      : "var(--graview-ink-muted)",
                }}
              >
                {kind.count === 0 ? "none yet" : kind.count}
              </span>
            </button>
            {/* A riser down to the ground and a contact shadow at its foot,
                so a plate reads as standing on the plane rather than floating
                over it. Both are cheap and both are what sells the tilt. */}
            <div
              aria-hidden="true"
              style={{
                width: 1,
                height: 18,
                margin: "0 auto",
                background: `linear-gradient(var(--graview-edge-bright), var(--graview-edge))`,
              }}
            />
            <div
              aria-hidden="true"
              style={{
                width: 26,
                height: 7,
                margin: "-3px auto 0",
                borderRadius: "50%",
                background: "var(--graview-edge)",
                opacity: near ? 0.7 : 0.25,
              }}
            />
          </div>
        );
      })}

      {/* The name of the thing you are standing over. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "52%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          fontSize: 11,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "var(--graview-ink-faint)",
          pointerEvents: "none",
        }}
      >
        {shape.kinds.length} kinds · {shape.links.length} relations
      </div>

      {/* What the selected kind is related to, in the schema's own words. */}
      {active ? (
        <div
          data-testid="constellation-detail"
          style={{
            position: "absolute",
            left: 20,
            bottom: 20,
            maxWidth: 340,
            display: "grid",
            gap: 5,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-float)",
            boxShadow: "var(--graview-lift-low)",
            fontSize: 12,
          }}
        >
          <strong style={{ fontSize: 13 }}>
            {shape.kinds.find((kind) => kind.kind === active)?.label}
          </strong>
          {shape.links
            .filter((link) => link.from === active || link.to === active)
            .map((link) => (
              <span key={link.id} style={{ color: "var(--graview-ink-muted)" }}>
                {link.description ?? link.edge.replace(/-/g, " ")}
                <span style={{ color: "var(--graview-ink-faint)" }}>
                  {" "}
                  · {link.from === active ? link.to : link.from}
                  {link.count === 0 ? " · none yet" : ` · ${link.count}`}
                </span>
              </span>
            ))}
          <span style={{ color: "var(--graview-ink-faint)", fontSize: 11 }}>
            Double click to go there.
          </span>
        </div>
      ) : null}
    </div>
  );
}
