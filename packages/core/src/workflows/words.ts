import type { WorkflowTrigger } from "../workflow-shape.js";
import { scheduleWords } from "./schedule.js";
import { withArticle } from "../schema/define-node.js";
import { kindNoun, type KindNoun } from "./steps.js";

/*
 * A WORKFLOW IN A SENTENCE: what starts it, then what it does — "Every
 * Sunday at 6 PM, and when a grocery list is made: fill out next week's
 * events". Each kind by its noun: the declaration's, where the caller
 * hands it (`noun`), else its name read as words.
 */

const listed = (said: readonly string[]): string => (said.length <= 2 ? said.join(" and ") : `${said.slice(0, -1).join(", ")} and ${said.at(-1)}`);

/** One trigger in words: "every Sunday at 6 PM", "when a grocery list is made". */
export function triggerWords(trigger: WorkflowTrigger, noun: KindNoun = kindNoun): string {
  if ("every" in trigger || "cron" in trigger) return scheduleWords(trigger);
  if ("made" in trigger) return `when ${withArticle(noun(trigger.made))} is made${trigger.where ? ` where ${trigger.where}` : ""}`;
  if ("changed" in trigger) return `when ${withArticle(noun(trigger.changed))}${trigger.fields?.length ? `'s ${listed(trigger.fields)}` : ""} changes${trigger.where ? ` where ${trigger.where}` : ""}`;
  if ("synced" in trigger) return `when the connection “${trigger.synced}” finishes a pass`;
  return "when somebody runs it";
}

/** A workflow in a sentence. */
export function workflowWords(workflow: { readonly title: string; readonly when: readonly WorkflowTrigger[] }, noun: KindNoun = kindNoun): string {
  const when = workflow.when.map((trigger) => triggerWords(trigger, noun));
  const said = when.length <= 2 ? when.join(", and ") : `${when.slice(0, -1).join(", ")}, and ${when.at(-1)}`;
  const start = said.charAt(0).toUpperCase() + said.slice(1);
  return `${start}: ${workflow.title.charAt(0).toLowerCase()}${workflow.title.slice(1)}`;
}
