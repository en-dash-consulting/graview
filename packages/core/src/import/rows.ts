import type { Primitive } from "../graph/primitives.js";
import type { GraphEdge } from "../graph/types.js";
import type { Violation } from "../invariants/types.js";
import { nameKey } from "../labels.js";
import { mintId, slug } from "../mutations/define-mutation.js";
import { nodeRefArgs } from "../mutations/node-ref.js";
import type { Author, Operation, Via } from "../ops/types.js";
import type { Principal } from "../permissions/types.js";
import { article, counted, edgeWords, fieldWords, labelOf, nounOf, valueWords } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import type { AnyNodeDefinition } from "../schema/types.js";
import { actingAs } from "../permissions/policy.js";
import { seesEveryRecord } from "../seen.js";
import { problemsMoved, type PlannedChange, type Store } from "../store.js";
import { andList, coerceCell, orList, splitCell } from "./coerce.js";
import { ImportMappingError, readMapping, fieldSpecFor, type ImportColumn, type ImportMapping } from "./mapping.js";

/**
 * ROWS TO RECORDS (FR-177). A spreadsheet became an app only by a chat
 * retyping it fifty records at a time; `importRows` takes the rows as they
 * are — arrays under a header row, or records keyed by header — and a
 * mapping from columns to the kind's fields and relations, reads each cell
 * by its field's type, links a cell that names another kind's record by
 * its label (an exact name, or the one label it starts, as acts take
 * names), and lands every row that fits as ONE batch: undone as one,
 * attributed to the importer, `via: "import"`. A row that does not fit is
 * left out and said, in words, with every reason; the rest still land.
 * Asked with `preview: true` (or as `previewImport`), it says all of that
 * and keeps nothing.
 */

/** One row: cells in the header's order, or a record keyed by header. */
export type ImportRow = readonly unknown[] | Readonly<Record<string, unknown>>;

export interface ImportOptions {
  /** Who is importing. The rows are judged by their policy and resolved by their sight, and the history names them. */
  readonly by: Author | Principal;
  /** Say what would happen, and keep nothing. */
  readonly preview?: boolean;
  /** The channel each op records. Defaults to `"import"`. */
  readonly via?: Via;
  /** What the batch was, in a sentence. Defaults to "Import 52 vendors". */
  readonly intent?: string;
  /** The batch the ops are kept under. Defaults to a fresh one. */
  readonly batch?: string;
  /** `3/4/2024` is the 4th of March, read day first; else the 3rd of April. */
  readonly dayFirst?: boolean;
  /**
   * A HOST'S LAST WORD (as `ApplyOptions.admit`): asked with the import as
   * planned before anything is kept, its ops as they would be appended;
   * whatever it throws goes on up and nothing is kept.
   */
  readonly admit?: (planned: PlannedChange) => void;
}

/** A link a row makes: the relation, which way it runs, and the record at the far end. */
export interface ImportLink {
  readonly relation: string;
  readonly direction: "out" | "in";
  readonly id: string;
  readonly label: string;
}

/** What became of one row. */
export interface ImportRowOutcome {
  /** The row as a spreadsheet numbers it: the header is row 1, the first record row 2. */
  readonly row: number;
  readonly made: boolean;
  /** The record it makes (or made), when it is not refused. */
  readonly id?: string;
  readonly label?: string;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly links: readonly ImportLink[];
  /** Every reason it is refused, in words; empty for a row that is made. */
  readonly refused: readonly string[];
  /** The row's outcome in one sentence: "Row 4 would make Bloom & Co, linked to Smith wedding." */
  readonly sentence: string;
}

