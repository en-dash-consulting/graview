import { bindSchema, createSchema, defineNode, imageField, nodeRef, Store, videoField, z, type AnySchema, type FileValue, type HostFiles } from "@graview/core";
import { describe, expect, it } from "vitest";
import { planDrop } from "../../src/host/drop-plan.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";

/**
 * A DROP SAYS WHEN EACH FILE WAS TAKEN (the thirteenth walk, a camera-trap
 * survey). A detection is one trigger of one camera, and the act that logs
 * one cannot go without the instant it was taken. Dropped on a station's
 * contact sheet, a card's photographs were offered as a drop target, and
 * every drop was refused: the host filled the file and the name, and left
 * the time out, though each file says when it was made (its `at`). A drop
 * fills a required time from the file; a required argument a file cannot
 * fill means no drop target at all, rather than one that refuses.
 */
const station = defineNode("station", { fields: z.object({ label: z.string().min(1).max(60) }), plural: "Stations", label: (node) => node.label });
const detection = defineNode("detection", {
  fields: z.object({ label: z.string().min(1).max(80), takenAt: z.iso.datetime({ offset: true }), photo: imageField().optional(), clip: videoField().optional() }),
  edges: { "taken-by": { to: ["station"], cardinality: "one", description: "the camera that took it", inverse: "what it caught" } },
  plural: "Detections",
  label: (node) => node.label,
  fieldRoles: { when: "takenAt" },
});
const schema = createSchema([station, detection]);
const { defineMutation } = bindSchema(schema);
const log = defineMutation("log-detection", {
  title: "Log a detection",
  description: "Take a photograph off a camera's card.",
  creates: ["detection"],
  subject: { kinds: ["station"], arg: "stationId" },
  connects: ["taken-by"],
  input: z.object({ stationId: nodeRef(["station"]), label: z.string().min(1).max(80), takenAt: z.iso.datetime({ offset: true }), photo: imageField().optional(), clip: videoField().optional() }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "detection");
    ctx.addNode({ id, kind: "detection", label: args.label, takenAt: args.takenAt, ...(args.photo ? { photo: args.photo } : {}) });
    ctx.addEdge({ kind: "taken-by", from: id, to: args.stationId });
  },
});
const tagged = defineMutation("log-tagged", {
  title: "Log a tagged detection",
  description: "One whose collar number must be typed.",
  creates: ["detection"],
  subject: { kinds: ["station"], arg: "stationId" },
  connects: ["taken-by"],
  input: z.object({ stationId: nodeRef(["station"]), label: z.string().min(1).max(80), takenAt: z.iso.datetime({ offset: true }), collar: z.number().int(), photo: imageField().optional() }),
  apply() {},
});
const files: HostFiles = { maxBytes: 10_000_000, kinds: ["image/*", "video/*"], upload: async () => ({}) as FileValue };
const photo: FileValue = { href: "/graview/files/a1.jpg", name: "RCNX0412.JPG", type: "image/jpeg", bytes: 180_000 };
const manifest = { name: "contact-sheet", attach: "station", cardinality: "one", accepts: [{ kind: "detection", field: "photo" }], acts: [] } as unknown as WorkerViewManifest;
const anyone = { kind: "human", id: "anyone" } as const;

function storeWith(mutations: readonly unknown[]) {
  const store = new Store<AnySchema>({ schema: schema as never, mutations: mutations as never, snapshot: { nodes: [{ id: "station:bear-wallow", kind: "station", label: "Bear Wallow" }], edges: [] } as never });
  return store;
}

describe("a drop on a station's contact sheet", () => {
  it("logs each photograph at the instant its file says it was taken, and the drop is applied", () => {
    const store = storeWith([log]);
    const plan = planDrop(store, anyone, manifest, { kind: "detection", connect: "taken-by:station:bear-wallow" }, { shown: new Set(["station:bear-wallow"]), files });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const calls = plan.calls({ field: "photo", value: photo, at: "2026-10-12T03:14:00.000Z" } as never, 0);
    expect(calls[0]!.args["takenAt"]).toBe("2026-10-12T03:14:00.000Z");
    const outcome = store.applyAll(calls as never, { author: anyone } as never);
    expect(outcome.ops.length).toBeGreaterThan(0);
    expect(store.graph.allNodes().filter((node) => node.kind === "detection").map((node) => (node as { takenAt?: string }).takenAt)).toEqual(["2026-10-12T03:14:00.000Z"]);
  });

  it("is no drop target where the act asks for something no file says, so nothing is offered and then refused", () => {
    const store = storeWith([tagged]);
    const plan = planDrop(store, anyone, manifest, { kind: "detection", connect: "taken-by:station:bear-wallow" }, { shown: new Set(["station:bear-wallow"]), files });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.says).toMatch(/collar/);
  });
});
