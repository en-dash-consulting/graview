import { clockReaders } from "../../clock-readers.js";
import type { InvariantDefinition } from "../../invariants/types.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/*
 * A RULE THAT READS THE CLOCK IS JUDGED AGAIN ONLY WHEN THE DAY IS TOLD
 * (FR-176). Rules are judged on every change and once on load; "overdue"
 * is broken by midnight, with nothing changed, and a host that keeps a
 * store open for weeks says what was true the day it last heard a change
 * unless it ticks the store. `@graview/ship`'s `openStore` and
 * `openRemote` tick at each turn of the day themselves; a host of its own
 * calls `store.tick(now)`. A note, never a failure: the author should know
 * which rules those are, and what their host owes them.
 */
export function checkClockRules<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  const { rules } = clockReaders(app.schema as AnySchema, (app.invariants ?? []) as readonly InvariantDefinition[]);
  if (rules.length === 0) return;
  const named = rules.map((rule) => `"${rule}"`).join(", ");
  add({
    severity: "note",
    code: "rules-read-the-clock",
    where: rules.join(", "),
    message: `${rules.length === 1 ? `Rule ${named} reads` : `Rules ${named} read`} the clock (today(), now(), a computed field that does, or a kind whose records retire on a date), so the day turning breaks or mends ${rules.length === 1 ? "it" : "them"} with nothing changed. A store judges ${rules.length === 1 ? "it" : "them"} again only when its host ticks it.`,
    fix: "Host it with @graview/ship (openStore, serve and openRemote tick at each midnight: the app's, in brand.timeZone, else UTC's), or call store.tick(now) when the day turns — once a day from a host's own alarm, untilTheDayTurns(now, brand.timeZone) ahead — and its subscribers hear what appeared and cleared.",
  });
}
