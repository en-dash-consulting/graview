import { FORMAT, FORMAT_VERSION } from "./schema.js";

/*
 * DOCUMENT FORMAT UPGRADES (docs/operations.md §4).
 *
 * A stored document says which format it was written in. When the format
 * moves on, each step is a pure function from version n to n+1; reading an
 * older document runs the steps in order, and the host records the result
 * as a new version authored by the system — so an upgrade is
 * history like anything else, and can be compared and rolled back.
 *
 * There is one format so far; the table is where the second one's step goes.
 */

export type Upgrade = (document: Record<string, unknown>) => Record<string, unknown>;

export const UPGRADES: Readonly<Record<number, Upgrade>> = {};

export interface Upgraded {
  readonly document: unknown;
  /** The format version it was written in, when that was older. */
  readonly from?: number;
}

export function upgradeDocument(raw: unknown, upgrades: Readonly<Record<number, Upgrade>> = UPGRADES, target = FORMAT_VERSION): Upgraded {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { document: raw };
  const doc = raw as Record<string, unknown>;
  if (doc["format"] !== FORMAT || typeof doc["formatVersion"] !== "number" || doc["formatVersion"] >= target) return { document: raw };
  const from = doc["formatVersion"] as number;
  let current: Record<string, unknown> = structuredClone(doc);
  for (let v = from; v < target; v++) {
    const step = upgrades[v];
    if (!step) throw new Error(`there is no upgrade from format ${v} to ${v + 1}`);
    current = { ...step(current), formatVersion: v + 1 };
  }
  return { document: current, from };
}
