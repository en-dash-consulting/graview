import { labelOf, type AnySchema, type NodeOfSchema } from "@graview/core";
import { useGraview, type ViewProps } from "@graview/react";
import type { CSSProperties, ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Chip, Panel, Roster } from "../primitives/index.js";

/**
 * The coverage lens: does everything on one side have something on the other?
 *
 * The timeline answers "when". This answers "did we miss anything", which is
 * a different question with a different natural picture — a bipartite mapping
 * rather than an interval. Requirements against deliverables, tests against
 * behaviours, controls against risks, skills against drills: the shape recurs
 * everywhere two sets of things are supposed to correspond, and the failure
 * is always the same two pictures.
 *
 * **An empty row** is something that was asked for and answered by nothing.
 * **An empty column** is something you are doing that nobody asked for.
 *
 * Both are absences of a RELATIONSHIP, which is exactly what prose review is
 * worst at and a graph is best at: reading a document top to bottom will not
 * reveal the paragraph that was never written. Reading down a column of
 * empty cells takes a second.
 *
 * Built from the same public primitives an app has, like the timeline, so it
 * stays a worked example of the authoring API rather than a privileged
 * insider.
 */

export const COVERAGE_REQUIRED_ROLES = ["rows", "columns", "link"] as const;

export interface CoverageRoles {
  /** Kind whose nodes are rows: the things that must be covered. */
  readonly rows: string;
  /** Kind whose nodes are columns: the things that do the covering. */
  readonly columns: string;
  /** Edge kind running from a column node to a row node. */
  readonly link: string;
}

export interface CoverageOptions extends CoverageRoles {
  /** Field on a row node carrying a short reference, shown before the label. */
  readonly rowRef?: string;
  /**
   * Field on a row node that sorts and groups it — a priority, a category.
   * Values are grouped in the order given by `groupOrder`.
   */
  readonly rowGroup?: string;
  readonly groupOrder?: readonly string[];
  /**
   * Rows in this group must be covered; rows outside it are optional and an
   * empty row is not a failure. Without it the picture cannot distinguish
   * "we missed a mandatory thing" from "we declined an optional one".
   */
  readonly requiredGroups?: readonly string[];
  /**
   * A second relation, shown as a per-row badge rather than a second grid.
   *
   * Two coverage relations rarely share a column set — a requirement is
   * satisfied by deliverables and narrated by sections — so overlaying them
   * on one matrix is not possible. A gutter mark is, and it is enough: the
   * row that has cells but no mark is work you do and never mention.
   */
  readonly badge?: {
    readonly edge: string;
    readonly symbol: string;
    readonly title: string;
    readonly missingTitle: string;
  };
  /** Column ordering field. Falls back to the node id, which is stable. */
  readonly columnGroup?: string;
}

export interface CoverageCell {
  readonly rowId: string;
  readonly columnId: string;
}

export interface CoverageGrid {
  readonly rows: readonly {
    readonly id: string;
    readonly ref: string;
    readonly label: string;
    readonly group: string;
    readonly required: boolean;
    readonly covered: boolean;
    readonly badged: boolean;
  }[];
  readonly columns: readonly {
    readonly id: string;
    readonly label: string;
    readonly used: boolean;
  }[];
  readonly cells: readonly CoverageCell[];
  /** Required rows with nothing against them. The reason the lens exists. */
  readonly gaps: readonly string[];
  /** Columns nobody asked for. The other reason. */
  readonly unasked: readonly string[];
}

export class CoverageBindingError extends Error {
  constructor(message: string, readonly hint: string) {
    super(`${message}\n  ${hint}`);
    this.name = "CoverageBindingError";
  }
}

const text = (node: Record<string, unknown>, field: string | undefined): string =>
  field && node[field] !== undefined ? String(node[field]) : "";

/**
 * Reads the grid out of the graph, in the app's own field names.
 *
 * Pure and exported, so an app can assert on the same numbers the picture is
 * drawn from rather than on the rendering of them.
 */
