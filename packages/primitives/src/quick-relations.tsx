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
 * the scene. One click selects (the emphasis path does the rest), a second
 * click clears, shift adds.
 *
 * Everything is derived and capped: kinds one edge from the focus whose
 * membership is SMALL — a household's five people, not a season's forty
 * sessions — ranked by how much of the visible view each one touches. A
 * crowd never becomes a toolbar; it already has a district.
 */
const MOST_MEMBERS = 6;
const MOST_KINDS = 2;

export function QuickRelations<S extends AnySchema>() {
  const { store, view, brand } = useGraview<S>();
  const { selection, set, clear, toggle, isSelected } = useSelection();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, nodes, view.focusId]);

  // At altitude the legend owns this corner and the districts are the
  // quick-select surface; in the stack this is the corner's tenant.
  if (view.overview || rows.length === 0) return null;

  return (
    <aside
      aria-label="Quick select"
      data-testid="quick-relations"
      style={{
        position: "absolute",
        left: 16,
        top: 14,
        zIndex: 5,
        display: "grid",
        gap: 6,
        maxWidth: 236,
      }}
    >
      {rows.map((row) => (
        <div key={row.kind} style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--graview-ink-faint)",
              marginRight: 2,
            }}
          >
            {row.plural}
          </span>
          {row.members.map((member) => {
            const node = store.graph.getNode(member.id);
            if (!node) return null;
            const pressed = isSelected(member.id);
            const hue = Math.round(hueFor(member.kind, brand?.accents) * 360);
            return (
              <button
                key={member.id}
                type="button"
                data-graview-quick={member.id}
                aria-pressed={pressed}
                title={`${labelOf(store.schema.tryDefinition(member.kind), node as never)} — ${member.touches} of what you are looking at`}
                onClick={(event) => {
                  // The scene's own grammar: plain click selects, again
                  // clears, shift adds to what is held.
                  if (event.shiftKey || event.metaKey) toggle(member.id);
                  else if (pressed && selection.length === 1) clear();
                  else set([member.id]);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  minHeight: 24,
                  padding: "2px 9px",
                  fontSize: 11.5,
                  borderRadius: 999,
                  cursor: "pointer",
                  border: `1px solid ${pressed ? "var(--graview-accent)" : "var(--graview-edge)"}`,
                  background: pressed ? "var(--graview-panel)" : "var(--graview-float)",
                  color: "var(--graview-ink)",
                  boxShadow: pressed ? "var(--graview-lift-low)" : "none",
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
                {labelOf(store.schema.tryDefinition(member.kind), node as never)}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
