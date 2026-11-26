// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import type { ToolCall } from "@graview/tools";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createPageRegistry, PagesApp, type PageComponent, type PageContext, type PageRegistry } from "../../src/index.js";
import { theOneFaceHasCome } from "./on-the-one-face.js";
import type { ReactNode } from "react";

type PagesRegistry = PageRegistry<typeof schema, PageComponent<typeof schema>>;

/**
 * THE ONE FACE OFFERS THE SEAT AND THE STUDIO (Graview HQ
 * feature:f-studio-and-seat-on-the-one-face). The Scene's own face held the
 * app's agent seat in its inbox's Activity and the way into the app's own
 * declaration in the person's menu, under "Keeping this app". The one face
 * has the same bar, so they go in the same places: `seat` and `studio` on
 * the face's context, and nothing else added to the bar.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const store = () => new Store({ schema, mutations: [], snapshot: { nodes: [], edges: [] } });
const views = () => registerDefaultViews(schema, createViews(schema));

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  told = undefined;
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

let told: ((call: ToolCall) => void) | undefined;
const seat = (onCall: (call: ToolCall) => void): ReactNode => {
  told = onCall;
  return (
    <button type="button" data-testid="agent-starter">
      Add some starter data
    </button>
  );
};
const studio = (
  <button type="button" data-testid="studio-place">
    Studio
  </button>
);

async function drawn(extra: Partial<PageContext<typeof schema>>, registry?: PagesRegistry) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: views(), ...extra } as PageContext<typeof schema>} initialPath="/" {...(registry ? { registry } : {})} />));
  unmount = () => act(async () => root.unmount());
  await theOneFaceHasCome(host);
  return host;
}

describe("the one face offers the seat and the studio", () => {
  it("holds the seat in the inbox's Activity, on an app nothing has happened in yet", async () => {
    await drawn({ seat });
    // The bell is there before any change: the seat is something Activity holds.
    await settled(() => expect(document.querySelector('[data-graview-app-bar] [data-testid="inbox-button"]')).not.toBeNull());
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="inbox-button"]')!.click());
    await settled(() => expect(document.querySelector('[data-testid="agent-seat-row"] [data-testid="agent-starter"]')).not.toBeNull());
    expect(document.querySelector('[data-testid="agent-seat-row"]')!.textContent).toContain("The agent's seat");
  });

  it("shows the calls the seat makes in Activity", async () => {
    await drawn({ seat });
    await settled(() => expect(told).toBeDefined());
    await act(async () => told!({ name: "add-task", args: {}, phase: "ok", at: new Date().toISOString(), by: { kind: "agent", id: "starter" } } as unknown as ToolCall));
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="inbox-button"]')!.click());
    await settled(() => expect(document.querySelector('[data-testid="agent-seat-row"]')?.parentElement?.textContent ?? "").toContain("Add task"));
  });

  it("holds the studio in the person's menu, under keeping this app", async () => {
    await drawn({ studio });
    const keeping = document.querySelector('[data-graview-app-bar] [data-testid="profile-keeping"]');
    expect(keeping?.querySelector('[data-testid="studio-place"]')).not.toBeNull();
  });

  it("offers both under a design's own shell, which stands under the same bar", async () => {
    const registry = createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).surface("shell", ({ children }: { children: ReactNode }) => <div data-testid="own-shell">{children}</div>);
    await drawn({ seat, studio }, registry);
    expect(document.querySelector('[data-testid="own-shell"]')).not.toBeNull();
    expect(document.querySelector('[data-graview-app-bar] [data-testid="profile-keeping"] [data-testid="studio-place"]')).not.toBeNull();
    await settled(() => expect(document.querySelector('[data-graview-app-bar] [data-testid="inbox-button"]')).not.toBeNull());
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="inbox-button"]')!.click());
    await settled(() => expect(document.querySelector('[data-testid="agent-seat-row"] [data-testid="agent-starter"]')).not.toBeNull());
    // Drawn once: the bar's own inbox stands aside where the design's face controls draw it.
    expect(document.querySelectorAll('[data-testid="agent-starter"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="inbox-button"]')).toHaveLength(1);
  });

  it("keeps the seat under a design that goes without the way back", async () => {
    const registry = createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).surface("shell", ({ children }: { children: ReactNode }) => <div>{children}</div>, { without: ["undo"] });
    await drawn({ seat }, registry);
    await settled(() => expect(document.querySelector('[data-graview-app-bar] [data-testid="inbox-button"]')).not.toBeNull());
  });

  it("draws neither, and no bell, where the host gives neither", async () => {
    await drawn({});
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(document.querySelector('[data-testid="inbox-button"]')).toBeNull();
    expect(document.querySelector('[data-testid="studio-place"]')).toBeNull();
  });
});
