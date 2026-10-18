// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Policy, type Principal, type SignIn } from "@graview/core";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A READER WHO MAY DO NOTHING IS TOLD HOW TO GET IN (FR-183). A signed-out
 * visitor on a public app right-clicked an era and was shown every act
 * struck through with the policy's sentence — "Nothing you may do with an
 * era — 3 actions withheld" — and nothing said how to get the right. With
 * the host's `signIn`, the menu says the host's one line as a row to press,
 * beside the face's own rows; the list's foot says it too; and "Notify me"
 * is not offered to somebody nobody can tell. A member lacking one role is
 * still told who could (FR-16).
 */
const era = defineNode("era", { fields: z.object({ label: z.string().min(1) }), plural: "Eras", label: (node) => node.label });
const schema = createSchema([era]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-era", {
  title: "Add an era",
  creates: ["era"],
  input: z.object({ label: z.string().min(1) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "era"), kind: "era", label: args.label }),
});
const rename = defineMutation("rename-era", {
  title: "Rename it",
  subject: { kinds: ["era"], arg: "eraId" },
  writes: ["label"],
  input: z.object({ eraId: nodeRef(["era"]), label: z.string().min(1) }),
  apply: (ctx, args) => void ctx.patchNode(args.eraId, { label: args.label }),
});
const policy: Policy = { grants: [{ roles: ["editor"], mutations: "*", describe: "Editors keep the timeline." }, { roles: ["proofreader"], mutations: ["rename-era"] }] };
const visitor: Principal = { kind: "human", id: "anonymous", name: "Visitor" };
const proofreader: Principal = { kind: "human", id: "june", roles: ["proofreader"] };

const MENU = '[data-testid="context-menu"]';
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function rendered(path: string, principal: Principal, signIn?: SignIn) {
  const store = new Store({ schema, mutations: [add, rename], policy, snapshot: { nodes: [{ id: "jurassic", kind: "era", label: "Jurassic" }] as never, edges: [] } });
  const context: PageContext<typeof schema> = { store, views: createViews(schema), principal, ...(signIn ? { signIn } : {}) };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath={path} />));
  await settle();
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}

async function settle(ms = 30) {
  for (let turn = 0; turn < 20; turn += 1) {
    await act(async () => new Promise((done) => setTimeout(done, ms)));
    if (document.querySelector(MENU) || turn > 2) {
      if (document.querySelector(MENU)) await act(async () => new Promise((done) => setTimeout(done, ms)));
      return;
    }
  }
}

async function rightClick(element: Element) {
  await act(async () => void element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
  await settle();
}

const menu = () => document.querySelector<HTMLElement>(MENU);
const rows = () => [...(menu()?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])].map((button) => button.getAttribute("data-menu-item"));
const row = (host: HTMLElement) => host.querySelector('[data-graview-record="jurassic"]')!;

describe("a visitor the host offers a way in", () => {
  it("is shown the host's line in the menu, pressable, with the face's own rows and nothing struck", async () => {
    const run = vi.fn();
    const host = await rendered("/eras", visitor, { label: "Sign in to make changes", run });
    await rightClick(row(host));
    expect(menu()).not.toBeNull();
    const line = menu()!.querySelector<HTMLButtonElement>('[data-testid="sign-in"]');
    expect(line?.textContent).toBe("Sign in to make changes");
    expect(rows()).toEqual(expect.arrayContaining(["open", "in-the-scene"]));
    expect(menu()!.querySelector('[data-testid="withheld"], [data-testid="no-affordances"], s')).toBeNull();
    await act(async () => line!.click());
    expect(run).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
  });

  it("is not offered Notify me, there being nobody to tell", async () => {
    const host = await rendered("/eras", visitor, { label: "Sign in to make changes", run: () => {} });
    await rightClick(row(host));
    expect(menu()!.querySelector('[data-menu-section="notify"]')).toBeNull();
    expect(rows()).not.toContain("notify-me");
  });

  it("is told the same line at the list's foot, in place of the struck acts", async () => {
    const host = await rendered("/eras", visitor, { label: "Sign in to make changes", run: () => {} });
    expect(host.querySelector('[data-testid="withheld"]')).toBeNull();
    expect(host.querySelector('[data-testid="sign-in"]')?.textContent).toBe("Sign in to make changes");
  });
});

describe("a seat the host offers no way in", () => {
  it("is a member lacking one role, told in the menu who could, as before (FR-16)", async () => {
    const host = await rendered("/eras", proofreader);
    await rightClick(row(host));
    expect(menu()!.querySelector('[data-testid="sign-in"]')).toBeNull();
    expect(menu()!.querySelector('[data-testid="withheld"] s')).not.toBeNull();
    expect(host.querySelector('[data-testid="withheld"]')?.textContent).toContain("Add an era");
  });

  it("is a visitor still told what is withheld, and offered Notify me, where the host said nothing", async () => {
    const host = await rendered("/eras", visitor);
    await rightClick(row(host));
    expect(menu()!.querySelector('[data-testid="sign-in"]')).toBeNull();
    expect(menu()!.querySelector('[data-testid="withheld"] s')).not.toBeNull();
    expect(rows()).toContain("notify-me");
  });
});
