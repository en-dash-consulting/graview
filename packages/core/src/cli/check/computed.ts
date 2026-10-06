import { computedOf, validateComputed, type ComputedKind } from "../../document/computed.js";
import { documentOf } from "../../document/to-document.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/**
 * COMPUTED FIELDS, HELD TO THE DECLARATION (FR-83).
 *
 * `defineNode({ computed: { net: "…" } })` is asked what a document's
 * `kinds.<kind>.computed` is asked, in the same words: a name that is
 * already a field or relation, an expression that does not parse or names
 * nothing the kind has, a cycle among the kind's computed fields, and work
 * that grows faster than a page can afford. A document's are judged when it
 * is read, at its own paths, so an app compiled from one is not asked twice.
 */
export function checkComputed<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  if (documentOf(app)) return;
  const kinds = new Map<string, ComputedKind>();
  for (const kind of app.schema.kinds as readonly string[]) {
    const definition = app.schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> }; edges?: Record<string, unknown> } & Parameters<typeof computedOf>[0];
    kinds.set(kind, { fields: new Set(Object.keys(definition?.fields?.shape ?? {})), edges: new Set(Object.keys(definition?.edges ?? {})), computed: computedOf(definition) });
  }
  if (![...kinds.values()].some((k) => k.computed.size > 0)) return;
  for (const finding of validateComputed(kinds, (kind, name) => `defineNode("${kind}").computed.${name}`)) {
    add({
      severity: finding.severity,
      code: finding.code,
      where: finding.path,
      message: finding.message,
      fix: finding.fix ?? "Work it out from the kind's own fields and relations, in the rule language.",
    });
  }
}
