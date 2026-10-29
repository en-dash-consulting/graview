import type { GraviewApp } from "../app.js";
import { subjectKindsOf } from "../mutations/derive-edits.js";
import type { AppWorkflows } from "../workflow-shape.js";
import type { AnySchema } from "../schema/schema.js";

/*
 * A WORKFLOW ON THE MAP (Roadmap f-jobs-declared, the Scene's part). From
 * altitude the Scene stands each kind on its plot; a workflow is the app's
 * own actor at work on some of them, so it stands in the street beside the
 * district it writes, wired to every kind it reads and writes — what its
 * steps name, nothing guessed. Paused, it is drawn dimmed; given the host's
 * log, it says how its last run went (`lastRunWords`). Declaration only —
 * no graph, no window — so a test and the live Scene agree on where each
 * one stands.
 *
 * Read off the steps as they are written, never through `STEP_KINDS`: the
 * Scene draws this, and the step kinds' shapes and checkers are the
 * document compiler's, which a page that draws an app never loads. A step
 * reads the kind it runs `over`, the kinds it `reads`, the kinds it makes
 * records `from`; it writes the kinds the acts it runs (`act`, `acts`) act
 * on and make, the kind it makes records of (`generate`) and the kind it
 * sets aside (`archive`) or labels (`classify`), which it reads too.
 */

/** A workflow as the Scene draws it: its name, title and status, and the kinds it reads and writes. */
export interface MapWorkflow {
  readonly name: string;
  readonly title: string;
  readonly status: "active" | "paused";
  /** Kinds its steps read, and what starts it on a change, in the order they say them. */
  readonly reads: readonly string[];
  /** Kinds its steps may write. */
  readonly writes: readonly string[];
}

/** An act as the map reads it: the kinds it acts on and the kinds it makes. */
export interface MapAct {
  readonly name: string;
  readonly subject?: { readonly kinds: readonly string[] | "*" } | undefined;
  readonly creates?: readonly string[] | undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): string[] => (typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : []);

/**
 * Every workflow the app declares (`declaredWorkflows(app)`, or a
 * compiled app's document's `workflows`), as the Scene draws it, in
 * declared order, given every act the app has (`store.allMutations()`: the derived
 * ones too). Dreaming, built in and at work on every district, is not drawn.
 */
export function workflowsOnTheMap<S extends AnySchema>(app: Pick<GraviewApp<S>, "schema">, workflows: AppWorkflows | undefined, acts: readonly MapAct[]): readonly MapWorkflow[] {
  const declared = Object.entries(workflows ?? {});
  if (declared.length === 0) return [];
  const kinds = new Set(app.schema.kinds as readonly string[]);
  const byName = new Map(acts.map((act) => [act.name, act]));
  const actKinds = (name: string): string[] => {
    const act = byName.get(name);
    return act ? [...subjectKindsOf(app.schema, act as never), ...(act.creates ?? [])] : [];
  };
  return declared.map(([name, workflow]) => {
    const reads: string[] = [];
    const writes: string[] = [];
    // What starts it on a change reads that kind: a workflow run when a grocery list is made is wired to grocery lists.
    for (const trigger of (workflow.when ?? []) as unknown as readonly Record<string, unknown>[]) reads.push(...strings(trigger["made"]), ...strings(trigger["changed"]));
    for (const step of (workflow.steps ?? []) as unknown as readonly Record<string, unknown>[]) {
      const over = isRecord(step["over"]) ? strings(step["over"]["kind"]) : [];
      const from = Array.isArray(step["from"]) ? step["from"].flatMap((source) => (isRecord(source) ? strings(source["kind"]) : [])) : [];
      reads.push(...over, ...strings(step["reads"]), ...from, ...strings(step["archive"]), ...strings(step["classify"]));
      writes.push(...[...strings(step["act"]), ...strings(step["acts"])].flatMap(actKinds), ...strings(step["generate"]), ...strings(step["archive"]), ...strings(step["classify"]));
    }
    const known = (list: readonly string[]) => [...new Set(list)].filter((kind) => kinds.has(kind));
    return { name, title: workflow.title, status: workflow.status === "paused" ? "paused" : "active", reads: known(reads), writes: known(writes) };
  });
}

