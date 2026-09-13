import { checkApp, Store, type AnySchema, type Batch, type CheckResult, type GraphSnapshot, type GraviewApp, type MigrationDeclaration, type MutationCall, type Principal } from "@graview/core";
import { declarationToGraph } from "./from-declaration.js";
import { migrationBetween } from "./migration.js";
import { studioApp, type StudioSchema } from "./meta.js";
import { declarationFiles, type SourceOptions, type WrittenFile } from "./source.js";
import { graphToDeclaration } from "./to-declaration.js";

/*
 * A STUDIO OVER ONE APP. The app's declaration is read into a store of the
 * meta-schema; the ordinary acts change it; the checker judges what it
 * would become; applying hands back the new app and the migration a stored
 * graph would need; the files are what `graview create` writes. An agent
 * seat proposes by acting — its batches are the proposals — and a person
 * accepts by applying or declines by undoing, the same way any turn of an
 * agent's is kept or taken back.
 */

export interface Studio<S extends AnySchema = AnySchema> {
  /** The store the interface edits: the declaration as a graph. */
  readonly store: Store<StudioSchema>;
  /** The app the studio opened on. */
  readonly base: GraviewApp<S>;
  /** The declaration as it now stands, runnable and checkable. */
  declaration(): GraviewApp<AnySchema>;
  /** What `graview check` says about the declaration as it now stands. */
  check(): CheckResult;
  /** Batches applied since the studio opened — every change, with its author and intent. */
  changes(): readonly Batch[];
  /** The changes an agent seat made and nobody has taken back. */
  proposals(): readonly Batch[];
  /** An agent's proposed change: applied under its seat, in a batch of its own, so a person can keep or take it back. */
  propose(call: MutationCall, agent: Principal, intent?: string): { readonly batch: string; readonly ok: true } | { readonly ok: false; readonly reason: string };
  /** Take a proposal back. */
  decline(batch: string): boolean;
  /**
   * WHAT THE CHECKER WOULD SAY IF THIS CALL WERE MADE — without making it.
   *
   * A proposal a person is shown has to be judged BEFORE they are asked to
   * keep it: a change that would fail the build is not a choice, it is a
   * trap. The call is applied to a copy of the store and the copy's
   * declaration is checked, so the real declaration is untouched whatever
   * the answer is — and a call the store itself refuses comes back as a
   * refusal in the store's own words rather than as a thrown error.
   */
  would(call: MutationCall): { readonly ok: true; readonly check: CheckResult } | { readonly ok: false; readonly reason: string };
  /** The new app and, where a stored graph needs one, the migration to it. Refused while the checker finds errors. */
  apply(): { readonly ok: true; readonly app: GraviewApp<AnySchema>; readonly migration: MigrationDeclaration | null } | { readonly ok: false; readonly check: CheckResult };
  /** The declaration as the files `graview create` writes. */
  files(options?: SourceOptions): readonly WrittenFile[];
}

export interface StudioOptions {
  readonly name?: string;
  readonly principal?: Principal;
}

export function createStudio<S extends AnySchema>(base: GraviewApp<S>, options: StudioOptions = {}): Studio<S> {
  const app = studioApp(options.name ?? `${base.name} studio`);
  const seed = declarationToGraph(base as unknown as GraviewApp<AnySchema>) as GraphSnapshot;
  const store = new Store<StudioSchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    snapshot: seed as never,
    ...(options.principal ? { principal: options.principal } : {}),
  } as never);
  const opened = store.batches().length;
  const declaration = () => graphToDeclaration(store.snapshot() as GraphSnapshot, { base: base as unknown as GraviewApp<AnySchema>, name: base.name });
  const isAgent = (batch: Batch) => batch.author.kind === "agent";
  let proposed = 0;
  return {
    store,
    base,
    declaration,
    check: () => checkApp(declaration()),
    changes: () => store.batches().slice(opened),
    proposals: () => store.batches().slice(opened).filter((batch) => isAgent(batch) && !batch.undone),
    propose(call, agent, intent) {
      const batch = `proposal:${++proposed}`;
      try {
        store.apply(call, { author: agent, batch, intent: intent ?? `Proposed: ${call.name}` });
        return { ok: true, batch };
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
      }
    },
    decline(batch) {
      if (!store.canUndo(batch).ok) return false;
      store.undo(batch);
      return true;
    },
    would(call) {
      const trial = new Store<StudioSchema>({
        schema: app.schema,
        mutations: app.mutations ?? [],
        invariants: app.invariants ?? [],
        snapshot: store.snapshot() as never,
        ...(options.principal ? { principal: options.principal } : {}),
      } as never);
      try {
        trial.apply(call, { intent: `Would: ${call.name}` });
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
      }
      return {
        ok: true,
        check: checkApp(
          graphToDeclaration(trial.snapshot() as GraphSnapshot, { base: base as unknown as GraviewApp<AnySchema>, name: base.name }),
        ),
      };
    },
    apply() {
      const next = declaration();
      const check = checkApp(next);
      if (check.errors > 0) return { ok: false, check };
      const migration = migrationBetween(base as unknown as GraviewApp<AnySchema>, store.snapshot() as GraphSnapshot);
      const version = migration ? migration.to : base.version;
      return {
        ok: true,
        app: {
          ...next,
          ...(version !== undefined ? { version } : {}),
          ...(migration ? { migrations: [...(base.migrations ?? []), migration] } : {}),
        },
        migration,
      };
    },
    files: (sourceOptions) =>
      declarationFiles(store.snapshot() as GraphSnapshot, { name: base.name, base: base as unknown as GraviewApp<AnySchema>, ...sourceOptions }),
  };
}
