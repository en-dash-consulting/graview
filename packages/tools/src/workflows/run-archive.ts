import { ARCHIVED, isLeftAlone, nounOf, pluralOf, touchedBy, type AnyGraphNode, type AnySchema, type GraphReader, type Principal, type Store } from "@graview/core";
import { tidyingOf } from "@graview/core/tidying";
import { afterMs, archiveStep, keeps, policyApplies, recordsOver, type ArchiveStep } from "@graview/core/workflows";
import type { StepRunner } from "./types.js";

/*
 * SET ASIDE WHAT IS DONE WITH (Roadmap f-retention-rules): each live
 * record of the kind that the step's `where` holds of, as the run's author
 * sees it, once it has stood `after` — since it last changed, or after a
 * date it holds — archived through its kind's own `archive-<kind>`, one
 * change per record, every one under the run's lineage so Activity says
 * the run as one row. Never removed; deterministic; no model.
 *
 * Passed by, and said: a record a person said to leave alone; every
 * record of a kind the app says is never tidied; a record a person brought
 * back after this workflow archived it (an undo of its archive, or "Bring
 * it back") — never set aside again by it; and a record a rule the workflow
 * follows keeps ("Keep …", `follows`).
 */

/** When each record last changed, by id: the time of the last op that touched it. */
function lastChanged(store: Store<AnySchema>): ReadonlyMap<string, number> {
  const at = new Map<string, number>();
  for (const op of store.log.all()) {
    if (op.withheld) continue;
    const when = Date.parse(op.at);
    for (const primitive of op.primitives) for (const id of touchedBy(primitive)) at.set(id, when);
  }
  return at;
}

/** The records this workflow archived that a person has since brought back: an undo of its archive, or an unarchive. */
function broughtBack(store: Store<AnySchema>, actor: string, author: string | undefined): ReadonlySet<string> {
  const ours = new Set<string>();
  const back = new Set<string>();
  for (const op of store.log.all()) {
    if (op.withheld) continue;
    const mine = op.lineage?.actor === actor || (author !== undefined && op.author.id === author);
    for (const primitive of op.primitives) {
      if (primitive.op !== "patch-node" || !(ARCHIVED in primitive.after)) continue;
      if (primitive.after[ARCHIVED] === true) {
        if (mine) ours.add(primitive.id);
      } else if (ours.has(primitive.id)) back.add(primitive.id);
    }
  }
  return back;
}

const many = (count: number, one: string, more: string): string => (count === 1 ? `one ${one}` : `${count} ${more}`);

export const runArchiveStep: StepRunner<ArchiveStep> = {
  key: "archive",
  async run(step, context) {
    const store = context.store;
    const schema = store.schema;
    const kind = step.archive;
    if (!schema.tryDefinition(kind)) {
      context.skipped(`"${kind}" is not a kind of this app, so nothing was archived.`);
      return;
    }
    if (tidyingOf(schema, kind) === "never") {
      context.holdBack(`The app says ${pluralOf(schema, kind)} are never tidied, so none was archived.`);
      return;
    }
    const actor = `workflow:${context.workflow.name}`;
    const ids = recordsOver(store, { kind, ...(step.where !== undefined ? { where: step.where } : {}) }, context.principal as Principal);
    if (ids.length === 0) return;
    const changed = lastChanged(store);
    const first = store.log.all()[0];
    const born = first ? Date.parse(first.at) : -Infinity;
    const back = broughtBack(store, actor, context.principal.id);
    const keeping = context.follows.filter(keeps);
    const wait = typeof step.after === "string" ? afterMs(step.after) : undefined;
    const passed = { alone: 0, back: 0, kept: [] as string[], young: 0 };
    const basis = `${archiveStep.words(step, (one) => nounOf(schema.tryDefinition(one) as never, one))}, in “${context.workflow.title}”`.slice(0, 500);
    for (const id of ids) {
      const node = store.graph.getNode(id) as AnyGraphNode | undefined;
      if (!node) continue;
      if (isLeftAlone(store, id)) {
        passed.alone++;
        continue;
      }
      if (back.has(id)) {
        passed.back++;
        continue;
      }
      const rule = keeping.find((policy) => policyApplies(policy, node, store.graph as unknown as GraphReader, schema, context.today));
      if (rule) {
        passed.kept.push(rule.label);
        continue;
      }
      if (typeof step.after === "string") {
        // A record no op has touched stood before the log's first: as old as that, at least.
        const since = changed.get(id) ?? born;
        if (wait === undefined || since === undefined || context.now - since < wait) {
          passed.young++;
          continue;
        }
      } else if (step.after) {
        const from = Date.parse(String((node as Record<string, unknown>)[step.after.field] ?? ""));
        if (Number.isNaN(from) || context.now - from < step.after.days * 86_400_000) {
          passed.young++;
          continue;
        }
      }
      context.change({ calls: [{ name: `archive-${kind}`, args: { id } }], basis, confidence: 1, severity: "archive" });
    }
    if (passed.alone > 0) context.note(`Passed by ${many(passed.alone, "record", "records")} a person said to leave alone.`);
    if (passed.back > 0) context.note(`Passed by ${many(passed.back, "record", "records")} a person brought back after this workflow archived ${passed.back === 1 ? "it" : "them"}: it is not archived again.`);
    if (passed.kept.length > 0) context.note(`Kept ${many(passed.kept.length, "record", "records")} by the rule${new Set(passed.kept).size === 1 ? "" : "s"} ${[...new Set(passed.kept)].map((label) => `“${label}”`).join(", ")}.`);
  },
};
