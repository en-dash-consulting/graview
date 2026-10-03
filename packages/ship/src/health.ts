import type { AnySchema, Store } from "@graview/core";

/**
 * Whether a deployment is WELL, asked of the store itself. Not liveness —
 * the process answering proves that — but coherence: the graph parses under
 * its schema, no edge dangles, and the rules' standing is a number rather
 * than a surprise. A service polls this per tenant; a self-hoster curls it.
 */
export interface HealthReport {
  readonly ok: boolean;
  readonly nodes: number;
  readonly edges: number;
  readonly violations: number;
  /** Of those, rules that threw rather than judged — counted apart, never matched by message. */
  readonly couldNotJudge: number;
  /** Of those, rules that would have read more of the graph than their budget. */
  readonly overBudget: number;
  readonly danglingEdges: readonly string[];
  readonly at: string;
}

export function health<S extends AnySchema>(
  store: Store<S>,
  options: { readonly now?: () => string } = {},
): HealthReport {
  const ids = new Set([...store.graph.allNodes()].map((node) => node.id));
  const dangling = [...store.graph.allEdges()]
    .filter((edge) => !ids.has(edge.from) || !ids.has(edge.to))
    .map((edge) => `${edge.kind}:${edge.from}->${edge.to}`);
  const all = store.violations();
  const violations = all.length;
  return {
    ok: dangling.length === 0,
    nodes: ids.size,
    edges: [...store.graph.allEdges()].length,
    violations,
    couldNotJudge: all.filter((violation) => violation.status === "could-not-judge").length,
    overBudget: all.filter((violation) => violation.status === "over-budget").length,
    danglingEdges: dangling,
    at: (options.now ?? (() => new Date().toISOString()))(),
  };
}
