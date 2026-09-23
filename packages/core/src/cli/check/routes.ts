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

export function checkRoutes<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  /*
   * The routed face derives `/:plural` from each kind's plural. Two kinds
   * whose plurals slug identically would leave one of them unreachable by
   * registration order — a route nobody can link to.
   */
  const slugs = new Map<string, string>();
  for (const definition of app.schema.definitions) {
    const plural = definition.plural ?? `${definition.kind}s`;
    const slug = plural.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const taken = slugs.get(slug);
    if (taken) {
      add({
        severity: "error",
        code: "plural-slug-collision",
        where: `defineNode("${definition.kind}").plural`,
        message: `"${plural}" slugs to "/${slug}", already taken by kind "${taken}".`,
        fix: `Give one of them a distinct plural.`,
      });
    } else {
      slugs.set(slug, definition.kind);
    }
  }

  /*
   * A declared provider's allowlist must name real mutations — a metering
   * or narrowing rule pointing at nothing enforces nothing.
   */
}
