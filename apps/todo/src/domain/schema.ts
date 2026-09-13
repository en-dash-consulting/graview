import { createSchema, defineNode, effectivity, isoDate, summarise } from "@graview/core";
import { todoInstallation } from "./installation.js";
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
  // A tray, open at the front: what a list actually looks like as a thing.
  figure: "list",
  edges: {
    holds: {
      to: ["task"],
      description: "the tasks on this list",
      // How it reads from the task's end. Same edge, and neither sentence
      // works in both places.
      inverse: "the list it is on",
    },
  },
  display: {
    // An ordering key is a fact about the storage, not about the list.
    hide: ["order"],
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
  figure: "task",
  // A lens asks for roles, not for field names. These are this app's words.
  fieldRoles: { start: "plannedAt", end: "plannedUntil", day: "day" },
  edges: {
    "waits-for": {
      to: ["task"],
      description: "what has to happen first",
      inverse: "what is waiting on this",
    },
  },
  /*
   * How a task READS.
   *
   * The framework renders a record from the declaration alone and can only get
   * so far on its own: `540` is a truthful rendering of a number of minutes
   * and a useless one, and `false` is not a word anybody says about a task.
   * These are decisions only this kind can make.
   */
  display: {
    labels: { due: "Due", plannedAt: "Blocked", plannedUntil: "Until", done: "Finished" },
    format: {
      plannedAt: (value) => clock(Number(value)),
      plannedUntil: (value) => clock(Number(value)),
      day: (value) => String(value).toUpperCase(),
    },
  },
});

/** Minutes from midnight, as a time somebody would say. */
function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

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
  // A set square, which is what a standard looks like.
  figure: "rule",
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
  /*
   * A NOTE THAT OUTLIVES WHOEVER WROTE IT DOES NOT GET REWRITTEN.
   *
   * `explain` makes one and no act changes it, which `graview check` reads
   * as a field nobody can ever set — a hole — unless the declaration says
   * the emptiness is the point. It is: the edge is append-only for the same
   * reason, and a rationale you can quietly edit afterwards is not a
   * rationale. (The warning only surfaced once this app had a policy: with
   * no policy every derived edit is permitted, so "nobody may run it" was
   * trivially false and the hole stayed hidden.)
   */
  fixed: { text: "the argument as it was made, kept in the words it was made in" },
  plural: "Reasons",
  // Shortened at a word boundary, and the full text is the heading on a page.
  label: (node) => summarise(node.text),
  figure: "note",
  edges: {
    explains: {
      to: ["task", "list"],
      description: "what this is about",
      inverse: "why this is here",
      // A note that outlives whoever wrote it does not get unwritten.
      // Declared, so the missing severer reads as a decision, not a hole.
      appendOnly: true,
    },
  },
});

/*
 * THE DOMAIN, AND WHO IS HERE.
 *
 * The installation's two kinds join the schema as ordinary kinds — there is
 * no second registry for people, and every derived thing (a record page, an
 * edit act, a district, a lens) works on them unasked. Whether they are
 * DRAWN is a matter for the policy: the module they belong to is shown only
 * to a seat that may administer it.
 *
 * They are spread in as an empty tuple so that `TodoSchema` keeps naming
 * this app's own four kinds. `declareInstallation` widens its kinds to
 * `AnyNodeDefinition[]`, and letting that widening into the schema type
 * would cost every call site in the app its kind names to buy nothing —
 * the two installation kinds are reached by name, through the framework's
 * own surfaces, and never through this type.
 */
const whoIsHere = todoInstallation.kinds as unknown as readonly [];
export const todoSchema = createSchema([list, task, rule, reason, ...whoIsHere]);
export type TodoSchema = typeof todoSchema;
