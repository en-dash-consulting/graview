import type { Policy, Sight } from "../../permissions/types.js";
import { rolesOf } from "../../permissions/policy.js";
import type { AnySchema } from "../../schema/schema.js";
import type { AnyNodeDefinition } from "../../schema/types.js";
import type { CheckContext } from "./context.js";

/*
 * A SIGHT THAT SHOWS ONLY SOME FIELDS (Roadmap f-field-sight).
 *
 * A sight's `hide` and `fields` name fields of the kinds it shows, so a
 * misspelled one would keep nothing, or keep everything: an error. A field
 * kept from a role that a record cannot do without serves the role no such
 * record at all — the store withholds it whole rather than serve one that
 * fails its own declaration: an error, unless another sight shows the role
 * that field. And a label or a description that reads a kept field is
 * worked out, for that role, from the record without it — the name falls
 * back to what is left — so the author is told (a warning): the value never
 * reaches the role, but the name it reads may not be the one meant.
 */

/** The fields of a kind's declaration, and whether each may be left off a record. */
function fieldsOf(definition: AnyNodeDefinition): Map<string, boolean> {
  const shape = (definition.fields as { shape?: Record<string, { safeParse?(value: unknown): { success: boolean } }> }).shape ?? {};
  return new Map(Object.entries(shape).map(([field, schema]) => [field, schema.safeParse?.(undefined).success === true]));
}

/** Whether one sight shows a field. */
const shows = (sight: Sight, field: string): boolean => (sight.fields === undefined || sight.fields.includes(field)) && !sight.hide?.includes(field);

/** Whether a sight is for a role. */
const forRole = (sight: Sight, role: string): boolean => sight.roles === "*" || sight.roles.includes(role);

/**
 * The fields of a kind a role is not shown on a record that is not its
 * own: kept by every sight of the role that shows the kind to it whatever
 * the record (or, with none such, by every one that does).
 */
export function keptFromRole(policy: Policy, role: string, kind: string, fields: readonly string[]): string[] {
  const all = (policy.sees ?? []).filter((sight) => sight.kinds.includes(kind) && forRole(sight, role));
  const plain = all.filter((sight) => !sight.own && !sight.via);
  const sights = plain.length > 0 ? plain : all;
  if (sights.length === 0) return [];
  return fields.filter((field) => !sights.some((sight) => shows(sight, field)));
}

/** A probe of a label or a description: each field holds its own marker, and what comes back says which it read. */
function reads(say: ((node: never) => unknown) | undefined, kind: string, fields: readonly string[]): Set<string> {
  const read = new Set<string>();
  if (typeof say !== "function") return read;
  const node: Record<string, unknown> = { id: `${kind}:probe`, kind };
  for (const field of fields) node[field] = `⟦${field}⟧`;
  try {
    const said = String(say(node as never));
    for (const field of fields) if (said.includes(`⟦${field}⟧`)) read.add(field);
  } catch {
    // A label that cannot be worked out from markers is not one this check can read.
  }
  return read;
}

export function checkFieldSight<S extends AnySchema>(ctx: CheckContext<S>): void {
  const policy = ctx.app.policy;
  const sights = policy?.sees ?? [];
  if (!policy || !sights.some((sight) => sight.fields !== undefined || (sight.hide?.length ?? 0) > 0)) return;
  const definition = (kind: string) => ctx.app.schema.tryDefinition(kind) as AnyNodeDefinition | undefined;

  for (const sight of sights) {
    for (const field of [...(sight.fields ?? []), ...(sight.hide ?? [])]) {
      if (sight.kinds.some((kind) => definition(kind) && fieldsOf(definition(kind)!).has(field))) continue;
      ctx.add({
        severity: "error",
        code: "sight-names-an-unknown-field",
        where: "policy.sees",
        message: `A sight of ${sight.kinds.join(", ")} names the field "${field}", which ${sight.kinds.length > 1 ? "none of them has" : `${sight.kinds[0]} does not have`}: it keeps or shows nothing.`,
        fix: `Name a field of ${sight.kinds.join(" or ")}, or take "${field}" out of the sight.`,
      });
    }
  }

  const roles = [...new Set([...rolesOf(policy), ...sights.flatMap((sight) => (sight.roles === "*" ? [] : sight.roles))])];
  for (const kind of ctx.kinds) {
    const declared = definition(kind);
    if (!declared) continue;
    const fields = fieldsOf(declared);
    const names = [...fields.keys()];
    const quoted = new Map<string, Set<string>>([
      ["label", reads(declared.label as never, kind, names)],
      ["description", reads((declared as { describe?: (node: never) => unknown }).describe, kind, names)],
    ]);
    for (const role of roles) {
      const kept = keptFromRole(policy, role, kind, names);
      for (const field of kept) {
        if (fields.get(field) === false) {
          ctx.add({
            severity: "error",
            code: "sight-hides-a-required-field",
            where: `policy.sees (${role}, ${kind}.${field})`,
            message: `The role "${role}" may not see ${kind}'s "${field}", and every ${kind} needs one — so it is shown no ${kind} at all: a record without a field it needs is not served.`,
            fix: `Make "${field}" optional on ${kind}, or show it to "${role}".`,
          });
        }
        for (const [part, read] of quoted) {
          if (!read.has(field)) continue;
          ctx.add({
            severity: "warning",
            code: "sight-hides-a-labeled-field",
            where: `${kind}.${part}`,
            message: `${kind}'s ${part} reads "${field}", which the role "${role}" may not see: it is told the ${part} worked out without it.`,
            fix: `Word the ${part} from fields every role sees, or show "${field}" to "${role}".`,
          });
        }
      }
    }
  }
}
