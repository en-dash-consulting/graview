import { bindSchema, type Violation } from "@graview/core";
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

export const invariants = [aSlotIsInASession, aWorkshopFitsItsRoom];
