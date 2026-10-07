import {
  createSchema,
  defineNode,
  summarize,
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
    showing: { to: ["app"], description: "what is in front of you", inverse: "the desk it is open on" },
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
    uses: { to: ["capability"], description: "what it exercises", inverse: "the apps that exercise it" },
  },
  plural: "Apps",
  label: (node) => node.label,
  describe: (node) => node.tagline,
  fieldRoles: { group: "command" },
});

export const CAPABILITY_AREAS = ["lens", "declaration", "behavior"] as const;

export const capability = defineNode("capability", {
  description: "Something the platform offers that an app may or may not use.",
  fields: z.object({
    label: z.string().min(1),
    area: z.enum(CAPABILITY_AREAS),
    note: z.string().optional(),
    /**
     * WHERE IT IS SHOWN: a demo, and a stop inside it.
     *
     * A list of capabilities with no way to see one is a brochure. Every
     * entry names the app that demonstrates it and the address that opens
     * it there — `#focus=aggregate:shift&in.view=the-fortnight`, `?chapter=14`
     * — so pressing it is going to look at the thing rather than reading
     * about it.
     */
    shownIn: z.string().optional(),
    stop: z.string().optional(),
    /** Where it sits in the order a person meets it. */
    at: z.number().int().min(0),
  }),
  plural: "Capabilities",
  label: (node) => node.label,
  // The matrix reads them in onboarding order rather than alphabetically.
  fieldRoles: { order: "at" },
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
    justifies: {
      to: "*",
      description: "the decision this explains",
      inverse: "why it is the way it is",
      appendOnly: true,
    },
  },
  plural: "Reasons",
  label: (node) => summarize(node.text),
});

export const launcherSchema = createSchema([desk, app, capability, rule, rationale]);
export type LauncherSchema = typeof launcherSchema;
