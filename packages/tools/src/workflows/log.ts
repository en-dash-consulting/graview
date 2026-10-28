import type { WorkflowLog, WorkflowRun } from "./types.js";

/** A log of runs kept in this process, the newest `limit` (200 when unsaid) of each workflow: for a test, a script, a dev server. */
export function memoryWorkflowLog(limit = 200): WorkflowLog {
  const kept = new Map<string, WorkflowRun[]>();
  return {
    last: (name) => kept.get(name)?.at(-1),
    add(run) {
      const runs = kept.get(run.workflow) ?? [];
      runs.push(run);
      if (runs.length > limit) runs.splice(0, runs.length - limit);
      kept.set(run.workflow, runs);
    },
    runs: (name, most) => [...(kept.get(name) ?? [])].reverse().slice(0, most ?? Infinity),
  };
}
