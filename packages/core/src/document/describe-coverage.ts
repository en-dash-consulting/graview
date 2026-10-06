import type { AnyGraphNode, GraphReader } from "../index.js";
import type { AnySchema } from "../schema/schema.js";
import { counted, isCurrent, labelOf, readableFields } from "../schema/define-node.js";
import { walkKinds } from "../schema/path.js";
import type { DescribedItem, DescribedPart } from "./describe-place.js";

/*
 * A COVERAGE GRID IN WORDS (FR-112).
 *
 * The coverage lens (`@graview/primitives`' `buildCoverage`) reads a grid of
 * rows by columns out of the graph; this reads the same grid, in the same
 * order, from the seat's own graph, for `describePlace`. Not a second
 * renderer: the picture's grid and this one are held together by
 * `a-place-is-described-as-it-is-drawn` — the rows, the columns and every
 * filled crossing the lens draws are the ones said here.
 *
 * Said as the faces say a status board's columns (FR-97): each row as a
 * field (its name, then the columns it is linked to and — over a path —
 * the record that joins them, in that record's own words), each column a
 * group with its count and its rows, and the two absences the lens exists
 * to show, counted as its header counts them.
 */

interface CoverageBinding {
  readonly rows: string;
  readonly columns: string;
  readonly link: string | { readonly path: readonly string[] };
  readonly rowRef?: string;
  readonly rowGroup?: string;
  readonly groupOrder?: readonly string[];
  readonly columnGroup?: string;
}

const text = (node: Record<string, unknown>, field: string | undefined): string => (field && node[field] !== undefined ? String(node[field]) : "");

/** The grid the lens draws: rows and columns in its order, and each filled crossing with the records between. */
export function coverageGrid(schema: AnySchema, graph: GraphReader, options: CoverageBinding) {
  const current = (kind: string) => (schema.tryDefinition(kind) ? graph.nodesOfKind(kind).filter((node) => isCurrent(schema.tryDefinition(kind), node)) : []);
  const rowNodes = current(options.rows);
  const columnNodes = current(options.columns);
  const rowIds = new Set(rowNodes.map((node) => node.id));
  const columnIds = new Set(columnNodes.map((node) => node.id));
  const edges = graph.allEdges();
  const cells: { rowId: string; columnId: string; via: readonly string[] }[] = [];
  const link = options.link;
  if (typeof link === "string") {
    // Whichever kind declares the edge, and what it points at, is the direction — as the lens reads it.
    const declares = (kind: string) => schema.tryDefinition(kind)?.edges?.[link]?.to as readonly string[] | undefined;
    const columnPointsAtRow = (declares(options.columns) ?? []).some((to) => to === options.rows || to === "*");
    const rowPointsAtColumn = (declares(options.rows) ?? []).some((to) => to === options.columns || to === "*");
    const fromIsColumn = columnPointsAtRow || !rowPointsAtColumn;
    for (const edge of edges) {
      if (edge.kind !== link) continue;
      const rowId = fromIsColumn ? edge.to : edge.from;
      const columnId = fromIsColumn ? edge.from : edge.to;
      if (rowIds.has(rowId) && columnIds.has(columnId)) cells.push({ rowId, columnId, via: [] });
    }
  } else {
    // Walked from each column, each step an edge of its kind in either direction; the first trail to a row is the one kept.
    const onward = new Map<string, Map<string, string[]>>(link.path.map((step) => [step, new Map()]));
    for (const edge of edges) {
      const adjacency = onward.get(edge.kind);
      if (!adjacency) continue;
      adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
      adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge.from]);
    }
    const seen = new Set<string>();
    for (const column of columnNodes) {
      let frontier: { id: string; via: string[] }[] = [{ id: column.id, via: [] }];
      for (const step of link.path) {
        const next: { id: string; via: string[] }[] = [];
        const here = new Set<string>();
        for (const at of frontier) {
          for (const id of onward.get(step)!.get(at.id) ?? []) {
            if (here.has(`${at.id}|${id}`)) continue;
            here.add(`${at.id}|${id}`);
            next.push({ id, via: [...at.via, at.id] });
          }
        }
        frontier = next;
      }
      for (const reached of frontier) {
        const key = `${reached.id}|${column.id}`;
        if (!rowIds.has(reached.id) || seen.has(key)) continue;
        seen.add(key);
        cells.push({ rowId: reached.id, columnId: column.id, via: reached.via.slice(1) });
      }
    }
  }
  const order = options.groupOrder ?? [];
  const rank = (value: string) => (order.indexOf(value) === -1 ? order.length : order.indexOf(value));
  const rows = rowNodes
    .map((node) => {
      const record = node as Record<string, unknown>;
      return { node, label: String(record["label"] ?? labelOf(schema.tryDefinition(node.kind), node)), group: text(record, options.rowGroup), ref: text(record, options.rowRef) };
    })
    .sort((a, b) => rank(a.group) - rank(b.group) || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const columns = columnNodes
    .map((node) => ({ node, label: labelOf(schema.tryDefinition(node.kind), node), group: text(node as Record<string, unknown>, options.columnGroup) }))
    .sort((a, b) => (a.group < b.group ? -1 : a.group > b.group ? 1 : a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0));
  return { rows, columns, cells };
}

