import { appAliasFindings } from "../../alias-findings.js";
import { documentOf } from "../../document/to-document.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/**
 * A KIND'S AND A FIELD'S OTHER WORDS, HELD TO THE DECLARATION (Roadmap
 * f-learned-suggestions): `defineNode({ aliases, fieldAliases })` is asked
 * what a document's `aliases` are asked, in the same words and codes
 * (`alias-taken`, `alias-field`). A document's are judged at its own paths
 * (`compileDocument`), so an app compiled from one is not asked twice.
 */
export function checkAliases<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  if (documentOf(app)) return;
  for (const finding of appAliasFindings(app)) add({ severity: "error", code: finding.code, where: finding.where, message: finding.message, fix: finding.fix });
}
