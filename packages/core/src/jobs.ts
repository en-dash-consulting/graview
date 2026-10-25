/**
 * `@graview/core/jobs` — WHAT AN APP'S PEOPLE COME TO DO, ANSWERED
 * (Roadmap f-app-jobs).
 *
 * `jobsOf(app)` reads the declaration's `purpose.jobs` in their whole form —
 * each order said with its direction, the kind's plural beside it — and
 * `jobsFor` narrows them to a seat's roles. `answerJob(store, job,
 * principal)` answers one AS THAT SEAT SEES THE APP: the records of the
 * job's kind its `where` holds for, read through `store.seenBy(principal)`,
 * so a record kept from the seat is never counted, never sorted and never
 * named, and a field kept from it reads as nothing.
 *
 * An entry of its own: a page that draws no job carries none of it, and the
 * checker's sentences about jobs (`job-*`) are `graview check`'s.
 */
import type { GraviewApp } from "./app.js";
import { shapesFor } from "./document/computed-values.js";
import { evaluateExpr, ExprEvalError, NodeSet, type Value } from "./document/expr/evaluate.js";
import { ExprSyntaxError, parseExpr, type Expr } from "./document/expr/parse.js";
import type { AnyGraphNode, GraphReader } from "./graph/types.js";
import { gridSortOf, sortForGrid } from "./grid-sort.js";
import { jobIsFor, type JobDeclaration } from "./job-shape.js";
import type { Principal } from "./permissions/types.js";
import { labelOf, pluralOf } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import type { Store } from "./store.js";

export type { AppPurpose, JobDeclaration, JobSort } from "./job-shape.js";
export { jobIsFor, MOST_JOBS } from "./job-shape.js";

/** A job in its whole form: its order said with a direction, and what its kind is called. */
export interface ResolvedJob {
  readonly name: string;
  readonly ask: string;
  readonly kind: string;
  /** The kind's records, as people say them: "Vendors". */
  readonly plural: string;
  readonly where?: string;
  readonly sort?: { readonly by: string; readonly direction: "asc" | "desc" };
  readonly act?: string;
  readonly roles?: readonly string[];
}

/** A job answered: how many records, and which, in its order. */
export interface JobAnswer {
  readonly count: number;
  readonly ids: readonly string[];
}

/**
 * THE APP'S JOBS, RESOLVED, in the order declared. A job over a kind the app
 * does not have is left out: the checker says so (`job-kind`), and nothing
 * could answer it.
 */
export function jobsOf<S extends AnySchema>(app: GraviewApp<S>): readonly ResolvedJob[] {
  const kinds = new Set(app.schema.kinds as readonly string[]);
  // A document compiled without the checker reads its purpose loosely: what is not a job is no job.
  const declared: readonly JobDeclaration[] = Array.isArray(app.purpose?.jobs) ? app.purpose.jobs : [];
  return declared.flatMap((job): ResolvedJob[] => {
    if (typeof job !== "object" || job === null || typeof job.name !== "string" || typeof job.ask !== "string" || !kinds.has(job.kind)) return [];
    const sort = gridSortOf(job.sort);
    return [
      {
        name: job.name,
        ask: job.ask,
        kind: job.kind,
        plural: pluralOf(app.schema, job.kind),
        ...(job.where !== undefined ? { where: job.where } : {}),
        ...(sort ? { sort } : {}),
        ...(job.act !== undefined ? { act: job.act } : {}),
        ...(job.roles && job.roles.length > 0 ? { roles: [...job.roles] } : {}),
      },
    ];
  });
}

/** The jobs a seat holding these roles comes to do: the ones naming one of its roles, and the ones naming none. */
export function jobsFor<J extends { readonly roles?: readonly string[] }>(jobs: readonly J[], principal: Pick<Principal, "roles">): readonly J[] {
  return jobs.filter((job) => jobIsFor(job, principal.roles));
}

const PARSED = new Map<string, Expr | null>();
/** An expression parsed once; one that does not parse is null (the checker said why). */
function parsed(source: string): Expr | null {
  if (!PARSED.has(source)) {
    try {
      PARSED.set(source, parseExpr(source));
    } catch (e) {
      if (!(e instanceof ExprSyntaxError)) throw e;
      PARSED.set(source, null);
    }
  }
  return PARSED.get(source)!;
}

/** Whether a value the language gives counts as yes. */
const holds = (value: Value): boolean => (value instanceof NodeSet ? value.nodes.length > 0 : Array.isArray(value) ? value.length > 0 : Boolean(value));

/** A value to order by: a record as its name, a set as how many. */
const orderable = (schema: AnySchema, value: Value): unknown =>
  value instanceof NodeSet ? value.nodes.length : value !== null && typeof value === "object" && !Array.isArray(value) ? labelOf(schema.tryDefinition((value as AnyGraphNode).kind), value as AnyGraphNode) : value;

/**
 * A JOB ANSWERED AS THIS SEAT SEES IT: the live records of its kind the seat
 * may see, those its `where` holds for (each read under the language's
 * budget; one it cannot be read for is not counted), in its order — by a
 * field, a computed field or `label`, the ones with none last — and their
 * ids. A kind kept from the seat answers nothing; so does a `where` that
 * does not parse.
 */
export function answerJob<S extends AnySchema>(given: Store<S>, job: Pick<JobDeclaration, "kind" | "where" | "sort">, principal: Principal): JobAnswer {
  const store = given as unknown as Store<AnySchema>;
  if (store.kindsKeptFrom(principal).has(job.kind) || !store.schema.tryDefinition(job.kind)) return { count: 0, ids: [] };
  const seen = store.seenBy(principal);
  const graph = seen.graph as unknown as GraphReader & { nodesOfKind(kind: string): AnyGraphNode[] };
  const schema = seen.schema;
  const kinds = shapesFor(schema);
  const today = seen.today?.();
  const read = (expr: Expr, node: AnyGraphNode): Value => evaluateExpr(expr, { graph, subject: node, kinds, ...(today ? { today } : {}) });
  const where = job.where === undefined ? undefined : parsed(job.where);
  if (where === null) return { count: 0, ids: [] };
  const records = graph.nodesOfKind(job.kind).filter((node) => {
    if (!where) return true;
    try {
      return holds(read(where, node));
    } catch (e) {
      if (!(e instanceof ExprEvalError)) throw e;
      return false;
    }
  });
  const sort = gridSortOf(job.sort);
  const key = sort && sort.by !== "label" ? parsed(sort.by) : undefined;
  const ordered = !sort
    ? records
    : sortForGrid(records, sort, (node) => {
        if (sort.by === "label") return labelOf(schema.tryDefinition(node.kind), node);
        if (!key) return undefined;
        try {
          return orderable(schema, read(key, node));
        } catch (e) {
          if (!(e instanceof ExprEvalError)) throw e;
          return undefined;
        }
      });
  const ids = ordered.map((node) => node.id);
  return { count: ids.length, ids };
}
