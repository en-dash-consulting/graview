import { z } from "zod";
import type {
  AnyNodeDefinition,
  EdgeDeclaration,
  NodeOf,
  ValidateEdgeTargets,
} from "./types.js";

export interface EdgeKindInfo {
  readonly kind: string;
  /** Node kinds this edge may leave. */
  readonly from: readonly string[];
  /** Node kinds this edge may point at, or `"*"`. */
  readonly to: readonly string[] | "*";
  readonly cardinality: "one" | "many";
  readonly description?: string;
}

export interface Schema<Defs extends readonly AnyNodeDefinition[] = readonly AnyNodeDefinition[]> {
  readonly definitions: Defs;
  readonly kinds: readonly Defs[number]["kind"][];
  readonly edgeKinds: readonly string[];
  definition<K extends Defs[number]["kind"]>(kind: K): DefinitionOfKind<Defs[number], K>;
  tryDefinition(kind: string): Defs[number] | undefined;
  edge(kind: string): EdgeKindInfo | undefined;
  /** Whether an edge of `kind` may run from one node kind to another. */
  edgeAllowed(kind: string, fromKind: string, toKind: string): boolean;
  /** Runtime validation of a node against its declared fields. */
  parseNode(node: unknown): NodeOf<Defs[number]>;
  /** Phantom carrier for the node union — never populated at runtime. */
  readonly __node: NodeOf<Defs[number]>;
}

/**
 * THE DEFINITION OF ONE KIND: the one that names it, in a schema whose kinds
 * are known; any definition, narrowed to that kind, in one whose kinds are
 * only `string` (`AnySchema`), where the exact one cannot be picked out and
 * `Extract` would leave nothing.
 */
export type DefinitionOfKind<D extends AnyNodeDefinition, K extends string> = D extends { readonly kind: infer Named } ? (K extends Named ? D : never) : never;

export type AnySchema = Schema<readonly AnyNodeDefinition[]>;
export type NodeOfSchema<S extends AnySchema> = S["__node"];
export type KindOfSchema<S extends AnySchema> = NodeOfSchema<S>["kind"];
/**
 * A node of one kind: the kind's own node in a schema whose kinds are known;
 * any node of that kind in one whose kinds are only `string` (`AnySchema`,
 * as an unbound `defineInvariant` sees it), where `Extract` would leave
 * nothing and every field read off it would be `never`.
 */
export type NodeOfKind<S extends AnySchema, K extends KindOfSchema<S>> = string extends KindOfSchema<S>
  ? NodeOfSchema<S> & { readonly kind: K }
  : Extract<NodeOfSchema<S>, { kind: K }>;

export class SchemaError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(hint ? `${message}\n  → ${hint}` : message);
    this.name = "SchemaError";
  }
}

/**
 * Assembles declarations into one schema. The `ValidateEdgeTargets` guard
 * makes an edge to an undeclared kind a typecheck failure; the runtime
 * checks here catch the same class of mistake for dynamically built schemas.
 */
export function createSchema<const Defs extends readonly AnyNodeDefinition[]>(
  definitions: Defs & ValidateEdgeTargets<Defs>,
): Schema<Defs> {
  const defs = definitions as Defs;
  const byKind = new Map<string, AnyNodeDefinition>();
  for (const def of defs) {
    if (byKind.has(def.kind)) {
      throw new SchemaError(
        `Duplicate node kind "${def.kind}"`,
        "Each kind may be declared once; merge the two defineNode calls.",
      );
    }
    byKind.set(def.kind, def);
  }

  const edges = new Map<string, { from: string[]; decl: EdgeDeclaration }>();
  for (const def of defs) {
    for (const [edgeKind, decl] of Object.entries(def.edges)) {
      if (decl.to !== "*") {
        for (const target of decl.to) {
          if (!byKind.has(target)) {
            throw new SchemaError(
              `Edge "${edgeKind}" on "${def.kind}" points at undeclared kind "${target}"`,
              `Declared kinds: ${[...byKind.keys()].join(", ")}`,
            );
          }
        }
      }
      const existing = edges.get(edgeKind);
      if (existing) {
        existing.from.push(def.kind);
      } else {
        edges.set(edgeKind, { from: [def.kind], decl });
      }
    }
  }

  const edgeInfo = new Map<string, EdgeKindInfo>();
  for (const [kind, { from, decl }] of edges) {
    // Every declaring kind's targets, not only the first's.
    const targets = from.map((one) => (byKind.get(one)!.edges[kind] as EdgeDeclaration).to);
    edgeInfo.set(kind, {
      kind,
      from,
      to: targets.includes("*") ? "*" : [...new Set(targets.flat() as string[])],
      cardinality: decl.cardinality ?? "many",
      ...(decl.description === undefined ? {} : { description: decl.description }),
    });
  }

  const nodeSchemas = new Map<string, z.ZodType>();
  for (const def of defs) {
    nodeSchemas.set(
      def.kind,
      def.fields.extend({ id: z.string().min(1), kind: z.literal(def.kind) }),
    );
  }

  return {
    definitions: defs,
    kinds: defs.map((d) => d.kind) as readonly Defs[number]["kind"][],
    edgeKinds: [...edgeInfo.keys()],
    definition(kind) {
      const def = byKind.get(kind);
      if (!def) {
        throw new SchemaError(
          `Unknown node kind "${String(kind)}"`,
          `Declared kinds: ${[...byKind.keys()].join(", ")}`,
        );
      }
      return def as DefinitionOfKind<Defs[number], typeof kind>;
    },
    tryDefinition(kind) {
      return byKind.get(kind) as Defs[number] | undefined;
    },
    edge(kind) {
      return edgeInfo.get(kind);
    },
    edgeAllowed(kind, fromKind, toKind) {
      /*
       * Asked of the DECLARING kind's own declaration. An edge name two
       * kinds both declare kept the first one's targets for both, so the
       * second kind's edge was refused to its own declared targets and
       * allowed to the first kind's.
       */
      const declared = byKind.get(fromKind)?.edges[kind] as EdgeDeclaration | undefined;
      if (!declared) return false;
      return declared.to === "*" || declared.to.includes(toKind);
    },
    parseNode(node) {
      const kind = (node as { kind?: unknown })?.kind;
      if (typeof kind !== "string") {
        throw new SchemaError("Node is missing a `kind`");
      }
      const parser = nodeSchemas.get(kind);
      if (!parser) {
        throw new SchemaError(
          `Unknown node kind "${kind}"`,
          `Declared kinds: ${[...byKind.keys()].join(", ")}`,
        );
      }
      return parser.parse(node) as NodeOf<Defs[number]>;
    },
    __node: undefined as never,
  };
}
