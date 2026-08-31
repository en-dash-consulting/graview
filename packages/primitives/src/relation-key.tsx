import type { AnySchema } from "@graview/core";
import { useGraph, useGraview, useNavigation, useSelection } from "@graview/react";
import { connectorStyle } from "@graview/render";

/**
 * What the lines mean.
 *
 * From the Graview the relations ARE the content, drawn with a colour and a
 * stroke pattern per edge kind — and nothing said which was which. A picture
 * of a domain whose only legend is "these are different from each other"
 * answers the shape of the question and not the question.
 *
 * Everything here is derived: the edge kinds come from the schema, the
 * treatment from the same `connectorStyle` the scene draws with, the
 * descriptions from the declarations, and the counts from the graph. Nothing
 * is authored per app, and a new edge kind appears the day it is declared.
 *
 * Clicking one selects the kinds it joins, which is the same gesture as
 * clicking a card: from up here, "show me what this touches" is the only thing
 * selecting can mean.
 */
export function RelationKey<S extends AnySchema>() {
  const { store, view } = useGraview<S>();
  const { selection, set } = useSelection();
  const { show } = useNavigation();
  // Recomputed when the graph changes, so a relation nobody uses yet does not
  // sit in the key claiming to exist.
  const nodes = useGraph<S>();
  void nodes;

  if (!view.overview) return null;

  const used = new Map<string, number>();
  for (const edge of store.graph.allEdges()) {
    used.set(edge.kind, (used.get(edge.kind) ?? 0) + 1);
  }
  const kinds = (store.schema.edgeKinds as readonly string[])
    .filter((kind) => (used.get(kind) ?? 0) > 0)
    .sort();
  if (kinds.length === 0) return null;

  /** An edge declaration's own words, from whichever kind declares it. */
  const describe = (edgeKind: string): string | undefined => {
    for (const definition of store.schema.definitions) {
      const declared = (definition.edges as Record<string, { description?: string }>)[edgeKind];
      if (declared?.description) return declared.description;
    }
    return undefined;
  };

  const chosen = new Set(selection);
  const kindsOfEdge = (edgeKind: string): string[] => {
    const ends = new Set<string>();
    for (const edge of store.graph.allEdges()) {
      if (edge.kind !== edgeKind) continue;
      for (const id of [edge.from, edge.to]) {
        const node = store.graph.getNode(id);
        if (node) ends.add(`kind:${node.kind}`);
      }
    }
    return [...ends];
  };

  return (
    <aside
      aria-label="What the lines mean"
      data-testid="relation-key"
      style={{
        position: "absolute",
        left: 20,
        bottom: 20,
        zIndex: 5,
        display: "grid",
        gap: 3,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-low)",
        maxWidth: 300,
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--graview-ink-faint)",
          paddingBottom: 2,
        }}
      >
        {kinds.length} relations
      </span>
      {kinds.map((edgeKind) => {
        const style = connectorStyle(edgeKind);
        const ends = kindsOfEdge(edgeKind);
        const lit = chosen.size === 0 || ends.some((id) => chosen.has(id));
        return (
          <button
            key={edgeKind}
            type="button"
            title={describe(edgeKind) ?? `${used.get(edgeKind)} of these`}
            onClick={() => {
              // Same gesture as clicking a card: show me what this touches.
              set(ends);
              show(null);
            }}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "grid",
              gridTemplateColumns: "34px 1fr auto",
              alignItems: "center",
              gap: 9,
              padding: "2px 3px",
              borderRadius: 6,
              opacity: lit ? 1 : 0.4,
            }}
          >
            {/* The same stroke the scene draws, at the same hue — a key whose
                swatch is an approximation is a key you cannot trust. */}
            <svg width="34" height="8" aria-hidden="true" style={{ display: "block" }}>
              <path
                d="M 1 4 L 33 4"
                fill="none"
                stroke={`hsl(${Math.round(style.hue * 360)} 55% 62%)`}
                strokeWidth={Math.max(1.6, style.width)}
                strokeDasharray={DASH[style.pattern]}
                strokeLinecap="round"
              />
            </svg>
            <span style={{ fontSize: 12, color: "var(--graview-ink)" }}>{edgeKind}</span>
            <span
              style={{
                fontSize: 11,
                color: "var(--graview-ink-faint)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {used.get(edgeKind)}
            </span>
          </button>
        );
      })}
    </aside>
  );
}

/** The same patterns the scene uses. Duplicated here would be a key that lies. */
const DASH: Record<string, string | undefined> = {
  solid: undefined,
  dashed: "7 5",
  dotted: "1 5",
  double: "12 3",
  tapered: "10 3 3 3",
};
