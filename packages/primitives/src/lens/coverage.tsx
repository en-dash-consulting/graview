import { labelOf, type AnySchema, type NodeOfSchema } from "@graview/core";
import { useGraview, type ViewProps } from "@graview/react";
import { onTheHorizon } from "./horizon.js";
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { hueFor } from "../default-views.js";
import { Chip, Panel, Roster, useWidth } from "../primitives/index.js";

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
  /**
   * How a column node reaches a row node.
   *
   * An edge kind, for a relationship that IS a bare edge. Or a `path` of
   * edge kinds — column end to row end — for one that runs through a node
   * with fields of its own: a concern is addressed by a practice, applied by
   * a routine, which covers a ground. That node is not incidental; it is
   * where the cadence and the season live, so the cells carry it back.
   */
  readonly link: string | { readonly path: readonly string[] };
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
   * A row is required when something points at it along this edge.
   *
   * Grouping by a field only works when "must be covered" is a property the
   * row carries. Often it is a property of the GRAPH: a skill matters
   * because some position in the formation requires it, not because someone
   * labelled it important. A third app needed exactly that, and adding it
   * left the other two untouched because they never set it.
   */
  readonly requiredVia?: { readonly edge: string };
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
  /**
   * The nodes the walk passed through, column end first — empty for a bare
   * edge. "Mosquitoes are covered in the Back Lawn" is only useful if
   * pressing it shows WHICH routine does it and when it next runs.
   */
  readonly via?: readonly string[];
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
/**
 * A MATRIX THE ROOM CAN HOLD, and the DOM can.
 *
 * Every row times every column is a cell, and a real graph is not a
 * fixture: a discography's "who worked with whom" is 568 artists by 568,
 * a third of a million cells, and the page never came back from drawing
 * them. Past the limit the picture keeps the rows and columns with the
 * most ties — in their own order — and says how many it left out. What is
 * missing (`gaps`, `unasked`) is still counted over all of it.
 */
export const COVERAGE_MAX_ROWS = 80;
export const COVERAGE_MAX_COLUMNS = 48;

export interface CappedCoverage extends CoverageGrid {
  /** How many rows and columns there are in all, when fewer are drawn. */
  readonly of?: { readonly rows: number; readonly columns: number };
}

