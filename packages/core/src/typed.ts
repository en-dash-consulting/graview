/**
 * `@graview/core/typed` — A DOCUMENT'S NAMES, CHECKED BY THE COMPILER THAT
 * BUILDS THE PRODUCT.
 *
 * A declaration document is JSON, and JSON's names are strings: a face that
 * reads `n.status` off `{ id, kind } & Record<string, unknown>`, or walks a
 * relation by a bare `"dependsOn"`, learns that a field or a relation was
 * renamed by drawing a blank section. Two doors close that gap:
 *
 * - `graview types <document>` writes the document's kinds, fields and
 *   relations as TypeScript (`Types`), and `typedReader<Types>(store)` reads
 *   a store through them: a renamed field or relation fails `tsc`.
 * - `defineDocument({...})` is the same document written in TypeScript. Its
 *   output is the JSON document, unchanged; what it adds is that the names a
 *   document says twice — a kind an edge points at, a field a glance or a
 *   lifecycle names, a relation an act connects, a kind a rule is over —
 *   and every key the format has are checked as they are typed.
 *   `TypesOf<typeof document>` is then what `graview types` would write.
 *
 * Its own entry, apart from `@graview/core` and `/document`: a page that
 * reads with it pays for six small functions, and a page that does not pays
 * nothing. Expressions stay strings: `graview check` reads those.
 */
import type * as z from "./schema/zod.js";
import type { FileValue } from "./schema/files.js";
import type { ActSpec, DocumentSpec, EdgeSpec, FieldSpec, KindSpec, RuleSpec } from "./document/schema.js";

// ------------------------------------------------------------- the types

/**
 * What a document's types are: each kind's record, and for each kind the
 * kinds each of its relations reaches. `graview types` writes one;
 * `TypesOf<typeof document>` derives one from a `defineDocument`.
 */
export interface DocumentTypes {
  readonly kinds: object;
  readonly edges: object;
}

/** The kinds of a document's types, by name. */
export type KindName<T extends DocumentTypes> = keyof T["kinds"] & string;
/** The record of one kind. */
export type RecordOf<T extends DocumentTypes, K extends KindName<T>> = T["kinds"][K];
/** A record of any kind. */
export type AnyRecord<T extends DocumentTypes> = T["kinds"][KindName<T>];
/** A record's own fields, by name: everything but its `id` and `kind`. */
export type FieldName<N> = Exclude<keyof N, "id" | "kind"> & string;
/** The relations a kind declares, by name. */
export type EdgeName<T extends DocumentTypes, K extends string> = K extends keyof T["edges"] ? keyof T["edges"][K] & string : never;
/** The kinds one relation of one kind reaches. */
export type TargetOf<T extends DocumentTypes, K extends string, E extends string> = K extends keyof T["edges"]
  ? E extends keyof T["edges"][K]
    ? T["edges"][K][E] & KindName<T>
    : never
  : never;
/** The relations that reach a kind from any kind, by name. */
export type InwardName<T extends DocumentTypes, K extends string> = {
  [S in keyof T["edges"]]: { [E in keyof T["edges"][S]]: K extends T["edges"][S][E] ? E : never }[keyof T["edges"][S]];
}[keyof T["edges"]] &
  string;
/** The kinds a relation reaches a kind from. */
export type SourceOf<T extends DocumentTypes, K extends string, E extends string> = {
  [S in keyof T["edges"]]: E extends keyof T["edges"][S] ? (K extends T["edges"][S][E] ? S : never) : never;
}[keyof T["edges"]] &
  KindName<T>;

// ------------------------------------------------------------- the reader

/** What the reader reads: a store's graph (`store.graph`), or anything that answers as one. */
export interface GraphReads {
  getNode(id: string): unknown;
  nodesOfKind(kind: string): readonly unknown[];
  out(id: string, edge?: string): readonly unknown[];
  in(id: string, edge?: string): readonly unknown[];
}

/** A store read through a document's types: every kind, field and relation named is one the document declares. */
export interface TypedReader<T extends DocumentTypes> {
  /** Every record of one kind. */
  nodes<K extends KindName<T>>(kind: K): readonly RecordOf<T, K>[];
  /** One record by id, of any kind — or of the kind named, or nothing. */
  node(id: string): AnyRecord<T> | undefined;
  node<K extends KindName<T>>(id: string, kind: K): RecordOf<T, K> | undefined;
  /** Whether a record is of the kind named, narrowing it. */
  is<K extends KindName<T>>(node: unknown, kind: K): node is RecordOf<T, K>;
  /** One of a record's fields, by a name its kind declares. */
  fieldOf<N extends AnyRecord<T>, F extends FieldName<N>>(node: N, field: F): N[F];
  /** The records a relation the record's kind declares reaches. */
  edgesOf<N extends AnyRecord<T> & { readonly id: string; readonly kind: string }, E extends EdgeName<T, N["kind"]>>(node: N, edge: E): readonly RecordOf<T, TargetOf<T, N["kind"], E>>[];
  /** The records that reach this one by a relation some kind declares toward its kind. */
  inwardOf<N extends AnyRecord<T> & { readonly id: string; readonly kind: string }, E extends InwardName<T, N["kind"]>>(node: N, edge: E): readonly RecordOf<T, SourceOf<T, N["kind"], E>>[];
}

