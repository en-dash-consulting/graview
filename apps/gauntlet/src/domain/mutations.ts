import { bindSchema, isoDate, nodeRef, UNSET, type GraphReader } from "@graview/core";
import { z } from "@graview/core";
import { gauntletSchema, speaker as speakerKind, room as roomKind } from "./schema.js";

const { defineMutation } = bindSchema(gauntletSchema);

type Reader = GraphReader<{ id: string; kind: string } & Record<string, unknown>>;

/** A record's name as every surface draws it: through its kind's own `label`. */
const nameOf = (graph: unknown, id: string): string => {
  const node = (graph as Reader).getNode(id);
  if (!node) return id;
  const label = gauntletSchema.tryDefinition(node.kind)?.label as ((n: unknown) => string) | undefined;
  return label ? label(node) : id;
};

const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "expected YYYY-MM-DDTHH:MM");

/* --------------------------------------------------------------- talks */

export const submitTalk = defineMutation("submit-talk", {
  title: "Submit a talk",
  description: "Propose a talk to the programme, presented by the speaker who proposes it.",
  creates: ["talk"],
  input: z.object({
    title: z.string().min(1).max(160),
    format: z.enum(["talk", "lightning", "keynote", "panel"]),
    speakerId: nodeRef(["speaker"]),
  }),
  describe: (args, graph) => `${nameOf(graph, args.speakerId)} submits ${args.title}`,
  apply(ctx, args) {
    const id = ctx.freshId(args.title, "talk");
    ctx.addNode({ id, kind: "talk", title: args.title, format: args.format, status: "submitted" });
    ctx.addEdge({ kind: "proposed-by", from: id, to: args.speakerId });
    ctx.addEdge({ kind: "presented-by", from: id, to: args.speakerId });
  },
});

export const acceptTalk = defineMutation("accept-talk", {
  title: "Accept it",
  description: "Accept a submitted talk onto the programme.",
  subject: { kinds: ["talk"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["talk"]) }),
  describe: (args, graph) => `Accept ${nameOf(graph, args.id)}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "accepted" });
  },
});

export const rejectTalk = defineMutation("reject-talk", {
  title: "Turn it down",
  description: "Turn a submitted talk down. It leaves the programme, never the record.",
  subject: { kinds: ["talk"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["talk"]) }),
  describe: (args, graph) => `Turn down ${nameOf(graph, args.id)}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "rejected" });
  },
});

export const withdrawTalk = defineMutation("withdraw-talk", {
  title: "Withdraw it",
  description: "Take a talk off the programme at the speaker's request.",
  subject: { kinds: ["talk"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["talk"]) }),
  describe: (args, graph) => `Withdraw ${nameOf(graph, args.id)}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "withdrawn" });
  },
});

export const scheduleTalk = defineMutation("schedule-talk", {
  title: "Give it a slot",
  fromTheOtherEnd: "Put a talk in this session",
  description: "Put an accepted talk in a session, at a time.",
  subject: { kinds: ["talk"], arg: "id" },
  writes: ["status", "startsAt"],
  connects: ["in-session"],
  severs: ["in-session"],
  input: z.object({ id: nodeRef(["talk"]), sessionId: nodeRef(["session"]), startsAt: dateTime }),
  describe: (args, graph) => `Put ${nameOf(graph, args.id)} in ${nameOf(graph, args.sessionId)} at ${args.startsAt.slice(11)}`,
  apply(ctx, args) {
    for (const session of ctx.graph.out(args.id, "in-session")) ctx.removeEdge({ kind: "in-session", from: args.id, to: session.id });
    ctx.addEdge({ kind: "in-session", from: args.id, to: args.sessionId });
    ctx.patchNode(args.id, { status: "scheduled", startsAt: args.startsAt });
  },
});

export const unscheduleTalk = defineMutation("unschedule-talk", {
  title: "Take its slot away",
  fromTheOtherEnd: "Take a talk out of this session",
  description: "Take a talk out of its session; it stays accepted.",
  subject: { kinds: ["talk"], arg: "id" },
  writes: ["status", "startsAt"],
  severs: ["in-session"],
  input: z.object({ id: nodeRef(["talk"]), sessionId: nodeRef(["session"]) }),
  describe: (args, graph) => `Take ${nameOf(graph, args.id)} out of ${nameOf(graph, args.sessionId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "in-session", from: args.id, to: args.sessionId });
    ctx.patchNode(args.id, { status: "accepted", startsAt: UNSET });
  },
});

