import { counted, labelOf, type AnyGraphNode, type MutationCall, type Operation } from "@graview/core";
import { generateWants, type GenerateStep, type WantedRecord } from "@graview/core/workflows";
import type { StepContext, StepRunner } from "./types.js";

/*
 * MAKE DATED RECORDS FROM A PATTERN, RUN (Roadmap f-job-generate-from-pattern).
 * Core says what the step wants (`generateWants`): each record by its key
 * and the id the key gives it. Here each is made when it is not there yet,
 * through the act that makes the kind, under that id — so the store itself
 * refuses a second — and linked to its source; and changed where the
 * source changed. What a person did to a made record stands: a field they
 * changed is not set back (unless the step says `overwrite`), one they set
 * aside stays aside, and one they removed — or a run they undid — is not
 * made again. A day the source skips is not among the days it wants.
 */

/** A relation's name as an act's name spells it: `takenOn` → `taken-on`. */
const inActName = (relation: string): string => relation.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** What the log says of the records a step makes: those taken away, and the fields somebody other than the run's author changed. */
function historyOf(ops: readonly Operation[], ids: ReadonlySet<string>, author: string | undefined): { readonly removed: ReadonlySet<string>; readonly touched: ReadonlyMap<string, ReadonlySet<string>> } {
  const removed = new Set<string>();
  const touched = new Map<string, Set<string>>();
  const touch = (id: string, field: string) => {
    let fields = touched.get(id);
    if (!fields) touched.set(id, (fields = new Set()));
    fields.add(field);
  };
  for (const op of ops) {
    for (const primitive of op.primitives) {
      if (primitive.op === "remove-node" && ids.has(primitive.node.id)) removed.add(primitive.node.id);
      if (primitive.op === "add-node" && ids.has(primitive.node.id)) removed.delete(primitive.node.id);
      if (op.author.id === author) continue;
      if (primitive.op === "patch-node" && ids.has(primitive.id)) for (const field of Object.keys(primitive.after)) touch(primitive.id, field);
      if (primitive.op === "splice-text" && ids.has(primitive.id)) touch(primitive.id, primitive.field);
    }
  }
  return { removed, touched };
}

export const runGenerateStep: StepRunner<GenerateStep> = {
  key: "generate",
  async run(step, context: StepContext) {
    const store = context.store;
    const schema = store.schema;
    const graph = context.seen.graph;
    const brand = context.app.brand as { readonly timeZone?: string; readonly locale?: string } | undefined;
    const wants = generateWants(step, { graph, schema, workflow: context.workflow.name, now: context.now, today: context.today, timeZone: brand?.timeZone ?? store.timeZone, locale: brand?.locale });
    for (const problem of wants.problems) context.holdBack(problem.source ? `${problem.source}: ${problem.why}.` : `${problem.why.replace(/^./, (first) => first.toUpperCase())}.`);

    const makers = store.allMutations().filter((mutation) => (mutation.creates as readonly string[] | undefined)?.includes(step.generate));
    const maker = step.using ? makers.find((mutation) => mutation.name === step.using) : makers.length === 1 ? makers[0] : undefined;
    if (!maker) {
      context.skipped(step.using ? `"${step.using}" does not make one of “${step.generate}”.` : makers.length === 0 ? `No act makes one of “${step.generate}”.` : `Several acts make one of “${step.generate}”; the step says none of them.`);
      return;
    }
    const madeDefinition = schema.tryDefinition(step.generate) as { readonly edges?: Readonly<Record<string, unknown>> } | undefined;
    const acts = new Set(store.allMutations().map((mutation) => mutation.name));
    /** The call that links a made record to its source, and whether they are linked already. */
    const linkOf = (wanted: WantedRecord): { readonly call?: MutationCall; readonly linked: boolean } => {
      if (step.link === undefined) return { linked: true };
      const onMade = !!madeDefinition?.edges?.[step.link];
      const [from, to, kind] = onMade ? [wanted.id, wanted.source, step.generate] : [wanted.source, wanted.id, wanted.sourceKind];
      const linked = graph.has(from) && graph.out(from, step.link).some((node) => node.id === to);
      const name = `connect-${kind}-${inActName(step.link)}`;
      return acts.has(name) ? { call: { name, args: { id: from, to } }, linked } : { linked };
    };

    const { removed, touched } = historyOf(store.log.all(), new Set(wants.wanted.map((wanted) => wanted.id)), context.principal.id);
    let notMadeAgain = 0;
    let keptAside = 0;
    let keptChanges = 0;
    let unlinkedSaid = false;
    for (const wanted of wants.wanted) {
      const source = graph.getNode(wanted.source) as AnyGraphNode | undefined;
      const sourceDefinition = schema.tryDefinition(wanted.sourceKind);
      const label = source && sourceDefinition ? labelOf(sourceDefinition, source as never) : wanted.source;
      const basis = `From “${label}” on ${wanted.day}`;
      const existing = store.graph.getNode(wanted.id) as Readonly<Record<string, unknown>> | undefined;
      if (!existing) {
        if (removed.has(wanted.id)) {
          notMadeAgain++;
          continue;
        }
        const link = linkOf(wanted);
        if (step.link !== undefined && !link.call && !unlinkedSaid) {
          unlinkedSaid = true;
          context.holdBack(`No act links through "${step.link}", so what it makes is not linked to its source.`);
        }
        context.change({ calls: [{ name: maker.name, args: { ...wanted.values, id: wanted.id } }, ...(link.call ? [link.call] : [])], basis, confidence: 1, key: wanted.key });
        continue;
      }
      if (store.graph.isArchived(wanted.id)) {
        keptAside++;
        continue;
      }
      const theirs = touched.get(wanted.id);
      const changes: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(wanted.values)) {
        if (same(existing[field], value)) continue;
        if (theirs?.has(field) && !step.overwrite) {
          keptChanges++;
          continue;
        }
        changes[field] = value;
      }
      const link = linkOf(wanted);
      const calls: MutationCall[] = [...(Object.keys(changes).length > 0 ? [{ name: `edit-${step.generate}`, args: { id: wanted.id, ...changes } }] : []), ...(!link.linked && link.call ? [link.call] : [])];
      if (calls.length > 0) context.change({ calls, basis, confidence: 1, key: wanted.key });
    }
    const days = wants.from === wants.to ? wants.from : `${wants.from} to ${wants.to}`;
    context.note(`${wants.wanted.length === 0 ? "Nothing" : counted(schema, step.generate, wants.wanted.length)} wanted for ${days}.`);
    if (keptChanges > 0) context.note(`Kept ${keptChanges} change${keptChanges === 1 ? "" : "s"} a person made to what it made before.`);
    if (keptAside > 0) context.note(`Left ${keptAside} record${keptAside === 1 ? "" : "s"} a person set aside where ${keptAside === 1 ? "it is" : "they are"}.`);
    if (notMadeAgain > 0) context.note(`Did not make ${notMadeAgain} record${notMadeAgain === 1 ? "" : "s"} again that ${notMadeAgain === 1 ? "was" : "were"} taken away.`);
  },
};
