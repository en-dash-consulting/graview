import { bindSchema, isCurrent, labelOf, type Violation } from "@graview/core";
import { gauntletSchema } from "./schema.js";

const { defineInvariant } = bindSchema(gauntletSchema);

/**
 * A talk with a slot is in a session. "Scheduled" with no session is a
 * talk the timetable says is happening somewhere nobody can find.
 */
export const aSlotIsInASession = defineInvariant("a-slot-is-in-a-session", {
  label: "A scheduled talk is in a session",
  description: "A talk that is scheduled or given is in a session.",
  scope: { kind: "talk" },
  repairs: ["schedule-talk"],
  evaluate({ graph, subject }): Violation[] {
    if (subject.status !== "scheduled" && subject.status !== "given") return [];
    if (graph.out(subject.id, "in-session").length > 0) return [];
    return [
      {
        invariant: "a-slot-is-in-a-session",
        subjectId: subject.id,
        label: subject.title,
        message: `${subject.title} is ${subject.status} but in no session`,
        nodeIds: [subject.id],
        repairs: [{ mutation: "schedule-talk", args: { id: subject.id }, missing: ["sessionId", "startsAt"], label: `Give ${subject.title} a session` }],
      },
    ];
  },
});

/** A workshop fits its room: no more places than the room has seats. */
export const aWorkshopFitsItsRoom = defineInvariant("a-workshop-fits-its-room", {
  label: "A workshop fits its room",
  description: "A workshop's capacity is no more than its room's seats.",
  scope: { kind: "workshop" },
  repairs: ["hold-in", "edit-workshop"],
  evaluate({ graph, subject }): Violation[] {
    if (subject.status === "canceled") return [];
    return graph
      .out(subject.id, "held-in")
      .flatMap((room) => (room.kind === "room" && subject.capacity > room.seats ? [room] : []))
      .map((room) => ({
        invariant: "a-workshop-fits-its-room",
        subjectId: subject.id,
        label: subject.label,
        message: `${subject.label} takes ${subject.capacity} and ${room.name} seats ${room.seats}`,
        nodeIds: [subject.id, room.id],
        repairs: [
          { mutation: "hold-in", args: { itemId: subject.id }, missing: ["roomId"], label: `Move ${subject.label} to a bigger room` },
          { mutation: "edit-workshop", args: { id: subject.id }, missing: ["capacity"], label: `Take fewer places on ${subject.label}` },
        ],
      }));
  },
});

/**
 * TWO KINDS SHARING A FIELD, IN ONE RULE (carried from walks XI and XII).
 * A workshop's leader is free on its day: somebody who leads a workshop is
 * not presenting a talk that same day. The rule names the workshop and the
 * talks together, and a talk and a workshop each have a `status` of their
 * own words — "scheduled" is no workshop's, "planned" no talk's — so the
 * records chosen through the problem are two kinds sharing a field name.
 * A shelter's kennel and its animals, chosen this way, were offered "Align
 * the status" with a value the kennel's input refused (W-228); no example
 * had the shape until this one.
 */
export const aLeaderIsFreeOnTheirWorkshopsDay = defineInvariant("a-leader-is-free-on-their-workshops-day", {
  label: "A workshop's leader is free that day",
  description: "Somebody who leads a workshop is not presenting a talk on the same day.",
  scope: { kind: "workshop" },
  repairs: ["unlead"],
  evaluate({ graph, subject }): Violation[] {
    if (subject.status === "canceled") return [];
    const day = subject.startsAt.slice(0, 10);
    const talkKind = gauntletSchema.definition("talk");
    return graph.out(subject.id, "led-by").flatMap((leader): Violation[] => {
      const talks = graph
        .in(leader.id, "presented-by")
        .filter((talk) => talk.kind === "talk" && isCurrent(talkKind, talk as never) && String(talk.startsAt ?? "").slice(0, 10) === day);
      if (talks.length === 0) return [];
      const who = labelOf(gauntletSchema.tryDefinition(leader.kind), leader as never);
      return [
        {
          invariant: "a-leader-is-free-on-their-workshops-day",
          subjectId: subject.id,
          label: subject.label,
          message: `${who} leads ${subject.label} and presents ${talks.length === 1 ? "a talk" : `${talks.length} talks`} that day`,
          nodeIds: [subject.id, ...talks.map((talk) => talk.id)],
          repairs: [{ mutation: "unlead", args: { workshopId: subject.id, speakerId: leader.id }, label: `Find ${subject.label} a leader other than ${who}` }],
        },
      ];
    });
  },
});

export const invariants = [aSlotIsInASession, aWorkshopFitsItsRoom, aLeaderIsFreeOnTheirWorkshopsDay];