export const addPresenter = defineMutation("add-presenter", {
  title: "Add a presenter",
  fromTheOtherEnd: "Have them present a talk",
  description: "Say somebody else presents a talk too.",
  subject: { kinds: ["talk"], arg: "talkId" },
  connects: ["presented-by"],
  input: z.object({ talkId: nodeRef(["talk"]), speakerId: nodeRef(["speaker"]) }),
  describe: (args, graph) => `${nameOf(graph, args.speakerId)} presents ${nameOf(graph, args.talkId)}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "presented-by", from: args.talkId, to: args.speakerId });
  },
});

export const removePresenter = defineMutation("remove-presenter", {
  title: "Drop a presenter",
  fromTheOtherEnd: "Drop them from a talk",
  description: "Say somebody no longer presents a talk.",
  subject: { kinds: ["talk"], arg: "talkId" },
  severs: ["presented-by"],
  input: z.object({ talkId: nodeRef(["talk"]), speakerId: nodeRef(["speaker"]) }),
  describe: (args, graph) => `${nameOf(graph, args.speakerId)} no longer presents ${nameOf(graph, args.talkId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "presented-by", from: args.talkId, to: args.speakerId });
  },
});

export const reassignProposer = defineMutation("reassign-proposer", {
  title: "Say who proposed it",
  fromTheOtherEnd: "Say they proposed a talk",
  description: "Name the one speaker who proposed a talk.",
  subject: { kinds: ["talk"], arg: "talkId" },
  connects: ["proposed-by"],
  severs: ["proposed-by"],
  input: z.object({ talkId: nodeRef(["talk"]), speakerId: nodeRef(["speaker"]) }),
  describe: (args, graph) => `${nameOf(graph, args.talkId)} was proposed by ${nameOf(graph, args.speakerId)}`,
  apply(ctx, args) {
    for (const one of ctx.graph.out(args.talkId, "proposed-by")) ctx.removeEdge({ kind: "proposed-by", from: args.talkId, to: one.id });
    ctx.addEdge({ kind: "proposed-by", from: args.talkId, to: args.speakerId });
  },
});

/* ---------------------------------------------- what things are about */

export const tag = defineMutation("tag", {
  title: "Say what it is about",
  fromTheOtherEnd: "Tag something with it",
  description: "Tag a talk or a workshop with a topic.",
  subject: { kinds: ["talk", "workshop"], arg: "itemId" },
  connects: ["about"],
  input: z.object({ itemId: nodeRef(["talk", "workshop"]), topicId: nodeRef(["topic"]) }),
  describe: (args, graph) => `${nameOf(graph, args.itemId)} is about ${nameOf(graph, args.topicId)}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "about", from: args.itemId, to: args.topicId });
  },
});

export const untag = defineMutation("untag", {
  title: "Say it is not about that",
  fromTheOtherEnd: "Untag something",
  description: "Take a topic off a talk or a workshop.",
  subject: { kinds: ["talk", "workshop"], arg: "itemId" },
  severs: ["about"],
  input: z.object({ itemId: nodeRef(["talk", "workshop"]), topicId: nodeRef(["topic"]) }),
  describe: (args, graph) => `${nameOf(graph, args.itemId)} is no longer about ${nameOf(graph, args.topicId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "about", from: args.itemId, to: args.topicId });
  },
});

/* ---------------------------------------------------- the timetable */

