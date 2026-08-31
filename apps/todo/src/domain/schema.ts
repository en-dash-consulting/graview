import { createSchema, defineNode, effectivity, isoDate, summarise } from "@graview/core";
import { z } from "zod";

/**
 * A todo list, which is the point.
 *
 * Every other app in this repository was built to prove something specific
 * about the framework, and each asks a reader to learn a domain first — a
 * household's temporal effectivity, a tender's coverage matrix, a football
 * club's formation-to-drill chain. This one asks nothing. Everybody already
 * knows what a task is, so everything on the screen is about GRAVIEW rather
 * than about the domain.
 *
 * It is small and it is not a toy: a kind, an edge that means something, rules
 * that name their own repairs, a lens reused from another domain entirely, and
 * an agent seat. That is the whole shape of the framework in about two hundred
 * lines of declaration.
 */

const dayOfWeek = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

/** Somewhere tasks live. A project, a context, a day — the app does not care. */
export const list = defineNode("list", {
  description: "A place tasks live: a project, a context, a someday pile.",
  fields: z.object({
    label: z.string().min(1),
    /** Ordering is data, so moving a list is a mutation rather than a drag handler. */
    order: z.number().int().min(0),
  }),
  plural: "Lists",
  label: (node) => node.label,
  edges: {
    holds: { to: ["task"], description: "the tasks in this list" },
  },
});

export const task = defineNode("task", {
  description: "One thing to do.",
  fields: z.object({
    label: z.string().min(1),
    done: z.boolean(),
    /** Absent means no date, which is different from a date in the past. */
    due: isoDate.optional(),
    /*
     * WHEN YOU HAVE ACTUALLY BLOCKED TIME FOR IT.
     *
     * A due date says when something is needed; these say when you intend to
     * do it, which is a different fact and the one a week can be drawn from.
     * Absent means unplanned, and an unplanned task simply does not appear on
     * the week — which is the honest answer rather than inventing a slot.
     *
     * Minutes from midnight, and a weekday, because that is what the timeline
     * lens asks for. The lens has never heard of a task; this app answers its
     * roles with its own fields, and that is the whole integration.
     */
    day: dayOfWeek.optional(),
    plannedAt: z.number().int().min(0).max(1439).optional(),
    plannedUntil: z.number().int().min(0).max(1440).optional(),
    notes: z.string().optional(),
  }),
  plural: "Tasks",
  label: (node) => node.label,
  // A lens asks for roles, not for field names. These are this app's words.
  fieldRoles: { start: "plannedAt", end: "plannedUntil", day: "day" },
  edges: {
    "waits-for": {
      to: ["task"],
      description: "what has to happen first",
    },
  },
});

/**
 * A rule, as a node.
 *
 * The third construct this app shows, and the one people are most surprised
 * by: the rules a domain enforces are DATA. That is what puts them on screen
 * where somebody can argue with one, and what lets `graview check` report a
 * rule whose invariant nobody registered.
 */
export const rule = defineNode("rule", {
  description: "Something this list holds itself to.",
  fields: z.object({
    label: z.string().min(1),
    spec: z.union([
      z.object({ type: z.literal("nothing-done-before-what-it-waits-for") }),
      z.object({ type: z.literal("nothing-overdue") }),
      z.object({ type: z.literal("a-list-is-not-a-heap") }),
    ]),
    ...effectivity,
  }),
  plural: "Rules",
  label: (node) => node.label,
});

/**
 * Why something is on the list at all.
 *
 * The smallest possible version of an idea every app here uses: a note that
 * outlives whoever wrote it, attached to the thing it explains. A `waits-for`
 * edge says what blocks a task; a reason says why anyone cares.
 */
export const reason = defineNode("reason", {
  description: "Why something is here, in whoever's words.",
  fields: z.object({ text: z.string().min(1) }),
  plural: "Reasons",
  // Shortened at a word boundary, and the full text is the heading on a page.
  label: (node) => summarise(node.text),
  edges: {
    explains: { to: ["task", "list"], description: "what this is about" },
  },
});

export const todoSchema = createSchema([list, task, rule, reason]);
export type TodoSchema = typeof todoSchema;