export interface ImportResult {
  readonly kind: string;
  /** Whether anything was kept: false for a preview, and for an import with no row that fits. */
  readonly kept: boolean;
  readonly rows: readonly ImportRowOutcome[];
  /** Rows made (or that would be). */
  readonly made: number;
  /** Links those rows make. */
  readonly linked: number;
  /** Rows refused. */
  readonly refused: number;
  /** Header columns the mapping does not import. */
  readonly ignored: readonly string[];
  /** The totals, in a sentence. */
  readonly sentence: string;
  /** The batch it was kept under — what `store.undo` takes to take it back. */
  readonly batch?: string;
  readonly ops?: readonly Operation[];
  /** Problems the import brought that were not there before it, once kept. */
  readonly introduces?: readonly Violation[];
}

/** Cells that mean "nothing here" in a column of numbers, dates or choices. */
const BLANK = new Set(["n/a", "na", "-", "—", "–", "null", "none", "tbd", "?"]);

const isBlank = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim().length === 0);

/** Says what a row would do: preview `importRows`. */
export function previewImport<S extends AnySchema>(store: Store<S>, kind: string, rows: readonly ImportRow[], mapping: ImportMapping, options: Omit<ImportOptions, "preview">): ImportResult {
  return importRows(store, kind, rows, mapping, { ...options, preview: true });
}

