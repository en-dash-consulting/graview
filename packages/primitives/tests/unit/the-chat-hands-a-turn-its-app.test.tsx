// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import type { HostAi, HostTurn } from "@graview/tools";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { ChatPanel, registerDefaultViews } from "../../src/index.js";

/**
 * THE CHAT HANDS A HOST'S TURN THE APP IT IS MOUNTED WITH. The seat's read
 * tools inside `HostAi.turn` were built from the store alone, so a model
 * asking `describe_place` for a lens was told there is no such place. The
 * provider now holds the app (`app`, which `mount` and `<Embed>` pass), and
 * the chat hands it on: the turn's `describe_place` says what the lens
 * shows, as `graview mcp` does.
 */
const fixtures = `${__dirname}/../../../core/tests/document/fixtures/`;
const compiled = compileDocument(JSON.parse(readFileSync(`${fixtures}lifelogics.gdd.json`, "utf8")));
if (!compiled.ok) throw new Error("the LifeLogics fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(`${fixtures}lifelogics.seed.json`, "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

/** A host's model, scripted: it asks what the offers lens shows, and answers with what it was told. */
function reading(): { ai: HostAi; read: unknown[] } {
  const read: unknown[] = [];
  const turn = async (handed: HostTurn) => {
    const said = await handed.call("describe_place", { place: "the-offers" });
    read.push(said);
    const ok = typeof said === "object" && said !== null && !("error" in said);
    return JSON.stringify({ say: ok ? "The offers lens is described." : "No such place.", proposals: [] });
  };
  return { ai: { turn }, read };
}

async function ask(withApp: boolean) {
  const { ai, read } = reading();
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(app.schema as AnySchema, createViews(app.schema as AnySchema))} initialView={EMPTY_VIEW} principal={owner} ai={ai} {...(withApp ? { app } : {})}>
        <ChatPanel />
      </GraviewProvider>,
    ),
  );
  const field = host.querySelector<HTMLInputElement>('[data-testid="chat-draft"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "how should we plan the next quarter?");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    field.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  for (let tries = 0; tries < 100 && read.length === 0; tries++) await act(async () => new Promise((r) => setTimeout(r, 20)));
  await act(async () => root.unmount());
  host.remove();
  return read;
}

describe("the chat, given a host's turn", () => {
  it("hands the turn the app its provider is mounted with, so describe_place says what a lens shows", async () => {
    const [said] = await ask(true);
    expect(said).toMatchObject({ drawnBy: expect.stringMatching(/^lens:/), place: { slug: "the-offers" } });
    expect((said as { text: string }).text).toContain("Two-day workshop");
  });

  it("without an app on the provider, the lens is not a place it knows", async () => {
    const [said] = await ask(false);
    expect(said).toEqual({ error: expect.stringContaining("is not a place this app has") });
  });
});
