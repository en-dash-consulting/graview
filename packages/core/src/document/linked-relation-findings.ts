import { parseLinkedTarget } from "../schema/linked.js";
import { error, type Finding } from "./findings.js";
import type { EdgeSpec } from "./schema.js";

/*
 * ONE RELATION TO ANOTHER APP'S KINDS (FR-171), JUDGED — by the checker in a
 * whole document (`linked-findings.ts`) and by an `add-relation` edit, in
 * the same words. Apart from the rest of the checker's linked findings so
 * an edit carries no compiler for them.
 */

/**
 * Every target names one app's kind (`@nick/house/house`), all of them the
 * same app, none of this document beside them; and nothing of it asks the
 * far app to change — no name from that end, no link kept from being taken
 * back. `path` is where the relation is said: `kinds.<kind>.edges.<name>`,
 * or `edits.<n>`.
 */
export function linkedRelationFindings(path: string, name: string, kind: string, edge: EdgeSpec): Finding[] {
  const findings: Finding[] = [];
  const targets = edge.to === "*" ? [] : edge.to;
  const far = targets.map((target) => [target, parseLinkedTarget(target)] as const);
  for (const [target, parsed] of far) {
    if (!target.startsWith("@")) findings.push(error("linked-mixed", `${path}.to`, `${kind}'s ${name} goes to "${target}" here and to another app beside it, and a relation goes to one app or the other`, "make two relations, one to each"));
    else if (!parsed) findings.push(error("linked-target", `${path}.to`, `"${target}" does not name a kind in another app`, 'write "@", the app\'s address, "/" and the kind, like "@nick/house/house"'));
  }
  const apps = [...new Set(far.flatMap(([, parsed]) => (parsed ? [parsed.address] : [])))];
  if (apps.length > 1) findings.push(error("linked-apps", `${path}.to`, `${kind}'s ${name} goes to kinds in ${apps.length} apps (${apps.join(", ")}), and a relation reaches one app`, "make a relation for each app"));
  if (edge.inverse) findings.push(error("linked-inverse", `${path}.inverse`, `${kind}'s ${name} links a record in another app, whose declaration this one does not change: it has no name from that end`, "drop inverse; the other app may declare its own relation back"));
  if (edge.appendOnly) findings.push(error("linked-append-only", `${path}.appendOnly`, `${kind}'s ${name} links a record in another app, and is changed like a value rather than appended to`, "drop appendOnly"));
  return findings;
}
