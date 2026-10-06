/**
 * A PROPOSAL'S OFFERS AND PACKAGES, in the shape of LifeLogics Offers
 * (Graview Cloud's staging app): the fixture `guest-sandbox`'s place and
 * write transports mount worker views over (FR-91–FR-93, FR-96).
 *
 * Erin, staff, sees every offer; Lin, of the client, sees the packages and
 * only the offers made to her firm — so "Internal margin review", made to
 * the delivery partner, is in the starter package for Erin and nowhere for
 * Lin. Notes are seen by everybody.
 */
import { bindSchema, createSchema, defineApp, defineNode, nodeRef, z, type Policy, type Principal } from "@graview/core";

const party = defineNode("party", {
  fields: z.object({ label: z.string().min(1).max(60), role: z.enum(["prime", "delivery", "client"]) }),
  plural: "Parties",
  label: (node) => node.label,
});
const offer = defineNode("offer", {
  fields: z.object({ label: z.string().min(1).max(60), list: z.number().min(0), units: z.number().int().min(1), stage: z.enum(["start", "later"]), cost: z.number().min(0).optional() }),
  edges: { for: { to: ["party"], description: "who it is offered to", inverse: "what is offered to them" } },
  plural: "Offers",
  label: (node) => node.label,
});
const pkg = defineNode("package", {
  fields: z.object({ label: z.string().min(1).max(60), standing: z.enum(["recommended", "alternative", "later"]), summary: z.string().max(500) }),
  edges: { includes: { to: ["offer"], description: "the offers in this package", inverse: "the packages this is in" } },
  plural: "Packages",
  label: (node) => node.label,
});
const signal = defineNode("signal", {
  noun: "note",
  fields: z.object({ label: z.string().min(1).max(200) }),
  plural: "What we heard",
  label: (node) => node.label,
});

export const offersSchema = createSchema([party, offer, pkg, signal]);
const { defineMutation } = bindSchema(offersSchema);

const addNote = defineMutation("add-note", {
  title: "Add a note",
  creates: ["signal"],
  input: z.object({ label: z.string().min(1).max(200) }),
  describe: (args) => `Note “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "signal"), kind: "signal", label: args.label });
  },
});
const setSummary = defineMutation("set-summary", {
  title: "Say what a package is",
  subject: { kinds: ["package"], arg: "packageId" },
  input: z.object({ packageId: nodeRef(["package"]), summary: z.string().max(500) }),
  describe: (args) => `Say what ${args.packageId} is: “${args.summary}”`,
  apply(ctx, args) {
    ctx.patchNode(args.packageId, { summary: args.summary });
  },
});
const setStanding = defineMutation("set-standing", {
  title: "Change a package's standing",
  subject: { kinds: ["package"], arg: "packageId" },
  input: z.object({ packageId: nodeRef(["package"]), standing: z.enum(["recommended", "alternative", "later"]) }),
  describe: (args) => `Make ${args.packageId} ${args.standing}`,
  apply(ctx, args) {
    ctx.patchNode(args.packageId, { standing: args.standing });
  },
});

const policy: Policy = {
  grants: [{ roles: ["staff"], mutations: "*" }, { roles: ["client"], mutations: ["add-note"] }],
  sees: [
    { roles: "*", kinds: ["party", "package", "signal"] },
    { roles: ["staff"], kinds: ["offer"] },
    { roles: ["client"], kinds: ["offer"], own: true },
  ],
};

export const offersApp = defineApp({ name: "Offers", schema: offersSchema, mutations: [addNote, setSummary, setStanding], policy });
/** The same app with no sights: every member sees every record (FR-92's case (a)). */
export const openOffersApp = defineApp({ name: "Offers, open", schema: offersSchema, mutations: [addNote, setSummary, setStanding], policy: { grants: policy.grants } });

export const erin: Principal = { kind: "human", id: "person:erin", roles: ["staff"] };
export const lin: Principal = { kind: "human", id: "party:lifelogics", roles: ["client"] };

export const offersSeed = {
  nodes: [
    { id: "party:lifelogics", kind: "party", label: "LifeLogics", role: "client" },
    { id: "party:open-set", kind: "party", label: "Open Set", role: "delivery" },
    { id: "offer:coaching", kind: "offer", label: "Team coaching", list: 12000, units: 1, stage: "start" },
    { id: "offer:strategy", kind: "offer", label: "AI strategy sprint", list: 24000, units: 1, stage: "start" },
    { id: "offer:build", kind: "offer", label: "Copernicus build", list: 9000, units: 4, stage: "later" },
    { id: "offer:margin", kind: "offer", label: "Internal margin review", list: 0, units: 1, stage: "start", cost: 18500 },
    { id: "package:start", kind: "package", label: "A way in", standing: "recommended", summary: "Coaching and a sprint." },
    { id: "package:full", kind: "package", label: "The whole thing", standing: "alternative", summary: "Everything at once." },
    { id: "package:later", kind: "package", label: "Later on", standing: "later", summary: "The build, after." },
    { id: "signal:hand-off", kind: "signal", label: "Hand-offs to TrueNorth are slow" },
  ],
  edges: [
    { kind: "for", from: "offer:coaching", to: "party:lifelogics" },
    { kind: "for", from: "offer:strategy", to: "party:lifelogics" },
    { kind: "for", from: "offer:build", to: "party:lifelogics" },
    { kind: "for", from: "offer:margin", to: "party:open-set" },
    { kind: "includes", from: "package:start", to: "offer:coaching" },
    { kind: "includes", from: "package:start", to: "offer:strategy" },
    { kind: "includes", from: "package:start", to: "offer:margin" },
    { kind: "includes", from: "package:full", to: "offer:coaching" },
    { kind: "includes", from: "package:full", to: "offer:strategy" },
    { kind: "includes", from: "package:full", to: "offer:build" },
    { kind: "includes", from: "package:later", to: "offer:build" },
  ],
};
