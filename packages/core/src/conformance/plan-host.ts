import type { MutationCall } from "../mutations/types.js";
import type { Principal } from "../permissions/types.js";
import { planEdits } from "../plan-edits.js";
import type { GraviewDocument } from "../document/schema.js";
import type { AnySchema } from "../schema/schema.js";
import type { Store } from "../store.js";

/**
 * A HOST THAT LANDS A PLAN, CHECKED AS GRAVIEW CHECKS ITS OWN (Roadmap
 * f-menu-type-anything). The quick ask offers a missing capability as one
 * plan — the least change to the app and the records that finish the ask —
 * and a host lands it with two functions: `composeChange` (the edits applied
 * to the app's document and judged by the checker: the changed document and
 * its app, or a refusal) and `onProposeChange` (the change and its records
 * applied as the person, as one change, said as the AI's, answered with its
 * one way back, `{ applied: true, undo }`). Graview Cloud runs this against
 * its own host, as the dev server's runs it in this repository: the
 * assign-to-a-person plan, end to end — composed, landed as one change said
 * `via` the AI, every record linked, and one undo taking it all back.
 */

/** The host's two functions, and the store it serves now (after a change, the new one). */
export interface PlanHost {
  composeChange(change: { readonly document: GraviewDocument; readonly edits: readonly unknown[] }): { readonly ok: true; readonly document: GraviewDocument; readonly app: object; readonly said: readonly string[] } | { readonly ok: false; readonly refused: string };
  onProposeChange(proposal: {
    readonly said: string;
    readonly add: readonly string[];
    readonly drop: readonly string[];
    readonly card: { readonly said: string; readonly adds: readonly never[]; readonly keeps: readonly never[]; readonly drops: readonly never[]; readonly breaking: readonly string[] };
    readonly edits: readonly unknown[];
    readonly records: readonly MutationCall[];
    readonly via: string;
  }): unknown;
  store(): Store<AnySchema>;
}

/** What the check found: each claim, and what failed in words. */
export interface PlanHostReport {
  readonly ok: boolean;
  readonly claims: {
    readonly composes: boolean;
    readonly appliedAsOneChange: boolean;
    readonly saidAsTheAi: boolean;
    readonly linksEveryRecord: boolean;
    readonly undoTakesItAllBack: boolean;
  };
  readonly said: readonly string[];
}

/**
 * Runs the assign-to-a-person plan against `host`: on `kind` of `document`
 * (the app the host serves), each of `members` given to one person — found
 * among the people the app has, else made.
 */
export async function checkPlanHost(host: PlanHost, scenario: { readonly document: GraviewDocument; readonly kind: string; readonly members: readonly string[]; readonly principal?: Principal }): Promise<PlanHostReport> {
  const said: string[] = [];
  const claims = { composes: false, appliedAsOneChange: false, saidAsTheAi: false, linksEveryRecord: false, undoTakesItAllBack: false };
  const done = () => ({ ok: Object.values(claims).every(Boolean), claims, said });
  const planned = planEdits(scenario.document, { link: { on: scenario.kind, called: "assigned to", to: "person" } });
  if ("refused" in planned) return (said.push(`No plan: ${planned.refused}`), done());
  const composed = host.composeChange({ document: scenario.document, edits: planned.edits });
  if (!composed.ok) return (said.push(`composeChange refused it: ${composed.refused}`), done());
  claims.composes = true;

  const before = host.store();
  let whom = planned.made ? `${planned.to}-conformance` : before.graph.allNodes().find((node) => node.kind === planned.to)?.id;
  if (!whom) return (said.push(`There is nobody of ${planned.to} to give them to.`), done());
  const records: MutationCall[] = [
    ...(planned.made && planned.makes ? [{ name: planned.makes, args: { name: "Conformance person" }, mintedHint: whom }] : []),
    ...scenario.members.map((id) => ({ name: planned.act, args: { id, [planned.arg]: whom } })),
  ];
  const via = "ai:conformance";
  let answered: unknown;
  try {
    answered = await host.onProposeChange({ said: "assign these to the conformance person", add: [], drop: [], card: { said: "", adds: [], keeps: [], drops: [], breaking: [] }, edits: planned.edits, records, via });
  } catch (error) {
    return (said.push(`onProposeChange threw: ${error instanceof Error ? error.message : String(error)}`), done());
  }
  if (answered === "declined" || answered === undefined) return (said.push("onProposeChange declined it."), done());
  const after = host.store();
  const ours = after.log.all().filter((op) => op.via === via);
  claims.saidAsTheAi = ours.length > 0;
  claims.appliedAsOneChange = ours.length > 0 && new Set(ours.map((op) => op.batch)).size === 1;
  if (!claims.saidAsTheAi) said.push(`No op of the change says via "${via}".`);
  else if (!claims.appliedAsOneChange) said.push("The records landed as more than one change.");
  // The person the records name — made under the hint where the store took it, else under the id it minted.
  const linked = scenario.members.map((id) => after.graph.out(id, planned.relation!).map((node) => node.id));
  claims.linksEveryRecord = linked.every((ids) => ids.length === 1 && ids[0] === linked[0]![0] && (planned.made ? true : ids[0] === whom));
  if (planned.made && linked[0]?.[0]) whom = linked[0][0];
  if (!claims.linksEveryRecord) said.push("Not every record was linked to the person.");

  const undo = typeof answered === "object" && answered !== null && typeof (answered as { undo?: unknown }).undo === "function" ? (answered as { undo: () => unknown }).undo : undefined;
  if (!undo) return (said.push("onProposeChange answered no way back ({ applied: true, undo })."), done());
  await undo();
  const back = host.store();
  const unlinked = scenario.members.every((id) => back.graph.out(id, planned.relation!).length === 0);
  const unmade = !planned.made || back.graph.getNode(whom) === undefined;
  const unchanged = !planned.made || !back.schema.kinds.includes(planned.to as never);
  claims.undoTakesItAllBack = unlinked && unmade && unchanged;
  if (!claims.undoTakesItAllBack) said.push("One undo did not take the app and the records back.");
  return done();
}
