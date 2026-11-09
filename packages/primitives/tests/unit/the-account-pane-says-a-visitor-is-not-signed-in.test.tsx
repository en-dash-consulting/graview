// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, type Policy, type Principal, type SignIn } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { registerDefaultViews } from "../../src/index.js";
import { ProfilePane } from "../../src/bar-panes.js";

/**
 * THE ACCOUNT PANE SAYS A VISITOR IS NOT SIGNED IN (Graview HQ
 * f-profile-pane-says-signed-out). A host hands `signIn` only while the
 * reader is a visitor (FR-183), and the pane told them "Signed in as A
 * visitor", "No role in particular", with no way in. With it, the pane says
 * they are not signed in and its first control is the host's sign-in, drawn
 * as the menu's is; without it, the pane is what it was.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const policy: Policy = { roles: ["member"], grants: [{ roles: ["member"], mutations: "*" }] };
const visitor: Principal = { kind: "human", id: "visitor", name: "A visitor" };

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function pane(signIn?: SignIn, hostActions: { label: string; onSelect?: () => void }[] = []) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const store = new Store({ schema, mutations: [], invariants: [], policy });
  const close = vi.fn();
  await act(async () => {
    root.render(
      <GraviewProvider store={store} principal={visitor} {...(signIn ? { signIn } : {})} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }}>
        <ProfilePane part="top" name="A visitor" me={undefined} hostActions={hostActions} close={close} />
      </GraviewProvider>,
    );
  });
  unmount = async () => act(async () => root.unmount());
  return { host, close };
}

describe("the account pane, for a visitor the host offers a way in", () => {
  it("says the person is not signed in, and draws no Signed in as line and no role line", async () => {
    const { host } = await pane({ label: "Sign in to make changes", run: () => {} });
    const text = host.textContent ?? "";
    expect(text).toContain("Not signed in");
    expect(text).not.toContain("Signed in as");
    expect(text).not.toContain("A visitor");
    expect(text).not.toContain("No role in particular");
    expect(text).not.toContain("This app has no sign-in");
  });

  it("makes the host's sign-in its first control, and pressing it runs the host's sign-in and closes the pane", async () => {
    const run = vi.fn();
    const { host, close } = await pane({ label: "Sign in to make changes", run }, [{ label: "Your apps", onSelect: () => {} }]);
    const first = host.querySelector("button, a, input, select, textarea") as HTMLElement;
    expect(first.textContent).toBe("Sign in to make changes");
    expect(first.getAttribute("data-testid")).toBe("profile-sign-in");
    await act(async () => first.click());
    expect(run).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("the account pane, without a way in", () => {
  it("is unchanged: Signed in as, the name, and the role line", async () => {
    const { host } = await pane();
    const text = host.textContent ?? "";
    expect(text).toContain("Signed in as");
    expect(text).toContain("A visitor");
    expect(text).toContain("This app has no sign-in; everything here is yours.");
    expect(host.querySelector('[data-testid="profile-sign-in"]')).toBeNull();
  });
});
