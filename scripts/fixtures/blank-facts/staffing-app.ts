/**
 * A STAFFING FIRM'S PLACEMENTS, ONE MADE WITHOUT ITS ALLOCATION OR ITS ROLE:
 * the fixture `verify-blank-facts` opens a record's page on (Roadmap
 * request:record-pages-draw-writable-but-blank-facts-as-empty-editable-slots).
 *
 * Ana, staffing, may add a placement and so change what it holds
 * (`edit-placement`, which rides `add-placement`); Rui reads. Where a
 * placement came from (`source`) is kept as it was made: no act writes it.
 */
import { bindSchema, createSchema, defineApp, defineNode, z, type Policy, type Principal } from "@graview/core";

const placement = defineNode("placement", {
  fields: z.object({
    label: z.string().min(1).max(80),
    allocation: z.number().int().min(0).max(100).optional(),
    role: z.enum(["lead", "support", "advisor"]).optional(),
    source: z.string().optional(),
  }),
  fixed: { source: "where the placement came from, as it was made" },
  plural: "Placements",
  label: (node) => node.label,
  display: { labels: { allocation: "Allocation", role: "Role", source: "Source" } },
});

export const staffingSchema = createSchema([placement]);
const { defineMutation } = bindSchema(staffingSchema);

const addPlacement = defineMutation("add-placement", {
  title: "Add a placement",
  creates: ["placement"],
  input: z.object({ label: z.string().min(1).max(80) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "placement"), kind: "placement", label: args.label }),
});

const policy: Policy = {
  roles: ["staffing", "reader"],
  grants: [{ roles: ["staffing"], mutations: ["add-placement"], describe: "Staffing places people and says what each placement holds." }],
};

export const staffingApp = defineApp({ name: "Staffing", schema: staffingSchema, mutations: [addPlacement], policy });

export const staffingSeed = {
  nodes: [
    { id: "placement-3", kind: "placement", label: "Placement 3", allocation: 40, role: "lead", source: "referral" },
    { id: "placement-4", kind: "placement", label: "Placement 4" },
  ],
  edges: [],
};

export const ana: Principal = { kind: "human", id: "person:ana", roles: ["staffing"] };
export const rui: Principal = { kind: "human", id: "person:rui", roles: ["reader"] };
