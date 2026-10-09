import { pluralLabel, labelOf, layer, type AnySchema } from "@graview/core";
import { kindsOfAggregate } from "@graview/layout/view";
import { useGraph, useGraview, useSelection } from "@graview/react/provider";
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
 * ONE kind, not a stack of them. Two labeled rows of wrapping chips read
 * as debris; the single kind that touches the view most — the people of a
 * week, the players of a board — is the quick-select that earns the
 * corner. Everything else already has a district and a legend.
 */
const MOST_KINDS = 1;
/** A chip is a handle, not a sentence: long names cut with their full text on hover. */
const MOST_LABEL = 18;

/**
 * HANDLES THAT CAN BE TOLD APART.
 *
 * Cut at eighteen characters, a customer's three test drives — "Wei Haddad
 * in the 2017 Jeep…", "…2027 Chevrolet…", "…2027 Honda…" — were three
 * chips reading "Wei Haddad in the…", and three buttons with one name. Where
 * two cut handles would read the same, the words they share are what gets
 * cut: "…2017 Jeep Wrangl…". A label that fits, or whose cut is already
 * its own, is left as it was.
 */
export function handles(labels: readonly string[], most = MOST_LABEL): string[] {
  const cut = (text: string) => (text.length > most ? `${text.slice(0, most - 1).trimEnd()}…` : text);
  const first = labels.map(cut);
  return labels.map((label, index) => {
    const mine = first[index]!;
    const twins = labels.filter((_, other) => first[other] === mine);
    if (twins.length < 2) return mine;
    // The words every twin starts with, to a word boundary.
    let shared = twins.reduce((prefix, other) => {
      let at = 0;
      while (at < prefix.length && prefix[at] === other[at]) at += 1;
      return prefix.slice(0, at);
    }, label);
    const space = shared.lastIndexOf(" ");
    shared = space > 0 ? shared.slice(0, space + 1) : "";
    const rest = label.slice(shared.length);
    if (shared.length === 0 || rest.length === 0) return mine;
    return `…${rest.length > most - 1 ? `${rest.slice(0, most - 2).trimEnd()}…` : rest}`;
  });
}

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
        plural: pluralLabel(store.schema, kind),
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
    <section
      aria-label="Quick select"
      // In the seat it is a part of the seat, not a landmark of its own (FR-40).
      role={inside ? "group" : undefined}
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
              zIndex: layer("rail"),
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
          {row.members.map((member, index, all) => {
            const node = store.graph.getNode(member.id);
            if (!node) return null;
            const hue = Math.round(hueFor(member.kind, brand?.accents));
            const full = labelOf(store.schema.tryDefinition(member.kind), node);
            const shown = handles(
              all.map((one) => {
                const other = store.graph.getNode(one.id);
                return other ? labelOf(store.schema.tryDefinition(one.kind), other) : one.id;
              }),
            )[index]!;
            return (
              <button
                key={member.id}
                type="button"
                data-graview-quick={member.id}
                // The whole name is the button's name; the handle is only what fits.
                aria-label={full}
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
                    // The kind's plot in miniature, as every kind mark is (FR-117).
                    width: 10,
                    height: 6,
                    clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
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
    </section>
  );
}
