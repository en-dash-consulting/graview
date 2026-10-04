import { labelOf, nounOf, type AnyGraphNode, type AnySchema, type GraphReader } from "@graview/core";
import { useGraph, useGraview } from "@graview/react/provider";
import { Chip } from "./primitives/index.js";
import { hueFor } from "./default-views.js";

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
 * the moment it is declared. Each neighbour is a `data-graview-pick` target,
 * so the scene routes a click on it to that node.
 */
export interface ConnectionsProps {
  readonly id: string;
  /** Chips per group before it says "+N more" rather than truncating. */
  readonly max?: number;
  /** Shown when the node has no edges at all. Omit for silence. */
  readonly empty?: string;
}

interface Group {
  readonly key: string;
  readonly label: string;
  readonly ids: string[];
}

export function Connections({ id, max = 8, empty }: ConnectionsProps) {
  const { store } = useGraview<AnySchema>();
  // Subscribing to the graph keeps this current when an edge is added.
  useGraph();
  // What it JUDGES counts as a connection: a rule's violations name the
  // nodes it is about, and a card saying "nothing is connected" over a band
  // of them was two surfaces disagreeing.
  const groups = groupsFor(store, id, store.violations());

  if (groups.length === 0) {
    return empty ? (
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--graview-ink-faint)" }}>{empty}</p>
    ) : null;
  }

  return (
    <div
      data-graview-primitive="connections"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {groups.map((group) => {
        const shown = group.ids.slice(0, max);
        const hidden = group.ids.length - shown.length;
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {shown.map((neighbourId) => {
                const node = store.graph.getNode(neighbourId);
                if (!node) return null;
                return (
                  <Chip
                    key={neighbourId}
                    pickId={neighbourId}
                    hue={hueFor(node.kind)}
                    title={`Go to the ${nounOf(store.schema.tryDefinition(node.kind), node.kind)}`}
                    label={labelOf(store.schema.tryDefinition(node.kind), node)}
                  />
                );
              })}
              {hidden > 0 ? <Chip label={`+${hidden} more`} /> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Neighbours grouped by the edge that reaches them.
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
    const key = `${edge.kind}:${direction}`;
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
        label:
          (direction === "out"
            ? describeEdge(store.schema, owner, edge.kind)?.description
            : describeEdge(store.schema, owner, edge.kind)?.inverse) ??
          edge.kind.replace(/-/g, " "),
        ids: [],
      } satisfies Group);
    if (!group.ids.includes(otherId)) group.ids.push(otherId);
    byKey.set(key, group);
  }

  for (const group of byKey.values()) group.ids.sort();
  return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

function describeEdge(
  schema: AnySchema,
  ownerKind: string,
  edgeKind: string,
): { description?: string; inverse?: string } | undefined {
  const edges = schema.tryDefinition(ownerKind)?.edges as
    | Record<string, { description?: string; inverse?: string }>
    | undefined;
  return edges?.[edgeKind];
}
