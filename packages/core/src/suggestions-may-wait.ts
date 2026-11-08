import type { AnySchema } from "./schema/schema.js";
import { seatOf } from "./seat-of.js";
import type { Store } from "./store.js";

/**
 * WHETHER THE TRAY IS WORTH FETCHING, read without fetching it: a suggestion in
 * the log, a stop in the log or behind its checkpoint, or one the host says this
 * page does not hold. With it comes `@graview/core/tidying`, which is what judges
 * who may take a stop back, so a row of Activity offers no Undo the server refuses.
 */
export function suggestionsMayWait<S extends AnySchema>(store: Store<S>): boolean {
  const whole = (seatOf(store)?.store ?? store) as unknown as Store<AnySchema>;
  if (store.log.all().some((op) => (op.suggests !== undefined || op.lineage?.stopsKind === true || op.lineage?.liftedStop === true) && !op.withheld)) return true;
  if ((whole.stopsServed?.stops.length ?? 0) > 0 || (whole.stopsServed?.kinds.length ?? 0) > 0) return true;
  return Object.values(whole.log.horizonEpoch()?.declines ?? {}).some((one) => one.stop !== undefined);
}
