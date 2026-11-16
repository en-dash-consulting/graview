// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews, useGraview, useSelection, type HostMenuAt, type HostMenuItem } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { registerDefaultViews, Shell } from "../../src/index.js";

/**
 * A HOST ADDS ITS OWN ROWS TO THE SCENE'S MENU (Roadmap
 * f-host-context-menu-items). `menuItems` on the provider, as `mount` hands
 * it, and on the Shell are drawn after every row of the framework's in the
 * menu at the pointer, the provider's first, shown as the menu opens, and
 * each is run with what was under the pointer (a record, a kind's card, a
 * link) and the app's link.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks", label: (node) => node.label, edges: { "waits-for": { to: ["task"], description: "what has to happen first" } } });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.taskId, { done: true }),
});
const SEED = {
  nodes: [
    { id: "t1", kind: "task", label: "Book the hall", done: false },
    { id: "t2", kind: "task", label: "Pay the deposit", done: false },
  ],
  edges: [{ id: "e1", kind: "waits-for", from: "t1", to: "t2" }],
};

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function settled(holds: () => void): Promise<void> {
  for (const end = Date.now() + 4000; ; ) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    try {
      holds();
      return;
    } catch (error) {
      if (Date.now() > end) throw error;
    }
  }
}

/** What a right-click on something in the scene asks for. */
function OpenOn({ on }: { readonly on: string }) {
  const { setMenuAt } = useGraview();
  const { set } = useSelection();
  return <button type="button" data-testid="open-on" onClick={() => (set([on]), setMenuAt({ x: 40, y: 40, on }))} />;
}

const menu = () => document.querySelector<HTMLElement>('[data-testid="context-menu"]');
const press = (id: string) => act(async () => menu()!.querySelector<HTMLButtonElement>(`[data-menu-item="${id}"]`)!.click());
const LINK = () => `${location.origin}${location.pathname}`;

/** The Shell under a provider, each handed its rows, and the menu opened on `on`. */
async function openedOn(on: string, provided: readonly HostMenuItem[], shell: readonly HostMenuItem[], menuLink?: () => string) {
  const store = new Store({ schema, mutations: [finish], snapshot: SEED as never });
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} menuItems={provided} {...(menuLink ? { menuLink } : {})}>
        <OpenOn on={on} />
        <Shell<typeof schema> scheme="light" onScheme={() => {}} menuItems={shell} />
      </GraviewProvider>,
    ),
  );
  unmount = async () => {
    await act(async () => root.unmount());
    element.remove();
  };
  await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="open-on"]')!.click());
  await settled(() => expect(menu()?.querySelector("[data-menu-section='host-items']")).not.toBeNull());
}

describe("a host's own rows in the scene's menu", () => {
  const pressed: Array<readonly [string, HostMenuAt]> = [];
  const row = (id: string): HostMenuItem => ({ id, label: id === "own-ai" ? "Make changes in your own AI" : "Send feedback", run: (at) => void pressed.push([id, at]) });
  afterEach(() => void pressed.splice(0));

  it("are drawn after every row of the framework's, the provider's then the Shell's, shown as the menu opens, and run with the record and the app's link", async () => {
    await openedOn("t1", [row("send-feedback")], [row("own-ai")]);
    await settled(() => expect(menu()?.querySelector("[data-affordance]")).not.toBeNull());
    const everything = [...menu()!.querySelectorAll("[data-menu-item], [data-affordance]")].map((one) => one.getAttribute("data-menu-item") ?? "act");
    expect(everything).toContain("act");
    expect(everything.slice(-2)).toEqual(["send-feedback", "own-ai"]);
    const own = menu()!.querySelector<HTMLButtonElement>('[data-menu-item="own-ai"]')!;
    expect(own.tagName).toBe("BUTTON");
    expect(own.textContent).toBe("Make changes in your own AI");
    // Never folded behind More….
    expect(own.closest("[data-menu-more]")).toBeNull();
    await press("own-ai");
    expect(pressed).toEqual([["own-ai", { face: "scene", record: "t1", kind: "task", link: LINK() }]]);
  });

  it("are run with the kind on a kind's card, and with the relation on a link", async () => {
    await openedOn("kind:task", [], [row("own-ai")]);
    await press("own-ai");
    await unmount?.();
    unmount = undefined;
    await openedOn("e1", [], [row("own-ai")]);
    await press("own-ai");
    expect(pressed.map(([, at]) => at)).toEqual([
      { face: "scene", kind: "task", link: LINK() },
      { face: "scene", edge: "e1", link: LINK() },
    ]);
  });

  it("are handed the link the provider says, as mount says its home on the host's page", async () => {
    await openedOn("t1", [], [row("own-ai")], () => "https://host.example/app/");
    await press("own-ai");
    expect(pressed.map(([, at]) => at.link)).toEqual(["https://host.example/app/"]);
  });

  it("draw a row once where the provider and the Shell both hand it", async () => {
    await openedOn("t1", [row("own-ai")], [row("own-ai")]);
    expect(menu()!.querySelectorAll('[data-menu-item="own-ai"]')).toHaveLength(1);
  });
});
