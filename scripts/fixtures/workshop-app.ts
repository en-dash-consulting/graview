/**
 * A WORKSHOP'S DELIVERABLES, in the shape of Graview Cloud's "Farm Bureau
 * POM Workshop": a deliverable is a `subject` and a long `draft`, several
 * paragraphs of it. The fixture a view of one record is drawn over beside
 * the record's own fields (FR-149), prefills its draft from (FR-150), and
 * the views guide's worked example reads (FR-151).
 *
 * Nick, staff, may change every deliverable and keeps the internal memos;
 * Rae, a reviewer, may read the deliverables and change nothing, and sees
 * no memo. "Quote the draft" makes a memo of a deliverable's draft: it
 * takes a `draft` argument and writes none of its subject's fields.
 */
import { bindSchema, createSchema, defineApp, defineNode, nodeRef, z, type Policy, type Principal } from "@graview/core";

const deliverable = defineNode("deliverable", {
  fields: z.object({ subject: z.string().min(1).max(120), draft: z.string().max(20_000), status: z.enum(["drafting", "sent"]) }),
  plural: "Deliverables",
  label: (node) => node.subject,
});
const memo = defineNode("memo", {
  fields: z.object({ label: z.string().min(1).max(120), body: z.string().max(20_000) }),
  plural: "Memos",
  label: (node) => node.label,
});

export const workshopSchema = createSchema([deliverable, memo]);
const { defineMutation } = bindSchema(workshopSchema);

const setDraft = defineMutation("set-draft", {
  title: "Change the draft",
  subject: { kinds: ["deliverable"], arg: "deliverableId" },
  writes: ["draft"],
  input: z.object({ deliverableId: nodeRef(["deliverable"]), draft: z.string().max(20_000) }),
  describe: (args) => `Change the draft of ${args.deliverableId}`,
  apply(ctx, args) {
    ctx.patchNode(args.deliverableId, { draft: args.draft });
  },
});
const setSubject = defineMutation("set-subject", {
  title: "Change the subject",
  subject: { kinds: ["deliverable"], arg: "deliverableId" },
  writes: ["subject"],
  input: z.object({ deliverableId: nodeRef(["deliverable"]), subject: z.string().min(1).max(120) }),
  describe: (args) => `Call ${args.deliverableId} “${args.subject}”`,
  apply(ctx, args) {
    ctx.patchNode(args.deliverableId, { subject: args.subject });
  },
});
const quoteDraft = defineMutation("quote-draft", {
  title: "Quote the draft in a memo",
  subject: { kinds: ["deliverable"], arg: "deliverableId" },
  creates: ["memo"],
  writes: [],
  input: z.object({ deliverableId: nodeRef(["deliverable"]), draft: z.string().max(20_000) }),
  describe: (args) => `Quote ${args.deliverableId} in a memo`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId("quote", "memo"), kind: "memo", label: "A quote", body: args.draft });
  },
});

const policy: Policy = {
  grants: [{ roles: ["staff"], mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["deliverable"] },
    { roles: ["staff"], kinds: ["memo"] },
  ],
};

export const workshopApp = defineApp({ name: "Workshop", schema: workshopSchema, mutations: [setDraft, setSubject, quoteDraft], policy });

export const nick: Principal = { kind: "human", id: "person:nick", roles: ["staff"] };
export const rae: Principal = { kind: "human", id: "person:rae", roles: ["reviewer"] };

/** The email's draft: four paragraphs, about three thousand characters, the way Cloud's was. */
export const EMAIL_DRAFT = [
  "Todd,\n\nThank you for making the time on Thursday. What follows is the plan for the Farm Bureau POM workshop as we left it, with the three changes your team asked for and the one we still owe you an answer on.",
  "The morning opens with the field data. Each county lead brings last season's yield sheets and the soil reports, and we walk them together before anybody proposes anything. We heard clearly that the last workshop started with the model and lost the room; this one starts with the farms. We have set aside ninety minutes for it and will not shorten it, whatever else runs long. The sheets are printed, not projected, so people can write on them and take them home.",
  "The afternoon is the practice of management itself: three short sessions on scouting, on timing applications against the forecast, and on keeping the records a buyer now asks for. Each is led by a grower who does it, with one of our agronomists beside them to answer the questions the grower would rather not. Lunch is on site, and the barn is booked until six in case the last session wants to keep going, which in our experience it does.",
  "What we still owe you is the cost of bringing the extension office's soil lab to the barn for the day. They have quoted a range, and we will have the number by the end of next week. If it is over what the grant allows we will propose bringing samples to them instead, the week before, and handing the results out in the morning session. Either way nothing else in the plan moves.\n\nWith thanks, and talk soon,\nNick",
].join("\n\n");

export const workshopSeed = {
  nodes: [
    { id: "deliverable:email", kind: "deliverable", subject: "Email to Todd", draft: EMAIL_DRAFT, status: "drafting" },
    { id: "deliverable:agenda", kind: "deliverable", subject: "The day's agenda", draft: "Morning: the field data.\n\nAfternoon: scouting, timing, records.", status: "drafting" },
    { id: "memo:margin", kind: "memo", label: "Our margin on the day", body: "We clear 18 percent after the barn." },
  ],
  edges: [],
};
