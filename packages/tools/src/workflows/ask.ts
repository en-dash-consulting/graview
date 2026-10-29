import type { AnySchema, Author, MutationCall, Operation, Principal, Store, Via } from "@graview/core";
import { declined, proposalWords, suggest, suggestions, withdrawSuggestion } from "@graview/core/tidying";
import type { ChangeOutcome, StepChange } from "./types.js";

/*
 * ASKED, AS ONE (Roadmap f-job-approvals): what a run whose changes are to
 * be approved first would change, gathered for a person — ONE suggestion
 * per run, said as a whole ("Fill out next week's events: 28 events to
 * add, 3 to change, 1 to archive"), each change in it its own act's
 * sentence (`suggestsSaid`), so the Suggested tray lists them and a person
 * accepts them all, some, or declines the rest. Its lineage names the run.
 *
 * Each change is rehearsed as it is asked: one the store would refuse is
 * refused there and then, one that would change nothing is not asked, and
 * one a person already declined is let go — never asked again. When the run
 * closes, its group replaces the one the workflow's last run left waiting
 * (withdrawn, which is no decline); a group that asks exactly what still
 * waits is the one that waits.
 */

export interface AskedOptions {
  readonly store: Store<AnySchema>;
  readonly principal: Author;
  readonly run: string;
  readonly workflow: { readonly name: string; readonly title: string };
  readonly via?: Via;
}

export interface Asked {
  /** One change to ask about: rehearsed now, asked when the run closes. */
  add(change: StepChange): ChangeOutcome;
  /** The run is over: the op that holds what was asked, when anything was. */
  close(): string | undefined;
}

const said = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function askedOf(options: AskedOptions): Asked {
  const { store, principal, workflow } = options;
  const actor = `workflow:${workflow.name}`.slice(0, 120);
  const calls: MutationCall[] = [];
  const bases: string[] = [];
  return {
    add(change) {
      if (declined(store, change.calls)) return { as: "dropped" };
      try {
        if (store.previewAll(change.calls, { author: principal }).ops.length === 0) return { as: "unchanged" };
      } catch (error) {
        return { as: "refused", error: said(error) };
      }
      calls.push(...change.calls);
      bases.push(change.basis);
      return { as: "suggested" };
    },
    close() {
      const before = suggestions(store).filter((one) => one.lineage?.actor === actor && one.author.id === principal.id);
      if (calls.length === 0) return undefined;
      const preview = store.previewAll(calls, { author: principal });
      const headline = proposalWords(store.schema, store.graph, preview.ops, workflow.title);
      const basis = (new Set(bases).size === 1 ? bases[0]! : `What “${workflow.title}” would change, asked as one`).slice(0, 500);
      const op: Operation | undefined = suggest(store, calls, { author: principal, lineage: { basis, run: options.run.slice(0, 120), actor }, intent: headline, ...(options.via ? { via: options.via } : {}) });
      if (!op) return undefined;
      // The last run's group stands no longer: this run's says what is still to do.
      for (const old of before) if (old.id !== op.id) withdrawSuggestion(store, old.id, { author: principal as Principal });
      return op.id;
    },
  };
}

