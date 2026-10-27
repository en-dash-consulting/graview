import * as z from "../schema/zod.js";
import { dayAsRead } from "../days.js";
import { labelOf } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import type { AnyNodeDefinition } from "../schema/types.js";
import { isRepeat, isRepeatField, occurrences, repeatedBy, repeatKey, type Repeat } from "../repeat.js";
import { ActRefusal } from "../refused.js";
import { refTo } from "./node-ref.js";
import { fieldWriters, settableFields } from "./derive-edits.js";
import type { AnyMutationDefinition, MutationContext } from "./types.js";

/*
 * ACTING ON ONE OCCURRENCE OF A REPEATING DATE (`repeat.ts`), each a derived
 * act on a kind with a date that repeats, one undo each, and permitted as the
 * kind's edit is:
 *
 *   skip-<kind>    "Skip this one": the day joins the series' exceptions.
 *   detach-<kind>  "Change just this one": the occurrence becomes a record
 *                  of its own — the series' fields and the links it makes,
 *                  on that day, with what was changed — and an exception on
 *                  the series.
 *   split-<kind>   "Change from here": the series ends the day before, and
 *                  a new one, continuing it (`continues`), starts on that
 *                  day with what was changed. From its first day, it is the
 *                  series itself that changes.
 *
 * Each takes the record (`id`), the day (`on`, `YYYY-MM-DD`) and, where the
 * kind has more than one date that repeats, which (`field`); the two that
 * change take the kind's fields beside them that its edit takes — those no
 * declared act writes, and those another system keeps in step — and a field
 * an act of its own sets is refused by that act's name, as the edit refuses
 * it. Riding the edit, they change only what it changes; and the two that
 * make a record make it only for a seat that may make one (the store asks,
 * `repeatMakes`). A hosted page loads this up front with the store, so it
 * is kept short.
 */

/** Which of a kind's dates repeat: those with their repeat declared beside them. */
export function repeatingFields(definition: AnyNodeDefinition): string[] {
  const shape = definition.fields.shape as Record<string, unknown>;
  return Object.keys(shape).flatMap((key) => {
    const date = isRepeatField(shape[key]) ? repeatedBy(key) : undefined;
    return date && shape[date] ? [date] : [];
  });
}

const ACTS = [
  ["skip", "Skip this one", "Leave one day out of the series; the rest stay as they are.", "Skip {} on "],
  ["detach", "Change just this one", "Make one day of the series a record of its own, to change apart from the rest.", "Change {} only on "],
  ["split", "Change from here", "End the series the day before, and start it again from that day with what changes.", "Change {} from "],
] as const;