/** A plot as a spot is found beside it: its corner cell and its side, in lattice cells. */
export interface SpotPlot {
  readonly col: number;
  readonly row: number;
  readonly side: number;
}

/** Where a workflow stands on the lattice: the kind it stands beside, and the point, in lattice cells. */
export interface WorkflowSpot {
  readonly name: string;
  /** The district it stands beside: the first kind it writes that is on the map, else the first it reads. */
  readonly beside: string;
  readonly col: number;
  readonly row: number;
}

/**
 * WHERE EACH WORKFLOW STANDS: in the street along the right edge of the
 * district it writes first — a cell out from the curb, down the edge, a
 * cell apart for a second and a third beside the same district — so it
 * reads as at work on that district and never stands on any district's
 * ground. One that touches no kind on the map is not placed.
 */
export function workflowSpots(workflows: readonly MapWorkflow[], plots: ReadonlyMap<string, SpotPlot>): readonly WorkflowSpot[] {
  const taken = new Map<string, number>();
  const out: WorkflowSpot[] = [];
  for (const workflow of workflows) {
    const beside = [...workflow.writes, ...workflow.reads].find((kind) => plots.has(kind));
    if (beside === undefined) continue;
    const plot = plots.get(beside)!;
    const k = taken.get(beside) ?? 0;
    taken.set(beside, k + 1);
    out.push({ name: workflow.name, beside, col: plot.col + plot.side + 1, row: plot.row + 0.5 + k });
  }
  return out;
}

/** How many records a run made, changed, set aside or suggested: the ids, or only how many there were. */
export type RunCount = number | readonly string[];

/**
 * A run as `lastRunWords` reads it: `WorkflowRun` from
 * `@graview/tools/workflows`, or any record with these. Each of `made`,
 * `changed`, `archived` and `suggested` is the ids or a count; a host that
 * keeps only counts sends the numbers, and the words are the same.
 */
export interface RunSaid {
  readonly finished: string;
  readonly outcome: "ok" | "nothing-new" | "partial" | "held" | "failed";
  readonly dry: boolean;
  readonly made: RunCount;
  readonly changed: RunCount;
  readonly archived: RunCount;
  readonly suggested: RunCount;
}

/** How many a count says: the number, or how many ids it holds. Anything else is none. */
export const runCount = (count: RunCount | undefined): number => (typeof count === "number" ? (Number.isFinite(count) && count > 0 ? Math.floor(count) : 0) : Array.isArray(count) ? count.length : 0);

/** "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago": how long before `now` a moment was. */
export function agoWords(at: string | number | Date, now: string | number | Date = Date.now()): string {
  const minutes = Math.floor((new Date(now).getTime() - new Date(at).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/**
 * HOW THE LAST RUN WENT, in words a person reads under a workflow on the
 * map: "Last ran 2 hours ago: made 28, changed 3", "Last ran yesterday:
 * nothing new", "Last ran 5 minutes ago, as a dry run: would make 4",
 * "Last ran 3 days ago and failed". With no run, "Has not run yet".
 */
export function lastRunWords(run: RunSaid | undefined, now: string | number | Date = Date.now()): string {
  if (!run) return "Has not run yet";
  const when = `Last ran ${agoWords(run.finished, now)}`;
  if (run.outcome === "failed") return `${when} and failed`;
  if (run.outcome === "held") return `${when}: held back`;
  const counts = [
    [runCount(run.made), run.dry ? "would make" : "made"],
    [runCount(run.changed), run.dry ? "would change" : "changed"],
    [runCount(run.archived), run.dry ? "would set aside" : "set aside"],
    [runCount(run.suggested), run.dry ? "would suggest" : "suggested"],
  ] as const;
  const said = counts.filter(([count]) => count > 0).map(([count, verb]) => `${verb} ${count}`);
  const what = said.length > 0 ? said.join(", ") : "nothing new";
  return `${when}${run.dry ? ", as a dry run" : ""}: ${what}${run.outcome === "partial" ? " (part of it did not run)" : ""}`;
}
