import type { AnySchema, Author, Store, Via } from "@graview/core";
import { suggest } from "@graview/core/tidying";
import type { ChangeOutcome, StepChange } from "./types.js";

/*
 * ASKED, AS ONE (Roadmap f-job-approvals): what a run whose changes are to
 * be approved first would change, gathered for a person. The foundation's
 * placeholder suggests each change as it comes; W4
 * (feat/workflow-retain-approve) gathers them into one grouped suggestion
 * per run, closed once at the end.
 */

export interface AskedOptions {
  readonly store: Store<AnySchema>;
  readonly principal: Author;
  readonly run: string;
  readonly workflow: { readonly name: string; readonly title: string };
  readonly via?: Via;
}

export interface Asked {
  /** One change to ask about. */
  add(change: StepChange): ChangeOutcome;
  /** The run is over: the op that holds what was asked, when one does. */
  close(): string | undefined;
}

export function askedOf(options: AskedOptions): Asked {
  return {
    add(change) {
      const lineage = { basis: change.basis, run: options.run, actor: `workflow:${options.workflow.name}`, ...(change.confidence !== undefined ? { confidence: change.confidence } : {}), ...(change.model ? { model: change.model } : {}), ...(change.key ? { key: change.key } : {}) };
      const op = suggest(options.store, change.calls, { author: options.principal, lineage, ...(options.via ? { via: options.via } : {}) });
      return { as: "suggested", ...(op ? { op: op.id } : {}) };
    },
    close: () => undefined,
  };
}
