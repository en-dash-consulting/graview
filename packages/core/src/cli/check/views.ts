import { validateViewSpecs } from "../../document/views.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/**
 * VIEWS AS DATA, HELD TO THE DECLARATION (FR-03).
 *
 * A view spec names fields, relations and tones, and every one of those
 * names is a promise about the schema: a card that shows `{quote}` on a
 * kind with no quote draws "—" for ever, and `"tone": "green"` is a colour
 * the kit does not have. The document path refuses both before it
 * compiles; a TypeScript declaration is asked the same questions here, in
 * the same words, at the same paths (`viewSpecs.<kind>.<slot>.<block>`).
 */
export function checkViewSpecs<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  // A home view and the lenses drawn from blocks are held to the same words (FR-81).
  const blockLenses = (app.lenses ?? []).some((lens) => lens.name === "blocks");
  if (!app.viewSpecs && app.home === undefined && !blockLenses) return;
  const findings = validateViewSpecs(app.schema, app.viewSpecs, {
    ...(app.brand?.figures ? { figures: app.brand.figures } : {}),
    ...(app.home !== undefined ? { home: app.home } : {}),
    ...(blockLenses ? { lenses: app.lenses } : {}),
  });
  for (const finding of findings) {
    add({
      severity: finding.severity,
      code: finding.code,
      where: finding.path,
      message: finding.message,
      fix: finding.fix ?? "Name a field, relation or tone the declaration has, or take the block out.",
    });
  }
}
