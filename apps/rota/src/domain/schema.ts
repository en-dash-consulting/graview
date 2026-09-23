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
 * Three kinds and two edges is the whole domain. Everything else this app
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
    /*
     * WHERE IT HAPPENS, as a thing rather than a string. "The hall" typed
     * into ten shifts was ten strings that happened to agree: nothing could
     * say what goes on in the hall this week, a typo was a new room, and
     * the picture drew no line from a shift to where it is.
     */
    "held-at": {
      to: ["location"],
      cardinality: "one",
      description: "where it happens",
      inverse: "what happens here",
    },
  },
  display: {
    labels: { on: "Date", from: "From", until: "Until", day: "Day" },
    format: {
      from: (value) => clock(Number(value)),
      until: (value) => clock(Number(value)),
      day: (value) => String(value).toUpperCase(),
    },
  },
});

/** Somewhere shifts happen: a room, a yard, a van. */
export const location = defineNode("location", {
  description: "Somewhere shifts happen.",
  fields: z.object({
    label: z.string().min(1),
    /** What a first-timer needs to find it and get in. */
    directions: z.string().optional(),
  }),
  plural: "Locations",
  label: (node) => node.label,
  figure: "plot",
  display: { labels: { directions: "How to get in" } },
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
 * and carry their own types, so `RotaSchema` names all six — see the same
 * note in Things.
 */
export const rotaSchema = createSchema([shift, location, volunteer, rule, ...rotaInstallation.kinds]);
export type RotaSchema = typeof rotaSchema;
