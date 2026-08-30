import { createSchema, defineNode, Store, type GraphSnapshot } from "@graview/core";
import { z } from "zod";
import { APPS, CAPABILITIES, surfaceOf } from "./apps.js";

/**
 * The launcher's own graph: three apps, the framework capabilities they
 * exercise, and an edge wherever one uses one.
 *
 * Built by READING the other apps' declarations, so it cannot drift. Nothing
 * here is written down twice.
 */

export const app = defineNode("app", {
  description: "A Graview application on this machine.",
  fields: z.object({
    label: z.string().min(1),
    tagline: z.string(),
    port: z.number().int(),
    command: z.string(),
    kinds: z.number().int(),
    edges: z.number().int(),
    mutations: z.number().int(),
    invariants: z.number().int(),
    lenses: z.number().int(),
  }),
  edges: {
    uses: { to: ["capability"], description: "what it exercises" },
  },
  plural: "Apps",
  label: (node) => node.label,
  describe: (node) => node.tagline,
});

export const capability = defineNode("capability", {
  description: "Something the framework offers that an app may or may not use.",
  fields: z.object({ label: z.string().min(1), area: z.string().min(1) }),
  plural: "Capabilities",
  label: (node) => node.label,
});

export const launcherSchema = createSchema([app, capability]);
export type LauncherSchema = typeof launcherSchema;

export function launcherSnapshot(): GraphSnapshot<never> {
  const nodes = [
    ...APPS.map((entry) => ({
      id: entry.id,
      kind: "app",
      label: entry.label,
      tagline: entry.tagline,
      port: entry.port,
      command: entry.command,
      ...surfaceOf(entry.app),
    })),
    ...CAPABILITIES.map((item) => ({
      id: item.id,
      kind: "capability",
      label: item.label,
      area: item.area,
    })),
  ];
  const edges = APPS.flatMap((entry) =>
    CAPABILITIES.filter((item) => item.holds(entry.app)).map((item) => ({
      kind: "uses",
      from: entry.id,
      to: item.id,
    })),
  );
  return { nodes, edges } as unknown as GraphSnapshot<never>;
}

export function createLauncherStore(): Store<LauncherSchema> {
  return new Store<LauncherSchema>({
    schema: launcherSchema,
    snapshot: launcherSnapshot() as never,
  });
}
