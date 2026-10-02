import { checkApp, createSchema, defineApp, defineMutation, defineNode, nodeRef } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio } from "../../src/index.js";

/**
 * WHAT THE STUDIO DOES NOT MODEL, IT MUST NOT SILENTLY DESTROY.
 *
 * A kind carries decisions the studio has no act for: how a field reads,
 * which fields nothing may rewrite, which of them answer a lens's roles.
 * Rebuilding a kind from the graph alone threw all of it away — so applying
 * a studio over Things would have turned "Blocked 09:00" back into
 * `plannedAt: 540` on every card, and brought back a warning about a
 * rationale that is fixed on purpose. Neither change is one anybody asked
 * for, and neither is visible in the studio.
 */

const task = defineNode("task", {
  fields: z.object({
    label: z.string().min(1),
    plannedAt: z.number().int().optional(),
    plannedUntil: z.number().int().optional(),
    note: z.string().optional(),
  }),
  plural: "Tasks",
  label: (node) => node.label,
  fieldRoles: { start: "plannedAt", end: "plannedUntil" },
  display: {
    labels: { plannedAt: "Blocked", plannedUntil: "Until" },
    format: { plannedAt: (value: unknown) => `${Math.floor(Number(value) / 60)}:00` },
    hide: ["note"],
    // What a glance says: the seventh walk's round trip dropped it (W-169).
    glance: ["plannedUntil", "plannedAt"],
  },
  fixed: { note: "a note is kept as it was written" },
});

const rename = defineMutation("rename", {
  title: "Rename it",
  description: "Gives a task another name.",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

const app = defineApp({ name: "carrier", schema: createSchema([task]), mutations: [rename] });

describe("a round trip through the studio", () => {
  it("keeps how a field reads, what is fixed, and which fields answer a lens", () => {
    const next = createStudio(app).declaration();
    const kind = next.schema.tryDefinition("task") as unknown as {
      display?: { labels?: Record<string, string>; hide?: readonly string[]; glance?: readonly string[] };
      fixed?: Record<string, string>;
      fieldRoles?: Record<string, string>;
    };
    expect(kind.display?.labels).toEqual({ plannedAt: "Blocked", plannedUntil: "Until" });
    expect(kind.display?.hide).toEqual(["note"]);
    expect(kind.display?.glance).toEqual(["plannedUntil", "plannedAt"]);
    const schema = createStudio(app).files().find((file) => file.path.endsWith("schema.ts"))!.contents;
    expect(schema).toContain('glance: ["plannedUntil", "plannedAt"],');
    expect(kind.fixed).toEqual({ note: "a note is kept as it was written" });
    expect(kind.fieldRoles).toEqual({ start: "plannedAt", end: "plannedUntil" });
  });

  it("says nothing new about an app the checker was already happy with", () => {
    // The sharpest form of the claim: the round trip is silent. Anything it
    // dropped would show up here as a finding the original did not have.
    expect(createStudio(app).check().findings).toEqual(checkApp(app).findings);
  });

  it("drops what belonged to a field that is no longer there", () => {
    const studio = createStudio(app);
    const note = studio.store.graph
      .allNodes()
      .find((node) => node.kind === "field" && (node as { label?: string }).label === "note")!;
    studio.store.apply({ name: "remove-field", args: { id: note.id } });
    const kind = studio.declaration().schema.tryDefinition("task") as unknown as {
      display?: { hide?: readonly string[] };
      fixed?: Record<string, string>;
    };
    // A label for a field somebody deleted is not preserved; it is meaningless.
    expect(kind.display?.hide ?? []).toEqual([]);
    expect(kind.fixed).toBeUndefined();
  });
});

/**
 * A RULE THAT NAMES NO REPAIR is the framework's own central seam left
 * unconnected: no repair in the strip, none in the menu, and nothing an
 * agent may lawfully do about it. The studio's seat finds them and proposes
 * the act that plausibly puts each right — a derivation over the
 * declaration graph, no model and no prompt — under its own name, in a
 * batch of its own, so declining is one undo.
 */
describe("the studio's agent seat", () => {
  const judged = defineNode("job", {
    fields: z.object({ label: z.string().min(1), done: z.boolean() }),
    plural: "Jobs",
    label: (node) => node.label,
  });
  const finish = defineMutation("finish", {
    title: "Finish it",
    description: "Marks a job done.",
    subject: { kinds: ["job"], arg: "id" },
    writes: ["done"],
    input: z.object({ id: nodeRef(["job"]) }),
    apply(ctx, args) {
      ctx.patchNode(args.id, { done: true });
    },
  });
  const unrepaired = {
    name: "every-job-finishes",
    label: "Every job finishes",
    description: "A job left open past its day.",
    scope: { kind: "job" } as const,
    repairs: [] as readonly string[],
    evaluate: () => [],
  };

  it("proposes under the agent's own name, and one undo declines it", () => {
    const studio = createStudio(
      defineApp({ name: "site", schema: createSchema([judged]), mutations: [finish], invariants: [unrepaired as never] }),
    );
    const rule = studio.store.graph.allNodes().find((node) => node.kind === "rule")!;
    const act = studio.store.graph.allNodes().find((node) => node.kind === "act" && (node as { label?: string }).label === "finish")!;
    const planner = { kind: "agent" as const, id: "studio", session: "ui" };

    expect(studio.store.graph.allEdges().some((edge) => edge.kind === "repairs")).toBe(false);
    const proposed = studio.propose({ name: "name-repair", args: { rule: rule.id, act: act.id } }, planner, "names no repair");
    expect(proposed.ok).toBe(true);
    expect(studio.proposals()).toHaveLength(1);
    expect(studio.store.graph.allEdges().some((edge) => edge.kind === "repairs")).toBe(true);

    // Declining is the same undo a person's own change gets.
    expect(studio.decline(proposed.ok ? proposed.batch : "")).toBe(true);
    expect(studio.proposals()).toHaveLength(0);
    expect(studio.store.graph.allEdges().some((edge) => edge.kind === "repairs")).toBe(false);
  });
});
