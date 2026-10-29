import { isLeftAlone, labelOf, nounOf, pluralOf, withArticle, type AnyGraphNode, type AnySchema, type MutationCall, type Principal, type Store } from "@graview/core";
import { classifyApplies, classifyAsks, floorLabel, recordsOver, type ClassifyStep } from "@graview/core/workflows";
import { nodeState, questionsForKind, type Question } from "../questions.js";
import { askAll } from "../tidy/asking.js";
import { NONE_FITS } from "../tidy/judging.js";
import { choiceOf, modelWord, systemOneOf } from "../tidy/system-one.js";
import type { StepContext, StepRunner } from "./types.js";

/*
 * LABEL EACH RECORD (Roadmap f-feedback-triage-agent), run. The records of
 * the kind the step's `where` holds of, as the run's author sees them —
 * those a change started the run for, when one did — less every record
 * already labeled (unless `relabel`) and every one a person said to leave
 * alone. Each is one request to the host's System One model (its Fast
 * slot, or its `decide`), through dreaming's asking — a few at once,
 * within the step's budget, answers kept by what was asked — with one
 * Choice: which option fits, or none. Its answer is a label with how sure,
 * set through the act that writes the field, the reason on the lineage
 * ("Jev: 90% sure “Buy now” is spam"). Where no model answered — none
 * lent, it failed, the budget ran out — the floor decides, sure (1), and
 * says which rule did; a record neither labels is labeled the step's
 * `otherwise`, when it says one, else left for a person, and the run says
 * how many. What the model's requests spent is counted on the run
 * (`spent`): requests, and the tokens its answers said. An option sure enough for its `setAside`
 * threshold archives the record too, as a change of its own.
 *
 * Every change waits for a person unless the step says its own `approve`,
 * or the judgment reaches its option's `applyAt` (`StepChange.apply`); an
 * option in `confirm`, or a choice the model barely made over the next
 * below its `applyAt`, waits whatever it says (`StepChange.ask`).
 */

/** A record's text, as the floor reads it: every string field, joined. */
const textOf = (node: Record<string, unknown>): string =>
  Object.entries(node)
    .filter(([key, value]) => key !== "id" && key !== "kind" && !key.startsWith("$") && typeof value === "string")
    .map(([, value]) => value as string)
    .join("\n");

const unset = (value: unknown) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
const many = (count: number, one: string, more: string): string => (count === 1 ? `one ${one}` : `${count} ${more}`);