type Readable = { readonly id: string; readonly kind: string } & Record<string, unknown>;

/**
 * A store — or its graph — read through a document's types:
 * `typedReader<Types>(store)`, with `Types` from `graview types` or
 * `TypesOf<typeof document>`. Reads what the graph holds and checks nothing
 * at run time; the names were checked when the product compiled.
 */
export function typedReader<T extends DocumentTypes>(source: GraphReads | { readonly graph: GraphReads }): TypedReader<T> {
  const graph = "graph" in source ? source.graph : source;
  const reader = {
    nodes: (kind: string) => graph.nodesOfKind(kind),
    node: (id: string, kind?: string) => {
      const node = graph.getNode(id) as Readable | undefined;
      return node && (kind === undefined || node.kind === kind) ? node : undefined;
    },
    is: (node: unknown, kind: string) => (node as { readonly kind?: unknown } | undefined)?.kind === kind,
    fieldOf: (node: Readable, field: string) => node[field],
    edgesOf: (node: Readable, edge: string) => graph.out(node.id, edge),
    inwardOf: (node: Readable, edge: string) => graph.in(node.id, edge),
  };
  return reader as unknown as TypedReader<T>;
}

// ---------------------------------------------------- types from a document

type Get<T, K extends string> = T extends { readonly [P in K]?: infer V } ? NonNullable<V> : never;
type Keys<T> = [T] extends [never] ? never : T extends object ? keyof T & string : never;
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** What a field of one declared type holds: its options for an enum, a number for a number, words for the rest. */
export type ValueOf<F> = F extends { readonly type: "enum"; readonly options: readonly (infer O)[] }
  ? O
  : F extends { readonly type: "number" | "integer" }
    ? number
    : F extends { readonly type: "boolean" }
      ? boolean
      : F extends { readonly type: "image" | "file" }
        ? FileValue
        : F extends { readonly type: "list"; readonly of: "number" }
          ? readonly number[]
          : F extends { readonly type: "list"; readonly of: "image" | "file" }
            ? readonly FileValue[]
            : F extends { readonly type: "list" }
              ? readonly string[]
              : string;

type RequiredFields<Fs> = { [F in keyof Fs]: Fs[F] extends { readonly required: true } ? F : never }[keyof Fs];

/** One kind's record, as the store holds it: `id`, `kind`, every required field, and the rest optional. */
export type RecordOfKind<K extends string, Spec> = Simplify<
  { readonly id: string; readonly kind: K } & { readonly [F in RequiredFields<Get<Spec, "fields">>]: ValueOf<Get<Spec, "fields">[F]> } & {
    readonly [F in Exclude<keyof Get<Spec, "fields">, RequiredFields<Get<Spec, "fields">>>]?: ValueOf<Get<Spec, "fields">[F]>;
  }
>;

type Targets<D, To> = To extends "*" ? KindNames<D> : To extends readonly (infer K)[] ? K & string : never;

/** A document's types, derived from the document itself: what `graview types` writes, for a `defineDocument`. */
export type TypesOf<D> = {
  readonly kinds: { readonly [K in KindNames<D>]: RecordOfKind<K, KindOf<D, K>> };
  readonly edges: { readonly [K in KindNames<D>]: { readonly [E in Keys<Get<KindOf<D, K>, "edges">>]: Targets<D, Get<Get<Get<KindOf<D, K>, "edges">, E>, "to">> } };
};

// ------------------------------------------------------------ defineDocument

type Deep<T> = T extends readonly (infer U)[] ? readonly Deep<U>[] : T extends object ? { readonly [K in keyof T]: Deep<T[K]> } : T;

/** A declaration document as TypeScript writes one: the format's shape, read-only all the way down. */
export type DocumentDraft = Deep<z.input<typeof DocumentSpec>>;

type KindNames<D> = Keys<Get<D, "kinds">>;
type KindOf<D, K extends string> = Get<Get<D, "kinds">, K>;
type FieldNames<D, K extends string> = Keys<Get<KindOf<D, K>, "fields">>;
type ComputedNames<D, K extends string> = Keys<Get<KindOf<D, K>, "computed">>;
type AllFields<D> = { [K in KindNames<D>]: FieldNames<D, K> }[KindNames<D>];
type EdgeNames<D> = { [K in KindNames<D>]: Keys<Get<KindOf<D, K>, "edges">> }[KindNames<D>];
/** An act a rule's repair or a grant may name: one the document declares, or one every kind is given. */
type ActNames<D> = Keys<Get<D, "acts">> | `${"edit" | "remove" | "archive" | "unarchive" | "merge"}-${KindNames<D>}`;
type RoleNames<D> = Get<D, "roles"> extends readonly (infer R)[] ? R & string : string;

/*
 * A NAME THAT IS NOT DECLARED is said as what it should have been one of.
 * Never as `never`: TypeScript reduces an object whose literal property
 * meets `never` to `never` whole, and every key of it would be the error.
 */
