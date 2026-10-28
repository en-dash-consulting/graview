import type { WorkflowTrigger } from "../workflow-shape.js";
import { scheduleWords } from "./schedule.js";
import { kindWords } from "./step-act.js";

/*
 * A WORKFLOW IN A SENTENCE: what starts it, then what it does — "Every
 * Sunday at 6 PM, and when a grocery list is made: fill out next week's
 * events". Kinds are said as their names read; a page that has the app's
 * nouns says its own.
 */

const article = (noun: string): string => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
const listed = (said: readonly string[]): string => (said.length <= 2 ? said.join(" and ") : `${said.slice(0, -1).join(", ")} and ${said.at(-1)}`);

/** One trigger in words: "every Sunday at 6 PM", "when a grocery list is made". */
export function triggerWords(trigger: WorkflowTrigger): string {
  if ("every" in trigger || "cron" in trigger) return scheduleWords(trigger);
  if ("made" in trigger) return `when ${article(kindWords(trigger.made))} is made${trigger.where ? ` where ${trigger.where}` : ""}`;
  if ("changed" in trigger) return `when ${article(kindWords(trigger.changed))}${trigger.fields?.length ? `'s ${listed(trigger.fields)}` : ""} changes${trigger.where ? ` where ${trigger.where}` : ""}`;
  if ("synced" in trigger) return `when the ${kindWords(trigger.synced)} connection finishes a pass`;
  return "when somebody runs it";
}

/** A workflow in a sentence. */
export function workflowWords(workflow: { readonly title: string; readonly when: readonly WorkflowTrigger[] }): string {
  const when = workflow.when.map(triggerWords);
  const said = when.length <= 2 ? when.join(", and ") : `${when.slice(0, -1).join(", ")}, and ${when.at(-1)}`;
  const start = said.charAt(0).toUpperCase() + said.slice(1);
  return `${start}: ${workflow.title.charAt(0).toLowerCase()}${workflow.title.slice(1)}`;
}
