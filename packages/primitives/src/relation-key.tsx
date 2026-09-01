import type { AnySchema } from "@graview/core";
import { useGraph, useGraview, useNavigation, useSelection } from "@graview/react";
import {
  CONNECTOR_DASH,
  connectorStroke,
  connectorStyle,
  connectorWidth,
} from "@graview/render";
import { useEffect, useMemo } from "react";

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
  const { store, view, emphasis, setEmphasis } = useGraview<S>();
  const { selection, set } = useSelection();
  const { show } = useNavigation();
  // Recomputed when the graph changes, so a relation nobody uses yet does not
  // sit in the key claiming to exist.
  const nodes = useGraph<S>();

  /*
   * One pass over the edges, not one per relation.
   *
   * `allEdges()` materialises a fresh array every call, and this component
   * re-renders on every diff — so scanning once per edge kind, plus again for
   * the counts, rebuilt the whole edge list six times per mutation while the
   * Graview was open.
   */
  const relations = useMemo(() => {
    const found = new Map<string, { count: number; ends: Set<string> }>();
    for (const edge of store.graph.allEdges()) {
      const entry = found.get(edge.kind) ?? { count: 0, ends: new Set<string>() };
      entry.count += 1;
      for (const id of [edge.from, edge.to]) {
        const node = store.graph.getNode(id);
        if (node) entry.ends.add(`kind:${node.kind}`);
      }
      found.set(edge.kind, entry);
    }
    return [...found.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kind, entry]) => ({ kind, count: entry.count, ends: [...entry.ends] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, nodes]);

  // A key that disappears mid-hover must not leave its question standing.
  useEffect(() => () => setEmphasis(null), [setEmphasis]);

  if (!view.overview || relations.length === 0) return null;

  /*
   * A relation is LIT when the selection reaches one of the kinds it joins.
   *
   * Resolved the same way the scene resolves a connector endpoint: the
   * selection holds real node ids, and up here what is drawn is a kind card.
   * Comparing them directly dimmed every row at once whenever an ordinary
   * selection was carried into the Graview — a legend reading "nothing
   * matches" when nothing was asked.
   */
  const chosen = new Set<string>();
  for (const id of selection) {
    if (id.startsWith("kind:")) {
      chosen.add(id);
      continue;
    }
    const node = store.graph.getNode(id);
    if (node) chosen.add(`kind:${node.kind}`);
  }

  return (
    <aside
      aria-label="What the lines mean"
      data-testid="relation-key"
      style={{
        position: "absolute",
        /*
         * The TOP-LEFT corner, mirroring the altitude control top-right.
         *
         * The bottom-left is ring ground now — the near-left districts land
         * there, and the key was sitting on them. The upper corners are the
         * one part of the ellipse that stays empty at every count.
         */
        left: 16,
        top: 14,
        zIndex: 5,
        display: "grid",
        gap: 1,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-low)",
        maxWidth: 250,
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
        {relations.length === 1 ? "1 relation" : `${relations.length} relations`}
      </span>
      {relations.map(({ kind: edgeKind, count, ends }) => {
        const style = connectorStyle(edgeKind);
        const lit =
          emphasis !== null
            ? emphasis === edgeKind
            : chosen.size === 0 || ends.some((id) => chosen.has(id));
        return (
          <button
            key={edgeKind}
            type="button"
            // The schema's own accessor, which resolves first-declaration-wins
            // exactly like the hand-rolled scan did, without a cast that would
            // stop catching a shape change.
            title={store.schema.edge(edgeKind)?.description ?? `${count} of these`}
            /*
             * Pointing at a row asks the picture the question: this relation's
             * lines come forward and the rest recede. From up here the lines
             * are the content, and a legend that cannot pick one line out of
             * the picture is a caption, not a key.
             */
            onMouseEnter={() => setEmphasis(edgeKind)}
            onMouseLeave={() => setEmphasis(null)}
            onFocus={() => setEmphasis(edgeKind)}
            onBlur={() => setEmphasis(null)}
            onClick={() => {
              // Same gesture as clicking a card: show me what this touches.
              set(ends);
              show(null);
            }}
            style={{
              all: "unset",
              // `all: unset` resets `outline` too, and an inline declaration
              // beats the stylesheet — so the theme's focus ring disappears
              // from the only controls in here unless it is restored.
              outline: "revert-layer",
              cursor: "pointer",
              display: "grid",
              gridTemplateColumns: "30px 1fr auto",
              alignItems: "center",
              gap: 8,
              minHeight: 23,
              padding: "2px 4px",
              borderRadius: 6,
              opacity: lit ? 1 : 0.4,
            }}
          >
            {/* The same stroke the scene draws, from the same helpers — a key
                whose swatch is an approximation is a key you cannot trust. */}
            <svg width="30" height="8" aria-hidden="true" style={{ display: "block" }}>
              <path
                d="M 1 4 L 29 4"
                fill="none"
                stroke={connectorStroke(style)}
                strokeWidth={connectorWidth(style, true)}
                strokeDasharray={CONNECTOR_DASH[style.pattern]}
                strokeLinecap="round"
              />
            </svg>
            <span style={{ fontSize: 11.5, color: "var(--graview-ink)" }}>{edgeKind}</span>
            <span
              style={{
                fontSize: 11,
                color: "var(--graview-ink-faint)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