export function buildCoverage<S extends AnySchema>(
  nodes: readonly NodeOfSchema<S>[],
  edges: readonly { kind: string; from: string; to: string }[],
  options: CoverageOptions,
  schema?: S,
): CoverageGrid {
  const asRecord = (node: NodeOfSchema<S>) => node as unknown as Record<string, unknown>;
  const label = (node: NodeOfSchema<S>) =>
    schema ? labelOf(schema.tryDefinition(node.kind), node as never) : String(asRecord(node)["label"] ?? node.id);

  const rowNodes = nodes.filter((node) => node.kind === options.rows);
  const columnNodes = nodes.filter((node) => node.kind === options.columns);
  if (rowNodes.length === 0 && columnNodes.length === 0) {
    throw new CoverageBindingError(
      `Nothing to lay out: no "${options.rows}" and no "${options.columns}" nodes.`,
      `Check the lens bindings: { rows: "<kind>", columns: "<kind>", link: "<edge kind>" }`,
    );
  }

  const order = options.groupOrder ?? [];
  const groupRank = (value: string) => {
    const index = order.indexOf(value);
    return index === -1 ? order.length : index;
  };

  const linked = edges.filter((edge) => edge.kind === options.link);
  const badgeEdges = options.badge
    ? edges.filter((edge) => edge.kind === options.badge!.edge)
    : [];

  const cells: CoverageCell[] = [];
  for (const edge of linked) {
    // The edge runs column → row; anything else is a binding mistake rather
    // than an empty grid, and saying so beats drawing nothing.
    const rowId = rowNodes.find((node) => node.id === edge.to)?.id;
    const columnId = columnNodes.find((node) => node.id === edge.from)?.id;
    if (rowId && columnId) cells.push({ rowId, columnId });
  }

  const required = new Set(options.requiredGroups ?? []);
  const rows = rowNodes
    .map((node) => {
      const record = asRecord(node);
      const group = text(record, options.rowGroup);
      return {
        id: node.id,
        ref: text(record, options.rowRef),
        label: String(record["label"] ?? label(node)),
        group,
        required: required.size === 0 || required.has(group),
        covered: cells.some((cell) => cell.rowId === node.id),
        badged: badgeEdges.some((edge) => edge.to === node.id),
      };
    })
    .sort(
      (a, b) => groupRank(a.group) - groupRank(b.group) || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0),
    );

  const columns = columnNodes
    .map((node) => ({
      id: node.id,
      label: label(node),
      used: cells.some((cell) => cell.columnId === node.id),
    }))
    .sort((a, b) => {
      const ga = text(asRecord(columnNodes.find((n) => n.id === a.id)!), options.columnGroup);
      const gb = text(asRecord(columnNodes.find((n) => n.id === b.id)!), options.columnGroup);
      return ga < gb ? -1 : ga > gb ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  return {
    rows,
    columns,
    cells,
    gaps: rows.filter((row) => row.required && !row.covered).map((row) => row.id),
    unasked: columns.filter((column) => !column.used).map((column) => column.id),
  };
}

export interface CoverageViewProps<S extends AnySchema> extends ViewProps<S> {
  readonly options: CoverageOptions;
  readonly schema?: S;
}

const ROW_LABEL_WIDTH = 250;
const HEADER_HEIGHT = 116;
/**
 * Room for the last column's header to ascend into.
 *
 * Rotated labels always run up and to the right of the column they name, so
 * the right-most one overflows unless the grid reserves the space. Reserving
 * it on the shared container keeps the header strip and the rows aligned;
 * padding one and not the other is how a matrix ends up one column out.
 */
const HEADER_OVERHANG = 52;
const HEADER_MAX = 138;

/**
 * The lens's aggregate view.
 *
 * Full fidelity draws the matrix. Summary drops it entirely for a coverage
 * bar and the names of what is missing — fidelity SWITCHING rather than
 * scaling, the same discipline the timeline keeps, because a matrix shrunk to
 * a third of its size is a grey rectangle and a list of two names is not.
 */
export function CoverageView<S extends AnySchema>({
  nodes,
  label,
  fidelity,
  options,
  schema,
  implicated = [],
  flagged = [],
}: CoverageViewProps<S>) {
  const { store } = useGraview<AnySchema>();
  const grid = buildCoverage<S>(
    nodes ?? [],
    store.graph.allEdges(),
    options,
    schema,
  );

  if (fidelity === "glyph") {
    return (
      <Chip
        label={`${label ?? "Coverage"} · ${grid.gaps.length === 0 ? "complete" : `${grid.gaps.length} missing`}`}
        hue={hueFor("coverage")}
      />
    );
  }

  if (fidelity === "summary") {
    const missing = grid.rows.filter((row) => grid.gaps.includes(row.id));
    return (
      <Panel
        title={label ?? "Coverage"}
        meta={`${grid.rows.length - grid.gaps.length}/${grid.rows.length}`}
        tone={grid.gaps.length > 0 ? "warning" : "muted"}
        fit
      >
        <CoverageBar grid={grid} />
        {missing.length > 0 ? (
          <Roster
            pick
            max={4}
            items={missing.map((row) => ({ id: row.id, label: row.ref || row.label }))}
          />
        ) : null}
      </Panel>
    );
  }

  const lit = new Set(implicated);
  const broken = new Set(flagged);

  return (
    <Panel
      title={label ?? "Coverage"}
      meta={
        grid.gaps.length === 0 && grid.unasked.length === 0
          ? "complete"
          : [
              grid.gaps.length > 0 ? `${grid.gaps.length} unanswered` : "",
              grid.unasked.length > 0 ? `${grid.unasked.length} unasked` : "",
            ]
              .filter(Boolean)
              .join(" · ")
      }
      selected={false}
      fit
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          paddingRight: HEADER_OVERHANG,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", flex: "0 0 auto" }}>
          <div style={{ width: ROW_LABEL_WIDTH, flex: "0 0 auto" }} />
          <div style={{ display: "flex", flex: 1, minWidth: 0, height: HEADER_HEIGHT }}>
            {grid.columns.map((column) => (
              <div
                key={column.id}
                data-graview-pick={column.id}
                title={column.label}
                style={{
                  flex: 1,
                  minWidth: 0,
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                {/*
                  * Rotated headers rather than truncation. A matrix whose
                  * column names read "Booking flow rem…" is a matrix you
                  * cannot use, and turning the text is the oldest fix there
                  * is.
                  */}
                <span
                  style={{
                    position: "absolute",
                    bottom: 6,
                    left: "50%",
                    transformOrigin: "left bottom",
                    transform: "rotate(-58deg)",
                    whiteSpace: "nowrap",
                    maxWidth: HEADER_MAX,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: 11,
                    letterSpacing: "0.01em",
                    color: column.used
                      ? lit.size > 0 && !lit.has(column.id)
                        ? "var(--graview-ink-faint)"
                        : "var(--graview-ink)"
                      : "var(--graview-warn)",
                  }}
                >
                  {column.used ? "" : "⚠ "}
                  {column.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          {grid.rows.map((row, index) => {
            const previous = grid.rows[index - 1];
            const startsGroup = previous === undefined || previous.group !== row.group;
            const missing = row.required && !row.covered;
            const dim = lit.size > 0 && !lit.has(row.id);
            return (
              <div key={row.id}>
                {startsGroup && row.group ? (
                  <div
                    style={{
                      fontSize: 9.5,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--graview-ink-faint)",
                      padding: "9px 0 3px",
                    }}
                  >
                    {row.group}
                  </div>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    borderTop: "1px solid var(--graview-edge)",
                    opacity: dim ? 0.72 : 1,
                  }}
                >
                  <div
                    data-graview-pick={row.id}
                    title={row.label}
                    style={{
                      width: ROW_LABEL_WIDTH,
                      flex: "0 0 auto",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "6px 10px 6px 0",
                      fontSize: 12,
                      minWidth: 0,
                      color:
                        missing || broken.has(row.id) ? "var(--graview-warn)" : "var(--graview-ink)",
                    }}
                  >
                    {row.ref ? (
                      <span
                        style={{
                          flex: "0 0 auto",
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--graview-ink-faint)",
                        }}
                      >
                        {row.ref}
                      </span>
                    ) : null}
                    <span
                      style={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.label}
                    </span>
                    {options.badge ? (
                      <span
                        title={row.badged ? options.badge.title : options.badge.missingTitle}
                        style={{
                          marginLeft: "auto",
                          flex: "0 0 auto",
                          fontSize: 11,
                          color: row.badged
                            ? "var(--graview-ink-faint)"
                            : "var(--graview-warn)",
                        }}
                      >
                        {row.badged ? options.badge.symbol : "○"}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
                    {grid.columns.map((column) => {
                      const filled = grid.cells.some(
                        (cell) => cell.rowId === row.id && cell.columnId === column.id,
                      );
                      return (
                        <div
                          key={column.id}
                          /*
                           * Only a FILLED cell is a target.
                           *
                           * An empty cell led to its own row, which the row
                           * label already reaches — so every empty cell was a
                           * duplicate tab stop, and a nine-by-eight grid put
                           * seventy-two of them between a keyboard user and
                           * anything else on the screen. The a11y harness
                           * caught it: focus never left plane 0.
                           */
                          {...(filled ? { "data-graview-pick": column.id } : {})}
                          title={
                            filled
                              ? `${column.label} answers ${row.ref || row.label}`
                              : `${column.label} does not answer ${row.ref || row.label}`
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderLeft: "1px solid var(--graview-edge)",
                          }}
                        >
                          <span style={cellStyle(filled, missing, lit.has(column.id) || lit.has(row.id), lit.size > 0)} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

/**
 * A cell is a RELATIONSHIP, so it is drawn as a mark rather than a box: a
 * filled grid of tinted rectangles reads as a heat map, which implies a
 * magnitude that is not there. Presence and absence is the whole content.
 */
function cellStyle(
  filled: boolean,
  rowIsMissing: boolean,
  related: boolean,
  anyRelated: boolean,
): CSSProperties {
  if (!filled) {
    return {
      width: 5,
      height: 5,
      borderRadius: 999,
      background: rowIsMissing ? "var(--graview-warn)" : "var(--graview-edge)",
      opacity: rowIsMissing ? 0.5 : 1,
    };
  }
  return {
    width: 13,
    height: 13,
    borderRadius: 4,
    background: related || !anyRelated ? "var(--graview-accent)" : "var(--graview-accent-dim)",
    boxShadow: related && anyRelated ? "0 0 12px -2px var(--graview-accent)" : undefined,
  };
}

/** How much of what had to be covered is covered. */
function CoverageBar({ grid }: { grid: CoverageGrid }) {
  const required = grid.rows.filter((row) => row.required);
  const covered = required.filter((row) => row.covered).length;
  const share = required.length === 0 ? 1 : covered / required.length;
  return (
    <div
      role="img"
      aria-label={`${covered} of ${required.length} covered`}
      style={{
        height: 6,
        borderRadius: 999,
        overflow: "hidden",
        background: "var(--graview-edge)",
      }}
    >
      <div
        style={{
          width: `${Math.round(share * 100)}%`,
          height: "100%",
          background: share === 1 ? "var(--graview-accent)" : "var(--graview-warn)",
        }}
      />
    </div>
  );
}

export interface CoverageLens<S extends AnySchema> {
  readonly name: "coverage";
  readonly requiredRoles: readonly string[];
  readonly options: CoverageOptions;
  View(props: ViewProps<S>): ReactElement | null;
  /** The grid, for an app or a test that wants the numbers not the picture. */
  build(
    nodes: readonly NodeOfSchema<S>[],
    edges: readonly { kind: string; from: string; to: string }[],
    schema?: S,
  ): CoverageGrid;
}

export function createCoverageLens<S extends AnySchema>(
  options: CoverageOptions,
): CoverageLens<S> {
  return {
    name: "coverage",
    requiredRoles: [...COVERAGE_REQUIRED_ROLES],
    options,
    View(props) {
      return <CoverageView<S> {...props} options={options} />;
    },
    build(nodes, edges, schema) {
      return buildCoverage<S>(nodes, edges, options, schema);
    },
  };
}