export function importRows<S extends AnySchema>(store: Store<S>, kind: string, rows: readonly ImportRow[], mapping: ImportMapping, options: ImportOptions): ImportResult {
  const schema = store.schema as AnySchema;
  const columns = readMapping(schema, kind, mapping);
  const definition = schema.definition(kind) as AnyNodeDefinition;
  const noun = nounOf(definition, kind);
  const by = options.by as Principal;
  const preview = options.preview === true;

  const { header, records } = tabulate(rows);
  const absent = columns.filter((column) => !header.includes(column.column)).map((column) => `No column is called ${column.column}.`);
  if (absent.length > 0 && records.length > 0) throw new ImportMappingError(absent);
  const ignored = header.filter((column) => !columns.some((one) => one.column === column));

  const forbidden = policyRefusal(store, kind, noun, by);
  /** The importer's own view: what a one-to-one link already holds is judged by what they see (FR-55). */
  const seen = store.seenBy(by);
  const mayLink = linking(store, by);
  const taken = new Set<string>();
  /** The rows planned so far, by their label's key: a later row may link to one. */
  const plannedByName = new Map<string, { id: string; kind: string; label: string }[]>();
  /** Far records whose one link of a relation this import has already given. */
  const filled = new Set<string>();
  const outcomes: ImportRowOutcome[] = [];
  const planned: { node: Record<string, unknown> & { id: string; kind: string }; edges: GraphEdge[]; replaced: GraphEdge[]; label: string }[] = [];
  const say = sentences(preview);

  for (const { row, cells } of records) {
    if (forbidden) {
      outcomes.push({ row, made: false, links: [], refused: [forbidden], sentence: say.refused(row, [forbidden]) });
      continue;
    }
    const reasons: string[] = [];
    const fields: Record<string, unknown> = {};
    for (const column of columns) {
      if (column.as !== "field") continue;
      const raw = cells[column.column];
      if (isBlank(raw)) continue;
      const loose = column.spec.type !== "string" && column.spec.type !== "text" && column.spec.type !== "boolean";
      if (loose && typeof raw === "string" && BLANK.has(raw.trim().toLowerCase())) continue;
      const read = coerceCell(column.spec, raw, column.column, {
        ...(options.dayFirst ? { dayFirst: true } : {}),
        optionWords: (option) => valueWords(definition, column.field, option),
      });
      if (!read.ok) {
        reasons.push(read.why);
        continue;
      }
      const fits = (column.schema as { safeParse(value: unknown): { success: boolean; data?: unknown; error?: { issues?: readonly { message?: string }[] } } }).safeParse(read.value);
      if (!fits.success) {
        reasons.push(`“${String(raw).trim()}” under ${column.column} does not fit: ${fits.error?.issues?.[0]?.message ?? "the field refuses it"}`);
        continue;
      }
      fields[column.field] = fits.data;
    }
    const shape = (definition.fields as unknown as { shape?: Record<string, unknown> }).shape ?? {};
    for (const field of Object.keys(shape)) {
      if (fields[field] !== undefined) continue;
      if (definition.defaults && Object.hasOwn(definition.defaults, field)) {
        fields[field] = definition.defaults[field];
        continue;
      }
      const spec = fieldSpecFor(definition, field)?.spec;
      if (!spec?.required) continue;
      const mapped = columns.find((column) => column.as === "field" && column.field === field);
      // A reason of its own only where the cell was blank: a cell that could not be read has said so already.
      if (mapped && !isBlank(cells[mapped.column])) continue;
      reasons.push(`it has no ${fieldWords(definition, field)}, which every ${noun} needs`);
    }
    if (reasons.length === 0) {
      try {
        Object.assign(fields, withoutIds(schema.parseNode({ ...fields, id: "import", kind })));
      } catch (error) {
        reasons.push(...issuesSaid(definition, error));
      }
    }

    const label = labelFor(definition, kind, fields, row);
    const id = reasons.length === 0 ? mint(store, seen, by, taken, kind, label) : `import:${row}`;
    const links: ImportLink[] = [];
    const edges: GraphEdge[] = [];
    /** Links a hidden record held that a one-to-one link this row makes takes, as an act's `setSingleSource` takes them (FR-55). */
    const replaced: GraphEdge[] = [];
    for (const column of columns) {
      if (column.as !== "relation") continue;
      const raw = cells[column.column];
      if (isBlank(raw)) continue;
      const text = String(raw).trim();
      const named = column.direction === "out" && column.one ? [text] : namesIn(store, column, text, by);
      if (column.direction === "out" && column.one && named.length > 1) {
        reasons.push(`${column.column} names ${named.length}, and ${article(noun)} ${noun} links to one`);
        continue;
      }
      for (const name of named) {
        const found = resolve(store, column, name, by, plannedByName);
        if (!found.ok) {
          reasons.push(found.why);
          continue;
        }
        if (found.id === id) {
          reasons.push(`it names itself under ${column.column}`);
          continue;
        }
        const edge = column.direction === "out" ? { kind: column.relation, from: id, to: found.id } : { kind: column.relation, from: found.id, to: id };
        if (edges.some((one) => one.kind === edge.kind && one.from === edge.from && one.to === edge.to)) continue;
        // Made by the acts that make such a link, as a press on one would be: a grant's kinds, its own end, an agent's `may`.
        const refusal = mayLink(column.relation, found.id, found.kind);
        if (refusal) {
          reasons.push(refusal);
          continue;
        }
        if (column.direction === "in" && column.one) {
          const holds = seen.graph.out(found.id, column.relation).length > 0 || filled.has(`${column.relation} ${found.id}`);
          if (holds) {
            reasons.push(`${found.label} already has its one “${edgeWords(schema, found.kind, column.relation, "out")}”`);
            continue;
          }
          // One the importer may not see holds it: taken, and said to nobody, as an act setting a single source takes it.
          replaced.push(...store.graph.outEdges(found.id, column.relation));
        }
        edges.push(edge);
        links.push({ relation: column.relation, direction: column.direction, id: found.id, label: found.label });
      }
    }

    if (reasons.length > 0) {
      outcomes.push({ row, made: false, links: [], refused: reasons, sentence: say.refused(row, reasons) });
      continue;
    }
    taken.add(id);
    for (const edge of edges) if (edge.to === id) filled.add(`${edge.kind} ${edge.from}`);
    const key = nameKey(label);
    plannedByName.set(key, [...(plannedByName.get(key) ?? []), { id, kind, label }]);
    planned.push({ node: { ...fields, id, kind }, edges, replaced, label });
    outcomes.push({ row, made: true, id, label, fields, links, refused: [], sentence: say.made(row, label, links) });
  }

  const made = planned.length;
  const linked = planned.reduce((sum, one) => sum + one.edges.length, 0);
  const refused = outcomes.length - made;
  const result = { kind, rows: outcomes, made, linked, refused, ignored, sentence: say.totals(outcomes.length, counted(schema, kind, made), linked, refused) };
  if (preview || made === 0) return { ...result, kept: false };

  const batchIntent = options.intent ?? `Import ${counted(schema, kind, made)}`;
  const via = options.via ?? "import";
  const appended = planned.map((one) => ({
    primitives: [{ op: "add-node", node: one.node } as Primitive, ...one.edges.map((edge) => ({ op: "add-edge", edge }) as Primitive), ...one.replaced.map((edge) => ({ op: "remove-edge", edge }) as Primitive)],
    author: options.by,
    intent: `Add ${article(noun)} ${noun}: ${one.label}`,
    batchIntent,
    via,
  }));
  if (options.admit) {
    const at = store.log.length;
    const ops = appended.map((one, index) => ({
      id: `import:${index + 1}`,
      seq: at + index,
      batch: options.batch ?? "import",
      mutation: null,
      inverse: [...one.primitives].reverse(),
      reads: [],
      writes: [...new Set(one.primitives.map((primitive) => ("node" in primitive ? primitive.node.id : primitive.op === "add-edge" ? primitive.edge.from : "")))],
      at: "",
      ...one,
    })) as unknown as Operation[];
    const size = store.graph.size;
    const taken = planned.reduce((sum, one) => sum + one.replaced.length, 0);
    options.admit({
      ops,
      primitives: appended.flatMap((one) => one.primitives),
      added: { nodes: made, edges: linked },
      removed: { nodes: 0, edges: taken },
      changed: { nodes: 0 },
      nodesAfter: size.nodes + made,
      edgesAfter: size.edges + linked - taken,
    });
  }
  const before = store.violations();
  const ops = store.append(appended, options.batch === undefined ? {} : { batch: options.batch });
  const { introduces } = problemsMoved(store.allInvariants(), before, store.violations());
  return { ...result, kept: true, batch: ops[0]!.batch, ops, introduces };
}

