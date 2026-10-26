import { isArchived, isCurrent, isLeftAlone, labelOf, nameKey, nodeRefArgs, nounOf, type AnySchema, type MutationCall, type Store } from "@graview/core";
import { districtState } from "@graview/core/city";
import { fold } from "@graview/core/search";
import { tidyingOf } from "@graview/core/tidying";
import type { Severity } from "./policy.js";

/*
 * THE JUDGES: what the app's own actor would change, found from the graph
 * alone. Each is a pure function over a store as the actor sees it, and
 * answers candidate calls with the words a person reads ("same name as
 * “Acme”") and how sure. None of them writes: `dream` decides what becomes
 * a suggestion. Each keeps to what people said before it proposes — a
 * record left alone, a kind or relation the declaration says is never
 * tidied (or never linked), a record somebody changed lately — so the
 * actor does not even ask about those.
 */

type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;

/** One change a judge would make: the calls, what it is based on, and how sure (0 to 1). */
export interface Candidate {
  /** The judge that found it: "duplicates", "links", "archive". */
  readonly judge: string;
  readonly calls: readonly MutationCall[];
  /** Words a person reads: "Same name as “Acme” (another vendor)". */
  readonly basis: string;
  readonly confidence: number;
  /** The records it is about, so a model and a report can name them. */
  readonly about: readonly string[];
  /**
   * The fields its basis read, `<id>#<field>`: kept on the change's lineage
   * (`lineage.read`), so a seat whose sight keeps one is not told the basis.
   * Left out, the basis is taken to have read every field the records it is
   * about hold — a model's, which read them all.
   */
  readonly read?: readonly string[];
}

/** What a judge is handed: the store as the actor sees it, and the run's clock and limits. */
export interface JudgeContext {
  readonly store: Store<AnySchema>;
  /** The run's moment, in milliseconds. */
  readonly now: number;
  /** When each record was last changed, from the log; a record the log never touched is absent. */
  readonly touched: ReadonlyMap<string, number>;
  /** Records changed more recently than this many milliseconds are left for now. */
  readonly quietFor: number;
  /** How old, in days, a finished record is before it is a candidate to set aside. */
  readonly olderThanDays: number;
}

/**
 * A judge: a name, how much what it proposes would undo, and what it finds
 * from the graph alone — the floor a dream stands on when no model answers.
 * A model, when lent, judges the same things more broadly (`./judging.ts`).
 */
export interface Judge {
  readonly name: string;
  /** How much its changes would undo, which sets how sure it must be (`BANDS`). "archive" when unsaid. */
  readonly severity?: Severity;
  judge(context: JudgeContext): readonly Candidate[];
}

const DAY = 24 * 60 * 60 * 1000;

/** Whether the actor may propose anything about this record: not left alone, not changed lately, its kind tidied. */
export function mayTouch(context: JudgeContext, node: Node): boolean {
  if (isLeftAlone(context.store, node.id) || isArchived(node as never)) return false;
  if (tidyingOf(context.store.schema, node.kind) === "never") return false;
  const last = context.touched.get(node.id);
  return last === undefined || context.now - last >= context.quietFor;
}

/** A kind's acts as the store holds them, by name. */
export const actNamed = (store: Store<AnySchema>, name: string) => store.allMutations().find((act) => act.name === name);

export const named = (schema: AnySchema, node: Node): string => labelOf(schema.tryDefinition(node.kind), node);

/** A field of a record a basis read, as a lineage says it. */
export const fieldRead = (node: { readonly id: string }, field: string): string => `${node.id}#${field}`;

/** The fields of a record its name reads, `<id>#<field>`: what a basis that says the name read. */
export function nameRead(schema: AnySchema, node: Node): string[] {
  const read: string[] = [];
  const watched = new Proxy(node, {
    get(target, field, receiver) {
      if (typeof field === "string" && field !== "id" && field !== "kind" && !read.includes(fieldRead(target, field))) read.push(fieldRead(target, field));
      return Reflect.get(target, field, receiver);
    },
  });
  named(schema, watched);
  return read;
}

/** Every field a record holds a value in, `<id>#<field>`: what a basis that read the whole record read. */
export const wholeRead = (node: Node): string[] => Object.keys(node).filter((field) => field !== "id" && field !== "kind" && node[field] !== undefined && node[field] !== null && node[field] !== "").map((field) => fieldRead(node, field));
export const noun = (schema: AnySchema, kind: string): string => nounOf(schema.tryDefinition(kind), kind);
export const fieldsOf = (schema: AnySchema, kind: string): string[] => Object.keys((schema.tryDefinition(kind)?.fields.shape ?? {}) as Record<string, unknown>);

