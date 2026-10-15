import { humanizeField, labelOf, nounOf, type AnyGraphNode, type AnySchema, type GraphReader } from "@graview/core";
import { edgeWords } from "@graview/core/words";
import { useGraph, useGraview } from "@graview/react/provider";
import { useState, type CSSProperties } from "react";
import { Chip } from "./primitives/index.js";
import { hueFor } from "@graview/render";

/**
 * Everything one edge away from a node, in the schema's own words.
 *
 * This is the answer to "I clicked a thing and nothing happened". A node in a
 * typed graph is never an island: an event has people at it, an agreement
 * that judges it, a reason it exists. All of that is already declared — every
 * edge carries a description like "who does the run" or "a nap that must not
 * be interrupted" — and until now no surface read any of it.
 *
 * Derived entirely from the schema and the graph, so a kind nobody wrote a
 * view for still shows its relationships, and a new edge kind appears here
 * the moment it is declared. Each neighbor is a `data-graview-pick` target,
 * so the scene routes a click on it to that node.
 */
export interface ConnectionsProps {
  readonly id: string;
  /** Chips per group before it offers "+N more", which opens the rest, rather than truncating. */
  readonly max?: number;
  /** Shown when the node has no edges at all. Omit for silence. */
  readonly empty?: string;
  /**
   * Records the surrounding view already lists (FR-141): a declared page's
   * own list of what a workshop part covers. A tie said there is not said
   * again here, and a heading left with nothing under it is not drawn.
   */
  readonly hide?: ReadonlySet<string>;
}

interface Group {
  readonly key: string;
  readonly label: string;
  /** What a screen reader says, where the label is an arrow: the relation's words. */
  readonly said?: string;
  readonly ids: string[];
}

