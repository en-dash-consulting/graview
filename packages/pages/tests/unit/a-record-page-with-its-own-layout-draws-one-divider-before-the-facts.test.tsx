// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses, fetchHomeView, viewsCss } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A RECORD PAGE WITH ITS OWN LAYOUT DRAWS ONE DIVIDER BEFORE THE FACTS
 * (Roadmap f-record-page-empty-band-under-page-spec). A kind's declared page
 * drew its own rule under it, the one it heads the scene's record with; on
 * the pages face the facts below it draw theirs, so a band of nothing stood
 * between two dividers and read as a view that failed to draw.
 */
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const notes = (page: boolean) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Notes",
  kinds: { note: { noun: "note", plural: "notes", fields: { name: { type: "string", required: true }, body: { type: "string" } } } },
  acts: { "add-note": { title: "Add a note", creates: "note" } },
  roles: ["owner"],
  policy: { grants: [{ roles: ["owner"], mutations: "*" }] },
  ...(page ? { views: { note: { page: [{ title: "{name}" }, { text: "A note to keep." }] } } } : {}),
});

const sheet = document.createElement("style");
beforeAll(async () => {
  await Promise.all([fetchDeclaredLenses(), fetchHomeView()]);
  sheet.textContent = viewsCss();
  document.head.appendChild(sheet);
});
afterAll(() => sheet.remove());

async function recordPage(page: boolean) {
  const compiled = compileDocument(notes(page) as never, { today: () => "2026-11-09" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, invariants: app.invariants ?? [] });
  store.apply({ name: "add-note", args: { id: "note:n1", name: "First", body: "hello" } }, { author: owner });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal: owner }} initialPath="/notes/note:n1" />));
  await act(async () => new Promise((done) => setTimeout(done, 30)));
  const main = host.querySelector<HTMLElement>("[data-graview-page-main]")!;
  return {
    main,
    done: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

/*
 * Whether an element draws a line on the side said, from what is declared of
 * it — its own style and the rules that match it — since jsdom does not
 * compute a border written with a custom property.
 */
const LINE = (side: "top" | "bottom") => new RegExp(`border-${side}\\s*:[^;]*solid`);
function drawsALine(element: Element, side: "top" | "bottom"): boolean {
  if (LINE(side).test((element as HTMLElement).style?.cssText ?? "")) return true;
  return [...document.styleSheets].some((styles) =>
    [...styles.cssRules].some((rule) => {
      if (!(rule instanceof CSSStyleRule) || !LINE(side).test(rule.style.cssText || rule.cssText)) return false;
      try {
        return element.matches(rule.selectorText);
      } catch {
        return false;
      }
    }),
  );
}

/** Every element from the top of the page to the facts that draws a line across it. */
function dividersBeforeTheFacts(main: HTMLElement): Element[] {
  const facts = main.querySelector('[data-testid="record-fields"]')!;
  const lines: Element[] = [];
  for (const element of [main, ...main.querySelectorAll("*")]) {
    if (element === facts) {
      if (drawsALine(element, "top")) lines.push(element);
      break;
    }
    if (facts.contains(element)) continue;
    if (drawsALine(element, "top") || drawsALine(element, "bottom")) lines.push(element);
  }
  return lines;
}

describe("a record page with its own layout draws one divider before the facts", () => {
  it("the page's layout draws no rule of its own under it: the facts' rule is the one", async () => {
    const { main, done } = await recordPage(true);
    const spec = main.querySelector('[data-testid="record-view"] [data-graview-spec="page"]')!;
    expect(spec.textContent).toBe("A note to keep.");
    const cs = getComputedStyle(spec); console.log("SPEC", JSON.stringify([cs.borderBottom, cs.borderBottomStyle, cs.getPropertyValue("border-bottom")])); const fs = getComputedStyle(main.querySelector("[data-testid=record-fields]")!); console.log("FACTS", JSON.stringify([fs.borderTop, fs.borderTopStyle, (main.querySelector("[data-testid=record-fields]") as HTMLElement).style.borderTop]));
    expect(dividersBeforeTheFacts(main).map((element) => element.getAttribute("data-testid") ?? element.className)).toEqual(["record-fields"]);
    await done();
  });

  it("and nothing empty stands between the layout and the facts", async () => {
    const { main, done } = await recordPage(true);
    const view = main.querySelector('[data-testid="record-view"]')!;
    expect(view.nextElementSibling?.getAttribute("data-testid")).toBe("record-fields");
    const spec = view.querySelector<HTMLElement>('[data-graview-spec="page"]')!;
    const style = getComputedStyle(spec);
    expect([style.paddingBottom, style.marginBottom].map((value) => parseFloat(value || "0"))).toEqual([0, 0]);
    await done();
  });

  it("a record page without one is unchanged: one divider, the facts'", async () => {
    const { main, done } = await recordPage(false);
    expect(main.querySelector('[data-testid="record-view"]')).toBeNull();
    expect(dividersBeforeTheFacts(main).map((element) => element.getAttribute("data-testid") ?? element.className)).toEqual(["record-fields"]);
    await done();
  });
});
