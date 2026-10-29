import { pluralOf, type AnyGraphNode, type AnySchema, type MutationCall, type Operation, type Principal, type Store } from "@graview/core";
import { keyedId, recordsOver, workflowKey, workflowValue, type ActStep } from "@graview/core/workflows";
import type { StepContext, StepRunner } from "./types.js";

/*
 * RUN AN ACT (Roadmap f-job-step-types, f-job-idempotency): once, or once
 * per record `over` picks as the run's author sees them — the record the
 * act's subject when the step does not say it, and what `{ expr }` values
 * read.
 *
 * A KEY MAKES A RERUN AN UPDATE. A step that says `key` makes each record
 * under an id worked out from the workflow's name and the key
 * (`<prefix>:wf.<workflow>.<key>`), asked for as a client asks for one
 * (f-1-0-client-ids), so the store itself refuses a second record of the
 * same key. A rerun finds the record it made last time by that id — or, for
 * an act that makes its own ids, by the key kept on the lineage of the op
 * that made it — and changes only what differs, through the kind's edit;
 * nothing differing is nothing new. A record a person removed since is not
 * made again: the run holds it back and says so. Without `key`, a call
 * that would change nothing is not made.
 */

/** The record an earlier run of this workflow made under a key, by the key on the lineage of the op that made it. */
function madeUnderKey(store: Store<AnySchema>, author: string | undefined, key: string): string | undefined {
  for (const op of [...store.log.all()].reverse()) {
    if (op.author.id !== author || (op.lineage as { key?: unknown } | undefined)?.key !== key) continue;
    const added = op.primitives.find((primitive) => primitive.op === "add-node");
    if (added && added.op === "add-node") return added.node.id;
  }
  return undefined;
}

/** Whether the log ever held a record under this id. */
const everMade = (store: Store<AnySchema>, id: string): boolean => store.log.all().some((op: Operation) => op.primitives.some((primitive) => primitive.op === "add-node" && primitive.node.id === id));

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The fields a would-be record sets that a record already standing holds otherwise. */
function differing(store: Store<AnySchema>, made: Readonly<Record<string, unknown>>, standing: AnyGraphNode): Record<string, unknown> {
  const definition = store.schema.tryDefinition(standing.kind as string) as { fields?: { shape?: Record<string, unknown> } } | undefined;
  const fields = Object.keys(definition?.fields?.shape ?? {});
  const out: Record<string, unknown> = {};
  for (const field of fields) if (field in made && !same(made[field], (standing as Record<string, unknown>)[field])) out[field] = made[field];
  return out;
}

/** The first record a call would make, as a preview says it, and the id the act minted. */
function wouldMake(store: Store<AnySchema>, call: MutationCall, author: Principal): { node?: AnyGraphNode; minted?: string } {
  const preview = store.previewAll([call], { author });
  const added = preview.primitives.find((primitive) => primitive.op === "add-node");
  return { ...(added && added.op === "add-node" ? { node: added.node as AnyGraphNode } : {}), ...(preview.minted?.[0] ? { minted: preview.minted[0] } : {}) };
}

/** One call, keyed: made under its key's id, or the record made last time changed to fit. */
function keyed(call: MutationCall, key: string, context: StepContext, basis: string): void {
  const store = context.store;
  const author = context.principal as Principal;
  let made: ReturnType<typeof wouldMake>;
  try {
    made = wouldMake(store, call, author);
  } catch {
    // Refused as it stands: the door says why, in the store's words.
    context.change({ calls: [call], basis, key });
    return;
  }
  if (!made.node) {
    // An act that makes nothing: run it only where it would change something.
    if (!store.wouldChange(call, author)) return;
    context.change({ calls: [call], basis, key });
    return;
  }
  const prefix = (made.minted ?? made.node.id).includes(":") ? (made.minted ?? made.node.id).split(":")[0]! : undefined;
  const id = prefix ? keyedId(prefix, context.workflow.name, key) : undefined;
  const standingId = (id && store.graph.getNode(id) ? id : undefined) ?? madeUnderKey(store, context.principal.id, key);
  const standing = standingId ? (store.graph.getNode(standingId) as AnyGraphNode | undefined) : undefined;
  if (standing) {
    const changes = differing(store, made.node as Record<string, unknown>, standing);
    if (Object.keys(changes).length === 0) return;
    const edit = `edit-${standing.kind as string}`;
    let takes = false;
    try {
      const writes = (store.mutation(edit) as { writes?: readonly string[] }).writes ?? [];
      takes = Object.keys(changes).every((field) => writes.includes(field));
    } catch {
      takes = false;
    }
    if (!takes) return context.holdBack(`“${key}” was made by an earlier run and now differs in ${Object.keys(changes).join(", ")}, which no edit of its kind changes.`);
    context.change({ calls: [{ name: edit, args: { id: standing.id, ...changes } }], basis: `${basis} (again, for “${key}”)`, key });
    return;
  }
  if ((id && everMade(store, id)) || (standingId && !standing)) return context.holdBack(`What it made for “${key}” was removed since; it is not made again.`);
  // Under the key's id where the act takes one asked for; else under its own, the key kept on the lineage.
  const asked = id ? { ...call, args: { ...call.args, id } } : call;
  let takesId = id !== undefined;
  if (takesId) {
    try {
      store.previewAll([asked], { author });
    } catch {
      takesId = false;
    }
  }
  context.change({ calls: [takesId ? asked : call], basis, key });
}

export const runActStep: StepRunner<ActStep> = {
  key: "act",
  async run(step, context) {
    const store = context.store;
    const now = { at: new Date(context.now).toISOString(), today: context.today };
    let subjectArg: string | undefined;
    try {
      subjectArg = (store.mutation(step.act) as { subject?: { arg: string } }).subject?.arg;
    } catch {
      return context.skipped(`the app has no act “${step.act}”.`);
    }
    const ids = step.over ? recordsOver(store, step.over, context.principal as Principal) : [undefined];
    if (step.over && ids.length === 0) context.note(`Step ${context.index + 1}: no ${pluralOf(store.schema, step.over.kind).toLowerCase()} to run over.`);
    for (const id of ids) {
      const record = id === undefined ? undefined : (store.graph.getNode(id) as AnyGraphNode | undefined);
      const args: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(step.args ?? {})) args[name] = workflowValue(value, record, store, now);
      if (record && subjectArg && args[subjectArg] === undefined) args[subjectArg] = record.id;
      const call: MutationCall = { name: step.act, args };
      const basis = `“${context.workflow.title}”${record ? ` for ${String((record as Record<string, unknown>)["name"] ?? record.id)}` : ""}`;
      if (step.key !== undefined) keyed(call, workflowKey(step.key, { ...(record ?? {}), ...args }), context, basis);
      else {
        let changes = true;
        try {
          changes = store.wouldChange(call, context.principal as Principal);
        } catch {
          changes = true;
        }
        if (changes) context.change({ calls: [call], basis });
      }
    }
  },
};