export const addSession = defineMutation("add-session", {
  title: "Add a session",
  description: "Add a block of the timetable on a day.",
  creates: ["session"],
  input: z.object({ label: z.string().min(1).max(160), day: isoDate }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "session"), kind: "session", label: args.label, day: args.day });
  },
});

export const holdIn = defineMutation("hold-in", {
  title: "Say which room",
  fromTheOtherEnd: "Hold something here",
  description: "Put a session or a workshop in a room.",
  subject: { kinds: ["session", "workshop"], arg: "itemId" },
  connects: ["held-in"],
  severs: ["held-in"],
  input: z.object({ itemId: nodeRef(["session", "workshop"]), roomId: nodeRef(["room"]) }),
  describe: (args, graph) => `Hold ${nameOf(graph, args.itemId)} in ${nameOf(graph, args.roomId)}`,
  apply(ctx, args) {
    for (const one of ctx.graph.out(args.itemId, "held-in")) ctx.removeEdge({ kind: "held-in", from: args.itemId, to: one.id });
    ctx.addEdge({ kind: "held-in", from: args.itemId, to: args.roomId });
  },
});

export const chair = defineMutation("chair", {
  title: "Name the chair",
  fromTheOtherEnd: "Have them chair a session",
  description: "Say who chairs a session.",
  subject: { kinds: ["session"], arg: "sessionId" },
  connects: ["chaired-by"],
  severs: ["chaired-by"],
  input: z.object({ sessionId: nodeRef(["session"]), speakerId: nodeRef(["speaker"]) }),
  describe: (args, graph) => `${nameOf(graph, args.speakerId)} chairs ${nameOf(graph, args.sessionId)}`,
  apply(ctx, args) {
    for (const one of ctx.graph.out(args.sessionId, "chaired-by")) ctx.removeEdge({ kind: "chaired-by", from: args.sessionId, to: one.id });
    ctx.addEdge({ kind: "chaired-by", from: args.sessionId, to: args.speakerId });
  },
});

/* ------------------------------------------------------------ workshops */

export const addWorkshop = defineMutation("add-workshop", {
  title: "Add a workshop",
  description: "Plan a hands-on workshop with a capacity.",
  creates: ["workshop"],
  input: z.object({ label: z.string().min(1).max(160), startsAt: dateTime, capacity: z.number().int().min(1).max(500) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "workshop"), kind: "workshop", label: args.label, startsAt: args.startsAt, capacity: args.capacity, status: "planned" });
  },
});

export const cancelWorkshop = defineMutation("cancel-workshop", {
  title: "Cancel it",
  description: "Cancel a workshop. It leaves the timetable, never the record.",
  subject: { kinds: ["workshop"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["workshop"]) }),
  describe: (args, graph) => `Cancel ${nameOf(graph, args.id)}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "cancelled" });
  },
});

export const lead = defineMutation("lead", {
  title: "Add a leader",
  fromTheOtherEnd: "Have them lead a workshop",
  description: "Say somebody leads a workshop.",
  subject: { kinds: ["workshop"], arg: "workshopId" },
  connects: ["led-by"],
  input: z.object({ workshopId: nodeRef(["workshop"]), speakerId: nodeRef(["speaker"]) }),
  describe: (args, graph) => `${nameOf(graph, args.speakerId)} leads ${nameOf(graph, args.workshopId)}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "led-by", from: args.workshopId, to: args.speakerId });
  },
});