/** Fields whose value names one thing and only that thing: two records that share one are the same. */
export const KEY_FIELD = /^(e-?mail|email-?address|code|sku|reference|ref|external-?id|key)$/i;

/** The one of several that stays: the one with the most links and history, else the first made. */
export function keeperOf(store: Store<AnySchema>, nodes: readonly Node[], touched: ReadonlyMap<string, number>): Node {
  const weight = (node: Node) => store.graph.out(node.id).length + store.graph.in(node.id).length;
  return [...nodes].sort((a, b) => weight(b) - weight(a) || (touched.get(a.id) ?? 0) - (touched.get(b.id) ?? 0))[0]!;
}

/**
 * DUPLICATES → MERGE. Records of one kind that share a name — case,
 * accents and spacing aside, as an import matches a row to its record
 * (`nameKey`) — or a key a record has only one of (an email, a code). The
 * one with the most links stays; each other is merged into it
 * (`merge-<kind>`). An exact name is surer than one that matches only with
 * its punctuation aside; a shared key is surest.
 */
export const duplicates: Judge = {
  name: "duplicates",
  severity: "merge",
  judge(context) {
    const { store } = context;
    const schema = store.schema;
    const out: Candidate[] = [];
    for (const definition of schema.definitions) {
      const kind = definition.kind;
      if (definition.archives === false || !actNamed(store, `merge-${kind}`)) continue;
      const records = store.graph.nodesOfKind(kind as never) as unknown as Node[];
      const keys = fieldsOf(schema, kind).filter((field) => KEY_FIELD.test(field));
      const merged = new Set<string>();
      const groups: { readonly nodes: Node[]; readonly basis: (keeper: Node) => string; readonly confidence: number; readonly field?: string }[] = [];
      const group = (key: (node: Node) => string | undefined, basis: (keeper: Node, value: string) => string, confidence: number, field?: string) => {
        const by = new Map<string, Node[]>();
        for (const node of records) {
          if (merged.has(node.id)) continue;
          const value = key(node);
          if (value) by.set(value, [...(by.get(value) ?? []), node]);
        }
        for (const [value, nodes] of by) if (nodes.length > 1) {
          groups.push({ nodes, basis: (keeper) => basis(keeper, value), confidence, ...(field !== undefined ? { field } : {}) });
          for (const node of nodes) merged.add(node.id);
        }
      };
      for (const field of keys) {
        group((node) => (typeof node[field] === "string" && node[field].trim() ? nameKey(node[field]) : undefined), (_keeper, value) => `Both have the ${field} ${value}`, 0.95, field);
      }
      group((node) => nameKey(named(schema, node)) || undefined, (keeper) => `Same name as “${named(schema, keeper)}” (another ${noun(schema, kind)})`, 0.9);
      group((node) => fold(named(schema, node)).replace(/ /g, "") || undefined, (keeper) => `Nearly the same name as “${named(schema, keeper)}”, punctuation and spacing aside`, 0.75);
      for (const { nodes, basis, confidence, field } of groups) {
        const keeper = keeperOf(store, nodes, context.touched);
        if (!mayTouch(context, keeper)) continue;
        for (const node of nodes) {
          if (node.id === keeper.id || !mayTouch(context, node)) continue;
          // A shared key read both records' key; a shared name, both names.
          const read = field !== undefined ? [fieldRead(node, field), fieldRead(keeper, field)] : [...nameRead(schema, node), ...nameRead(schema, keeper)];
          out.push({ judge: "duplicates", calls: [{ name: `merge-${kind}`, args: { id: node.id, into: keeper.id } }], basis: basis(keeper), confidence, about: [node.id, keeper.id], read });
        }
      }
    }
    return out;
  },
};

/** The act that links a kind's records along a relation, and the argument the far record goes in: the derived connect, else a declared act that `connects` it. */
export function connectOf(store: Store<AnySchema>, kind: string, relation: string, targets: readonly string[]): { readonly name: string; readonly to: string } | undefined {
  for (const act of store.allMutations()) {
    if (!(act.connects ?? []).includes(relation) || act.subject?.arg === undefined || !act.subject.kinds?.includes(kind)) continue;
    const refs = nodeRefArgs(act.input).filter((ref) => ref.name !== act.subject!.arg);
    // One other record it takes, of the kinds the relation reaches: anything more is the act's own business.
    const far = refs.filter((ref) => ref.kinds.includes("*") || targets.some((target) => ref.kinds.includes(target)));
    if (act.subject.arg === "id" && far.length === 1 && refs.length === 1) return { name: act.name, to: far[0]!.name };
  }
  return undefined;
}

/** Whether `inside` holds `words` as whole words, folded. */
const holdsWords = (inside: string, words: string): boolean => ` ${inside} `.includes(` ${words} `);

