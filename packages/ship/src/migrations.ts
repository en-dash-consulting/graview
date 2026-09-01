import {
  invert,
  writesOf,
  type GraviewApp,
  type AnySchema,
  type MigrationDeclaration,
  type Operation,
  type Primitive,
} from "@graview/core";
import type { GraphSnapshot } from "./snapshot.js";
import { applyToSnapshot } from "./snapshot.js";

/**
 * MIGRATIONS SPEAK THE OP LOG'S LANGUAGE.
 *
 * A migration answers with primitives — the same five words every other
 * change is made of — and running one appends ordinary operations: authored
 * (`system · ship:migration`), stating their intent, carrying their inverse
 * because a patch carries its before. Schema evolution is therefore not a
 * special ceremony outside the record; it IS the record, replayable and
 * undoable in the same vocabulary as a person's edit.
 */

export interface MigrationRun {
  readonly snapshot: GraphSnapshot;
  readonly version: number;
  /** The operations the run appended — empty when already current. */
  readonly ops: readonly Operation[];
}

/** The single-step chain from a stored version to the declaration's. */
export function pendingMigrations<S extends AnySchema>(
  app: GraviewApp<S>,
  storedVersion: number,
): readonly MigrationDeclaration[] {
  const target = app.version ?? storedVersion;
  const bySource = new Map((app.migrations ?? []).map((m) => [m.from, m]));
  const chain: MigrationDeclaration[] = [];
  let at = storedVersion;
  while (at < target) {
    const step = bySource.get(at);
    if (!step) {
      throw new Error(
        `No migration from version ${at} — a stored graph there cannot reach ${target}. ` +
          `graview check would have said so.`,
      );
    }
    chain.push(step);
    at = step.to;
  }
  return chain;
}

/**
 * Runs the chain over a stored snapshot, producing the migrated snapshot
 * and the operations that record the run. Pure: nothing is written here —
 * the caller (openStore, a service's fleet upgrader) owns the append and
 * can therefore halt, stage, or roll back.
 */
export function migrateSnapshot<S extends AnySchema>(
  app: GraviewApp<S>,
  stored: GraphSnapshot,
  storedVersion: number,
  options: { readonly now?: () => string; readonly nextOpId?: (step: string) => string } = {},
): MigrationRun {
  const now = options.now ?? (() => new Date().toISOString());
  const nextOpId = options.nextOpId ?? ((step: string) => `migration:${step}:${now()}`);
  let snapshot = stored;
  const ops: Operation[] = [];
  const batch = `migration:${storedVersion}->${app.version ?? storedVersion}`;

  for (const step of pendingMigrations(app, storedVersion)) {
    const primitives: readonly Primitive[] = step.apply(snapshot);
    snapshot = applyToSnapshot(snapshot, primitives);
    ops.push({
      id: nextOpId(`${step.from}-${step.to}`),
      seq: -1, // The appender assigns the real position in its log.
      batch,
      author: { kind: "system", id: "ship:migration" },
      intent: `migration ${step.from}→${step.to}: ${step.title}`,
      mutation: null,
      primitives,
      inverse: [...primitives].reverse().map(invert),
      reads: [],
      writes: [...new Set(primitives.flatMap(writesOf))],
      at: now(),
    });
  }

  return { snapshot, version: app.version ?? storedVersion, ops };
}
