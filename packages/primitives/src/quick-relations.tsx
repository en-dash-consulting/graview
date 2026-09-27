import { labelOf, type AnySchema } from "@graview/core";
import { kindsOfAggregate } from "@graview/layout";
import { useGraph, useGraview, useSelection } from "@graview/react";
import { useMemo } from "react";
import { hueFor } from "./default-views.js";

/**
 * THE PEOPLE BEHIND A VIEW, one press away.
 *
 * "Which of this week is Parent1's?" used to cost two deliberate gestures —
 * raise People, then pick the person — for a one-glance question. The
 * answer machinery has always existed (selecting a node lights everything
 * it implicates); this is the fast way in: the graph already knows which
 * few nodes touch the focused group most, so they stand as chips beside
 * the scene. One click selects and the emphasis path does the rest; the
 * pane then owns the rail, and Escape (or its ×) brings the chips back.
 *
 * Everything is derived and capped: kinds one edge from the focus whose
 * membership is SMALL — a household's five people, not a season's forty
 * sessions — ranked by how much of the visible view each one touches. A
 * crowd never becomes a toolbar; it already has a district.
 */
/*
 * Five, so the panel always finishes above the inspector's docked top edge
 * — the two share the left rail as a stack, never a collision. A kind with
 * more members has a district for exactly this.
 */
const MOST_MEMBERS = 5;
/*
 * ONE kind, not a stack of them. Two labelled rows of wrapping chips read
 * as debris; the single kind that touches the view most — the people of a
 * week, the players of a board — is the quick-select that earns the
 * corner. Everything else already has a district and a legend.
 */
const MOST_KINDS = 1;
/** A chip is a handle, not a sentence: long names cut with their full text on hover. */
const MOST_LABEL = 18;

export function QuickRelations<S extends AnySchema>({ inside = false }: { readonly inside?: boolean } = {}) {
  const { store, view, brand, menuAt } = useGraview<S>();
  const { set } = useSelection();
  const { selection } = useSelection();
  const nodes = useGraph<S>();

  const rows = useMemo(() => {
    if (!view.focusId) return [];
    const focusKinds = kindsOfAggregate(view.focusId);
    const inFocus = new Set(
      focusKinds.length > 0
        ? nodes.filter((node) => focusKinds.includes(node.kind as string)).map((node) => node.id)
        : [view.focusId],
    );
    if (inFocus.size === 0) return [];

    // One pass: everything one edge from the focus group, by kind, with how
    // many of the visible things each candidate touches.
    const byKind = new Map<string, Map<string, { id: string; kind: string; touches: number }>>();
    for (const edge of store.graph.allEdges()) {
      const outward = inFocus.has(edge.from) ? edge.to : inFocus.has(edge.to) ? edge.from : null;
      if (!outward || inFocus.has(outward)) continue;
      const node = store.graph.getNode(outward);
      if (!node) continue;
      if (focusKinds.includes(node.kind as string)) continue;
      const members = byKind.get(node.kind as string) ?? new Map();
      const entry = members.get(node.id) ?? { id: node.id, kind: node.kind as string, touches: 0 };
      entry.touches += 1;
      members.set(node.id, entry);
      byKind.set(node.kind as string, members);
    }

    return [...byKind.entries()]
      .filter(([, members]) => members.size > 0 && members.size <= MOST_MEMBERS)
      .map(([kind, members]) => ({
        kind,
        plural: store.schema.tryDefinition(kind)?.plural ?? `${kind}s`,
        reach: [...members.values()].reduce((sum, entry) => sum + entry.touches, 0),
        members: [...members.values()].sort(
          (a, b) => b.touches - a.touches || a.id.localeCompare(b.id),
        ),
      }))
      .sort((a, b) => b.reach - a.reach)
      .slice(0, MOST_KINDS);
  }, [store, nodes, view.focusId]);

  /*
   * THE RAIL HAS ONE TENANT AT A TIME. At altitude the legend owns the
   * corner; in the stack these chips do — until something is selected, at
   * which point the inspector takes the whole rail and the chips stand
   * aside (they are the way IN; the pane is where you already are, and its
   * × or Escape is the way back out, after which the chips return). A
   * pointer menu quiets the corner the same way.
   */
  if (view.overview || rows.length === 0 || menuAt !== null || selection.length > 0) {
    return null;
  }

  return (
    <aside
      aria-label="Quick select"
      data-testid="quick-relations"
      style={
        inside
          ? { display: "grid", gap: 5 }
          : {
              /*
               * The SAME dress the legend wears at altitude: one corner, one
               * visual language at both heights. Loose chips floating on the
               * ground read as something spilled; a panel reads as something
               * placed.
               */
              position: "absolute",
              left: 16,
              top: 14,
              zIndex: 5,
              display: "grid",
              gap: 5,
              maxWidth: "min(250px, 21cqw)",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--graview-edge)",
              background: "var(--graview-float)",
              boxShadow: "var(--graview-lift-low)",
              animation: "graview-settle 380ms 120ms ease backwards",
            }
      }
    >
      {rows.map((row) => (
        <div key={row.kind} style={{ display: "grid", gap: 5 }}>
          <span
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--graview-ink-faint)",
            }}
          >
            {row.plural}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {row.members.map((member) => {
            const node = store.graph.getNode(member.id);
            if (!node) return null;
            const hue = Math.round(hueFor(member.kind, brand?.accents));
            const full = labelOf(store.schema.tryDefinition(member.kind), node);
            const shown = full.length > MOST_LABEL ? `${full.slice(0, MOST_LABEL - 1).trimEnd()}…` : full;
            return (
              <button
                key={member.id}
                type="button"
                data-graview-quick={member.id}
                title={`${full} — ${member.touches} of what you are looking at`}
                onClick={() => set([member.id])}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  minHeight: 24,
                  padding: "2px 9px",
                  fontSize: "0.8125rem",
                  borderRadius: 999,
                  cursor: "pointer",
                  border: "1px solid var(--graview-edge)",
                  background: "var(--graview-float)",
                  color: "var(--graview-ink)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    flex: "0 0 auto",
                    background: `hsl(${hue} 55% var(--graview-tint-lightness) / 0.9)`,
                  }}
                />
                {shown}
              </button>
            );
          })}
          </div>
        </div>
      ))}
    </aside>
  );
}
