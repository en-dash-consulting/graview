// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, z, type Policy, type SignIn } from "@graview/core";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { providerProps } from "../../src/frame.js";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

beforeAll(() => preload());
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

/**
 * A HOST OFFERS A VISITOR THE WAY IN (FR-183). `mount`'s `signIn` is the
 * host's word on what a signed-out reader could gain: on a public app,
 * where every act is an editor's, the list's foot and the context menu say
 * "Sign in to make changes" as one press, beside the face's own rows, and
 * nothing is struck — on the pages and, through the same provider, the scene.
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
const policy: Policy = { grants: [{ roles: ["editor"], mutations: "*" }] };
const app = defineApp({ name: "Deep time", schema, mutations: [add, rename], policy });
const visitor = { kind: "human" as const, id: "anonymous" };

const written = () => new Store({ schema, mutations: [add, rename], policy, snapshot: { nodes: [{ id: "jurassic", kind: "era", label: "Jurassic" }] as never, edges: [] } });

async function settled(holds: () => void): Promise<void> {
  for (const end = Date.now() + 3000; ; ) {
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

const opened: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of opened.splice(0)) await done();
});

async function open(options: Partial<EmbedOptions>): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, fonts: false, store: written(), principal: visitor, ...options } as unknown as EmbedOptions);
  });
  opened.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  return host;
}

describe("a host's signIn handed to mount", () => {
  it("is the line at the list's foot and the row in the menu on the pages face, beside Open, with nothing struck", async () => {
    const run = vi.fn();
    const host = await open({ face: "pages", path: "/eras", signIn: { label: "Sign in to make changes", run } });
    await settled(() => expect(host.querySelector('[data-graview-record="jurassic"]')).not.toBeNull());
    expect(host.querySelector('[data-testid="withheld"]')).toBeNull();
    expect(host.querySelector('[data-testid="sign-in"]')?.textContent).toBe("Sign in to make changes");

    const row = host.querySelector('[data-graview-record="jurassic"]')!;
    await act(async () => void row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
    await settled(() => expect(document.querySelector('[data-testid="context-menu"] [data-testid="sign-in"]')).not.toBeNull());
    const menu = document.querySelector('[data-testid="context-menu"]')!;
    expect(menu.querySelector('[data-menu-item="open"]')).not.toBeNull();
    expect(menu.querySelector('[data-testid="withheld"], [data-testid="no-affordances"], [data-menu-section="notify"]')).toBeNull();
    await act(async () => (menu.querySelector('[data-testid="sign-in"]') as HTMLElement).click());
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("reaches the provider under the scene, the same as the one under the pages", () => {
    const signIn: SignIn = { label: "Sign in to make changes", run: () => {} };
    expect(providerProps({ app, signIn } as unknown as EmbedOptions, undefined, undefined).signIn).toBe(signIn);
  });
});
