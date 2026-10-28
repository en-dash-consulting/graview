import type { GraviewApp } from "../app.js";
import type { AnySchema } from "../schema/schema.js";
import type { WorkflowStep } from "../workflow-shape.js";
import { stepKindOf } from "./steps.js";
import { workflowReach } from "./resolve.js";
import { workflowWorldOfApp } from "./world.js";

/*
 * A WORKFLOW ON THE MAP (Roadmap f-jobs-declared, the Scene's part). From
 * altitude the Scene stands each kind on its plot; a workflow is the app's
 * own actor at work on some of them, so it stands in the street beside the
 * district it writes, wired to every kind it reads and writes — what its
 * steps say they touch (`STEP_KINDS`' `touches`), nothing guessed. Paused,
 * it is drawn dimmed; given the host's log, it says how its last run went
 * (`lastRunWords`). Declaration only — no graph, no window — so a test, a
 * thumbnail and the live Scene agree on where each one stands.
 */

/** A workflow as the Scene draws it: its name, title and status, the kinds it reads and writes, and its steps in a line each. */
export interface MapWorkflow {
  readonly name: string;
  readonly title: string;
  readonly status: "active" | "paused";
  /** Kinds its steps read, in the order they say them. */
  readonly reads: readonly string[];
  /** Kinds its steps may write — the kinds their acts act on and make. */
  readonly writes: readonly string[];
  /** Its steps, one line each, as the checker and `describe` say them. */
  readonly steps: readonly string[];
}

/** Every workflow the app declares, as the Scene draws it, in declared order: dreaming, built in and at work on every district, is not drawn. */
export function workflowsOnTheMap<S extends AnySchema>(app: GraviewApp<S>): readonly MapWorkflow[] {
  const declared = Object.entries(app.workflows ?? {});
  if (declared.length === 0) return [];
  const world = workflowWorldOfApp(app);
  const kinds = new Set(app.schema.kinds as readonly string[]);
  return declared.map(([name, workflow]) => {
    const steps = (workflow.steps ?? []) as readonly WorkflowStep[];
    const reach = workflowReach(steps, world);
    // What starts it on a change reads that kind too: a workflow run when a grocery list is made is wired to grocery lists.
    const started = (workflow.when ?? []).flatMap((trigger) => ("made" in trigger ? [trigger.made] : "changed" in trigger ? [trigger.changed] : []));
    const reads = [...new Set([...reach.reads, ...started])].filter((kind) => kinds.has(kind));
    const writes = reach.writes.filter((kind) => kinds.has(kind));
    const said = steps.flatMap((step) => {
      const kind = stepKindOf(step);
      return kind ? [kind.words(step)] : [];
    });
    return { name, title: workflow.title, status: workflow.status === "paused" ? "paused" : "active", reads, writes, steps: said };
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

/** A run as `lastRunWords` reads it: `WorkflowRun` from `@graview/tools/workflows`, or any record with these. */
export interface RunSaid {
  readonly finished: string;
  readonly outcome: "ok" | "nothing-new" | "partial" | "held" | "failed";
  readonly dry: boolean;
  readonly made: readonly string[];
  readonly changed: readonly string[];
  readonly archived: readonly string[];
  readonly suggested: readonly string[];
}

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
    [run.made.length, run.dry ? "would make" : "made"],
    [run.changed.length, run.dry ? "would change" : "changed"],
    [run.archived.length, run.dry ? "would set aside" : "set aside"],
    [run.suggested.length, run.dry ? "would suggest" : "suggested"],
  ] as const;
  const said = counts.filter(([count]) => count > 0).map(([count, verb]) => `${verb} ${count}`);
  const what = said.length > 0 ? said.join(", ") : "nothing new";
  return `${when}${run.dry ? ", as a dry run" : ""}: ${what}${run.outcome === "partial" ? " (part of it did not run)" : ""}`;
}
