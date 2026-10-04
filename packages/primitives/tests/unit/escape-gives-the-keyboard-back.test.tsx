// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ActivityRail, Standing, registerDefaultViews } from "../../src/index.js";

/**
 * ESCAPE GIVES THE KEYBOARD BACK TO WHAT OPENED THE POPOVER.
 *
 * Open the activity list, press "undo", press Escape: the list closed and
 * the keyboard was on <body>, because the undo button went with it. Every
 * popover on the bar did the same.
 */
const song = defineNode("song", {
  description: "A song.",
  fields: z.object({ label: z.string(), explicit: z.boolean() }),
  plural: "Songs",
  label: (node) => node.label,
});
const schema = createSchema([song]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const add = defineMutation("add-song", {
  title: "Add a song",
  creates: ["song"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "song"), kind: "song", label: args.label, explicit: true });
  },
});
const clean = defineInvariant("clean", {
  label: "Clean",
  description: "Nothing explicit.",
  scope: { kind: "song" },
  evaluate({ subject }) {
    return subject.explicit ? [{ invariant: "clean", subjectId: subject.id, label: "Clean", message: "explicit", nodeIds: [subject.id], repairs: [] }] : [];
  },
});

async function mount(children: React.ReactNode) {
  const store = new Store({ schema, mutations: [add], invariants: [clean] });
  store.apply({ name: "add-song", args: { label: "Blue Hour" } });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
        {children}
      </GraviewProvider>,
    );
  });
  return { host, unmount: () => act(() => root.unmount()) };
}
const escape = () => act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });

describe("a popover closed from the keyboard", () => {
  it("puts the keyboard back on the activity button, not on the body", async () => {
    const { host, unmount } = await mount(<ActivityRail calls={[]} remembers />);
    const button = host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!;
    await act(async () => button.click());
    const undo = host.querySelector<HTMLButtonElement>('[data-testid="undo-turn"]');
    expect(undo).not.toBeNull();
    undo!.focus();
    expect(document.activeElement).toBe(undo);
    await escape();
    expect(host.querySelector('[data-testid="diff-log"]')).toBeNull();
    expect(document.activeElement).toBe(button);
    await unmount();
  });

  it("puts the keyboard back on the standing, from inside the problems", async () => {
    const { host, unmount } = await mount(<Standing clean="All good" />);
    const button = host.querySelector<HTMLButtonElement>('[data-testid="standing"]')!;
    await act(async () => button.click());
    const inside = [...host.querySelectorAll<HTMLElement>("button, a")].find((el) => el !== button);
    expect(inside).toBeDefined();
    inside!.focus();
    await escape();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
    await unmount();
  });

  it("leaves the keyboard alone when it never went inside", async () => {
    const { host, unmount } = await mount(<ActivityRail calls={[]} remembers />);
    const button = host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!;
    button.focus();
    await act(async () => button.click());
    await escape();
    expect(document.activeElement).toBe(button);
    await unmount();
  });
});