export function capCoverage(grid: CoverageGrid, limits: { readonly rows?: number; readonly columns?: number } = {}): CappedCoverage {
  const maxRows = limits.rows ?? COVERAGE_MAX_ROWS;
  const maxColumns = limits.columns ?? COVERAGE_MAX_COLUMNS;
  if (grid.rows.length <= maxRows && grid.columns.length <= maxColumns) return grid;
  const ties = new Map<string, number>();
  for (const cell of grid.cells) {
    ties.set(cell.rowId, (ties.get(cell.rowId) ?? 0) + 1);
    ties.set(`col:${cell.columnId}`, (ties.get(`col:${cell.columnId}`) ?? 0) + 1);
  }
  // The most-tied, kept in the order the grid already drew them.
  const keep = <T extends { id: string }>(items: readonly T[], max: number, key: (item: T) => string): readonly T[] => {
    if (items.length <= max) return items;
    const chosen = new Set(
      items
        .map((item, index) => ({ item, index, count: ties.get(key(item)) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.index - b.index)
        .slice(0, max)
        .map((entry) => entry.item.id),
    );
    return items.filter((item) => chosen.has(item.id));
  };
  const rows = keep(grid.rows, maxRows, (row) => row.id);
  const columns = keep(grid.columns, maxColumns, (column) => `col:${column.id}`);
  const shownRows = new Set(rows.map((row) => row.id));
  const shownColumns = new Set(columns.map((column) => column.id));
  return {
    ...grid,
    rows,
    columns,
    cells: grid.cells.filter((cell) => shownRows.has(cell.rowId) && shownColumns.has(cell.columnId)),
    of: { rows: grid.rows.length, columns: grid.columns.length },
  };
}

export function buildCoverage<S extends AnySchema>(
  nodes: readonly NodeOfSchema<S>[],
  edges: readonly { kind: string; from: string; to: string }[],
  options: CoverageOptions,
  schema?: S,
): CoverageGrid {
  const asRecord = (node: NodeOfSchema<S>) => node as Record<string, unknown>;
  const label = (node: NodeOfSchema<S>) =>
    schema ? labelOf(schema.tryDefinition(node.kind), node) : String(asRecord(node)["label"] ?? node.id);

  /*
   * AN EMPTY GRAPH IS NOT A MISBINDING.
   *
   * This used to throw whenever there were no rows and no columns, on the
   * reasoning that the binding was probably wrong — which is true of a kind
   * nobody declared and false of a blank app, where every kind is empty and
   * the lens's title is in the bar from the first paint. Pressing it there
   * took the whole scene down.
   *
   * The declaration answers the question the node count was guessing at: a
   * role naming a kind that does not exist is a binding error whatever is in
   * the graph, and a declared kind with nothing in it is an empty picture.
   */
  const undeclared = schema
    ? ([options.rows, options.columns] as const).filter(
        (kind) => schema.tryDefinition(kind) === undefined,
      )
    : [];
  if (undeclared.length > 0) {
    throw new CoverageBindingError(
      `No kind is declared for ${undeclared.map((kind) => `"${kind}"`).join(" or ")}.`,
      `Check the lens bindings: { rows: "<kind>", columns: "<kind>", link: "<edge kind>" }`,
    );
  }
  const rowNodes = nodes.filter((node) => node.kind === options.rows);
  const columnNodes = nodes.filter((node) => node.kind === options.columns);
  if (!schema && rowNodes.length === 0 && columnNodes.length === 0) {
    // Called headlessly with no schema to ask: the node count is the only
    // evidence there is, and it is still better than an empty picture with
    // no explanation.
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

  const badgeEdges = options.badge
    ? edges.filter((edge) => edge.kind === options.badge!.edge)
    : [];

  const rowIds = new Set(rowNodes.map((node) => node.id));
  const columnIds = new Set(columnNodes.map((node) => node.id));
  const cells: CoverageCell[] = [];

  if (typeof options.link === "string") {
    const link = options.link;
    const linked = edges.filter((edge) => edge.kind === link);
    /*
     * WHICH WAY THE EDGE RUNS IS SOMETHING THE SCHEMA ALREADY SAYS.
     *
     * This assumed `edge.from` was the column and `edge.to` the row, and the
     * comment beside it claimed anything else was "a binding mistake rather
     * than an empty grid, and saying so beats drawing nothing" — which the
     * code did not do: it dropped the edge in silence. Half of all domains
     * declare the relation the other way round ("an item is kept by an
     * owner" reads row → column; "a control mitigates a risk" reads column →
     * row), and those got a grid of entirely empty cells, every row flagged,
     * and the lens reporting that nothing was covered when everything was.
     * `graview check` passed, because the binding was not wrong — the
     * assumption was.
     *
     * Guessing per edge would be worse: a hand-built edge running the
     * illegal way would then fill a cell and the picture would lie about who
     * covers what. The declaration settles it without guessing — whichever
     * kind declares `link`, and what it points at, IS the direction — and an
     * edge that does not fit that orientation is still ignored.
     */
    const declares = (kind: string) =>
      schema?.tryDefinition?.(kind)?.edges?.[link]?.to as readonly string[] | undefined;
    const columnPointsAtRow = (declares(options.columns) ?? []).some(
      (target) => target === options.rows || target === "*",
    );
    const rowPointsAtColumn = (declares(options.rows) ?? []).some(
      (target) => target === options.columns || target === "*",
    );
    // Undeclared either way: keep the reading this lens has always had.
    const fromIsColumn = columnPointsAtRow || !rowPointsAtColumn;
    for (const edge of linked) {
      const rowId = fromIsColumn ? edge.to : edge.from;
      const columnId = fromIsColumn ? edge.from : edge.to;
      if (rowIds.has(rowId) && columnIds.has(columnId)) cells.push({ rowId, columnId });
    }
  } else {
    /*
     * A RELATIONSHIP THAT RUNS THROUGH A NODE.
     *
     * The walk is named by edge kind, column end first, and each step
     * follows an edge of that kind IN EITHER DIRECTION — an edge has two
     * readings, and which one a domain happened to declare is not the
     * picture's business. What comes back with the cell is the nodes passed
     * through, because the routine in the middle is the thing worth pressing.
     *
     * A path is walked per column node rather than joined over the whole
     * graph: it keeps the intermediates for THIS cell, and a domain with
     * hundreds of routines still only ever walks the edges of one kind at a
     * time.
     */
    const byKind = new Map<string, { from: string; to: string }[]>();
    for (const edge of edges) {
      const bucket = byKind.get(edge.kind);
      if (bucket) bucket.push(edge);
      else byKind.set(edge.kind, [{ from: edge.from, to: edge.to }]);
    }
    const seen = new Set<string>();
    for (const column of columnNodes) {
      /* Each reachable node, with the trail that got there. */
      let frontier: { id: string; via: string[] }[] = [{ id: column.id, via: [] }];
      for (const step of options.link.path) {
        const next: { id: string; via: string[] }[] = [];
        const here = new Set<string>();
        for (const at of frontier) {
          for (const edge of byKind.get(step) ?? []) {
            const onward = edge.from === at.id ? edge.to : edge.to === at.id ? edge.from : undefined;
            if (onward === undefined || here.has(`${at.id}|${onward}`)) continue;
            here.add(`${at.id}|${onward}`);
            next.push({ id: onward, via: [...at.via, at.id] });
          }
        }
        frontier = next;
      }
      for (const reached of frontier) {
        if (!rowIds.has(reached.id)) continue;
        const key = `${reached.id}|${column.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        /* The trail starts at the column itself; the hinges are what is after it. */
        cells.push({ rowId: reached.id, columnId: column.id, via: reached.via.slice(1) });
      }
    }
  }

  const required = new Set(options.requiredGroups ?? []);
  const demanded = options.requiredVia
    ? new Set(
        edges
          .filter((edge) => edge.kind === options.requiredVia!.edge)
          .map((edge) => edge.to),
      )
    : null;
  const rows = rowNodes
    .map((node) => {
      const record = asRecord(node);
      const group = text(record, options.rowGroup);
      return {
        id: node.id,
        ref: text(record, options.rowRef),
        label: String(record["label"] ?? label(node)),
        group,
        required: demanded
          ? demanded.has(node.id)
          : required.size === 0 || required.has(group),
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

/*
 * Wide enough for a requirement's own wording.
 *
 * At 250 the bid desk's rows read "Booking flow conforms to WCAG 2…" and
 * "Testing with assistive technology u…" — six of eight rows cut, in a panel
 * with three hundred spare pixels to its right. A matrix you cannot read the
 * rows of is a matrix that answers nothing.
 */
const ROW_LABEL_WIDTH = 316;

/**
 * The header's geometry, DERIVED from the angle rather than guessed alongside
 * it.
 *
 * A rotated label is a right triangle: a 138-pixel label at 58° rises 117 and
 * runs 73. The height was 116 and the rise is 117, so every column header was
 * clipped by exactly one pixel at the top — enough to shave the ascenders off
 * a row of headings and make the whole strip look cut off, and invisible in
 * any test that was not looking at it.
 *
 * Three constants that have to agree, written as one that cannot disagree.
 */
const HEADER_ANGLE = 58;
/*
 * And long enough for a column's own wording, for the same reason: "Design
 * system contributions" and "Prescription journey remediation" were both
 * ellipsised, which turns the header strip into a row of guesses.
 */
const HEADER_MAX = 176;
const RISE = Math.sin((HEADER_ANGLE * Math.PI) / 180);
const RUN = Math.cos((HEADER_ANGLE * Math.PI) / 180);
/**
 * The band is as tall as THIS matrix's longest column name needs, never
 * taller.
 *
 * A cap sized for the longest label anyone might write is dead space for
 * everyone who did not write it: the desk's columns are "The household example", "bid
 * desk" and "The coaching example", and a band cut for "Prescription journey
 * remediation" left a hundred empty pixels above them. Same geometry, asked
 * of the labels that are actually there.
 */
const headerHeightFor = (labels: readonly string[]): number => {
  const longest = labels.reduce((most, label) => Math.max(most, label.length), 0);
  // 5.4px per character at 10.5px, and never below a two-line-ish minimum so
  // a matrix of one-word columns still has a header strip rather than a seam.
  const run = Math.min(HEADER_MAX, Math.max(46, longest * 5.4 + 12));
  return Math.ceil(run * RISE) + 8;
};
/**
 * Room for the last column's header to ascend into.
 *
 * Rotated labels always run up and to the right of the column they name, so
 * the right-most one overflows unless the grid reserves the space. Reserving
 * it on the shared container keeps the header strip and the rows aligned;
 * padding one and not the other is how a matrix ends up one column out.
 */
const HEADER_OVERHANG = Math.ceil(HEADER_MAX * RUN);

/**
 * The lens's aggregate view.
 *
 * Full fidelity draws the matrix. Summary drops it entirely for a coverage
 * bar and the names of what is missing — fidelity SWITCHING rather than
 * scaling, the same discipline the timeline keeps, because a matrix shrunk to
 * a third of its size is a grey rectangle and a list of two names is not.
 */
/*
 * WHAT IS MISSING, IN THE DECLARATION'S WORDS. The header said "3
 * unanswered · 2 unasked" in every domain — a tender's vocabulary, where a
 * requirement is answered by a section. Over songs and themes it is "songs
 * with no theme"; over artists and the artists they worked with, rows and
 * columns of one kind, it says which way the gap runs.
 */
const pluralWords = (schema: AnySchema, kind: string): string => (schema.tryDefinition(kind)?.plural ?? `${kind}s`).toLowerCase();
const kindWords = (kind: string): string => kind.replace(/-/g, " ");
export function gapWords(count: number, options: CoverageRoles, schema: AnySchema): string {
  if (options.rows === options.columns) return `${count} with none across`;
  const rows = count === 1 ? kindWords(options.rows) : pluralWords(schema, options.rows);
  return `${count} ${rows} with no ${kindWords(options.columns)}`;
}
export function unaskedWords(count: number, options: CoverageRoles, schema: AnySchema): string {
  if (options.rows === options.columns) return `${count} with none down`;
  const columns = count === 1 ? kindWords(options.columns) : pluralWords(schema, options.columns);
  return `${count} ${columns} on no ${kindWords(options.rows)}`;
}

export function CoverageView<S extends AnySchema>({
  nodes,
  label,
  fidelity,
  mode,
  options,
  schema,
  implicated = [],
  flagged = [],
  budget,
}: CoverageViewProps<S>) {
  const { store } = useGraview<AnySchema>();
  const under = useColumnsUnderTheNames();
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  /*
   * The whole graph's rows and columns, not the aggregate's members.
   *
   * A grid over gardeners and plots registered on the gardeners drew rows
   * with no columns, because the group it was handed held gardeners only;
   * every app then wrote the same wrapper to fetch the other kind. The lens
   * knows both kinds it is bound to, so it reads them itself. The aggregate
   * still decides what is focused; it does not decide what can be looked up
   * — but for its own kind it is what the horizon left (see horizon.ts).
   */
  const whole = buildCoverage<S>(
    onTheHorizon(store.graph, store.schema, nodes)
      .filter((node) => node.kind === options.rows || node.kind === options.columns),
    store.graph.allEdges(),
    options,
    schema,
  );
  // The glyph and the summary count; only the full picture draws cells, and only as many as it can.
  // A budget (a thumbnail's) holds rows and columns to it; otherwise the page's own limits.
  const grid: CappedCoverage = fidelity === "full" ? capCoverage(whole, budget !== undefined ? { rows: budget, columns: budget } : {}) : whole;

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
  // Lifted out, the matrix is the PAGE — the same argument the board makes:
  // a picture whose content is a two-dimensional arrangement is exactly the
  // thing a card-sized box was cramping.
  const page = mode === "fullscreen";
  const headerHeight = headerHeightFor(grid.columns.map((column) => column.label));
  /*
   * THE SHAPE FOLLOWS THE ROOM. A 316px label column in a 300px card put
   * every column past the edge, behind a sideways scroll nothing announced
   * — a matrix with names and no cells. The names take a share of the
   * width rather than a fixed run; and where the columns still would not
   * fit at a fingertip each, the matrix stacks: each row is its name and
   * then its cells as labelled marks that wrap, which is a different
   * drawing of the same facts rather than a smaller one.
   */
  const labelWidth = width === null ? ROW_LABEL_WIDTH : Math.max(96, Math.min(ROW_LABEL_WIDTH, Math.round(width * 0.36)));
  const stacked =
    width !== null && (width < 420 || labelWidth + grid.columns.length * 28 + HEADER_OVERHANG > width);

  return (
    <Panel
      title={label ?? "Coverage"}
      {...(page ? { style: { flex: "1 1 auto", minHeight: 0, height: "100%" } } : {})}
      meta={
        grid.gaps.length === 0 && grid.unasked.length === 0
          ? "complete"
          : [
              grid.gaps.length > 0 ? gapWords(grid.gaps.length, options, store.schema) : "",
              grid.unasked.length > 0 ? unaskedWords(grid.unasked.length, options, store.schema) : "",
            ]
              .filter(Boolean)
              .join(" · ")
      }
      selected={false}
      fit
    >
      <div
        ref={box}
        data-coverage-shape={stacked ? "stacked" : "matrix"}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: "1 1 auto",
          minHeight: 0,
          paddingRight: stacked ? 0 : HEADER_OVERHANG,
        }}
      >
        {/*
          * THE NAMES STAY WHEN THE GRID MOVES.
          *
          * A matrix is read by crossing a row with a column, which means
          * both names have to be on screen at the moment you are looking at
          * the cell. This one scrolled them away: twenty-two practices is
          * wider than the panel and twenty concerns is taller, so the column
          * names went off the top as soon as anybody scrolled down to the
          * rows they were reading, and came back CUT — the rotated labels
          * sliced off mid-word by the panel's own edge.
          *
          * Sticky, and opaque, because a translucent header with a grid
          * sliding under it is harder to read than no header at all.
          *
          * And absent when the matrix is stacked: the names sit beside
          * their cells then, and a strip of rotated names over nothing
          * would be a caption for a different picture.
          */}
        {stacked ? null : (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            flex: "0 0 auto",
            position: "sticky",
            top: 0,
            zIndex: 2,
            background: "var(--graview-panel)",
            /* The names lean up out of their own boxes; without this the
               panel's edge takes the top off the longest of them. */
            paddingTop: 6,
          }}
        >
          <div
            ref={under.corner}
            style={{
              width: labelWidth,
              flex: "0 0 auto",
              alignSelf: "stretch",
              position: "sticky",
              left: 0,
              zIndex: 1,
              background: "var(--graview-panel)",
            }}
          />
          <div ref={under.heads} style={{ display: "flex", flex: 1, minWidth: 0, height: headerHeight }}>
            {grid.columns.map((column) => (
              <div
                key={column.id}
                data-graview-pick={column.id}
                /*
                 * SAID, NOT ONLY PAINTED. The column head already went faint
                 * when a selection reached past it; the row labels said so in
                 * the tree and the columns and cells did not, so half this
                 * picture's emphasis existed only as a colour — checkable by
                 * nothing, and absent from what a screen reader can reach.
                 */
                data-graview-emphasis={
                  lit.size === 0 ? "plain" : lit.has(column.id) ? "lit" : "dimmed"
                }
                title={column.label}
                data-graview-column={column.id}
                style={{
                  flex: 1,
                  // A column is a target: a fingertip wide at the least, and the
                  // grid scrolls rather than crushing its columns to nothing.
                  minWidth: 28,
                  // The same box as the cells below it, border and all.
                  boxSizing: "border-box",
                  borderLeft: "1px solid transparent",
                  /*
                   * THE NAME IS THE TARGET, NOT THE BOX IT STANDS IN. The
                   * label leans up and to the right, across the boxes of
                   * the columns after it, and those were painted over it:
                   * a press on a name picked a neighbour more often than
                   * not. The box lets presses through; the label takes them.
                   */
                  pointerEvents: "none",
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
                    // A little taller than the words, so the name is a target a pointer can find.
                    bottom: 3,
                    padding: "3px 0",
                    pointerEvents: "auto",
                    cursor: "pointer",
                    left: "50%",
                    /*
                     * A COLUMN SCROLLED UNDER THE NAMES TAKES ITS NAME WITH IT.
                     * Its cells go under the sticky names; its label did not,
                     * and leaning up to the right it hung over the columns
                     * still in view — so a grid scrolled four columns along
                     * read as every label four columns out.
                     */
                    visibility: under.hidden.has(column.id) ? "hidden" : "visible",
                    transformOrigin: "left bottom",
                    transform: `rotate(-${HEADER_ANGLE}deg)`,
                    whiteSpace: "nowrap",
                    maxWidth: HEADER_MAX,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: "0.75rem",
                    letterSpacing: "0.005em",
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
        )}

        {grid.of ? (
          <p data-testid="coverage-more" style={{ margin: "4px 0 6px", fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
            {[
              grid.of.rows > grid.rows.length ? `the ${grid.rows.length} most connected of ${grid.of.rows} ${pluralWords(store.schema, options.rows)}` : null,
              grid.of.columns > grid.columns.length ? `${grid.columns.length} of ${grid.of.columns} ${pluralWords(store.schema, options.columns)} across` : null,
            ]
              .filter(Boolean)
              .join(" · ")
              .replace(/^./, (first) => first.toUpperCase())}
            {" "}— what is missing is still counted over all of them.
          </p>
        ) : null}
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
                      fontSize: "0.6875rem",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--graview-ink-faint)",
                      padding: "9px 0 3px",
                    }}
                  >
                    {/*
                      * The WORD sticks, not the box. A full-width heading
                      * pinned at left:0 is already at the left; what slides
                      * away under a sideways scroll is the text inside it,
                      * which came back reading "AGE" and "RANCE".
                      */}
                    <span
                      style={{
                        position: "sticky",
                        left: 0,
                        display: "inline-block",
                        paddingRight: 8,
                        background: "var(--graview-panel)",
                      }}
                    >
                      {row.group}
                    </span>
                  </div>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    flexDirection: stacked ? "column" : "row",
                    alignItems: "stretch",
                    borderTop: "1px solid var(--graview-edge)",
                    opacity: dim ? 0.72 : 1,
                  }}
                >
                  <div
                    data-graview-pick={row.id}
                    // Emphasis in the DOM as well as in the paint, so what a
                    // selection lights is a fact rather than a colour.
                    data-graview-emphasis={lit.size === 0 ? "plain" : dim ? "dimmed" : "lit"}
                    title={row.label}
                    style={{
                      width: stacked ? "auto" : labelWidth,
                      flex: "0 0 auto",
                      /* And the row's name stays when the grid slides
                         sideways, for the same reason the column's does. */
                      position: stacked ? "static" : "sticky",
                      left: 0,
                      zIndex: 1,
                      background: "var(--graview-panel)",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "6px 10px 6px 0",
                      // Padding inside the width, so the cells start where the column heads do.
                      boxSizing: "border-box",
                      fontSize: "0.8125rem",
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
                          fontSize: "0.75rem",
                          color: row.badged
                            ? "var(--graview-ink-faint)"
                            : "var(--graview-warn)",
                        }}
                      >
                        {row.badged ? options.badge.symbol : "○"}
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flex: 1,
                      minWidth: 0,
                      ...(stacked ? { flexWrap: "wrap" as const, gap: 6, padding: "0 0 8px" } : {}),
                    }}
                  >
                    {grid.columns.map((column) => {
                      const filled = grid.cells.some(
                        (cell) => cell.rowId === row.id && cell.columnId === column.id,
                      );
                      return (
                        <div
                          key={column.id}
                          /*
                           * A MARK OF A RELATION, NOT A DRAWING OF THE THING.
                           * The cell wears the column's id so a press means
                           * the column, but it stands at the crossing of a
                           * row and a column: it is the edge. A line drawn
                           * from elsewhere must not land on it as though it
                           * were where the column's thing is.
                           */
                          data-graview-mark=""
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
                          {...(filled
                            ? {
                                "data-graview-pick": column.id,
                                /*
                                 * A cell is an EDGE, lit when the selection
                                 * reaches both its ends. Lit when it reached
                                 * either, selecting one song lit the whole
                                 * column of its theme — every other song
                                 * about night, none of them its business.
                                 */
                                "data-graview-emphasis":
                                  lit.size === 0
                                    ? "plain"
                                    : lit.has(column.id) && lit.has(row.id)
                                      ? "lit"
                                      : "dimmed",
                              }
                            : {})}
                          title={
                            filled
                              ? `${column.label} answers ${row.ref || row.label}`
                              : `${column.label} does not answer ${row.ref || row.label}`
                          }
                          style={
                            stacked
                              ? {
                                  // A labelled mark: the column's name beside its cell,
                                  // since there is no header strip to read it off.
                                  flex: "0 0 auto",
                                  minHeight: 24,
                                  boxSizing: "border-box",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "2px 9px 2px 7px",
                                  borderRadius: 999,
                                  border: "1px solid var(--graview-edge)",
                                  fontSize: "0.75rem",
                                  color: filled ? "var(--graview-ink)" : "var(--graview-ink-faint)",
                                }
                              : {
                                  flex: 1,
                                  minWidth: 28,
                                  boxSizing: "border-box",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderLeft: "1px solid var(--graview-edge)",
                                }
                          }
                        >
                          <span style={cellStyle(filled, missing, lit.has(column.id) && lit.has(row.id), lit.size > 0)} />
                          {stacked ? <span>{column.label}</span> : null}
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
  /*
   * A real COMPONENT, not a method that happens to call hooks.
   *
   * `View` is rendered as `<lens.View />`, so it is a component — but written
   * as a method on an object literal it looked like one to the hooks lint rule
   * and needed a disable in three files. A disable repeated three times is a
   * rule telling you something, and what it was telling us is that this wanted
   * to be a component.
   */
  function Bound(props: ViewProps<S>) {
    // The SCHEMA comes from the provider: `ViewProps` carries none, so a lens
    // rendered through the registry ran without it and every schema-aware
    // decision inside quietly took its fallback path.
    const { store } = useGraview<S>();
    return <CoverageView<S> schema={store.schema} {...props} options={options} />;
  }

  return {
    name: "coverage",
    requiredRoles: [...COVERAGE_REQUIRED_ROLES],
    options,
    /*
     * The SCHEMA comes from the provider, not from the caller.
     *
     * `ViewProps` carries no schema — the registry never passes one — so a
     * lens rendered through the registry ran without it and every
     * schema-aware decision inside quietly took its fallback path. In the
     * timeline that meant an optional field absent on one node looked exactly
     * like a role nobody bound, and a single unplanned task threw for the
     * whole view.
     */
    View: Bound,
    build(nodes, edges, schema) {
      return buildCoverage<S>(nodes, edges, options, schema);
    },
  };
}

/**
 * The columns whose heads have scrolled under the sticky names, by id —
 * measured against the corner the names sit in, on every sideways scroll.
 */
function useColumnsUnderTheNames() {
  const corner = useRef<HTMLDivElement | null>(null);
  const heads = useRef<HTMLDivElement | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const strip = heads.current;
    if (!strip || typeof window === "undefined") return;
    let scroller: HTMLElement | null = strip.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowX)) scroller = scroller.parentElement;
    if (!scroller) return;
    let queued = 0;
    const measure = () => {
      queued = 0;
      const edge = corner.current?.getBoundingClientRect().right ?? 0;
      const under = new Set<string>();
      for (const head of strip.querySelectorAll<HTMLElement>("[data-graview-column]")) {
        const box = head.getBoundingClientRect();
        // Its label stands on the column's middle: under the names once that is.
        if (box.left + box.width / 2 < edge) under.add(head.dataset["graviewColumn"]!);
      }
      setHidden((current) => (current.size === under.size && [...under].every((id) => current.has(id)) ? current : under));
    };
    const onScroll = () => {
      if (queued === 0) queued = requestAnimationFrame(measure);
    };
    measure();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (queued !== 0) cancelAnimationFrame(queued);
    };
  }, []);
  return { corner, heads, hidden };
}
