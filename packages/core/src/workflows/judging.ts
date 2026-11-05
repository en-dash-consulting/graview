import type { FarAppResolver } from "./far.js";

/*
 * WHERE AN EDIT FINDS THE WORKFLOW CHECKER. `editDocument` is on a page,
 * and the checker — the shapes of every step kind, the schedule reader, the
 * rule reader — is not: it fills this slot as it loads
 * (`./findings.ts`, which `@graview/core/check` and
 * `@graview/core/workflows` both bring), and an edit asks it when it is
 * there. Without it, an edit keeps a workflow that is shaped as one and
 * leaves the rest to `graview check`. One slot per realm, as `VOTING` is.
 */

/** A workflow judged for an edit: what refuses it, what is said of it, and its line. */
export interface WorkflowJudged {
  readonly errors: readonly { readonly code: string; readonly path: string; readonly message: string; readonly fix: string }[];
  readonly warnings: readonly string[];
  /** "Every day at 3 AM, one step": how the edit says it. */
  readonly said: string;
}

export interface WorkflowJudging {
  /** `options.resolveFarApp`: what the host knows of another app a step names (`EditOptions.resolveFarApp`). */
  judge?: (name: string, workflow: unknown, document: unknown, options?: { readonly resolveFarApp?: FarAppResolver }) => WorkflowJudged;
}

export const WORKFLOW_JUDGING: WorkflowJudging = ((globalThis as Record<symbol, WorkflowJudging | undefined>)[Symbol.for("@graview/core:workflow-judging")] ??= {});