/** A coverage lens's parts: the grid, row by row and column by column, in the seat's graph. */
export function coverageParts(schema: AnySchema, graph: GraphReader, options: CoverageBinding): DescribedPart[] {
  const { rows, columns, cells } = coverageGrid(schema, graph, options);
  const plural = (kind: string, count: number) => counted(schema, kind, count);
  const noun = (kind: string) => counted(schema, kind, 1).replace(/^1 /, "");
  const name = (node: AnyGraphNode): DescribedItem => ({ id: node.id, kind: node.kind, title: labelOf(schema.tryDefinition(node.kind), node), parts: [] });
  /* A record on the path, in its own words: its title and what a glance at it says ("Ryan SEO, level 3"). */
  const joining = (id: string): string | null => {
    const node = graph.getNode(id);
    if (!node) return null;
    const definition = schema.tryDefinition(node.kind);
    const title = labelOf(definition, node);
    const glance = readableFields(node as Record<string, unknown>, definition, { limit: 3, said: [title], glance: true }).map((field) =>
      field.alone.startsWith(field.label) ? `${field.label.toLowerCase()}${field.alone.slice(field.label.length)}` : field.alone,
    );
    return [title, ...glance].join(", ");
  };
  // What the path runs through, by kind: every kind it reaches before its last step.
  const through =
    typeof options.link === "string"
      ? []
      : options.link.path.slice(0, -1).flatMap((_, at, steps) => {
          const walked = walkKinds(schema, options.columns, steps.slice(0, at + 1));
          return walked.ok ? [...walked.reached] : [];
        });
  const parts: DescribedPart[] = [
    {
      t: "text",
      text: `${plural(options.rows, rows.length)} against ${plural(options.columns, columns.length)}${through.length > 0 ? `, through ${[...new Set(through)].map((kind) => plural(kind, 2).replace(/^2 /, "")).join(" and ")}` : ""}${columns.length > 0 ? `: ${columns.map((column) => column.label).join(", ")}` : ""}.`,
    },
  ];
  const labelOfColumn = new Map(columns.map((column) => [column.node.id, column.label]));
  const order = new Map(columns.map((column, index) => [column.node.id, index]));
  for (const row of rows) {
    const mine = cells.filter((cell) => cell.rowId === row.node.id).sort((a, b) => order.get(a.columnId)! - order.get(b.columnId)!);
    const said = mine.map((cell) => {
      const via = cell.via.map(joining).filter((one): one is string => one !== null);
      return `${labelOfColumn.get(cell.columnId)}${via.length > 0 ? ` (${via.join("; ")})` : ""}`;
    });
    parts.push({ t: "field", label: row.label, text: said.length > 0 ? said.join(", ") : "none" });
  }
  parts.push({
    t: "list",
    as: "name",
    columns: 1,
    groups: columns.map((column) => {
      const linked = new Set(cells.filter((cell) => cell.columnId === column.node.id).map((cell) => cell.rowId));
      const items = rows.filter((row) => linked.has(row.node.id)).map((row) => name(row.node));
      return { heading: `${column.label} (${items.length})`, items };
    }),
  });
  const covered = new Set(cells.map((cell) => cell.rowId));
  const used = new Set(cells.map((cell) => cell.columnId));
  const none = rows.filter((row) => !covered.has(row.node.id));
  const unused = columns.filter((column) => !used.has(column.node.id));
  // Rows and columns of one kind: which way the gap runs, as the lens's header says it.
  const same = options.rows === options.columns;
  if (none.length > 0) parts.push({ t: "text", text: `${same ? `${none.length} with none across` : `${plural(options.rows, none.length)} with no ${noun(options.columns)}`}: ${none.map((row) => row.label).join(", ")}.` });
  if (unused.length > 0) parts.push({ t: "text", text: `${same ? `${unused.length} with none down` : `${plural(options.columns, unused.length)} on no ${noun(options.rows)}`}: ${unused.map((column) => column.label).join(", ")}.` });
  return parts;
}
