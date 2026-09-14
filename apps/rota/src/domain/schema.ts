import { createSchema, defineNode, isoDate } from "@graview/core";
import { z } from "zod";
import { rotaInstallation } from "./installation.js";

/**
 * A VOLUNTEER SHIFT ROSTER, which is the shape a real product has.
 *
 * Things is the example nobody has to be taught and Seedbed is the one that
 * grows a chapter at a time; neither is what a person would actually ship.
 * Rota is: a domain with a real relation in it, three roles who want
 * different things, rules an organiser would argue about, a brand of its
 * own, a stored history that outlives a deployment, and a face somebody
 * would put in front of a committee.
 *
 * Two kinds and one edge is the whole domain. Everything else this app
 * demonstrates — the installation, the policy, the migration, the studio —
 * is the framework, which is the point: a small domain carrying a large
 * platform is the honest demonstration of a platform.
 */

/** A stretch of time somebody has to be there for. */
export const shift = defineNode("shift", {
  description: "A stretch of time somebody has to be there for.",
  fields: z.object({
    label: z.string().min(1),
    /** The day it happens. A roster is planned in days, not in hours. */
    on: isoDate,
    /** Minutes from midnight, so the timeline lens can draw a week of them. */
    from: z.number().int().min(0).max(1439),
    until: z.number().int().min(0).max(1440),
    /** Which day of the week it falls on, for the week grid. */
    day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    /** Somewhere it happens. A roster with two rooms is a different roster. */
    place: z.string().min(1),
    notes: z.string().optional(),
  }),
  plural: "Shifts",
  label: (node) => node.label,
  // A block of time with its hours ruled across it.
  figure: "shift",
  // A lens asks for roles, not for field names. These are this app's words.
  fieldRoles: { start: "from", end: "until", day: "day" },
  edges: {
    "covered-by": {
      to: ["volunteer"],
      description: "who is covering it",
      // How it reads from the volunteer's end. Same edge, and neither
      // sentence works in both places.
      inverse: "what they are covering",
    },
  },
  display: {
    labels: { on: "Date", from: "From", until: "Until", place: "Where", day: "Day" },
    format: {
      from: (value) => clock(Number(value)),
      until: (value) => clock(Number(value)),
      day: (value) => String(value).toUpperCase(),
    },
  },
});

/** Somebody who has said they will turn up. */
export const volunteer = defineNode("volunteer", {
  description: "Somebody who has said they will turn up.",
  fields: z.object({
    label: z.string().min(1),
    /** How to reach them, which is the whole administrative burden of a rota. */
    phone: z.string().min(3),
    /**
     * The most they are willing to do in a week. A rota that asks somebody
     * for a seventh shift is how you lose a volunteer, so the number is a
     * fact about them and a rule can hold the roster to it.
     */
    limit: z.number().int().min(1).max(14),
    status: z.enum(["available", "away", "left"]),
  }),
  plural: "Volunteers",
  label: (node) => node.label,
  figure: "person",
  // Somebody who has left keeps everything they did and leaves the picture.
  lifecycle: { field: "status", retired: ["left"] },
  display: { labels: { limit: "Most per week", phone: "Phone" } },
});

/**
 * A rule, as a node — so somebody on the committee can read it, argue with
 * it and change the number without a deploy.
 */
export const rule = defineNode("rule", {
  description: "Something this roster holds itself to.",
  fields: z.object({
    label: z.string().min(1),
    spec: z.union([
      z.object({ type: z.literal("every-shift-covered") }),
      z.object({ type: z.literal("nobody-over-their-limit") }),
    ]),
  }),
  plural: "Rules",
  label: (node) => node.label,
  figure: "rule",
});

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/*
 * The domain, and WHO IS HERE. The installation's kinds are ordinary kinds
 * and carry their own types, so `RotaSchema` names all five — see the same
 * note in Things.
 */
export const rotaSchema = createSchema([shift, volunteer, rule, ...rotaInstallation.kinds]);
export type RotaSchema = typeof rotaSchema;
