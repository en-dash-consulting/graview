// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { composeReshape } from "@graview/core/compose";
import { documentOf, type GraviewDocument } from "@graview/core/document";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, type ProposeChangeHost } from "@graview/react";
import type { HostAi } from "@graview/tools";
import type { ReshapeProposal } from "@graview/tools/reshape";

type Decide = NonNullable<HostAi["decide"]>;
type Answer = Awaited<ReturnType<Decide>>["answers"][string];
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ChatPanel, registerDefaultViews } from "../../src/index.js";

/**
 * THE SEAT OFFERS A CHANGE TO THE APP ONLY WITH A HOST TO APPLY IT (Roadmap
 * f-seat-reshape). An owner who says "we also need who's driving" is
 * answered with a card — people who own things added, the categories and
 * vendors kept — whose chips toggle and whose Accept hands the host one
 * change; without `onProposeChange`, and for a viewer, the same words draw
 * no card at all: the tool does not exist, it is not refused.
 */
const fixtures = `${__dirname}/../../../core/tests/document/fixtures/`;
const CATALOG = JSON.parse(readFileSync(`${fixtures}cloud-catalog.json`, "utf8")) as { id: string; document: GraviewDocument }[];
const compiled = compileDocument(CATALOG.find((one) => one.id === "vendor-shortlist")!.document);
if (!compiled.ok) throw new Error("the vendor shortlist compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const viewer: Principal = { kind: "human", id: "u:viewer", roles: ["viewer"] };

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

/** A stub System One: people who own things are needed, nothing else is needed or dropped. */
const whoIsDriving: Decide = async (_state, questions) => {
  const answers: Record<string, Answer> = {};
  for (const key of Object.keys(questions)) answers[key] = { type: "noul", noul: key === "need:owners" ? 0.92 : 0.08 };
  return { answers, usage: { inputTokens: 0, outputTokens: 0 } };
};
const ai: HostAi = { decide: whoIsDriving };

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  sessionStorage.clear();
});

const settle = () => act(async () => new Promise<void>((done) => setTimeout(done, 25)));

async function seat(options: { readonly principal: Principal; readonly onProposeChange?: ProposeChangeHost }) {
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes: [], edges: [] } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(app.schema as AnySchema, createViews(app.schema as AnySchema))} initialView={EMPTY_VIEW} principal={options.principal} ai={ai} app={app} {...(options.onProposeChange ? { onProposeChange: options.onProposeChange } : {})}>
        <ChatPanel />
      </GraviewProvider>,
    ),
  );
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  const ask = async (text: string) => {
    const field = host.querySelector<HTMLInputElement>('[data-testid="chat-draft"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, text);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      field.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    // The seat's turns: the person's, then the answer.
    for (let tries = 0; tries < 200 && host.querySelectorAll('[data-testid="chat-panel"] ol > li').length < 2; tries++) await settle();
  };
  const card = () => host.querySelector('[data-testid="chat-reshape"]');
  const chips = () => [...host.querySelectorAll<HTMLButtonElement>('[data-testid="chat-reshape-chip"]')].map((chip) => ({ words: chip.textContent ?? "", on: chip.getAttribute("aria-pressed") === "true", part: chip.getAttribute("data-reshape-part") }));
  return { host, ask, card, chips };
}

