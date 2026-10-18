// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { createViews } from "@graview/react";
import { stubFast, stubThinking } from "@graview/tools/inline-ai";
import type { HostAi } from "@graview/tools/frame";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A PANEL DRAWN FROM THE RIGHT-CLICK MENU OPENS IN THE FACE IT WAS ASKED ON
 * (FR-184). On Pages the menu at the pointer is the routed face's, so the
 * inline AI goes the way this face goes: "Draw a panel" lands on `/~draft`,
 * with "Keep as a lens" and "Discard", and the scene is never asked to
 * show it. An ask that fails is said in the menu it was asked in, not only
 * in Activity, where nobody asking was looking.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), status: z.enum(["todo", "doing", "done"]).default("todo") }),
  plural: "Tasks",
  label: (node) => node.label,
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["status"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.taskId, { status: "done" }),
});

const MENU = '[data-testid="context-menu"]';
const AI = '[data-menu-section="inline-ai"]';
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function rendered(path: string, ai: HostAi) {
  const store = new Store({
    schema,
    mutations: [finish],
    snapshot: {
      nodes: [
        { id: "deposit", kind: "task", label: "Pay the deposit", status: "todo" },
        { id: "hall", kind: "task", label: "Book the hall", status: "doing" },
      ] as never,
      edges: [],
    },
  });
  const went: string[] = [];
  const context: PageContext<typeof schema> = { store, views: createViews(schema), ai };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath={path} onNavigate={(to) => went.push(to)} />));
  await settle();
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, went };
}

/** Lets what is fetched arrive and draw: until it says so, else a few turns. */
async function settle(ms = 30, until?: () => boolean) {
  for (let turn = 0; turn < (until ? 60 : 5); turn += 1) {
    await act(async () => new Promise((done) => setTimeout(done, ms)));
    if (until?.()) return;
  }
}

async function openTheMenuOnTheHeading(host: HTMLElement) {
  const heading = host.querySelector("[data-graview-page-title]") ?? host.querySelector("main h1")!;
  await act(async () => void heading.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
  // The section is fetched, then its suggestions arrive.
  await settle(30, () => document.querySelector(`${AI} [data-menu-item="ai-panel"]`) !== null && document.querySelector('[data-testid="inline-ai-thinking"]') === null);
}

async function press(selector: string) {
  const button = document.querySelector<HTMLElement>(selector);
  expect(button, selector).not.toBeNull();
  await act(async () => button!.click());
}

describe("a panel drawn from the menu, on the pages", () => {
  it("lands on /~draft with Keep as a lens and Discard, not waiting for the scene", async () => {
    const { host, went } = await rendered("/tasks/deposit", { fast: stubFast(), thinking: stubThinking() });
    await openTheMenuOnTheHeading(host);
    await press(`${AI} [data-menu-item="ai-panel"]`);
    await settle(30, () => document.querySelector('[data-testid="draft-keep"]') !== null);
    expect(went.at(-1)).toBe("/~draft");
    expect(host.querySelector('[data-testid="draft-page"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="draft-keep"]')?.textContent).toBe("Keep as a lens");
    expect(host.querySelector('[data-testid="draft-discard"]')?.textContent).toBe("Discard");
    // The menu is put away once the panel is drawn.
    expect(document.querySelector(MENU)).toBeNull();
  });

  it("says a failed ask in the menu it was asked in, and keeps the menu open", async () => {
    const refusing: HostAi = {
      fast: stubFast(),
      thinking: {
        model: "refusing",
        think: async ({ system }) => {
          if (/"panel"/.test(system)) throw new Error("The model is resting.");
          return { text: "{}" };
        },
      },
    };
    const { host, went } = await rendered("/tasks/deposit", refusing);
    await openTheMenuOnTheHeading(host);
    await press(`${AI} [data-menu-item="ai-panel"]`);
    await settle(30, () => document.querySelector('[data-testid="inline-ai-failed"]') !== null);
    expect(document.querySelector(MENU)).not.toBeNull();
    expect(document.querySelector('[data-testid="inline-ai-failed"]')?.textContent).toContain("The model is resting.");
    expect(went).not.toContain("/~draft");
  });
});