/** The header and the record rows, each numbered as the sheet numbers it, blank rows left out. */
function tabulate(rows: readonly ImportRow[]): { header: string[]; records: { row: number; cells: Record<string, unknown> }[] } {
  if (rows.length === 0) return { header: [], records: [] };
  if (Array.isArray(rows[0])) {
    const header = (rows[0] as readonly unknown[]).map((cell) => String(cell ?? "").trim());
    const records = rows.slice(1).flatMap((cells, index) => {
      const list = cells as readonly unknown[];
      if (list.every(isBlank)) return [];
      return [{ row: index + 2, cells: Object.fromEntries(header.map((column, at) => [column, list[at]])) }];
    });
    return { header, records };
  }
  const header: string[] = [];
  for (const row of rows) for (const column of Object.keys(row)) if (!header.includes(column)) header.push(column);
  const records = rows.flatMap((cells, index) => (Object.values(cells).every(isBlank) ? [] : [{ row: index + 2, cells: { ...(cells as Record<string, unknown>) } }]));
  return { header, records };
}

/**
 * Why this importer may not add the kind at all, or nothing. Asked of the
 * acts that create it — who may bring one into being by hand may bring
 * one in from a sheet — as the store asks them, the agent's `may` and the
 * policy's grants alike. A kind no act creates is the host's to import
 * where no policy is declared, and nobody's where one is.
 */