/**
 * LINKS FROM SHARED VALUES. A record whose text names another record —
 * a field that says exactly what the other is called, or names it among
 * other words — is linked to it through a relation the declaration already
 * has whose far end is that record's kind; a relation is never invented.
 * A cardinality-one relation that already holds a link is left as it is;
 * a name two records of the far kind share says nothing. An exact name is
 * surer than one named in passing.
 */
export const links: Judge = {
  name: "links",
  severity: "link",
  judge(context) {
    const { store } = context;
    const schema = store.schema;
    const out: Candidate[] = [];
    for (const definition of schema.definitions) {
      const kind = definition.kind;
      if (tidyingOf(schema, kind) === "no-links") continue;
      const hidden = new Set(definition.display?.hide ?? []);
      for (const [relation, edge] of Object.entries(definition.edges ?? {}) as [string, { readonly to: readonly string[] | "*"; readonly cardinality?: string; readonly acts?: string }][]) {
        if (edge.acts === "none" || tidyingOf(schema, kind, relation) === "never") continue;
        const targets = edge.to === "*" ? schema.definitions.map((one) => one.kind) : edge.to;
        const act = connectOf(store, kind, relation, targets);
        if (!act) continue;
        // The far records by their folded name; a name two of them share names neither.
        const byName = new Map<string, Node | null>();
        for (const target of targets) {
          if (tidyingOf(schema, target) === "never" || tidyingOf(schema, target) === "no-links") continue;
          for (const node of store.graph.nodesOfKind(target as never) as unknown as Node[]) {
            const name = fold(named(schema, node));
            if (name.replace(/ /g, "").length < 3) continue;
            byName.set(name, byName.has(name) ? null : node);
          }
        }
        for (const node of store.graph.nodesOfKind(kind as never) as unknown as Node[]) {
          if (!mayTouch(context, node)) continue;
          const linked = new Set(store.graph.out(node.id, relation).map((one) => one.id));
          if (edge.cardinality === "one" && linked.size > 0) continue;
          const own = fold(named(schema, node));
          const found = new Map<string, { far: Node; field: string; exact: boolean }>();
          for (const field of fieldsOf(schema, kind)) {
            const value = node[field];
            if (hidden.has(field) || typeof value !== "string" || !value.trim()) continue;
            const said = fold(value);
            for (const [name, far] of byName) {
              if (!far || far.id === node.id || linked.has(far.id) || name === own) continue;
              const exact = said === name;
              if (!exact && !holdsWords(said, name)) continue;
              const was = found.get(far.id);
              if (!was || (exact && !was.exact)) found.set(far.id, { far, field, exact });
            }
          }
          const ranked = [...found.values()].sort((a, b) => Number(b.exact) - Number(a.exact));
          // One link to hold, and two equally named: nothing to say.
          const picked = edge.cardinality === "one" ? (ranked.length === 1 || (ranked[0]?.exact && !ranked[1]?.exact) ? ranked.slice(0, 1) : []) : ranked;
          for (const { far, field, exact } of picked) {
            if (!mayTouch(context, far)) continue;
            const farNoun = noun(schema, far.kind);
            out.push({
              judge: "links",
              calls: [{ name: act.name, args: { id: node.id, [act.to]: far.id } }],
              basis: exact ? `Its ${field} is “${named(schema, far)}”, the name of ${/^[aeiou]/i.test(farNoun) ? "an" : "a"} ${farNoun}` : `Its ${field} names “${named(schema, far)}”`,
              confidence: exact ? 0.85 : 0.5,
              about: [node.id, far.id],
              // What the record's field says, and the names it was matched against.
              read: [fieldRead(node, field), ...nameRead(schema, node), ...nameRead(schema, far)],
            });
          }
        }
      }
    }
    return out;
  },
};

/**
 * HOW THE APP SAYS A RECORD IS FINISHED, from its declaration: its
 * lifecycle (a value that retires it, or a date it expires after), else
 * its main choice field read as the map reads it (`districtState`: a
 * value like done, shipped, closed), else a yes/no field called done,
 * completed or closed. Undefined when the kind says no such thing.
 */
export function finishedOf(schema: AnySchema, kind: string, today: string): ((node: Node) => string | undefined) | undefined {
  const definition = schema.tryDefinition(kind);
  if (!definition) return undefined;
  const lifecycle = definition.lifecycle;
  if (lifecycle) {
    return (node) => (isCurrent(definition, node, today) ? undefined : lifecycle.retired === "date" ? `its ${lifecycle.field} has passed` : `its ${lifecycle.field} is “${String(node[lifecycle.field])}”`);
  }
  const state = districtState(schema, kind);
  if (state && state.tiers.includes("done")) {
    const done = new Set(state.values.filter((_, at) => state.tiers[at] === "done"));
    return (node) => (done.has(node[state.field] as string) ? `its ${state.field} is “${String(node[state.field])}”` : undefined);
  }
  const flag = fieldsOf(schema, kind).find((field) => /^(done|completed|closed|finished)$/i.test(field));
  return flag ? (node) => (node[flag] === true ? `it is marked ${flag}` : undefined) : undefined;
}

