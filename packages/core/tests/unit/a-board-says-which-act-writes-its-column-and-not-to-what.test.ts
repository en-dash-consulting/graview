import { describe, expect, it } from "vitest";
import { checkApp } from "../../src/cli/check.js";
import { columnChoices } from "../../src/columns.js";
import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, z } from "../../src/index.js";

/**
 * A BOARD SAYS WHICH ACT WRITES ITS COLUMN, AND NOT TO WHAT (the thirteenth
 * walk, a camera-trap survey). The review queue, a status board of
 * detections with `move: true`, offered "Move to ›" on every card and
 * withheld every column with "Nothing in this app moves a detection to
 * Confirmed." — though "Confirm", "Nothing there" and "Same animal again"
 * each set the status. They were written in code as the scaffold writes its
 * own close act, `writes: ["status"]`, which says the act writes the field
 * and not the value it writes, so no column could be reached; and
 * `graview check` said nothing, since a board no act moves on at all was
 * taken for a picture. Now the checker warns, naming each act and the
 * `sets` that makes it the move.
 */
const detection = defineNode("detection", {
  fields: z.object({ label: z.string().min(1).max(60), status: z.enum(["unreviewed", "confirmed", "false-trigger"]) }),
  plural: "Detections",
  label: (node) => node.label,
});
const schema = createSchema([detection]);
const { defineMutation } = bindSchema(schema);
const step = (name: string, title: string, status: "confirmed" | "false-trigger", sets: boolean) =>
  defineMutation(name, {
    title,
    description: title,
    subject: { kinds: ["detection"], arg: "id" },
    writes: ["status"],
    ...(sets ? { sets: { status } } : {}),
    input: z.object({ id: nodeRef(["detection"]) }),
    apply(ctx, args) {
      ctx.patchNode(args.id, { status });
    },
  });
const board = { name: "columns", title: "Review queue", bindings: { detection: { column: "status" } }, options: { move: true } };
const appWith = (sets: boolean) =>
  defineApp({ name: "Survey", schema, mutations: [step("confirm-detection", "Confirm", "confirmed", sets), step("mark-false-trigger", "Nothing there", "false-trigger", sets)], lenses: [board] } as never);

describe("a status board whose acts say they write its column", () => {
  it("is warned of by graview check, naming each act and the sets that makes it the move", () => {
    const found = checkApp(appWith(false) as never).findings.filter((one) => one.code === "lens-column-written-unsaid");
    expect(found.map((one) => [one.severity, one.where])).toEqual([["warning", "lenses.0.bindings.detection.column"]]);
    expect(found[0]!.message).toContain('"Confirm" and "Nothing there" write status');
    expect(found[0]!.fix).toContain('sets: { status: "<the value it writes>" }');
  });

  it("moves its cards, and is not warned of, once each act says the value it sets", () => {
    const app = appWith(true);
    expect(checkApp(app as never).findings.filter((one) => one.code === "lens-column-written-unsaid")).toEqual([]);
    const store = new Store({ schema, mutations: app.mutations as never, snapshot: { nodes: [{ id: "detection:a", kind: "detection", label: "RCNX00001", status: "unreviewed" }], edges: [] } as never });
    const choices = columnChoices(store as never, { kind: "human", id: "ana" } as never, store.graph.getNode("detection:a") as never, "status");
    expect(choices.map((one) => [one.to, one.move?.title ?? one.why])).toEqual([
      ["confirmed", "Confirm"],
      ["false-trigger", "Nothing there"],
    ]);
  });
});