function policyRefusal<S extends AnySchema>(store: Store<S>, kind: string, noun: string, by: Principal): string | undefined {
  if (store.modules.disabledKinds.has(kind)) return `${capital(store.schema.tryDefinition(kind)?.plural ?? `${noun}s`)} belong to a module this workspace has turned off.`;
  const creators = store.allMutations().filter((mutation) => !mutation.derived && (mutation.creates ?? []).includes(kind as never));
  if (creators.length === 0) return store.policy === undefined && by.kind !== "agent" ? undefined : `Nothing in this app adds ${article(noun)} ${noun}, so none can be imported.`;
  let first: string | undefined;
  for (const creator of creators) {
    const verdict = store.permits({ name: creator.name, args: {} }, by);
    if (verdict.ok) return undefined;
    first ??= verdict.refusal.message;
  }
  return first;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The names one cell gives: the whole cell when it names a record, else its parts. */
function namesIn<S extends AnySchema>(store: Store<S>, column: Extract<ImportColumn, { as: "relation" }>, text: string, by: Principal): string[] {
  const whole = store.resolveRef({ name: column.column, kinds: column.kinds }, text, by);
  if (whole.ok) return [text];
  const parts = splitCell(text);
  return parts.length > 1 ? parts : [text];
}

type Found = { ok: true; id: string; label: string; kind: string } | { ok: false; why: string };

/** A name, resolved as an act resolves it, under the importer's sight; failing that, among the rows this import makes. */
function resolve<S extends AnySchema>(store: Store<S>, column: Extract<ImportColumn, { as: "relation" }>, name: string, by: Principal, planned: ReadonlyMap<string, readonly { id: string; kind: string; label: string }[]>): Found {
  const found = store.resolveRef({ name: column.column, kinds: column.kinds }, name, by);
  if (found.ok) return { ok: true, id: found.id, label: found.label, kind: String(store.graph.getNode(found.id)!.kind) };
  if (found.reason === "ambiguous") {
    const labels = [...new Set(found.candidates.map((candidate) => candidate.label))];
    return { ok: false, why: `“${name}” under ${column.column} could be ${labels.length <= 5 ? orList(labels) : `any of ${labels.length} records`}` };
  }
  const here = (planned.get(nameKey(name)) ?? []).filter((one) => column.kinds.includes(one.kind));
  if (here.length === 1) return { ok: true, ...here[0]! };
  if (here.length > 1) return { ok: false, why: `“${name}” under ${column.column} could be any of the ${here.length} rows above it so called` };
  const nouns = [...new Set(column.kinds.map((one) => nounOf(store.schema.tryDefinition(one), one)))];
  return { ok: false, why: `no ${nouns.length <= 3 ? orList(nouns) : "record"} is called “${name}”` };
}

/** What the record will be called: its kind's label, else its first words, else the row. */
function labelFor(definition: AnyNodeDefinition, kind: string, fields: Record<string, unknown>, row: number): string {
  const said = labelOf(definition, { id: "", kind, ...fields });
  if (said.trim().length > 0) return said.trim();
  const words = Object.values(fields).find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return words?.trim() ?? `${nounOf(definition, kind)} from row ${row}`;
}

/**
 * An id as the importer's own act's `freshId` would mint it: `<kind>:<label>`,
 * numbered past one they see — and, for a kind they may not see every record
 * of, their own (FR-55), so the id says nothing of a record kept from them.
 */
function mint<S extends AnySchema>(store: Store<S>, seen: Store<S>, by: Principal, taken: ReadonlySet<string>, kind: string, label: string): string {
  return mintId(`${kind}:${slug(label)}`, {
    seen: (id) => seen.graph.has(id) || taken.has(id),
    held: (id) => store.graph.has(id) || taken.has(id),
    limited: !seesEveryRecord(store, by)(kind),
    me: actingAs(by).id,
  });
}

/**
 * WHETHER THE IMPORTER MAY MAKE A LINK, asked of the acts that make links of
 * its relation (their `connects`) as a press on one would be: the record at
 * the far end handed to the argument that takes it, so a grant's kinds, a
 * `self` grant, an own-end grant and an agent's `may` all answer as they
 * would. Where no policy is declared a person may link anything, as they may
 * make anything; where one is, a relation no act makes is linked by nobody.
 * Answers the refusal in words, or undefined.
 */
function linking<S extends AnySchema>(store: Store<S>, by: Principal): (relation: string, far: string, farKind: string) => string | undefined {
  const asked = new Map<string, string | undefined>();
  return (relation, far, farKind) => {
    const key = `${relation}\u0000${far}`;
    if (asked.has(key)) return asked.get(key);
    let answer: string | undefined;
    if (store.policy !== undefined || by.kind === "agent") {
      const linkers = store.allMutations().filter((mutation) => !mutation.derived && (mutation.connects ?? []).includes(relation));
      if (linkers.length === 0) {
        if (store.policy !== undefined) answer = `nothing in this app links ${linkWords(store, relation, farKind)} that way, so none can be imported`;
      } else {
        for (const linker of linkers) {
          const subject = linker.subject?.arg;
          const takes = (kinds: readonly string[]) => kinds.includes("*") || kinds.includes(farKind);
          const refs = nodeRefArgs(linker.input);
          const at = refs.find((ref) => ref.name !== subject && takes(ref.kinds))?.name ?? (subject !== undefined && refs.some((ref) => ref.name === subject && takes(ref.kinds)) ? subject : undefined);
          const verdict = store.permits({ name: linker.name, args: at === undefined ? {} : { [at]: far } }, by);
          if (verdict.ok) {
            answer = undefined;
            break;
          }
          answer ??= verdict.refusal.message;
        }
      }
    }
    asked.set(key, answer);
    return answer;
  };
}

/** "a vendor to a tag": the two ends of a relation, as a sentence says them. */
function linkWords<S extends AnySchema>(store: Store<S>, relation: string, farKind: string): string {
  const owner = (store.schema as AnySchema).definitions.find((definition) => Object.hasOwn((definition.edges ?? {}) as object, relation));
  const far = nounOf(store.schema.tryDefinition(farKind), farKind);
  if (!owner) return `anything to ${article(far)} ${far}`;
  const near = nounOf(owner, owner.kind);
  return `${article(near)} ${near} to ${article(far)} ${far}`;
}

function withoutIds(node: unknown): Record<string, unknown> {
  const { id: _id, kind: _kind, ...fields } = node as Record<string, unknown>;
  return fields;
}

/** A parse's issues, each by the field's words. */
function issuesSaid(definition: AnyNodeDefinition, error: unknown): string[] {
  const issues = (error as { issues?: readonly { path?: readonly PropertyKey[]; message?: string }[] }).issues;
  if (!issues || issues.length === 0) return [error instanceof Error ? error.message : String(error)];
  return issues.map((issue) => {
    const field = typeof issue.path?.[0] === "string" ? issue.path[0] : undefined;
    return field ? `${fieldWords(definition, field)} does not fit: ${issue.message ?? "the field refuses it"}` : (issue.message ?? "it does not fit");
  });
}

function sentences(preview: boolean) {
  const rows = (n: number) => `${n} ${n === 1 ? "row" : "rows"}`;
  const links = (n: number) => `${n} ${n === 1 ? "link" : "links"}`;
  return {
    made: (row: number, label: string, linked: readonly ImportLink[]) =>
      `Row ${row} ${preview ? "would make" : "made"} ${label}${linked.length > 0 ? `, linked to ${andList(linked.map((link) => link.label))}` : ""}.`,
    refused: (row: number, reasons: readonly string[]) => `Row ${row} ${preview ? "would be" : "was"} refused: ${reasons.join("; ")}${/[.!?]$/.test(reasons.at(-1) ?? "") ? "" : "."}`,
    totals: (count: number, made: string, linked: number, refused: number) =>
      `${capital(rows(count))}: ${made} ${preview ? "would be made" : "made"}${linked > 0 ? `, with ${links(linked)}` : ""}${refused > 0 ? `; ${rows(refused)} ${preview ? "would be" : refused === 1 ? "was" : "were"} refused` : ""}.`,
  };
}
