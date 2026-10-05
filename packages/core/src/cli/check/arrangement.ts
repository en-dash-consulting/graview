import { admitArrangement, arrangeable, parseArrangement } from "../../arrange.js";
import type { AnySchema } from "../../schema/schema.js";
import { bindsOf } from "../../places.js";
import type { CheckContext } from "./context.js";

/**
 * WHAT A KIND SAYS IT IS ARRANGED BY has to be something it has.
 *
 * `fieldRoles.order` names the field a kind sorts by when nothing is asked;
 * a lens's `arrangedBy` names how its picture opens. Both are strings in a
 * declaration that nothing else reads until a person is looking, so a
 * renamed field would leave a picture quietly opening unsorted. The
 * arrangement module already knows what each kind offers; this asks it.
 */
export function checkArrangement<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  for (const definition of app.schema.definitions) {
    const order = definition.fieldRoles?.["order"];
    if (order === undefined) continue;
    const shape = (definition.fields.shape ?? {}) as Record<string, unknown>;
    if (order === "label" || order in shape) continue;
    add({
      severity: "warning",
      code: "order-role-unknown",
      where: `defineNode("${definition.kind}").fieldRoles.order`,
      message: `"${definition.kind}" says it sorts by "${order}", and has no such field — so nothing sorts it.`,
      fix: `Point order at one of ${Object.keys(shape).join(", ") || "its fields"}, or drop it.`,
    });
  }
  for (const lens of app.lenses ?? []) {
    if (!lens.arrangedBy) continue;
    /*
     * The kinds a lens is bound over: the keys of a fields binding, or the
     * kinds an entities binding names. An arrangement is admitted against
     * each; what none of them offers is noted.
     */
    const bound = new Set<string>();
    for (const [key, binding] of Object.entries(lens.bindings ?? {})) {
      if (bindsOf(lens) === "entities") {
        const kind = (binding as { kind?: unknown }).kind;
        if (typeof kind === "string") bound.add(kind);
      } else {
        bound.add(key);
      }
    }
    if (bound.size === 0) continue;
    const asked = parseArrangement(lens.arrangedBy);
    const dropped = [...bound].map((kind) => admitArrangement(asked, arrangeable(app.schema, kind)).dropped);
    const byEvery = dropped.length > 0 ? dropped.reduce((common, these) => common.filter((part) => these.includes(part))) : [];
    for (const part of byEvery) {
      add({
        severity: "note",
        code: "lens-arrangement-unknown",
        where: `lens "${lens.title ?? lens.name}" arrangedBy`,
        message: `The lens opens arranged by "${part}", and none of ${[...bound].join(", ")} can be arranged that way — the picture will open unarranged there.`,
        fix: `Name a field, an edge or \`is\` the bound kind has; \`graview describe\` lists what each kind can be arranged by.`,
      });
    }
  }
}
