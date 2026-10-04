import { hidesFrom, seatLens, type AnySchema, type Principal, type Store } from "@graview/core";

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
  /**
   * What no longer fits the declaration (`store.findings()`, FR-21): records
   * and links a repair could fix, and the rules that could not be judged.
   */
  readonly findings: number;
  readonly at: string;
}

/**
 * THE COUNTS ARE THE STORE'S; THE IDS ARE THE SEAT'S (FR-55). `ok` and every
 * count judge the whole store, because a service polling a tenant asks
 * whether the store is well, and a seat-relative count would say a broken
 * store is fine — a count names no record. Given `seat`, `danglingEdges`
 * names only the links whose both ends are ids that seat may be told
 * (`seatLens(...).shows`: a record it is served, or an id that names no
 * record at all), so a link dangling from a hidden record is counted in
 * `ok` and never named.
 */
export function health<S extends AnySchema>(
  store: Store<S>,
  options: { readonly now?: () => string; readonly seat?: Principal } = {},
): HealthReport {
  const ids = new Set([...store.graph.allNodes()].map((node) => node.id));
  const told = options.seat && hidesFrom(store, options.seat) ? seatLens(store, options.seat).shows : () => true;
  const broken = [...store.graph.allEdges()].filter((edge) => !ids.has(edge.from) || !ids.has(edge.to));
  const dangling = broken.filter((edge) => told(edge.from) && told(edge.to)).map((edge) => `${edge.kind}:${edge.from}->${edge.to}`);
  const all = store.violations();
  const violations = all.length;
  return {
    ok: broken.length === 0,
    nodes: ids.size,
    edges: [...store.graph.allEdges()].length,
    violations,
    couldNotJudge: all.filter((violation) => violation.status === "could-not-judge").length,
    overBudget: all.filter((violation) => violation.status === "over-budget").length,
    danglingEdges: dangling,
    findings: store.findings().length,
    at: (options.now ?? (() => new Date().toISOString()))(),
  };
}
