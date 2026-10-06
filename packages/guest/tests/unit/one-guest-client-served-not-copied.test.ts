import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createContext, Script } from "node:vm";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error — a plain .mjs module of the scripts, with no declarations.
import { CLIENT, clientModules, GENERATED_CLIENT } from "../../../../scripts/guest-view-runtime.mjs";
import { GUEST_CLIENT, GUEST_CLIENT_SHA256 } from "../../src/client.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/**
 * ONE GUEST CLIENT, SERVED NOT COPIED (FR-88). `connectGuest` is a module,
 * so every frame guest bundled or inlined its own copy. The client is now
 * one prebuilt classic script, `@graview/guest/client.js`, that leaves one
 * global, `GraviewGuest`; a host serves it at a path of its own, or inlines
 * its text (`GUEST_CLIENT`, from `@graview/guest/client`) where a frame's
 * policy allows inline script alone, or names its hash. That a few lines of
 * HTML and the inlined client render, act, navigate and resize under Graview
 * Cloud's view policy in Chromium, WebKit and Firefox is `guest-sandbox
 * --transport=client`.
 */
const file = readFileSync(CLIENT, "utf8");

describe("the client", () => {
  it("is current with its source (pnpm guest:runtime)", async () => {
    const { script, module } = await clientModules();
    expect(file).toBe(script);
    expect(readFileSync(GENERATED_CLIENT, "utf8")).toBe(module);
  });

  it("is the same text inlined as served, with the hash a policy names", () => {
    expect(GUEST_CLIENT).toBe(file);
    expect(GUEST_CLIENT_SHA256).toBe(`sha256-${createHash("sha256").update(file).digest("base64")}`);
  });

  it("is one strict classic script that loads nothing and imports nothing of the framework", () => {
    expect(() => new Script(file)).not.toThrow();
    expect(file).toMatch(/^\/\*![^\n]*\*\/\n"use strict";/);
    expect(file).not.toMatch(/\bimport\s*\(|\bimportScripts\b|\bimport\s+[{*\w]/);
    expect(file.length).toBeLessThan(4_000);
  });

  it("is in the package's tarball and its exports, at a fixed path", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { exports: Record<string, unknown>; files: string[] };
    expect(manifest.exports["./client.js"]).toBe("./client.js");
    expect(manifest.files).toContain("client.js");
  });
});

describe("GraviewGuest.connect, run as a classic script", () => {
  it("says ready to its parent, takes the hello's port, and hears props, asks, goes and sizes over it", async () => {
    const said: unknown[] = [];
    let hear: ((event: MessageEvent) => void) | undefined;
    const parent = { postMessage: (message: unknown) => said.push(message) };
    const page = createContext({ parent, addEventListener: (_: string, listener: (event: MessageEvent) => void) => (hear = listener), removeEventListener: () => {}, Promise });
    new Script(file).runInContext(page);
    const guest = new Script("GraviewGuest.connect()").runInContext(page) as { subscribe(listener: (props: unknown) => void): void; act(name: string, args: unknown): Promise<unknown>; navigate(to: unknown): void; size(height: number): void };
    expect(said).toEqual([{ graview: "guest-ready", protocol: GUEST_PROTOCOL }]);
    expect(new Script("GraviewGuest.protocol").runInContext(page)).toBe(GUEST_PROTOCOL);

    const channel = new MessageChannel();
    const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce: "n0nce", view: "prices" };
    hear!({ source: parent, origin: "https://app.example", data: hello, ports: [channel.port2] } as unknown as MessageEvent);
    const asked: Record<string, unknown>[] = [];
    channel.port1.onmessage = (event) => {
      asked.push(event.data);
      if (event.data.type === "act") channel.port1.postMessage({ type: "answer", id: event.data.id, ok: true, intent: "Noted" });
    };
    const props: unknown[] = [];
    guest.subscribe((one) => props.push(one));
    channel.port1.postMessage({ type: "props", props: { view: "prices", nodes: [], edges: [], acts: [] } });
    await vi.waitFor(() => expect(props).toHaveLength(1));
    expect(await guest.act("add-note", { label: "From the frame" })).toMatchObject({ ok: true, intent: "Noted" });
    guest.navigate("offer:coaching");
    guest.navigate({ place: "the-packages" });
    guest.size(240);
    await vi.waitFor(() => expect(asked).toHaveLength(4));
    expect(asked.map(({ nonce, ...rest }) => (expect(nonce).toBe("n0nce"), rest))).toEqual([
      { type: "act", id: 1, name: "add-note", args: { label: "From the frame" } },
      { type: "navigate", to: "offer:coaching" },
      { type: "navigate", place: "the-packages" },
      { type: "size", height: 240 },
    ]);
    channel.port1.close();
  });
});
