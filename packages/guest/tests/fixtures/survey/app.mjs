// A camera-trap survey, as the thirteenth walk declared it in code, cut to
// what a station's contact sheet needs: stations, and the detections each
// camera takes, each with a photograph.
import { createSchema, defineApp, defineNode, imageField, z } from "@graview/core";

const station = defineNode("station", {
  fields: z.object({ label: z.string().min(1).max(60) }),
  plural: "Stations",
  label: (node) => node.label,
});
const detection = defineNode("detection", {
  fields: z.object({ label: z.string().min(1).max(60), photo: imageField().optional() }),
  edges: { "taken-by": { to: ["station"], description: "the camera that took it", inverse: "what it took" } },
  plural: "Detections",
  label: (node) => node.label,
});

export const app = defineApp({ name: "Survey", schema: createSchema([station, detection]), mutations: [] });
export default app;
