import { UNSET, type GraphEdge, type Primitive } from "../index.js";
import { canonicalize } from "./canonical.js";
import { hasRange, outsideRange, rangeWords } from "./range.js";
import type { FieldSpec, FieldType, GraviewDocument } from "./schema.js";

/*
 * A CHANGE TO AN APP THAT KEEPS ITS DATA (docs/operations.md §4).
 *
 * Given the declaration before and after, and the records as they stand,
 * planMigration says — in primitives the room applies as one attributed op,
 * and in words the preview shows — what happens to every record:
 *
 *   renamed   `renamedFrom` on a field, a relation or a kind: values move.
 *   coerced   a field whose type changed keeps its value where the meaning
 *             survives (text→number when it parses, datetime→date, a word→
 *             an enum option it names, a value→a list of one, and back).
 *   defaulted a field that became required takes its declared default.
 *   cleared   what cannot survive — a dropped field, a value that does not
 *             coerce, an enum option no longer offered — is cleared, counted.
 *   removed   records of a removed kind, links of a removed relation.
 *
 * Pure: no store, no clock.
 */

export interface StoredGraph {
  readonly nodes: readonly Record<string, unknown>[];
  readonly edges: readonly GraphEdge[];
}

export interface MigrationPlan {
  readonly primitives: readonly Primitive[];
  /** What happens, counted, in sentences. Empty when nothing moves. */
  readonly words: readonly string[];
  readonly counts: { readonly moved: number; readonly coerced: number; readonly defaulted: number; readonly filled: number; readonly cleared: number; readonly removedNodes: number; readonly removedEdges: number };
  /** Values a field that is required (and has no default) would still lack after the migration. */
  readonly missingRequired: number;
}

/** Whether a plan loses anything: a value cleared, a record or link removed, a required value left missing. */
export function losesData(plan: MigrationPlan): boolean {
  return plan.counts.cleared + plan.counts.removedNodes + plan.counts.removedEdges + plan.missingRequired > 0;
}

/**
 * A value for existing records in a field the change adds (structural edits' `fill`):
 * a constant, or a copy of another field of the same record. Applied only where the
 * record has no value after the rest of the migration.
 */
export interface MigrationFill {
  readonly kind: string;
  readonly field: string;
  readonly value?: unknown;
  readonly from?: string;
}

type Kinds = GraviewDocument["kinds"];

/** Where a field in `after` takes its value from in `before`: itself, or what it was renamed from. */
function sourceField(beforeFields: Readonly<Record<string, FieldSpec>> | undefined, name: string, spec: FieldSpec & { renamedFrom?: string }): string | undefined {
  if (!beforeFields) return undefined;
  if (spec.renamedFrom && beforeFields[spec.renamedFrom] && !beforeFields[name]) return spec.renamedFrom;
  return beforeFields[name] ? name : undefined;
}

