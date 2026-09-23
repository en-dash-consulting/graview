// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, type GraviewApp } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { ChatPanel, registerDefaultViews } from "@graview/primitives";
import type { ChatReply } from "@graview/tools";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio, StudioAgentPanel, studioApp, type Studio } from "../../src/index.js";
import type { StudioSchema } from "../../src/meta.js";

/**
 * ONE SEAT, ONE CONVERSATION.
 *
 * The app's chat and the studio's declaration seat were two conversations
 * written twice: the studio boxed both voices and wrote "Kept — … undo
 * takes it back" under each change; the chat put the seat in prose and
 * settled proposals in place. The same scripted reply, given to both, now
 * reads the same and behaves the same — only what a proposal is FOR
 * differs: applied to the graph, or kept into the declaration.
 */

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

const note = defineNode("note", { fields: z.object({ label: z.string().min(1) }), plural: "Notes", label: (node) => node.label });
const notes = createSchema([note]);
const { defineMutation } = bindSchema(notes);
const addNote = defineMutation("add-note", {
  title: "Add a note",
  creates: ["note"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "note"), kind: "note", label: args.label });
  },
});

const scripted = (proposals: ChatReply["proposals"]) => async (): Promise<ChatReply> => ({ say: "Doing both.", proposals });

async function mount(element: ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, unmount: () => act(async () => root.unmount()) };
}

async function converse(host: HTMLElement, id: string, words: string) {
  const opener = host.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
  if (opener) await act(async () => opener.click());
  const field = host.querySelector<HTMLInputElement>(`[data-testid="${id}-draft"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, words);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    field.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
}

/** What a conversation looks like, whichever surface holds it. */
const shape = (host: HTMLElement, id: string) => {
  const panel = host.querySelector(`[data-testid="${id}-panel"]`)!;
  return {
    turns: panel.querySelectorAll("ol > li").length,
    said: [...panel.querySelectorAll("ol > li > p")].map((p) => p.textContent),
    applyAll: panel.querySelector(`[data-testid="${id}-apply-all"]`) !== null,
    applied: [...panel.querySelectorAll(`[data-testid="${id}-applied"]`)].map((line) => line.textContent),
  };
};

describe("the app's seat and the studio's seat are one conversation", () => {
  it("reads the same and settles the same, over the same scripted reply", async () => {
    const store = new Store({ schema: notes, mutations: [addNote] });
    const chat = await mount(
      <GraviewProvider store={store} views={registerDefaultViews(notes, createViews(notes))} initialView={EMPTY_VIEW}>
        <ChatPanel
          respond={scripted([
            { mutation: "add-note", args: { label: "Milk" } },
            { mutation: "add-note", args: { label: "Eggs" } },
          ]) as never}
        />
      </GraviewProvider>,
    );

    const app: GraviewApp<typeof notes> = { name: "Notes", schema: notes, mutations: [addNote] as never };
    const studio = createStudio(app) as unknown as Studio<never>;
    const meta = studioApp();
    const declaration = await mount(
      <GraviewProvider<StudioSchema> store={studio.store} views={registerDefaultViews(meta.schema, createViews(meta.schema))} initialView={EMPTY_VIEW}>
        <StudioAgentPanel
          studio={studio as never}
          respond={scripted([
            { mutation: "add-kind", args: { label: "Meal" } },
            // Named by the kind the first one makes, which is not there yet.
            { mutation: "add-field", args: { kind: "meal", label: "serves", type: "number", required: false } },
          ])}
        />
      </GraviewProvider>,
    );

    await converse(chat.host, "chat", "add milk and eggs");
    await converse(declaration.host, "studio-agent", "a meal kind with how many it serves");

    const before = [shape(chat.host, "chat"), shape(declaration.host, "studio-agent")];
    for (const surface of before) {
      // The person, then the seat — the seat's words as prose, not a second bubble.
      expect(surface.turns).toBe(2);
      expect(surface.said[1]).toBe("Doing both.");
      expect(surface.applyAll).toBe(true);
    }

    await act(async () => chat.host.querySelector<HTMLButtonElement>('[data-testid="chat-apply-all"]')!.click());
    await act(async () => declaration.host.querySelector<HTMLButtonElement>('[data-testid="studio-agent-apply-all"]')!.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

    const after = [shape(chat.host, "chat"), shape(declaration.host, "studio-agent")];
    expect(after[0]!.applied).toEqual(["✓ Add Milk", "✓ Add Eggs"]);
    expect(after[1]!.applied).toHaveLength(2);
    for (const surface of after) {
      // Settled in place: no message of its own per change, and nothing that says "Kept —".
      expect(surface.turns).toBe(2);
      expect(surface.applyAll).toBe(false);
    }
    expect(declaration.host.textContent).not.toContain("Kept —");
    expect(studio.store.graph.getNode("declared:meal")).toBeDefined();

    await chat.unmount();
    await declaration.unmount();
  });
});