/** When a record last moved: the log's last change to it, else the date its declaration reads it by (a lifecycle date, an end or due role). */
export function lastMoved(schema: AnySchema, node: Node, touched: ReadonlyMap<string, number>): number | undefined {
  return movedBy(schema, node, touched)?.at;
}

/** When a record last moved, and the field that said so, when a field did rather than the log. */
function movedBy(schema: AnySchema, node: Node, touched: ReadonlyMap<string, number>): { readonly at: number; readonly field?: string } | undefined {
  const logged = touched.get(node.id);
  if (logged !== undefined) return { at: logged };
  const definition = schema.tryDefinition(node.kind);
  const roles = definition?.fieldRoles ?? {};
  for (const field of [definition?.lifecycle?.retired === "date" ? definition.lifecycle.field : undefined, roles["end"], roles["due"], roles["at"], roles["start"]]) {
    const value = field ? node[field] : undefined;
    const at = typeof value === "string" ? Date.parse(value) : Number.NaN;
    if (!Number.isNaN(at)) return { at, field: field! };
  }
  return undefined;
}

/** The field a kind says it is finished by, as `finishedOf` reads it. */
function finishedField(schema: AnySchema, kind: string): string | undefined {
  const definition = schema.tryDefinition(kind);
  if (!definition) return undefined;
  if (definition.lifecycle) return definition.lifecycle.field;
  const state = districtState(schema, kind);
  if (state && state.tiers.includes("done")) return state.field;
  return fieldsOf(schema, kind).find((field) => /^(done|completed|closed|finished)$/i.test(field));
}

/**
 * DONE AND OLD → SET ASIDE. A record its kind says is finished, unchanged
 * for longer than the run's `olderThanDays`, is a candidate to archive
 * (`archive-<kind>`): out of lists and counts, its links and history kept,
 * "Bring it back" one act away. Only kinds that archive; a record whose age
 * nothing says is left.
 */
export const archive: Judge = {
  name: "archive",
  severity: "archive",
  judge(context) {
    const { store } = context;
    const schema = store.schema;
    const today = new Date(context.now).toISOString().slice(0, 10);
    const out: Candidate[] = [];
    for (const definition of schema.definitions) {
      const kind = definition.kind;
      if (definition.archives === false || !actNamed(store, `archive-${kind}`)) continue;
      const finished = finishedOf(schema, kind, today);
      if (!finished) continue;
      for (const node of store.graph.nodesOfKind(kind as never) as unknown as Node[]) {
        if (!mayTouch(context, node)) continue;
        const why = finished(node);
        const movedAt = why ? movedBy(schema, node, context.touched) : undefined;
        if (!why || movedAt === undefined) continue;
        const moved = movedAt.at;
        const days = Math.floor((context.now - moved) / DAY);
        const by = finishedField(schema, kind);
        if (days < context.olderThanDays) continue;
        out.push({
          judge: "archive",
          calls: [{ name: `archive-${kind}`, args: { id: node.id } }],
          basis: `Finished — ${why} — and unchanged for ${days} days`,
          // Older is surer, never certain: a person may still be reading it.
          confidence: Math.min(0.8, 0.6 + days / 365),
          about: [node.id],
          read: [...(by !== undefined ? [fieldRead(node, by)] : []), ...(movedAt.field !== undefined ? [fieldRead(node, movedAt.field)] : [])],
        });
      }
    }
    return out;
  },
};

/**
 * AN EMPTY CHOICE, FILLED IN (`edit-<kind>`). Which of a field's options a
 * record is takes reading it, so the graph alone proposes nothing: only a
 * model, when lent, judges it (`./judging.ts`).
 */
export const categorize: Judge = { name: "categorize", severity: "categorize", judge: () => [] };

/**
 * AN EMPTY ONE-LINK RELATION, FILLED IN. Without a model the floor is the
 * `links` judge's — a far record the record's own text names; a model, when
 * lent, chooses among the likeliest records of the far kind, or none.
 */
export const missingLinks: Judge = { name: "missing-links", severity: "link", judge: () => [] };

/** The judges a run uses unless told otherwise. */
export const JUDGES: readonly Judge[] = [duplicates, links, archive, categorize, missingLinks];
