import type { z } from "zod";
import { defineInvariant } from "./invariants/engine.js";
import type { InvariantDefinition, InvariantEvalArgs, Violation } from "./invariants/types.js";
import type {
  MutationDefinition,
  MutationDefinitionSpec,
} from "./mutations/types.js";
import type { AnySchema, KindOfSchema, NodeOfKind } from "./schema/schema.js";
import { createViewRegistry, type ViewRegistry } from "./views/types.js";

export interface SchemaBinding<S extends AnySchema> {
  readonly schema: S;
  /**
   * Declares a mutation against this schema. Binding the schema up front is
   * what lets TypeScript infer the argument type from `input` — so a
   * mutation body sees real field types, and a renamed field breaks the
   * build rather than the app.
   */
  defineMutation<const Name extends string, I extends z.ZodType>(
    name: Name,
    spec: MutationDefinitionSpec<S, I>,
  ): MutationDefinition<S, Name, I>;
  defineInvariant<const K extends KindOfSchema<S>>(
    name: string,
    spec: {
      readonly scope: { readonly kind: K; readonly match?: (node: NodeOfKind<S, K>) => boolean };
      readonly label?: string;
      readonly description?: string;
      readonly repairs?: readonly string[];
      /** Judge retired subjects too — see `InvariantDefinition.judgesPast`. */
      readonly judgesPast?: boolean;
      readonly evaluate: (args: InvariantEvalArgs<S, NodeOfKind<S, K>>) => Violation[];
    },
  ): InvariantDefinition<S>;
  defineGraphInvariant(
    name: string,
    spec: {
      readonly label?: string;
      readonly description?: string;
      readonly repairs?: readonly string[];
      readonly evaluate: (args: InvariantEvalArgs<S, undefined>) => Violation[];
    },
  ): InvariantDefinition<S>;
  createViews<V = unknown>(): ViewRegistry<S, V>;
}

/**
 * Binds a schema so everything declared against it infers from it. Without
 * this, TypeScript cannot infer a mutation's argument type and the schema
 * type at once — and an argument typed `unknown` defeats the whole point of
 * declaring the schema.
 */
export function bindSchema<S extends AnySchema>(schema: S): SchemaBinding<S> {
  return {
    schema,
    defineMutation(name, spec) {
      return { ...spec, name };
    },
    defineInvariant(name, spec) {
      return defineInvariant<S, KindOfSchema<S>>(name, spec as never);
    },
    defineGraphInvariant(name, spec) {
      return defineInvariant<S>(name, { ...spec, scope: "graph" });
    },
    createViews<V = unknown>() {
      return createViewRegistry<S, V>(schema);
    },
  };
}
