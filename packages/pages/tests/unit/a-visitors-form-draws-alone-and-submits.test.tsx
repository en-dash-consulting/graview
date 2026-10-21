// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { formVisitor } from "@graview/core/forms";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { VisitorFormPage } from "../../src/visitor-form.js";

/**
 * A VISITOR'S FORM DRAWS ALONE AND SUBMITS (Roadmap f-public-forms): the
 * RSVP's title, intro, the fields it names in its order and the submit,
 * and nothing of the app — no bar, no list, no record, not the guest
 * already there nor the table — then, pressed, the answer lands on the
 * store as the minted visitor and the page says it was received, in the
 * declaration's words, with the keyboard on what it said.
 */
const document_ = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/rsvp.gdd.json"), "utf8"));
const compiled = compileDocument(document_);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;
const HOST: Principal = { kind: "human", id: "hana", roles: ["host"] };

const typeInto = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
};

describe("a visitor's form", () => {
  it("draws the form alone, submits as the visitor, and says it was received in the declaration's words", async () => {
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy } as never) as Store<AnySchema>;
    store.apply({ name: "add-table", args: { name: "Rose" } }, { author: HOST });
    store.apply({ name: "add-guest", args: { name: "Grace Hopper", coming: "yes" } }, { author: HOST });
    const visitor = formVisitor(app, "rsvp", "form:tok-1");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const submitted: string[] = [];
    await act(async () => root.render(<VisitorFormPage app={app} store={store} form="rsvp" principal={visitor} onSubmitted={(form) => submitted.push(form)} />));

    expect(host.querySelector("h1")?.textContent).toBe("RSVP");
    expect(host.textContent).toContain("Tell us whether you can come");
    expect([...host.querySelectorAll("[name]")].map((el) => el.getAttribute("name"))).toEqual(["name", "email", "coming", "note"]);
    expect(host.querySelector('button[type="submit"]')?.textContent).toBe("Answer the invitation");
    // Nothing of the app: no bar, no nav, no link, no record already there.
    expect(host.querySelectorAll("nav, a, [data-graview-bar]").length).toBe(0);
    expect(host.textContent).not.toMatch(/Grace|Rose/);

    await act(async () => {
      typeInto(host.querySelector<HTMLInputElement>('input[name="name"]')!, "Ada Lovelace");
      typeInto(host.querySelector<HTMLSelectElement>('select[name="coming"]')!, "maybe");
    });
    await act(async () => host.querySelector("form")!.requestSubmit());

    expect(host.querySelector('[data-testid="refused"]')).toBeNull();
    const ada = store.snapshot().nodes.find((node) => node.name === "Ada Lovelace");
    expect(ada).toMatchObject({ kind: "guest", coming: "maybe" });
    expect(store.log.all().at(-1)!.author).toMatchObject({ id: "form:tok-1", name: "a visitor via the RSVP form" });
    const status = host.querySelector('[role="status"]')!;
    expect(status.textContent).toBe("Received — thank you.Thank you — the hosts will write to you a week before.");
    expect(document.activeElement).toBe(status);
    expect(host.querySelector("form")).toBeNull();
    expect(host.textContent).not.toMatch(/Grace|Rose/);
    expect(submitted).toEqual(["rsvp"]);
    await act(async () => root.unmount());
    host.remove();
  });

  it("says there is no form where the declaration has none of that name", async () => {
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy } as never) as Store<AnySchema>;
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<VisitorFormPage app={app} store={store} form="nowhere" principal={{ kind: "human", id: "form:x", roles: ["visitor"] }} />));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("There is no form here.");
    await act(async () => root.unmount());
  });
});
