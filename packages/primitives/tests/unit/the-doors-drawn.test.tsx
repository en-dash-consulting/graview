// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, type IntelligenceProviderDeclaration } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Door, Intake, registerDefaultViews } from "../../src/index.js";
import type { PlannedCall } from "@graview/tools";

/**
 * THE DOORS A PROVIDER DECLARED, DRAWN.
 *
 * `reach: ["paste", "local"]` is the declaration; this is what it looks
 * like. Paste is the floor and works everywhere — a prompt out, an answer
 * back — with no key, no network and no permission, and a product whose
 * model is reached that way is a product anybody can run. A door the
 * provider did not declare is not drawn at all.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const schema = createSchema([zone]);
const { defineMutation } = bindSchema(schema);
const stakeOut = defineMutation("stake-out", {
  title: "Stake out some ground",
  creates: ["zone"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) =>
    void ctx.addNode({ id: ctx.freshId(args.label, "zone"), kind: "zone", label: args.label } as never),
});

const store = (intelligence: readonly IntelligenceProviderDeclaration[]) =>
  new Store({ schema, mutations: [stakeOut], intelligence });

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
});
afterEach(() => {
  host.remove();
  vi.unstubAllGlobals();
});

const draw = async (at: Store<typeof schema>, onProposals: (p: readonly PlannedCall[]) => void = () => {}) => {
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <GraviewProvider store={at} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
        <Door provider="surveyor" prompt="Describe the ground." onProposals={onProposals} />
      </GraviewProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return root;
};

describe("a door", () => {
  it("draws only what the provider declared", async () => {
    const root = await draw(store([{ name: "surveyor", kind: "llm", reach: ["paste"] }]));
    expect(host.querySelector('[data-testid="door-paste"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="door-local"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("is nothing at all for a provider nobody declared", async () => {
    const root = await draw(store([{ name: "somebody-else", kind: "llm", reach: ["paste"] }]));
    expect(host.querySelector('[data-testid="door"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("offers the local door and says it is shut when nothing answers", async () => {
    const root = await draw(
      store([{ name: "surveyor", kind: "llm", reach: ["local"], bridge: "/__graview/local" }]),
    );
    const button = host.querySelector<HTMLButtonElement>('[data-testid="door-local"]')!;
    expect(button.disabled).toBe(true);
    expect(host.querySelector('[data-testid="door"]')!.textContent).toContain("Nothing is serving");
    await act(async () => root.unmount());
  });

  it("reads calls out of a pasted answer, and keeps what the plan named", async () => {
    const taken: PlannedCall[][] = [];
    const root = await draw(store([{ name: "surveyor", kind: "llm", reach: ["paste"] }]), (p) =>
      taken.push([...p]),
    );
    const paste = host.querySelector<HTMLTextAreaElement>('[data-testid="door-paste"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(
        paste,
        'Here you go:\n```json\n{"proposals":[{"mutation":"stake-out","as":"lawn","args":{"label":"Back Lawn"},"why":"the big one"}]}\n```',
      );
      paste.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="door-read"]')!.click());
    expect(taken).toHaveLength(1);
    expect(taken[0]![0]).toMatchObject({ mutation: "stake-out", as: "lawn" });
    await act(async () => root.unmount());
  });

  it("says so rather than silently taking nothing, when the answer names no act", async () => {
    const root = await draw(store([{ name: "surveyor", kind: "llm", reach: ["paste"] }]));
    const paste = host.querySelector<HTMLTextAreaElement>('[data-testid="door-paste"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(paste, '{"proposals":[{"mutation":"invent-a-thing","args":{}}]}');
      paste.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="door-read"]')!.click());
    expect(host.querySelector('[data-testid="door-said"]')!.textContent).toContain("nothing was taken");
    await act(async () => root.unmount());
  });

  it("drops a call outside what the provider may do", async () => {
    const taken: PlannedCall[][] = [];
    const root = await draw(
      store([{ name: "surveyor", kind: "llm", reach: ["paste"], may: ["describe-zone"] }]),
      (p) => taken.push([...p]),
    );
    const paste = host.querySelector<HTMLTextAreaElement>('[data-testid="door-paste"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(paste, '{"proposals":[{"mutation":"stake-out","args":{"label":"x"}}]}');
      paste.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="door-read"]')!.click());
    expect(taken).toHaveLength(0);
    expect(host.querySelector('[data-testid="door-said"]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});

describe("taking photographs in", () => {
  it("hands back a data URL per file", async () => {
    const got: string[][] = [];
    const root = createRoot(host);
    await act(async () => root.render(<Intake onPhotos={(photos) => got.push([...photos])} />));
    const input = host.querySelector<HTMLInputElement>('[data-testid="intake"] input')!;
    const file = new File([new Uint8Array([1, 2, 3])], "lawn.png", { type: "image/png" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => {
      await new Promise((settle) => setTimeout(settle, 10));
    });
    expect(got[0]?.[0]).toMatch(/^data:image\/png;base64,/);
    await act(async () => root.unmount());
  });
});
