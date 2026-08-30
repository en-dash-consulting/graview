import type { AnySchema, KindOfSchema } from "../schema/schema.js";

/** One node, or a group of them standing in for a kind. */
export type Cardinality = "one" | "many";

/**
 * How much of a node is drawn. This is the axis that keeps receded text
 * legible: a calendar at depth switches to a denser summary view rather than
 * scaling down into mush.
 *
 * - `full`    live DOM, captured every frame it moves
 * - `summary` captured on change into a cached texture
 * - `glyph`   painted in the shader, never captured
 */
export type Fidelity = "full" | "summary" | "glyph";

export const FIDELITIES: readonly Fidelity[] = ["full", "summary", "glyph"];

/** Views form a matrix, not a list. This names one cell of it. */
export interface ViewCell {
  readonly cardinality: Cardinality;
  readonly fidelity: Fidelity;
}

export interface ViewRegistration<V = unknown> {
  readonly kind: string;
  readonly cardinality: Cardinality;
  readonly fidelity: Fidelity;
  readonly view: V;
}

export interface ViewRegistry<S extends AnySchema, V = unknown> {
  /**
   * Registering a view for a kind the schema never declared is a typecheck
   * failure — `K` is constrained to the schema's kinds, so the mistake
   * surfaces at build time rather than at render.
   */
  register<K extends KindOfSchema<S>>(
    kind: K,
    cell: ViewCell,
    view: V,
  ): ViewRegistry<S, V>;
  /** The exact cell, with no fallback. */
  lookup(kind: string, cell: ViewCell): V | undefined;
  /**
   * The best available view for a cell: exact match, then a coarser fidelity,
   * then the primitive fallback the caller supplies.
   */
  resolve(kind: string, cell: ViewCell): ViewRegistration<V> | undefined;
  all(): readonly ViewRegistration<V>[];
  kindsWithViews(): readonly string[];
}

const key = (kind: string, cell: ViewCell) =>
  `${kind}|${cell.cardinality}|${cell.fidelity}`;

/** Fidelity fallback order, coarsest-first from a given starting point. */
function fallbacks(fidelity: Fidelity): Fidelity[] {
  switch (fidelity) {
    case "full":
      return ["full", "summary", "glyph"];
    case "summary":
      return ["summary", "full", "glyph"];
    case "glyph":
      return ["glyph", "summary", "full"];
  }
}

export function createViewRegistry<S extends AnySchema, V = unknown>(
  _schema: S,
): ViewRegistry<S, V> {
  const entries = new Map<string, ViewRegistration<V>>();

  const registry: ViewRegistry<S, V> = {
    register(kind, cell, view) {
      entries.set(key(kind, cell), {
        kind,
        cardinality: cell.cardinality,
        fidelity: cell.fidelity,
        view,
      });
      return registry;
    },
    lookup(kind, cell) {
      return entries.get(key(kind, cell))?.view;
    },
    resolve(kind, cell) {
      for (const fidelity of fallbacks(cell.fidelity)) {
        const found = entries.get(key(kind, { cardinality: cell.cardinality, fidelity }));
        if (found) return found;
      }
      // A `one` view standing in for `many` is wrong; a `many` view standing
      // in for `one` is merely dull. Only fall back in the safe direction.
      if (cell.cardinality === "one") {
        for (const fidelity of fallbacks(cell.fidelity)) {
          const found = entries.get(key(kind, { cardinality: "many", fidelity }));
          if (found) return found;
        }
      }
      return undefined;
    },
    all() {
      return [...entries.values()];
    },
    kindsWithViews() {
      return [...new Set([...entries.values()].map((e) => e.kind))];
    },
  };

  return registry;
}