/** The kind in `before` a kind in `after` continues. */
function sourceKind(before: Kinds, name: string, spec: Kinds[string] & { renamedFrom?: string }): string | undefined {
  if (spec.renamedFrom && before[spec.renamedFrom] && !before[name]) return spec.renamedFrom;
  return before[name] ? name : undefined;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A value of type `from` as type `to`, or `undefined` when its meaning does not survive. */
export function coerce(value: unknown, from: FieldType, to: FieldSpec): unknown {
  if (value === undefined || value === null) return undefined;
  const type = to.type;
  // A number with a range (FR-114) is judged against it, whatever it was before.
  if (from === type && type !== "enum" && type !== "list" && !hasRange(to)) return value;
  const asText = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : undefined);
  switch (type) {
    case "string":
    case "text": {
      if (Array.isArray(value)) return value.length === 1 ? asText(value[0]) : value.map(asText).filter((x) => x !== undefined).join(", ");
      const t = asText(value);
      return t === undefined ? undefined : type === "string" ? t.slice(0, 500) : t;
    }
    case "number":
    case "integer": {
      const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.replace(/[, _]/g, "")) : NaN;
      if (!Number.isFinite(n) || outsideRange(n, to, "") !== undefined) return undefined;
      return type === "integer" ? (Number.isInteger(n) ? n : undefined) : n;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      const t = asText(value)?.trim().toLowerCase();
      return t === "true" || t === "yes" ? true : t === "false" || t === "no" ? false : undefined;
    }
    case "date": {
      const t = asText(value);
      if (!t) return undefined;
      if (DATE.test(t)) return t;
      const ms = Date.parse(t);
      return Number.isNaN(ms) ? undefined : new Date(ms).toISOString().slice(0, 10);
    }
    case "datetime": {
      const t = asText(value);
      if (!t) return undefined;
      const ms = Date.parse(DATE.test(t) ? `${t}T00:00:00Z` : t);
      return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
    }
    case "enum": {
      const t = asText(value);
      if (t === undefined) return undefined;
      const options = to.options ?? [];
      return options.find((o) => o === t) ?? options.find((o) => o.toLowerCase() === t.toLowerCase());
    }
    case "list": {
      const items = Array.isArray(value) ? value : [value];
      const of = to.of ?? "string";
      const coerced = items.map((v) => coerce(v, typeof v === "number" ? "number" : "string", { type: of } as FieldSpec));
      return coerced.every((v) => v !== undefined) ? coerced : undefined;
    }
    case "url":
    case "email": {
      const t = asText(value)?.trim();
      if (!t) return undefined;
      if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : undefined;
      try {
        return new URL(t).toString() === t || new URL(t).toString() === `${t}/` ? t : undefined;
      } catch {
        return undefined;
      }
    }
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function planMigration(before: GraviewDocument, after: GraviewDocument, graph: StoredGraph, options: { readonly fills?: readonly MigrationFill[] } = {}): MigrationPlan {
  const primitives: Primitive[] = [];
  const counts = { moved: 0, coerced: 0, defaulted: 0, filled: 0, cleared: 0, removedNodes: 0, removedEdges: 0 };
  let missingRequired = 0;
  const fills = options.fills ?? [];
  const words: string[] = [];
  const tally = new Map<string, number>();
  const note = (sentence: string) => tally.set(sentence, (tally.get(sentence) ?? 0) + 1);

  // Which after-kind each before-kind continues as (identity or rename), and which edge names map.
  const kindAfter = new Map<string, string>();
  for (const [name, spec] of Object.entries(after.kinds)) {
    const src = sourceKind(before.kinds, name, spec as Kinds[string] & { renamedFrom?: string });
    if (src) kindAfter.set(src, name);
  }
  const edgeAfter = new Map<string, string>();
  for (const spec of Object.values(after.kinds)) {
    for (const [name, e] of Object.entries(spec.edges ?? {})) {
      const from = (e as { renamedFrom?: string }).renamedFrom;
      if (from && !Object.values(before.kinds).some((k) => k.edges?.[name])) edgeAfter.set(from, name);
    }
  }
  for (const spec of Object.values(before.kinds)) for (const name of Object.keys(spec.edges ?? {})) if (!edgeAfter.has(name) && Object.values(after.kinds).some((k) => k.edges?.[name])) edgeAfter.set(name, name);

  const removedIds = new Set<string>();
  const rekinded = new Map<string, Record<string, unknown>>();

  for (const node of graph.nodes) {
    const id = String(node["id"]);
    const oldKind = String(node["kind"]);
    const newKind = kindAfter.get(oldKind);
    if (!newKind) {
      removedIds.add(id);
      counts.removedNodes++;
      note(`${oldKind} record(s) removed with their kind`);
      continue;
    }
    const was = before.kinds[oldKind]!.fields;
    const now = after.kinds[newKind]!.fields;
    const next: Record<string, unknown> = {};
    const patchBefore: Record<string, unknown> = {};
    const patchAfter: Record<string, unknown> = {};
    for (const [field, spec] of Object.entries(now)) {
      const src = sourceField(was, field, spec as FieldSpec & { renamedFrom?: string });
      const old = src ? node[src] : undefined;
      let value: unknown = undefined;
      if (old !== undefined && old !== null && src) {
        value = coerce(old, was[src]!.type, spec);
        if (value === undefined) {
          counts.cleared++;
          note(`${newKind}'s ${field}: value(s) that do not fit ${spec.type === "enum" ? "its options" : hasRange(spec) ? `${rangeWords(spec)}` : spec.type} cleared`);
        } else if (src !== field) {
          counts.moved++;
          note(`${newKind}'s ${src} renamed to ${field}, values kept`);
        } else if (canonicalize(value) !== canonicalize(old)) {
          counts.coerced++;
          note(`${newKind}'s ${field} converted to ${spec.type}`);
        }
      }
      if (value === undefined && spec.required && spec.default !== undefined) {
        value = spec.default;
        counts.defaulted++;
        note(`${newKind}'s ${field} filled with its default`);
      }
      if (value !== undefined) next[field] = value;
    }
    for (const fill of fills) {
      const spec = now[fill.field];
      if (fill.kind !== newKind || !spec || next[fill.field] !== undefined) continue;
      const source = fill.from !== undefined ? next[fill.from] : fill.value;
      const fromType: FieldType = fill.from !== undefined ? (now[fill.from]?.type ?? "string") : typeof source === "number" ? "number" : typeof source === "boolean" ? "boolean" : Array.isArray(source) ? "list" : "string";
      const value = coerce(source, fromType, spec);
      if (value === undefined) continue;
      next[fill.field] = value;
      counts.filled++;
      note(`${newKind}'s ${fill.field} filled in${fill.from !== undefined ? ` from ${fill.from}` : ""}`);
    }
    // Only a requirement this change brings counts: a record that already lacked a required value is not made worse.
    for (const [field, spec] of Object.entries(now)) {
      if (!spec.required || next[field] !== undefined) continue;
      const src = sourceField(was, field, spec as FieldSpec & { renamedFrom?: string });
      if (!src || !was[src]!.required) missingRequired++;
    }
    for (const field of Object.keys(was)) {
      const kept = Object.entries(now).some(([f, spec]) => sourceField(was, f, spec as FieldSpec & { renamedFrom?: string }) === field);
      if (!kept && node[field] !== undefined) {
        counts.cleared++;
        note(`${newKind}'s ${field} removed, with its value(s)`);
      }
    }
    if (newKind !== oldKind) {
      // A kind cannot change in place: the record is made again under the new kind, with the same id.
      rekinded.set(id, { id, kind: newKind, ...next });
      removedIds.add(id);
      counts.moved++;
      note(`${oldKind} renamed to ${newKind}, records kept`);
      continue;
    }
    for (const key of new Set([...Object.keys(node), ...Object.keys(next)])) {
      if (key === "id" || key === "kind") continue;
      const a = node[key];
      const b = next[key];
      if (canonicalize(a) === canonicalize(b)) continue;
      patchBefore[key] = a === undefined ? UNSET : a;
      patchAfter[key] = b === undefined ? UNSET : b;
    }
    if (Object.keys(patchAfter).length > 0) primitives.push({ op: "patch-node", id, before: patchBefore, after: patchAfter } as Primitive);
  }

  // Links: kept, renamed (removed and added under the new name), or removed.
  const keptEdges: GraphEdge[] = [];
  for (const edge of graph.edges) {
    const name = edgeAfter.get(edge.kind);
    const endsGone = removedIds.has(edge.from) && !rekinded.has(edge.from) || removedIds.has(edge.to) && !rekinded.has(edge.to);
    const touchesRekinded = rekinded.has(edge.from) || rekinded.has(edge.to);
    if (!name || endsGone) {
      primitives.push({ op: "remove-edge", edge } as Primitive);
      counts.removedEdges++;
      note(!name ? `"${edge.kind}" link(s) removed with their relation` : `link(s) to removed records removed`);
      continue;
    }
    if (name !== edge.kind || touchesRekinded) {
      primitives.push({ op: "remove-edge", edge } as Primitive);
      keptEdges.push({ kind: name, from: edge.from, to: edge.to });
      if (name !== edge.kind) {
        counts.moved++;
        note(`"${edge.kind}" renamed to "${name}", links kept`);
      }
    }
  }
  for (const node of graph.nodes) {
    const id = String(node["id"]);
    if (removedIds.has(id)) primitives.push({ op: "remove-node", node } as Primitive);
  }
  for (const node of rekinded.values()) primitives.push({ op: "add-node", node } as Primitive);
  for (const edge of keptEdges) primitives.push({ op: "add-edge", edge } as Primitive);

  for (const [sentence, n] of tally) words.push(sentence.includes("record(s)") || sentence.includes("link(s)") || sentence.includes("value(s)") ? `${n} ${sentence.replace(/\(s\)/g, n === 1 ? "" : "s")}.` : `${sentence} (${plural(n, "record")}).`);
  if (missingRequired > 0) words.push(`${plural(missingRequired, "required value")} would be missing; those records need ${missingRequired === 1 ? "it" : "them"} filled in.`);
  return { primitives, words, counts, missingRequired };
}
