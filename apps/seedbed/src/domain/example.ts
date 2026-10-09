import type { GraphSnapshot } from "@graview/core";
import { CHAPTERS } from "./chapters.js";
import { seedbedSchema } from "./schema.js";

/**
 * THE EXAMPLE GARDEN: what the standalone app opens on.
 *
 * Not a second copy of the garden — the one the chapters grow into, read
 * from the last chapter that plants one ("The years it turns through") and
 * kept to the kinds the finished declaration has. Its gardeners, plots,
 * plantings, rotations and agreement are the docs' own, so a reader who
 * walked the chapters meets the same garden here; the users and the
 * invitation belong to the installation that chapter declares, which this
 * app does not.
 */
const declared = new Set(seedbedSchema.kinds as readonly string[]);
const grown = CHAPTERS.find((chapter) => chapter.slug === "the-rotation")!.seed;
const kept = new Set(grown.nodes.filter((node) => declared.has(node.kind)).map((node) => node.id));

export const EXAMPLE_GARDEN: GraphSnapshot = {
  nodes: grown.nodes.filter((node) => kept.has(node.id)),
  edges: grown.edges.filter((edge) => kept.has(edge.from) && kept.has(edge.to)),
};
