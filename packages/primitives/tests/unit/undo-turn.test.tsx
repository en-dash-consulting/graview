// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews, UndoTurn } from "../../src/index.js";

/**
 * A REFUSAL IS A RESULT, said on the control that asked for it.
 *
 * `store.canUndo` answers what the LOG can answer — whether a later op read
 * what this one wrote. It cannot answer what the SCHEMA answers: taking back
 * a migration that added a required field leaves a node the declaration
 * refuses. That threw out of the click handler, which is an unhandled error
 * in a console nobody is reading and a button that appeared to do nothing.
 */
const note = defineNode("note", {
  fields: z.object({ label: z.string(), urgency: z.enum(["whenever", "today"]) }),
  plural: "Notes",
});
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);

/** A mutation that clears the required field: legal to run, illegal to leave. */
const clear = defineMutation("clear-urgency", {
  input: z.object({ id: nodeRef(["note"]) }),
  subject: { kinds: ["note"], arg: "id" },
  apply(ctx, args) {
    ctx.patchNode(args.id, { urgency: "today" });
  },
});

describe("taking a turn back", () => {
  it("says why when the declaration will not have it, rather than throwing", async () => {
    const store = new Store({
      schema,
      mutations: [clear],
      invariants: [],
      snapshot: { nodes: [{ id: "n1", kind: "note", label: "One", urgency: "whenever" }] as never, edges: [] },
    });
    store.apply({ name: "clear-urgency", args: { id: "n1" } });
    const op = store.log.all()[0]!;
    /*
     * The shape a migration leaves behind after a reload: the op's inverse
     * asks for a value the CURRENT declaration refuses. Written here as a
     * patch to a value outside the enum, which is the same wall.
     */
    const doomed = {
      ...op,
      inverse: [{ op: "patch-node" as const, id: "n1", before: {}, after: { urgency: "gone" } }],
    };
    const rewritten = new Store({
      schema,
      mutations: [clear],
      invariants: [],
      snapshot: { nodes: [{ id: "n1", kind: "note", label: "One", urgency: "today" }] as never, edges: [] },
      log: [doomed] as never,
    });

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider
          store={rewritten}
          views={registerDefaultViews(schema, createViews(schema))}
          initialView={EMPTY_VIEW}
        >
          <UndoTurn batch={doomed.batch ?? doomed.id} />
        </GraviewProvider>,
      );
    });
    const button = host.querySelector<HTMLButtonElement>('[data-testid="undo-turn"]');
    expect(button).not.toBeNull();
    await act(async () => {
      button!.click();
    });
    const said = host.querySelector('[data-testid="undo-refused"]');
    expect(said).not.toBeNull();
    expect(said?.textContent).toContain("does not match its declared fields");
    // And nothing changed: a refusal is not a half-applied undo.
    expect((rewritten.graph.getNode("n1") as { urgency: string }).urgency).toBe("today");
    await act(async () => root.unmount());
  });
});