export const runClassifyStep: StepRunner<ClassifyStep> = {
  key: "classify",
  async run(step, context: StepContext) {
    const { store, seen } = context;
    const schema = store.schema;
    const kind = step.classify;
    const definition = schema.tryDefinition(kind);
    if (!definition) return context.skipped(`"${kind}" is not a kind of this app, so nothing was labeled.`);
    const question = questionsForKind(seen as Store<AnySchema>, kind).find((one) => one.about === "field" && one.field === step.field);
    const writes = question?.about === "field" ? question.writes : undefined;
    if (!writes) return context.skipped(`no act sets the ${step.field} of ${withArticle(nounOf(definition, kind))}, so nothing was labeled.`);
    const options = step.options ?? (question!.question.type === "choice" ? Object.keys(question!.question.criteria).filter((option) => option !== NONE_FITS) : []);
    if (options.length === 0) return context.skipped(`"${step.field}" has no options to label with.`);

    const principal = context.principal as Principal;
    let ids = recordsOver(store, { kind, ...(step.where !== undefined ? { where: step.where } : {}) }, principal);
    const trigger = context.trigger;
    if ((trigger.kind === "made" || trigger.kind === "changed") && trigger.records.length > 0) {
      const started = new Set(trigger.records);
      ids = ids.filter((id) => started.has(id));
    }
    let labeled = 0;
    let alone = 0;
    const nodes: AnyGraphNode[] = [];
    for (const id of ids) {
      const node = seen.graph.getNode(id) as AnyGraphNode | undefined;
      if (!node) continue;
      if (!step.relabel && !unset((node as Record<string, unknown>)[step.field])) {
        labeled++;
        continue;
      }
      if (isLeftAlone(store, id)) {
        alone++;
        continue;
      }
      nodes.push(node);
    }
    if (labeled > 0) context.note(`Passed by ${many(labeled, `${nounOf(definition, kind)} already labeled`, `${pluralOf(schema, kind)} already labeled`)}: a label is never set again unless the step says relabel.`);
    if (alone > 0) context.note(`Passed by ${many(alone, "record", "records")} a person said to leave alone.`);
    if (nodes.length === 0) return;

    const noun = nounOf(definition, kind);
    const words = step.field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    const model = systemOneOf(undefined, context.ai);
    const named = step.model ?? model?.model;
    const judged = new Map<string, { option: string; confidence: number; basis: string; split: boolean }>();
    if (model) {
      const criteria: Record<string, string | null> = Object.fromEntries(options.map((option) => [option, null]));
      criteria[NONE_FITS] = `No ${words} plainly fits; leave it for a person.`;
      const questions: Record<string, Question> = {
        label: { type: "choice", instructions: `${step.instruction ? `${step.instruction} ` : ""}Which ${words} is this ${noun}? Choose “${NONE_FITS}” unless the record plainly says.`, criteria },
      };
      const asks = nodes.map((node) => ({ covers: [], state: { kind: { name: noun, ...(definition.description ? { "what it is": definition.description } : {}) }, record: nodeState(seen as Store<AnySchema>, node.id) ?? {} }, questions, read: () => [] }));
      const asked = await askAll({ ...model, model: named! }, asks, { budget: { requests: step.budget?.calls ?? 60, inputTokens: step.budget?.tokens ?? 200_000 } });
      if (asked.usage.requests > 0) context.spent({ calls: asked.usage.requests, inputTokens: asked.usage.inputTokens, outputTokens: asked.usage.outputTokens, ...(asked.usage.costUsd !== undefined ? { costUsd: asked.usage.costUsd } : {}), model: named! });
      if (asked.error !== undefined) context.note(`Step ${context.index + 1}: the model failed (${asked.error}); the floor decided the rest.`);
      if (asked.stopped) context.note(`Step ${context.index + 1}: its budget of ${asked.stopped === "requests" ? "requests" : "tokens"} ran out; the floor decided the rest.`);
      asked.answers.forEach((answers, at) => {
        const chosen = choiceOf(answers?.["label"]);
        if (!chosen || !options.includes(chosen.choice)) return;
        const node = nodes[at]!;
        judged.set(node.id, { option: chosen.choice, confidence: chosen.confidence, split: chosen.margin < 0.15, basis: `${modelWord(named!)}: ${Math.round(chosen.confidence * 100)}% sure “${labelOf(definition, node)}” is ${chosen.choice}` });
      });
    } else if (step.floor) context.note(`Step ${context.index + 1}: no model was lent, so the floor decided.`);
    else return context.skipped("no model was lent and the step has no floor, so nothing was labeled.");

    // The floor's rules that are rule-language lines, each read once over the kind.
    const holding = new Map<string, ReadonlySet<string>>();
    const holds = (option: string) => (id: string) => {
      const expr = step.floor?.[option]?.expr;
      if (expr === undefined) return false;
      if (!holding.has(option)) holding.set(option, new Set(recordsOver(store, { kind, where: expr }, principal)));
      return holding.get(option)!.has(id);
    };

    let left = 0;
    let otherwise = 0;
    for (const node of nodes) {
      let label = judged.get(node.id);
      if (!label) {
        const floor = floorLabel(step.floor, textOf(node as Record<string, unknown>), (option) => holds(option)(node.id));
        if (floor && options.includes(floor.option)) label = { option: floor.option, confidence: 1, split: false, basis: `Sure: ${floor.basis}` };
      }
      if (!label && step.otherwise !== undefined && options.includes(step.otherwise)) {
        label = { option: step.otherwise, confidence: 1, split: false, basis: `${step.otherwise}, as no option cleared it` };
        otherwise++;
      }
      if (!label) {
        left++;
        continue;
      }
      const applies = classifyApplies(step, label.option, label.confidence);
      const ask = !applies && (classifyAsks(step, label.option) || label.split);
      const lineage = { basis: label.basis, confidence: label.confidence, ...(judged.has(node.id) && named ? { model: named } : {}) };
      const calls: MutationCall[] = [{ name: writes.mutation, args: { [writes.subjectArg]: node.id, [writes.arg]: label.option } }];
      context.change({ calls, ...lineage, severity: "categorize", ...(ask ? { ask: true } : applies ? { apply: true } : {}) });
      const threshold = step.setAside?.[label.option];
      if (threshold !== undefined && label.confidence >= threshold) {
        context.change({ calls: [{ name: `archive-${kind}`, args: { id: node.id } }], ...lineage, basis: `${label.basis}: set aside`, severity: "archive", ...(ask ? { ask: true } : applies ? { apply: true } : {}) });
      }
    }
    if (otherwise > 0) context.note(`Labeled ${many(otherwise, noun, pluralOf(schema, kind))} ${step.otherwise}: ${model ? "neither the model nor the floor" : "no floor rule"} found an option that fit.`);
    if (left > 0) context.note(`Left ${many(left, noun, pluralOf(schema, kind))} for a person: ${model ? "neither the model nor the floor" : "no floor rule"} labeled ${left === 1 ? "it" : "them"}.`);
  },
};