export function Connections({ id, max = 8, empty, hide }: ConnectionsProps) {
  const { store } = useGraview<AnySchema>();
  // Subscribing to the graph keeps this current when an edge is added.
  useGraph();
  // What it JUDGES counts as a connection: a rule's violations name the
  // nodes it is about, and a card saying "nothing is connected" over a band
  // of them was two surfaces disagreeing.
  const all = groupsFor(store, id, store.violations());
  /* The groups opened past their first chips, by key: "+N more" opens one, "Show fewer" closes it. */
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const groups = hide
    ? all.flatMap((group) => {
        const ids = group.ids.filter((other) => !hide.has(other));
        return ids.length > 0 ? [{ ...group, ids }] : [];
      })
    : all;

  // Ties the view already listed are not "nothing connected": then it says nothing.
  if (groups.length === 0) {
    return empty && all.length === 0 ? (
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--graview-ink-faint)" }}>{empty}</p>
    ) : null;
  }

  return (
    <div
      data-graview-primitive="connections"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {groups.map((group) => {
        const open = opened.has(group.key);
        const cut = group.ids.length > max;
        const shown = open ? group.ids : group.ids.slice(0, max);
        const hidden = group.ids.length - Math.min(max, group.ids.length);
        const chips = `graview-more-${id}-${group.key}`.replace(/[^A-Za-z0-9_-]/g, "-");
        return (
          <section key={group.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/*
              * h2, not h4. The scene's document has exactly one heading above
              * this — the app's name in the bar — so a relation's caption is
              * the next level down. Written as an h4 for its size (which the
              * style sets anyway), it skipped two, and a screen reader's
              * heading list read as though two sections were missing. axe
              * calls it `heading-order`; nothing here ran axe on a scene with
              * a relation drawn in it until the walkthrough did.
              */}
            <h2
              {...(group.said ? { "aria-label": group.said } : {})}
              style={{
                margin: 0,
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: "var(--graview-ink-faint)",
              }}
            >
              {group.label}
            </h2>
            <div id={chips} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {shown.map((neighborId) => {
                const node = store.graph.getNode(neighborId);
                if (!node) return null;
                return (
                  <Chip
                    key={neighborId}
                    pickId={neighborId}
                    hue={hueFor(node.kind)}
                    title={`Go to the ${nounOf(store.schema.tryDefinition(node.kind), node.kind)}`}
                    label={labelOf(store.schema.tryDefinition(node.kind), node)}
                  />
                );
              })}
              {/*
                * "+N MORE" IS A BUTTON. It was a chip with no press behind
                * it, so a card said there were two more findings and offered
                * no way to see them. It opens the group in place, every chip
                * of it, and closes again; the card scrolls if they need the
                * room.
                */}
              {cut ? (
                <button
                  type="button"
                  data-graview-more={group.key}
                  aria-expanded={open}
                  aria-controls={chips}
                  {...(open ? {} : { "aria-label": `${hidden} more: ${group.said ?? group.label}` })}
                  onClick={(event) => {
                    // Its own meaning, not a press on the card it sits on.
                    event.stopPropagation();
                    setOpened((was) => {
                      const next = new Set(was);
                      if (next.has(group.key)) next.delete(group.key);
                      else next.add(group.key);
                      return next;
                    });
                  }}
                  style={MORE}
                >
                  {open ? "Show fewer" : `+${hidden} more`}
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** "+N more" at a chip's size, as the control it is. */
const MORE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "flex-start",
  minHeight: 24,
  boxSizing: "border-box",
  padding: "3px 9px",
  borderRadius: 6,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel-muted)",
  color: "var(--graview-accent)",
  font: "inherit",
  fontSize: "0.8125rem",
  lineHeight: 1.5,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

/**
 * Neighbors grouped by the edge that reaches them.
 *
 * An outbound edge is described by the focus's own declaration; an inbound
 * one by the declaration of whatever points at it. Both are the schema
 * author's words about that relationship, which is what makes this readable
 * without anyone writing UI copy.
 */
function groupsFor(
  store: { graph: GraphReader<AnyGraphNode>; schema: AnySchema },
  id: string,
  violations: readonly { readonly subjectId?: string; readonly nodeIds: readonly string[] }[] = [],
): Group[] {
  const focus = store.graph.getNode(id);
  if (!focus) return [];
  const byKey = new Map<string, Group>();
  const judged: string[] = [];
  for (const violation of violations) {
    if (violation.subjectId !== id) continue;
    for (const other of violation.nodeIds) if (other !== id && !judged.includes(other) && store.graph.has(other)) judged.push(other);
  }
  if (judged.length > 0) byKey.set("judges", { key: "judges", label: "what it finds wrong", ids: judged });

  for (const edge of store.graph.allEdges()) {
    const otherId = edge.from === id ? edge.to : edge.to === id ? edge.from : null;
    if (otherId === null || otherId === id) continue;
    const other = store.graph.getNode(otherId);
    if (!other) continue;
    const direction = edge.from === id ? "out" : "in";
    // The edge is declared by whichever kind it leaves, wherever you are
    // reading it from.
    const owner = direction === "out" ? focus.kind : other.kind;
    // One group per reading: kinds that word a shared relation their own way are listed apart, under each one's words.
    const caption = captionOf(store.schema, owner, edge.kind, direction);
    const key = `${edge.kind}:${direction}:${caption.label}`;
    const group =
      byKey.get(key) ??
      ({
        key,
        /*
         * READ FROM THE END YOU ARE STANDING ON.
         *
         * An edge has one direction and two readings. Using the declaring
         * side's words for both captioned a task's page "the tasks in this
         * list", as though the task contained tasks. Incoming edges take the
         * declaration's `inverse` when it has one, and the edge kind in plain
         * words when it does not — which says less and is at least not wrong.
         */
        ...caption,
        ids: [],
      } satisfies Group);
    if (!group.ids.includes(otherId)) group.ids.push(otherId);
    byKey.set(key, group);
  }

  for (const group of byKey.values()) group.ids.sort();
  return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * A GROUP'S CAPTION (FR-142): the declaration's words for this end where
 * they are a phrase of their own ("covers", "the plan it is on"), else an
 * arrow that says which way the relation points and its name — "→ tier"
 * from the record that declares it, "← part of" from the record it points
 * at. The key spoken alone, "part of" over the topics a workshop part
 * holds, read the relation the wrong way round. A screen reader hears the
 * words, never the arrow.
 */
function captionOf(schema: AnySchema, owner: string, edgeKind: string, direction: "out" | "in"): { readonly label: string; readonly said?: string } {
  const words = edgeWords(schema, owner, edgeKind, direction);
  const key = humanizeField(edgeKind).toLowerCase();
  if (words.trim().toLowerCase() !== key) return { label: words };
  return direction === "out" ? { label: `→ ${key}`, said: key } : { label: `← ${key}`, said: `${key}, pointing here` };
}
