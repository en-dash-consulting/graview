import {
  createSchema,
  defineNode,
  summarise,
} from "@graview/core";
import { z } from "zod";

/**
 * The desk: a typed context graph whose subject is the other apps.
 *
 * It was a Graview *scene* before this — a store, a matrix and an inspector —
 * which is not the same thing as a Graview app. It had no mutations, so
 * nothing was derivable and there was nothing for an agent to hold. It had no
 * rules, so it could not tell you anything was wrong. It had no `defineApp`,
 * so `graview check` could not check it. And its own state lived in React,
 * which meant the one interesting thing it does — putting an app in front of
 * you — was invisible to the log, unundoable, and outside the model.
 *
 * All of that is the same argument the framework makes about everyone else's
 * software, so it is worth the launcher passing its own test.
 */

/** The workspace itself, and what is in front of you. */
export const desk = defineNode("desk", {
  description: "This machine's Graview desk.",
  fields: z.object({ label: z.string().min(1) }),
  edges: {
    showing: { to: ["app"], description: "what is in front of you" },
  },
  plural: "Desks",
  label: (node) => node.label,
});

/**
 * An app, described entirely by counting its own declaration.
 *
 * Nothing here is written down twice: every number comes from reading the
 * app's `defineApp`, the same object `graview check` consumes.
 */
export const app = defineNode("app", {
  description: "A Graview application on this machine.",
  fields: z.object({
    label: z.string().min(1),
    tagline: z.string(),
    port: z.number().int(),
    command: z.string(),
    kinds: z.number().int(),
    edgeKinds: z.number().int(),
    mutations: z.number().int(),
    rules: z.number().int(),
  }),
  edges: {
    uses: { to: ["capability"], description: "what it exercises" },
  },
  plural: "Apps",
  label: (node) => node.label,
  describe: (node) => node.tagline,
  fieldRoles: { group: "command" },
});

export const CAPABILITY_AREAS = ["lens", "declaration", "behaviour"] as const;

export const capability = defineNode("capability", {
  description: "Something the framework offers that an app may or may not use.",
  fields: z.object({
    label: z.string().min(1),
    area: z.enum(CAPABILITY_AREAS),
    note: z.string().optional(),
  }),
  plural: "Capabilities",
  label: (node) => node.label,
});

const ruleSpec = z.union([
  z.object({ type: z.literal("every-capability-is-earned") }),
  z.object({ type: z.literal("a-lens-needs-two-users") }),
  z.object({ type: z.literal("every-app-uses-a-lens") }),
]);

/**
 * The same rules-as-nodes pattern, for the fourth time — now pointed at the
 * framework rather than at a domain.
 */
export const rule = defineNode("rule", {
  description: "A standard the framework holds itself to.",
  fields: z.object({
    label: z.string().min(1),
    spec: ruleSpec,
    rationale: z.string().optional(),
  }),
  plural: "Rules",
  label: (node) => node.label,
  requiresInvariant: (node) => node.spec.type,
});

export const rationale = defineNode("rationale", {
  description: "Why something is kept.",
  fields: z.object({ text: z.string().min(1) }),
  edges: {
    // A reason, once given, is part of the record; nothing unmakes it.
    justifies: { to: "*", description: "the decision this explains", appendOnly: true },
  },
  plural: "Reasons",
  label: (node) => summarise(node.text),
});

export const launcherSchema = createSchema([desk, app, capability, rule, rationale]);
export type LauncherSchema = typeof launcherSchema;
