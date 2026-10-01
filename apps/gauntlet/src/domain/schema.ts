import { createSchema, defineNode, isoDate } from "@graview/core";
import { z } from "@graview/core";

/**
 * THE PROGRAMME OF A CONFERENCE, TEN YEARS OF IT — AND BUILT TO BE AWKWARD.
 *
 * Every other example here is tame: short unique ASCII names, one kind with
 * a `label` field, one person, seats that may do everything, a few dozen
 * nodes, each edge name used once and one relation per pair. Six walks
 * found a hundred and fifty bugs whose "harness that should have caught it"
 * was, again and again, that no fixture had the shape a real domain has.
 *
 * So this one has them all, on purpose, in a domain where each is ordinary:
 *
 * - talk titles 60–120 characters long that share their first forty
 *   ("Towards Reproducible Builds in Large Monorepos: …"), in German,
 *   Japanese and Arabic as well as English (W-093, W-130, W-137, W-146);
 * - "Opening Remarks" every year, three speakers called Wei Zhang, a María
 *   García and a Maria Garcia whose names fold to one id (W-112);
 * - "Machine learning" beside "Machine Learning", "Aula" beside "Aula
 *   Magna" (W-141);
 * - a speaker and a room with no `label` field — the name is built from
 *   fields of their own (W-134), and a `staff` kind whose id is a mass
 *   noun (W-131);
 * - `held-in` and `about` declared on two kinds each (W-097);
 * - a talk proposed by and presented by the same speaker: two relations
 *   between one pair (W-101);
 * - relations that hold one (`proposed-by`, `in-session`, `held-in`,
 *   `chaired-by`) read from their declaring end (W-135);
 * - talks withdrawn and rejected, workshops cancelled: a lifecycle with
 *   retired members (W-105);
 * - a calendar over talks AND workshops (W-144), and a policy that refuses
 *   a volunteer almost everything (W-115), sat at by people and an agent
 *   whose ids are not their names (W-114);
 * - and real size: about four thousand records (W-122).
 *
 * `tests/the-awkward-shapes.test.ts` holds each of these, so an edit that
 * quietly tames the data fails by the shape's name.
 */

/** A start time a calendar can place: a day and a time of day. */
const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "expected YYYY-MM-DDTHH:MM");

/** Something a person stands up and says, for twenty minutes or for five. */
export const talk = defineNode("talk", {
  description: "A talk submitted to the programme: given, scheduled, still in review, withdrawn or turned down.",
  fields: z.object({
    // Not `label`: a talk has a title, and the kind says so.
    title: z.string().min(1).max(160),
    format: z.enum(["talk", "lightning", "keynote", "panel"]),
    status: z.enum(["submitted", "accepted", "scheduled", "given", "withdrawn", "rejected"]),
    /** When it starts, where it has been given a slot. */
    startsAt: dateTime.optional(),
    /** Minutes. */
    minutes: z.number().int().min(5).max(180).optional(),
    abstract: z.string().max(4000).optional(),
  }),
  edges: {
    "presented-by": {
      to: ["speaker"],
      description: "who presents it",
      inverse: "the talks they present",
    },
    /*
     * TWO RELATIONS BETWEEN ONE PAIR. Almost every talk is proposed by one
     * of the people who present it, so a talk and its speaker are tied
     * twice — and each tie must be drawn, picked and severed on its own.
     */
    "proposed-by": {
      to: ["speaker"],
      cardinality: "one",
      description: "who proposed it",
      inverse: "the talks they proposed",
    },
    "in-session": {
      to: ["session"],
      cardinality: "one",
      description: "the session it is in",
      inverse: "the talks in it",
    },
    about: {
      to: ["topic"],
      description: "what it is about",
      inverse: "what is about it",
    },
  },
  plural: "Talks",
  label: (node) => node.title,
  fieldRoles: { start: "startsAt" },
  lifecycle: { field: "status", retired: ["withdrawn", "rejected"] },
  display: {
    labels: { startsAt: "Starts", minutes: "Length" },
    format: { minutes: (value) => `${String(value)} min` },
  },
});