/** The acts a kind with a repeating date is given: skip, detach and split, each on the record as `id`. */
export function deriveRepeatMutations<S extends AnySchema>(schema: S, mutations: readonly AnyMutationDefinition<S>[]): AnyMutationDefinition<S>[] {
  const taken = new Set(mutations.map((mutation) => mutation.name));
  const derived: AnyMutationDefinition<S>[] = [];
  for (const definition of schema.definitions) {
    const dates = repeatingFields(definition);
    if (dates.length === 0) continue;
    const kind = definition.kind;
    const shape = definition.fields.shape as Record<string, z.ZodMiniType>;
    const writers = fieldWriters(schema, mutations).get(kind);
    const kept = new Set(definition.keptInStep ?? []);
    const owned = (field: string) => (writers?.get(field)?.length ?? 0) > 0 && !kept.has(field);
    const changes = settableFields(definition).filter((field) => !owned(field));
    const writtenBy = Object.fromEntries(settableFields(definition).filter(owned).map((field) => [field, writers!.get(field)!]));
    const named = (node: unknown) => labelOf(definition, node as never);
    for (const [act, title, description, says] of ACTS) {
      const name = `${act}-${kind}`;
      if (taken.has(name)) continue;
      derived.push({
        name,
        derived: { kind, act },
        title,
        description,
        subject: { kinds: [kind], arg: "id" },
        // What each writes on the series is how it repeats; what the other two set, they set on the record they make.
        writes: dates.map(repeatKey),
        ...(act === "skip" ? {} : { creates: [kind], ...(Object.keys(writtenBy).length > 0 ? { writtenBy } : {}) }),
        input: z.strictObject({
          id: refTo([kind]),
          on: z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/, "a day, like 2026-10-21")),
          ...(dates.length > 1 ? { field: z.optional(z.enum(dates as [string, ...string[]])) } : {}),
          ...(act === "skip" ? {} : Object.fromEntries(changes.map((field) => [field, z.optional(shape[field]!)]))),
        }) as never,
        describe: (args: Record<string, unknown>, graph) => says.replace("{}", named(graph.getNode(String(args["id"])) ?? { id: args["id"] })) + dayAsRead(String(args["on"])),
        apply(ctx: MutationContext<S>, args: Record<string, unknown>) {
          const node = ctx.graph.getNode(String(args["id"])) as Record<string, unknown> | undefined;
          const field = String(args["field"] ?? dates[0]);
          const start = node?.[field];
          const repeat = node?.[repeatKey(field)];
          const on = String(args["on"]);
          if (typeof start !== "string" || !isRepeat(repeat)) throw new ActRefusal(`${named(node ?? { id: args["id"] })} does not repeat`, "refused");
          const at = occurrences(start, repeat, { from: on, to: on })[0];
          if (!at) throw new ActRefusal(`${named(node)} does not fall on ${dayAsRead(on)}`, "refused");
          const id = String(node!["id"]);
          const given = Object.fromEntries(changes.filter((one) => args[one] !== undefined).map((one) => [one, args[one]]));
          const key = repeatKey(field);
          /** A record of its own, made from the series: its fields and what was changed, and the links it makes. */
          const copy = (fields: Record<string, unknown>) => {
            const made = Object.fromEntries(Object.entries({ ...node, ...fields, ...given }).filter(([one, value]) => value != null && one !== "id"));
            // Minted as every id is: saying its kind, and never from words of a field some sight keeps from a role.
            const fresh = ctx.freshId(named(made), kind, made);
            ctx.addNode({ ...made, id: fresh, kind } as never);
            for (const edge of Object.keys(definition.edges ?? {})) for (const to of ctx.graph.out(id, edge)) ctx.addEdge({ kind: edge, from: fresh, to: to.id });
          };
          if (act !== "split") {
            ctx.patchNode(id, { [key]: { ...repeat, except: [...new Set([...(repeat.except ?? []), on])].sort() } });
            if (act === "detach") copy({ [field]: at, [key]: null });
            return;
          }
          if (Object.keys(given).length === 0) throw new ActRefusal(`Nothing to change: give ${named(node)} from ${dayAsRead(on)} something new`, "invalid");
          // From its first day, "from here" is the whole series.
          if (on <= start.slice(0, 10)) return ctx.patchNode(id, given);
          const until = new Date(Date.parse(`${on}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
          const before = repeat.count ? occurrences(start, { ...repeat, except: [] }, { to: until }).length : 0;
          const { count, except, ...rule } = repeat;
          const kept = (keep: (day: string) => boolean): Partial<Repeat> => (except?.some(keep) ? { except: except.filter(keep) } : {});
          ctx.patchNode(id, { [key]: { ...rule, until, ...kept((day) => day < on), ...(count ? { count: before } : {}) } });
          copy({ [field]: at, [key]: { ...rule, ...kept((day) => day >= on), ...(count ? { count: count - before } : {}), continues: id } });
        },
      } as AnyMutationDefinition<S>);
    }
  }
  return derived;
}

/**
 * WHETHER A CALL OF A REPEAT ACT MAKES A RECORD: "change just this one"
 * always does, and "change from here" past the series' first day. Riding
 * the kind's edit, such a call is the seat's to make only where it may make
 * one of the kind, as the store judges. A record the call cannot read
 * (absent, or kept from the seat) is judged as one it would make.
 */
export function repeatMakes(act: string, args: Record<string, unknown>, node: Record<string, unknown> | undefined, dates: readonly string[]): boolean {
  if (act === "detach") return true;
  if (act !== "split" || typeof args["on"] !== "string") return false;
  const start = node?.[String(args["field"] ?? dates[0])];
  return typeof start !== "string" || args["on"] > start.slice(0, 10);
}
