import type { AnySchema } from "../../schema/schema.js";

/**
 * `note` is a QUESTION ASKED OUT LOUD, not a problem.
 *
 * Some things a checker can see are legitimate designs that the author
 * should nonetheless have looked at once: a lens written for this app and
 * never proved against another domain, a role name two vocabularies both
 * use, a kind unreachable on an empty graph. Filed as warnings they would
 * be warnings that can only ever be acknowledged, and those are the ones
 * people learn to scroll past — which costs the checker its authority on
 * the warnings that matter. So they have their own voice: counted, printed,
 * and never a failure.
 */
import type { CheckContext } from "./context.js";

export function checkMigrations<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  /*
   * The migration chain must actually reach the declared version. A stored
   * graph at version 1 with a declaration at 3 and a hole at 2 is a
   * deployment that cannot start — findable here instead of there.
   */
  if (app.version !== undefined) {
    const steps = new Map((app.migrations ?? []).map((m) => [m.from, m]));
    for (const migration of app.migrations ?? []) {
      if (migration.to !== migration.from + 1) {
        add({
          severity: "error",
          code: "migration-not-single-step",
          where: `migrations[${migration.from}→${migration.to}]`,
          message: `Migrations move one version at a time; this one jumps ${migration.from}→${migration.to}.`,
          fix: `Split it into single steps so any stored version has a path.`,
        });
      }
    }
    for (let at = 1; at < app.version; at++) {
      if (!steps.has(at)) {
        add({
          severity: "error",
          code: "migration-gap",
          where: `defineApp("${app.name}").migrations`,
          message: `No migration from version ${at}, so a graph stored at ${at} cannot reach ${app.version}.`,
          fix: `Declare a migration { from: ${at}, to: ${at + 1}, ... }.`,
        });
      }
    }
  } else if ((app.migrations ?? []).length > 0) {
    add({
      severity: "error",
      code: "migration-without-version",
      where: `defineApp("${app.name}").version`,
      message: `Migrations are declared but the app declares no version to migrate to.`,
      fix: `Declare version: <n> alongside the migrations.`,
    });
  }
}