/** Somebody who has stood up and said something, or proposed to. */
export const speaker = defineNode("speaker", {
  description: "Somebody who proposes, presents, chairs or leads.",
  /*
   * NO LABEL FIELD. A person's name is two fields of their own, and the
   * name every surface draws is built from them — so a glance that
   * repeats the given name under the heading is saying the heading twice.
   */
  fields: z.object({
    given: z.string().min(1).max(80),
    family: z.string().max(80),
    affiliation: z.string().max(120).optional(),
    country: z.string().max(60).optional(),
    /** Whether they have collected their badge this year. */
    checkedIn: z.boolean().optional(),
  }),
  plural: "Speakers",
  label: (node) => (node.family ? `${node.given} ${node.family}` : node.given),
  display: { labels: { given: "Given name", family: "Family name", checkedIn: "Checked in" } },
});

/** A block of the timetable, in one room, with somebody in the chair. */
export const session = defineNode("session", {
  description: "A block of the timetable: one room, one chair, several talks.",
  fields: z.object({
    label: z.string().min(1).max(160),
    day: isoDate,
  }),
  edges: {
    "held-in": {
      to: ["room"],
      cardinality: "one",
      description: "the room it is held in",
      inverse: "what is held there",
    },
    "chaired-by": {
      to: ["speaker"],
      cardinality: "one",
      description: "who chairs it",
      inverse: "the sessions they chair",
    },
  },
  plural: "Sessions",
  label: (node) => node.label,
});

/** Half a day with a laptop open, for a room of twenty. */
export const workshop = defineNode("workshop", {
  description: "A hands-on session with a capacity: planned, full or cancelled.",
  fields: z.object({
    label: z.string().min(1).max(160),
    startsAt: dateTime,
    capacity: z.number().int().min(1).max(500),
    status: z.enum(["planned", "full", "cancelled"]),
  }),
  edges: {
    /*
     * ONE EDGE NAME ON TWO KINDS, in the same words: a session is held in a
     * room and so is a workshop, and a room lists both under one reading.
     */
    "held-in": {
      to: ["room"],
      cardinality: "one",
      description: "the room it is held in",
      inverse: "what is held there",
    },
    "led-by": {
      to: ["speaker"],
      description: "who leads it",
      inverse: "the workshops they lead",
    },
    about: {
      to: ["topic"],
      description: "what it is about",
      inverse: "what is about it",
    },
  },
  plural: "Workshops",
  label: (node) => node.label,
  fieldRoles: { start: "startsAt" },
  lifecycle: { field: "status", retired: ["cancelled"] },
});

/** Somewhere to sit and listen. */
export const room = defineNode("room", {
  description: "A room the conference uses, in a building of the venue.",
  // No label field either: a room is a building and a name in it.
  fields: z.object({
    building: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    seats: z.number().int().min(1).max(5000),
  }),
  plural: "Rooms",
  label: (node) => node.name,
});

/** Subject matter a talk or a workshop is about. */
export const topic = defineNode("topic", {
  description: "Subject matter, as the committee tags it.",
  fields: z.object({ label: z.string().min(1).max(80) }),
  plural: "Topics",
  label: (node) => node.label,
});

/**
 * THE STAFF: a mass noun for a kind. One of them is a staff member, never
 * "a staff", and nothing about the id says so.
 */
export const staff = defineNode("staff", {
  description: "The people who run the venue on the day.",
  fields: z.object({
    name: z.string().min(1).max(100),
    duty: z.enum(["registration", "av", "stewarding", "catering", "accessibility"]),
  }),
  edges: {
    "looks-after": {
      to: ["room"],
      description: "the rooms they look after",
      inverse: "who looks after it",
    },
  },
  plural: "Staff",
  noun: "staff member",
  label: (node) => node.name,
});

export const gauntletSchema = createSchema([talk, speaker, session, workshop, room, topic, staff]);
export type GauntletSchema = typeof gauntletSchema;
