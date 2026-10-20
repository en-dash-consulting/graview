import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances } from "../../src/index.js";

/**
 * A NEIGHBOR SHARED THROUGH ANOTHER RELATION IS NOT A NEAR MISS (the
 * gauntlet's two kinds sharing a field, carried from walks XI and XII).
 *
 * A workshop whose leader presents both of the day's keynotes breaks one
 * rule, and its problem chooses the workshop and the two talks together.
 * The two talks are presented by Zoë; the workshop is led by her. The
 * structure provider read "all but the workshop share Zoë (presented by)"
 * and offered "Add a leader: bring the workshop in line with the others" —
 * an act that ties a different relation, to somebody who already leads it.
 * A record is brought in line only by an act that ties the relation the
 * others share.
 */
const speaker = defineNode("speaker", { fields: z.object({ label: z.string() }) });
const talk = defineNode("talk", {
  fields: z.object({ label: z.string(), status: z.enum(["submitted", "scheduled"]) }),
  edges: { "presented-by": { to: ["speaker"] } },
});
const workshop = defineNode("workshop", {
  fields: z.object({ label: z.string(), status: z.enum(["planned", "canceled"]) }),
  edges: { "led-by": { to: ["speaker"] } },
});
const schema = createSchema([speaker, talk, workshop]);
const { defineMutation } = bindSchema(schema);
const lead = defineMutation("lead", {
  title: "Add a leader",
  subject: { kinds: ["workshop"], arg: "workshopId" },
  connects: ["led-by"],
  input: z.object({ workshopId: nodeRef(["workshop"]), speakerId: nodeRef(["speaker"]) }),
  apply: (ctx, args) => void ctx.addEdge({ kind: "led-by", from: args.workshopId, to: args.speakerId }),
});
const present = defineMutation("add-presenter", {
  title: "Add a presenter",
  subject: { kinds: ["talk"], arg: "talkId" },
  connects: ["presented-by"],
  input: z.object({ talkId: nodeRef(["talk"]), speakerId: nodeRef(["speaker"]) }),
  apply: (ctx, args) => void ctx.addEdge({ kind: "presented-by", from: args.talkId, to: args.speakerId }),
});
const store = () =>
  new Store({
    schema,
    mutations: [lead, present],
    snapshot: {
      nodes: [
        { id: "zoe", kind: "speaker", label: "Zoë Lamarré" },
        { id: "k1", kind: "talk", label: "Keynote", status: "scheduled" },
        { id: "k2", kind: "talk", label: "Keynote, Revisited", status: "scheduled" },
        { id: "k3", kind: "talk", label: "A third talk", status: "submitted" },
        { id: "w1", kind: "workshop", label: "Hands-on", status: "planned" },
      ] as never,
      edges: [
        { kind: "presented-by", from: "k1", to: "zoe" },
        { kind: "presented-by", from: "k2", to: "zoe" },
        { kind: "led-by", from: "w1", to: "zoe" },
      ] as never,
    },
  });
const inLine = (ids: string[]) => deriveAffordances(store(), ids).affordances.filter((affordance) => affordance.label.includes("in line with the others")).map((affordance) => affordance.label);

describe("the one record out of step with the others' shared neighbor", () => {
  it("is not brought in line by an act that ties another relation", () => {
    expect(inLine(["w1", "k1", "k2"])).toEqual([]);
  });

  it("is brought in line by an act that ties the relation the others share", () => {
    expect(inLine(["k3", "k1", "k2"])).toEqual(['Add a presenter: bring "A third talk" in line with the others']);
  });
});
