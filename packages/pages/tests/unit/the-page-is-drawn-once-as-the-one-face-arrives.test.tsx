// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ONE_FACE_ARRIVING, PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE PAGE IS DRAWN ONCE AS THE ONE FACE ARRIVES. The one face's part is
 * fetched as the page first draws, and the page stood as Suspense's
 * fallback meanwhile: when the part came, some 300 ms later, the whole page
 * and its bar were drawn again as new elements inside it, and a press, the
 * keyboard and a word typed in that time were lost. Drawn once and moved,
 * the page's elements, the field the keyboard is in and what was typed
 * there are the same once the one face has come — and the page stands in
 * the one face's sheet, its bar in the face's slot.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const store = () => new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the van" }] as never, edges: [] } });
const views = () => registerDefaultViews(schema, createViews(schema));

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 5)));

describe("the page is drawn once as the one face arrives", () => {
  it("keeps the page's elements, the keyboard and a typed word across the arrival", async () => {
    const html = document.documentElement;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: store(), views: views(), sceneUnderPages: true } as PageContext<typeof schema>} initialPath="/tasks" />));
    // The page as it is first drawn, before the one face has come.
    expect(html.hasAttribute(ONE_FACE_ARRIVING)).toBe(true);
    expect(host.querySelector("[data-graview-one-place]")).toBeNull();
    const main = host.querySelector("main");
    const bar = host.querySelector("[data-graview-app-bar]");
    const link = host.querySelector('a[href="/tasks/t1"]');
    expect(main, "the page is drawn while the one face is on its way").not.toBeNull();
    expect(bar, "and its bar").not.toBeNull();
    expect(link, "and its link to the task").not.toBeNull();
    // A word typed in a field of the page meanwhile, the keyboard in it.
    const field = document.createElement("input");
    field.setAttribute("data-test-field", "");
    main!.appendChild(field);
    field.focus();
    field.value = "fern";
    field.setSelectionRange(2, 2);
    expect(document.activeElement).toBe(field);

    for (let turn = 0; turn < 200 && (html.hasAttribute(ONE_FACE_ARRIVING) || !host.querySelector("[data-graview-one-place]")); turn++) await settle();
    await settle();

    const sheet = host.querySelector("[data-graview-one-place]");
    expect(sheet, "the one face has come").not.toBeNull();
    expect(html.hasAttribute(ONE_FACE_ARRIVING)).toBe(false);
    // The same elements, now in the one face: the page in its sheet, the bar in its slot.
    expect(host.querySelector("main")).toBe(main);
    expect(host.querySelector("[data-graview-app-bar]")).toBe(bar);
    expect(host.querySelector('a[href="/tasks/t1"]')).toBe(link);
    expect(sheet!.contains(main)).toBe(true);
    expect(host.querySelector('[data-testid="one-place-bar"]')!.contains(bar)).toBe(true);
    expect(host.querySelectorAll("main")).toHaveLength(1);
    expect(host.querySelectorAll("[data-graview-app-bar]")).toHaveLength(1);
    // The keyboard where it was, and the word as typed.
    expect(main!.contains(field)).toBe(true);
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe("fern");
    expect(field.selectionStart).toBe(2);

    await act(async () => root.unmount());
    host.remove();
    // Nothing of the page is left behind once the face goes.
    expect(document.querySelector("[data-graview-one-face-page], [data-graview-bar-host]")).toBeNull();
  });
});
