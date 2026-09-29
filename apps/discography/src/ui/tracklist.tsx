import { labelOf, type AnySchema, type NodeOfSchema } from "@graview/core";
import { useGraview, type ViewProps } from "@graview/react";
import { Chip, hueFor, Panel, useArranging } from "@graview/primitives";

/**
 * TRACKLISTS: every release as a column, its songs in track order.
 *
 * Bound by roles, not names: `releases` is the kind whose members are the
 * columns (the group this is registered over), `entries` is the edge from a
 * release to what is on it, and `order` is the field on an entry that orders
 * it. A setlist is the same picture: gigs, "plays", position.
 */
export interface TracklistRoles {
  readonly entries: string;
  readonly order: string;
}

export class TracklistBindingError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "TracklistBindingError";
    this.hint = hint;
  }
}

export interface Column {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly { readonly id: string; readonly label: string; readonly order: number | null }[];
}

/** The picture as data: pure, so the reuse test can hold it. */
export function buildTracklists(
  releases: readonly ({ id: string; kind: string } & Record<string, unknown>)[],
  graph: { out(id: string, kind: string): ({ id: string; kind: string } & Record<string, unknown>)[] },
  roles: TracklistRoles,
  label: (node: { id: string; kind: string } & Record<string, unknown>) => string,
): Column[] {
  return releases.map((release) => {
    const entries = graph
      .out(release.id, roles.entries)
      .map((entry) => ({ id: entry.id, label: label(entry), order: typeof entry[roles.order] === "number" ? (entry[roles.order] as number) : null }))
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.label.localeCompare(b.label));
    return { id: release.id, label: label(release), entries };
  });
}

export function createTracklistLens<S extends AnySchema>(roles: TracklistRoles) {
  function View(props: ViewProps<S>) {
    const { store } = useGraview<S>();
    const { nodes, bar } = useArranging(props, { lensAllows: { group: false } });
    const kinds = new Set(nodes.map((node) => node.kind));
    for (const kind of kinds) {
      const edges = store.schema.tryDefinition(kind as never)?.edges as Record<string, unknown> | undefined;
      if (!edges?.[roles.entries]) {
        throw new TracklistBindingError(
          `The tracklist's "entries" role is "${roles.entries}", which ${kind} does not declare.`,
          `Bind entries to an edge ${kind} declares: ${Object.keys(edges ?? {}).join(", ") || "it declares none"}.`,
        );
      }
    }
    const name = (node: { id: string; kind: string } & Record<string, unknown>) => labelOf(store.schema.tryDefinition(node.kind as never), node);
    const columns = buildTracklists(nodes as never, store.graph as never, roles, name);
    const lit = new Set(props.implicated ?? []);
    const flagged = new Set(props.flagged ?? []);
    const emphasis = (id: string) => (lit.size === 0 ? "rest" : lit.has(id) ? "lit" : "dim");
    if (props.fidelity === "glyph") {
      return <Chip label={`${props.label ?? "Releases"} · ${columns.length}`} hue={hueFor(props.cardinality === "many" ? String([...kinds][0] ?? "") : "")} />;
    }
    const full = props.fidelity === "full";
    return (
      <Panel title={props.label ?? "Tracklists"} meta={`${columns.length} releases`} selected={props.selected}>
        {full ? bar : null}
        {columns.length === 0 ? (
          <p style={{ margin: 0 }}>No releases yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${full ? 180 : 140}px, 1fr))`, gap: 14 }}>
            {columns.map((column) => (
              <section key={column.id} style={{ display: "grid", gap: 4, alignContent: "start" }}>
                <strong
                  data-graview-pick={column.id}
                  data-graview-emphasis={emphasis(column.id)}
                  style={{ display: "block", fontSize: "0.9375rem", opacity: emphasis(column.id) === "dim" ? 0.4 : 1 }}
                >
                  {column.label}
                </strong>
                <ol style={{ margin: 0, paddingLeft: "1.6em", display: "grid", gap: 2 }}>
                  {column.entries.slice(0, full ? undefined : 5).map((entry) => (
                    <li key={entry.id} value={entry.order ?? undefined}>
                      <span
                        data-graview-pick={entry.id}
                        data-graview-emphasis={emphasis(entry.id)}
                        style={{ opacity: emphasis(entry.id) === "dim" ? 0.4 : 1, color: flagged.has(entry.id) ? "var(--graview-warn)" : undefined }}
                      >
                        {entry.label}
                        {flagged.has(entry.id) ? " ⚠" : ""}
                      </span>
                    </li>
                  ))}
                  {!full && column.entries.length > 5 ? <li style={{ listStyle: "none" }}>+{column.entries.length - 5} more</li> : null}
                </ol>
              </section>
            ))}
          </div>
        )}
      </Panel>
    );
  }
  return { name: "tracklist" as const, requiredRoles: ["entries", "order"] as const, View };
}

export type TracklistNode<S extends AnySchema> = NodeOfSchema<S>;