type Named<Given, Declared> = [Given] extends [Declared] ? unknown : { readonly "is not declared; the document declares": Declared };

/** Every key the format does not have, refused: `{ "roles": … }` on a kind is a compile error, not a run-time one. */
type NoOther<T, Shape> = { readonly [P in Exclude<keyof T, keyof Shape>]: { readonly "is not a key the Graview document format has here": P } };

type CheckedKind<D, K extends string, S = KindOf<D, K>> = NoOther<S, z.input<typeof KindSpec>> & {
  readonly fields: { readonly [F in Keys<Get<S, "fields">>]: NoOther<Get<Get<S, "fields">, F>, z.input<typeof FieldSpec>> };
  readonly glance?: readonly (FieldNames<D, K> | ComputedNames<D, K>)[];
  /** Which field fills each role: a field the kind has (or its `label`). */
  readonly fieldRoles?: { readonly [R in Keys<Get<S, "fieldRoles">>]: Named<Get<Get<S, "fieldRoles">, R>, FieldNames<D, K> | "label"> };
  readonly lifecycle?: { readonly field: Named<Get<Get<S, "lifecycle">, "field">, FieldNames<D, K>> };
  readonly page?: {
    readonly fields?: readonly (FieldNames<D, K> | ComputedNames<D, K>)[];
    readonly groups?: readonly { readonly title: string; readonly fields: readonly (FieldNames<D, K> | ComputedNames<D, K>)[] }[];
  };
  readonly edges?: {
    readonly [E in Keys<Get<S, "edges">>]: NoOther<Get<Get<S, "edges">, E>, z.input<typeof EdgeSpec>> & { readonly to: readonly KindNames<D>[] | "*" };
  };
};

type CheckedEffect<D, E> = E extends { readonly create: infer Kind }
  ? { readonly create: Named<Kind, KindNames<D>> }
  : E extends { readonly connect: infer Edge }
    ? { readonly connect: Named<Edge, EdgeNames<D>> }
    : E extends { readonly sever: infer Edge }
      ? { readonly sever: Named<Edge, EdgeNames<D>> }
      : unknown;
type CheckedEffects<D, T> = { readonly [I in keyof T]: CheckedEffect<D, T[I]> };

type CheckedAct<D, A> = NoOther<A, z.input<typeof ActSpec>> & {
  readonly on?: Named<Get<A, "on">, KindNames<D> | readonly KindNames<D>[]>;
  readonly creates?: Named<Get<A, "creates">, KindNames<D>>;
  readonly connects?: Named<Get<A, "connects">, EdgeNames<D>>;
  readonly severs?: Named<Get<A, "severs">, EdgeNames<D>>;
  readonly replaces?: true | readonly EdgeNames<D>[];
  readonly writes?: readonly AllFields<D>[];
  readonly effects?: CheckedEffects<D, Get<A, "effects">>;
};

type CheckedRepairs<D, T> = { readonly [I in keyof T]: { readonly act: Named<Get<T[I], "act">, ActNames<D>> } };

type CheckedRule<D, R> = NoOther<R, z.input<typeof RuleSpec>> & {
  readonly over: Named<Get<R, "over">, "graph" | KindNames<D>>;
  readonly repairs?: CheckedRepairs<D, Get<R, "repairs">>;
};

type CheckedPolicy<D> = {
  readonly grants: readonly { readonly roles: readonly RoleNames<D>[] | "*"; readonly mutations: readonly ActNames<D>[] | "*"; readonly kinds?: readonly KindNames<D>[] | "*" }[];
  readonly sees?: readonly { readonly roles: readonly RoleNames<D>[] | "*"; readonly kinds: readonly KindNames<D>[] }[];
};

/** The names a document says twice, held to the ones it declares — and no key the format does not have. */
export type CheckedDocument<D> = NoOther<D, z.input<typeof DocumentSpec>> & {
  readonly kinds: { readonly [K in KindNames<D>]: CheckedKind<D, K> };
  readonly acts?: { readonly [A in Keys<Get<D, "acts">>]: CheckedAct<D, Get<Get<D, "acts">, A>> };
  readonly rules?: { readonly [R in Keys<Get<D, "rules">>]: CheckedRule<D, Get<Get<D, "rules">, R>> };
  readonly policy?: CheckedPolicy<D>;
  readonly views?: { readonly [V in Keys<Get<D, "views">>]: Named<V, KindNames<D> | "home"> };
};

/**
 * A declaration document, written in TypeScript: what it returns is the
 * document itself, the same JSON `graview check --document` reads and a host
 * compiles — `JSON.stringify(defineDocument({...}))` is a document. What it
 * adds is the compiler: a key the format does not have, a kind an edge
 * points at that no kind is, a field a glance or a lifecycle names that its
 * kind lacks, a relation an act connects that no kind declares, a kind a
 * rule is over, an act a repair or a grant names — each is a type error.
 * Expressions and templates are strings still; `graview check` reads them.
 */
export function defineDocument<const D extends DocumentDraft>(document: D & CheckedDocument<D>): D {
  return document;
}
