// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW, type ViewState } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchInspector, Inspector, registerDefaultViews } from "../../src/index.js";

beforeAll(() => fetchInspector());

/*
 * A RECORD CHOSEN ON A PHONE SAYS ITS ACTS (the tenth walk). Choosing
 * "Today" in the todo's lists on a phone lit it and dimmed the rest, and
 * that was all: its acts open by a right-click or the acts key, and a finger
 * has neither, so "Add a task" was on no screen. The map's panel says
 * "Acts…" for what it is about (W-195); on the ground, a chosen record in a
 * scene too narrow for anything beside it says it too.
 */
const list = defineNode("list", { fields: z.object({ label: z.string() }), plural: "Lists" });
const schema = createSchema([list]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename it",
  subject: { kinds: ["list"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["list"]), label: z.string().min(1) }),
  apply: (ctx, args) => ctx.patchNode(args.id, { label: args.label }),
});

async function drawn(view: ViewState, selection: readonly string[]) {
  const store = new Store({ schema, mutations: [rename], invariants: [], snapshot: { nodes: [{ id: "today", kind: "list", label: "Today" }] as never, edges: [] } });
  const host = document.createElement("main");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={view} initialSelection={selection}>
        <Inspector placement="menu" />
      </GraviewProvider>,
    );
  });
  return { host, done: () => act(async () => root.unmount()) };
}

describe("a record chosen in a narrow scene", () => {
  it("says its acts in a button that opens the same menu a right-click opens", async () => {
    const { host, done } = await drawn({ ...EMPTY_VIEW, focusId: aggregateId("list") }, ["today"]);
    const button = host.querySelector<HTMLButtonElement>('[data-testid="chosen-acts"]');
    expect(button, "the chosen record's acts are a press away").not.toBeNull();
    expect(button!.getAttribute("aria-label")).toBe("What can be done with Today");
    await act(async () => button!.click());
    const menu = document.querySelector('[data-testid="context-menu"]');
    expect(menu?.textContent).toContain("Rename it");
    await done();
  });

  it("says nothing with nothing chosen, or from the map, whose panel says it", async () => {
    const none = await drawn({ ...EMPTY_VIEW, focusId: aggregateId("list") }, []);
    expect(none.host.querySelector('[data-testid="chosen-acts"]')).toBeNull();
    await none.done();
    const above = await drawn({ ...EMPTY_VIEW, overview: true }, ["today"]);
    expect(above.host.querySelector('[data-testid="chosen-acts"]')).toBeNull();
    await above.done();
  });
});