export const unlead = defineMutation("unlead", {
  title: "Drop a leader",
  fromTheOtherEnd: "Drop them from a workshop",
  description: "Say somebody no longer leads a workshop.",
  subject: { kinds: ["workshop"], arg: "workshopId" },
  severs: ["led-by"],
  input: z.object({ workshopId: nodeRef(["workshop"]), speakerId: nodeRef(["speaker"]) }),
  describe: (args, graph) => `${nameOf(graph, args.speakerId)} no longer leads ${nameOf(graph, args.workshopId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "led-by", from: args.workshopId, to: args.speakerId });
  },
});

/* ---------------------------------------------------- people and places */

export const addSpeaker = defineMutation("add-speaker", {
  title: "Add a speaker",
  description: "Add somebody who proposes, presents, chairs or leads.",
  creates: ["speaker"],
  input: z.object({ given: z.string().min(1).max(80), family: z.string().max(80), affiliation: z.string().max(120).optional() }),
  describe: (args) => `Add ${speakerKind.label!({ id: "", ...args } as never)}`,
  apply(ctx, args) {
    const name = args.family ? `${args.given} ${args.family}` : args.given;
    ctx.addNode({ id: ctx.freshId(name, "speaker"), kind: "speaker", given: args.given, family: args.family, ...(args.affiliation ? { affiliation: args.affiliation } : {}) });
  },
});

export const checkIn = defineMutation("check-in", {
  title: "Check them in",
  description: "Say a speaker has collected their badge.",
  subject: { kinds: ["speaker"], arg: "id" },
  writes: ["checkedIn"],
  input: z.object({ id: nodeRef(["speaker"]) }),
  describe: (args, graph) => `Check in ${nameOf(graph, args.id)}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { checkedIn: true });
  },
});

export const addRoom = defineMutation("add-room", {
  title: "Add a room",
  description: "Add a room the conference may use.",
  creates: ["room"],
  input: z.object({ building: z.string().min(1).max(80), name: z.string().min(1).max(120), seats: z.number().int().min(1).max(5000) }),
  describe: (args) => `Add ${roomKind.label!({ id: "", ...args } as never)}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.name, "room"), kind: "room", building: args.building, name: args.name, seats: args.seats });
  },
});

export const addTopic = defineMutation("add-topic", {
  title: "Add a topic",
  description: "Name some subject matter the committee tags with.",
  creates: ["topic"],
  input: z.object({ label: z.string().min(1).max(80) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "topic"), kind: "topic", label: args.label });
  },
});

export const addStaff = defineMutation("add-staff", {
  title: "Add a staff member",
  description: "Add somebody who runs the venue on the day.",
  creates: ["staff"],
  input: z.object({ name: z.string().min(1).max(100), duty: z.enum(["registration", "av", "stewarding", "catering", "accessibility"]) }),
  describe: (args) => `Add ${args.name}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.name, "staff"), kind: "staff", name: args.name, duty: args.duty });
  },
});

export const lookAfter = defineMutation("look-after", {
  title: "Give them a room",
  fromTheOtherEnd: "Have a staff member look after it",
  description: "Say a staff member looks after a room.",
  subject: { kinds: ["staff"], arg: "staffId" },
  connects: ["looks-after"],
  input: z.object({ staffId: nodeRef(["staff"]), roomId: nodeRef(["room"]) }),
  describe: (args, graph) => `${nameOf(graph, args.staffId)} looks after ${nameOf(graph, args.roomId)}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "looks-after", from: args.staffId, to: args.roomId });
  },
});

export const stopLookingAfter = defineMutation("stop-looking-after", {
  title: "Take a room off them",
  fromTheOtherEnd: "Take it off a staff member",
  description: "Say a staff member no longer looks after a room.",
  subject: { kinds: ["staff"], arg: "staffId" },
  severs: ["looks-after"],
  input: z.object({ staffId: nodeRef(["staff"]), roomId: nodeRef(["room"]) }),
  describe: (args, graph) => `${nameOf(graph, args.staffId)} no longer looks after ${nameOf(graph, args.roomId)}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "looks-after", from: args.staffId, to: args.roomId });
  },
});

export const mutations = [
  submitTalk, acceptTalk, rejectTalk, withdrawTalk, scheduleTalk, unscheduleTalk,
  addPresenter, removePresenter, reassignProposer,
  tag, untag,
  addSession, holdIn, chair,
  addWorkshop, cancelWorkshop, lead, unlead,
  addSpeaker, checkIn, addRoom, addTopic, addStaff, lookAfter, stopLookingAfter,
];
