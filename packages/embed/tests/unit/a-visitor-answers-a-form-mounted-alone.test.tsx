// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnySchema, GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type FormEmbedHandle } from "../../src/form.js";

/**
 * A VISITOR ANSWERS A FORM MOUNTED ALONE (Roadmap f-public-forms).
 * `@graview/embed/form`'s `mount(el, { app, form: "rsvp", principal:
 * "form:<token>" })` draws the RSVP and nothing of the app — no bar, no
 * place, no record already there — makes the token the form's visitor,
 * and on submit the guest lands on the store as "a visitor via the RSVP
 * form" and the page says it was received.
 */
const rsvp = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/rsvp.gdd.json"), "utf8"));
const compiled = compileDocument(rsvp);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;
const seed = { nodes: [{ id: "table:rose", kind: "table", name: "Rose" }, { id: "guest:grace", kind: "guest", name: "Grace Hopper", coming: "yes", email: "grace@example.com" }], edges: [{ id: "e1", kind: "table", from: "guest:grace", to: "table:rose" }] };

let handle: FormEmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
});

const typeInto = (el: HTMLInputElement | HTMLSelectElement, value: string) => {
  Object.getOwnPropertyDescriptor(el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
};

describe("a form mounted alone", () => {
  it("draws only the form, runs as the visitor the token names, and says it was received", async () => {
    host = document.createElement("div");
    document.body.append(host);
    const submitted: string[] = [];
    await act(async () => {
      handle = mount(host!, { app, seed, form: "rsvp", principal: "form:tok-1", scheme: "light", fonts: false, onSubmitted: (form) => submitted.push(form) });
    });
    const root = host.querySelector('[data-graview-embed="form"]')!;
    expect(root.getAttribute("aria-label")).toBe("RSVP");
    expect(host.querySelector("h1")?.textContent).toBe("RSVP");
    expect(host.querySelectorAll('nav, a, [data-testid^="app-face"], [data-testid^="app-place"]').length).toBe(0);
    expect(host.textContent).not.toMatch(/Grace|Rose|Garden party/);

    await act(async () => {
      typeInto(host!.querySelector<HTMLInputElement>('input[name="name"]')!, "Ada Lovelace");
      typeInto(host!.querySelector<HTMLSelectElement>('select[name="coming"]')!, "yes");
    });
    await act(async () => host!.querySelector("form")!.requestSubmit());

    expect(handle!.store.snapshot().nodes.filter((node) => node.kind === "guest").map((node) => node.name)).toEqual(["Grace Hopper", "Ada Lovelace"]);
    expect(handle!.store.log.all().at(-1)!.author).toEqual({ kind: "visitor", id: "form:tok-1", name: "a visitor via the RSVP form", roles: ["visitor"] });
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Received — thank you.");
    expect(host.textContent).not.toMatch(/Grace|Rose/);
    expect(submitted).toEqual(["rsvp"]);
  });

  it("refuses a form the declaration has not got, by its name", () => {
    host = document.createElement("div");
    expect(() => (handle = mount(host!, { app, form: "nowhere", principal: "form:tok-1", fonts: false }))).toThrow(/no form called "nowhere"/);
    handle = undefined;
  });
});