describe("an owner who says 'we also need who's driving'", () => {
  it("is answered with a card that adds people who own things and keeps the categories and vendors, and Accept hands the host one change", async () => {
    const handed: ReshapeProposal[] = [];
    const onProposeChange: ProposeChangeHost = async (proposal) => {
      handed.push(proposal);
      return "applied" as const;
    };
    const { host, ask, card, chips } = await seat({ principal: owner, onProposeChange });
    await ask("we also need who's driving");
    for (let tries = 0; tries < 200 && !card(); tries++) await settle();
    expect(card()).not.toBeNull();
    expect(card()!.textContent).toContain("This adds people who own things and keeps categories and vendors.");
    expect(chips()).toEqual(expect.arrayContaining([expect.objectContaining({ words: "people who own things", on: true, part: "trait:owners" }), expect.objectContaining({ words: "vendors", on: true, part: "kind:vendor" })]));
    expect(host.querySelector('[data-testid="chat-reshape-breaking"]')).toBeNull();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="chat-reshape-accept"]')!.click());
    for (let tries = 0; tries < 200 && handed.length === 0; tries++) await settle();
    expect(handed).toHaveLength(1);
    expect(handed[0]!.add).toEqual(["owners"]);
    expect(handed[0]!.drop).toEqual([]);
    // The host composes the edits from the reading it was handed: a person kind and an owner link, one change.
    const composed = composeReshape({ document: documentOf(app)!, add: handed[0]!.add, drop: handed[0]!.drop });
    expect(composed.edits.map((edit) => edit.op)).toEqual(expect.arrayContaining(["add-kind", "add-relation"]));
    expect(composed.edits.find((edit) => edit.op === "add-kind")).toMatchObject({ kind: "person" });
    for (let tries = 0; tries < 200 && !host.querySelector('[data-testid="chat-applied"]'); tries++) await settle();
    expect(host.querySelector('[data-testid="chat-applied"]')?.textContent).toContain("This adds people who own things");
    expect(host.querySelector('[data-testid="chat-reshape-accept"]')).toBeNull();
  });

  it("toggles a chip off and the card recomposes to nothing, with Accept disabled until something is on again", async () => {
    const { host, ask, card, chips } = await seat({ principal: owner, onProposeChange: async () => "applied" as const });
    await ask("we also need who's driving");
    for (let tries = 0; tries < 200 && !card(); tries++) await settle();
    const chip = () => host.querySelector<HTMLButtonElement>('[data-reshape-part="trait:owners"]')!;
    await act(async () => chip().click());
    for (let tries = 0; tries < 200 && chip().getAttribute("aria-pressed") !== "false"; tries++) await settle();
    expect(chips().find((one) => one.part === "trait:owners")?.on).toBe(false);
    expect(card()!.textContent).toContain("Nothing in Vendor shortlist changes for that.");
    expect(host.querySelector<HTMLButtonElement>('[data-testid="chat-reshape-accept"]')!.disabled).toBe(true);
    await act(async () => chip().click());
    for (let tries = 0; tries < 200 && chip().getAttribute("aria-pressed") !== "true"; tries++) await settle();
    expect(host.querySelector<HTMLButtonElement>('[data-testid="chat-reshape-accept"]')!.disabled).toBe(false);
  });

  it("is told when the host declines, where the card stood", async () => {
    const { host, ask, card } = await seat({ principal: owner, onProposeChange: async () => "declined" as const });
    await ask("we also need who's driving");
    for (let tries = 0; tries < 200 && !card(); tries++) await settle();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="chat-reshape-accept"]')!.click());
    for (let tries = 0; tries < 200 && !host.querySelector('[data-testid="chat-refused"]'); tries++) await settle();
    expect(host.querySelector('[data-testid="chat-refused"]')?.textContent).toContain("declined");
  });
});

describe("the same words", () => {
  it("draw no card without a host to apply the change: the tool does not exist", async () => {
    const { host, ask, card } = await seat({ principal: owner });
    await ask("we also need who's driving");
    await settle();
    await settle();
    expect(card()).toBeNull();
    expect(host.querySelectorAll('[data-testid="chat-panel"] ol > li').length).toBeGreaterThanOrEqual(2);
  });

  it("draw no card for a viewer, whose role may not change the declaration", async () => {
    const { ask, card } = await seat({ principal: viewer, onProposeChange: async () => "applied" as const });
    await ask("we also need who's driving");
    await settle();
    await settle();
    expect(card()).toBeNull();
  });
});
