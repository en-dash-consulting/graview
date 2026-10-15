// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FindBox, registerDefaultViews } from "../../src/index.js";

/*
 * THE ARROWS WALK FIND'S RECORDS ONE KEY EACH (the tenth walk; carried from
 * the eighth). A highlighted record unfolds its acts under it, and ↓ walked
 * into them: five keys a record, so the gauntlet's longest title, twenty-odd
 * records down, was past the keyboard's reach in the strip. ↓ and ↑ go
 * record to record; → goes into the acts under the one lit, ← back to it.
 */
const talk = defineNode("talk", { fields: z.object({ label: z.string(), accepted: z.boolean() }), plural: "Talks" });
const schema = createSchema([talk]);
const { defineMutation } = bindSchema(schema);
const accept = defineMutation("accept", {
  title: "Accept it",
  subject: { kinds: ["talk"], arg: "id" },
  writes: ["accepted"],
  input: z.object({ id: nodeRef(["talk"]) }),
  apply: (ctx, args) => ctx.patchNode(args.id, { accepted: true }),
});

async function strip() {
  const store = new Store({
    schema,
    mutations: [accept],
    invariants: [],
    snapshot: {
      nodes: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, kind: "talk", label: `Incremental talk ${i}`, accepted: false })) as never,
      edges: [],
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(() => {
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, q: "incremental" }}>
        <FindBox />
      </GraviewProvider>,
    );
  });
  const box = host.querySelector<HTMLInputElement>('[data-testid="find-box"]')!;
  await act(async () => box.focus());
  const key = (name: string) => act(async () => void box.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })));
  const lit = () => {
    const id = box.getAttribute("aria-activedescendant");
    const row = id ? host.querySelector(`[id="${id}"]`) : null;
    return { about: row?.getAttribute("data-about") ?? null, text: row?.textContent ?? "" };
  };
  return { key, lit, done: () => act(async () => root.unmount()) };
}

describe("Find from the keyboard", () => {
  it("walks record to record with the arrows, past the acts unfolded under each", async () => {
    const { key, lit, done } = await strip();
    for (let press = 0; press < 4; press++) await key("ArrowDown");
    expect(lit()).toMatchObject({ about: "node" });
    expect(lit().text).toContain("Incremental talk");
    const fourth = lit().text;
    await key("ArrowUp");
    expect(lit().about).toBe("node");
    expect(lit().text).not.toBe(fourth);
    await done();
  });

  it("goes into the acts under the record lit with →, and back with ←", async () => {
    const { key, lit, done } = await strip();
    await key("ArrowDown");
    const record = lit().text;
    await key("ArrowRight");
    expect(lit()).toMatchObject({ about: "act" });
    expect(lit().text).toContain("Accept it");
    await key("ArrowLeft");
    expect(lit()).toMatchObject({ about: "node", text: record });
    await done();
  });
});
