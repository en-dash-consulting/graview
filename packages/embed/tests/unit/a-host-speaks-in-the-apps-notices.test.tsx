// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount, preload, type EmbedHandle } from "../../src/index.js";
import { mount as mountPages } from "../../src/pages.js";

beforeAll(() => preload());

/**
 * A HOST SPEAKS IN THE APP'S OWN NOTICES (FR-75).
 *
 * Graview Cloud drew its newer-build notice, its offline and held banners,
 * its conflict card and its toasts as furniture of its own, fixed over the
 * app in a look copied from the framework's. The embed's handle says them
 * now, in the framework's floating panel, on the ladder's top rung, and
 * aloud.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const app = defineApp({ name: "Field notes", schema: createSchema([note]), mutations: [] });

let handle: EmbedHandle | undefined;
let host: HTMLElement;
async function mounted(mounter: typeof mount = mount) {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mounter(host, { app, fonts: false, face: "pages" }) as EmbedHandle;
  });
  return handle!;
}
afterEach(async () => {
  vi.useRealTimers();
  await act(async () => handle?.unmount());
  host?.remove();
});

const toasts = () => [...host.querySelectorAll('[data-testid="notices-toasts"] [data-testid="notice"]')];
const banners = () => [...host.querySelectorAll('[data-testid="notices-banners"] [data-testid="notice"]')];
const said = () => host.querySelector('[data-testid="notices-said"]')?.textContent ?? "";
const alarmed = () => host.querySelector('[data-testid="notices-alarm"]')?.textContent ?? "";

describe("a host's notices", () => {
  it("says a toast in the app's own notices and aloud, and lets it go after a while", async () => {
    vi.useFakeTimers();
    const embed = await mounted();
    act(() => void embed.notify({ kind: "toast", sentence: "The app was changed — now version 4" }));
    expect(toasts().map((one) => one.textContent)).toEqual([expect.stringContaining("The app was changed — now version 4")]);
    await act(async () => void vi.advanceTimersByTime(100));
    expect(said()).toBe("The app was changed — now version 4");
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(toasts()).toEqual([]);
  });

  it("keeps a banner until it is cleared, and changes it in place", async () => {
    vi.useFakeTimers();
    const embed = await mounted();
    let offline!: ReturnType<EmbedHandle["notify"]>;
    act(() => {
      offline = embed.notify({ kind: "banner", sentence: "Offline — changes will be sent when you reconnect.", tone: "warn" });
    });
    await act(async () => void vi.advanceTimersByTime(60_000));
    expect(banners()).toHaveLength(1);
    expect(banners()[0]!.getAttribute("data-tone")).toBe("warn");
    act(() => offline.update({ sentence: "Held while a repair is checked.", tone: "bad" }));
    expect(banners()[0]!.textContent).toContain("Held while a repair is checked.");
    expect(banners()[0]!.getAttribute("data-tone")).toBe("bad");
    act(() => offline.dismiss());
    expect(banners()).toEqual([]);
  });

  it("says a bad one as an alert", async () => {
    vi.useFakeTimers();
    const embed = await mounted();
    act(() => void embed.notify({ kind: "toast", sentence: "That change was refused.", tone: "bad" }));
    await act(async () => void vi.advanceTimersByTime(100));
    expect(alarmed()).toBe("That change was refused.");
  });

  it("puts one with the same id in place of the one before", async () => {
    const embed = await mounted();
    act(() => void embed.notify({ id: "newer", kind: "banner", sentence: "A newer version is available." }));
    act(() => void embed.notify({ id: "newer", kind: "banner", sentence: "A newer version is available — reload when convenient." }));
    expect(banners().map((one) => one.textContent)).toEqual([expect.stringContaining("reload when convenient")]);
  });

  it("offers its actions — a press that is told and closes it, a link that is followed — and waits for one", async () => {
    vi.useFakeTimers();
    const embed = await mounted();
    const keepTheirs = vi.fn();
    act(() =>
      void embed.notify({
        kind: "toast",
        sentence: "Somebody changed this while you were offline.",
        actions: [{ label: "Keep theirs", onSelect: keepTheirs }, { label: "Use mine", onSelect: () => {} }],
      }),
    );
    act(() => void embed.notify({ kind: "banner", sentence: "A newer version is available.", action: { label: "Reload", href: "/" } }));
    await act(async () => void vi.advanceTimersByTime(60_000));
    expect(toasts()).toHaveLength(1);
    expect(banners()[0]!.querySelector("a")?.getAttribute("href")).toBe("/");
    act(() => [...toasts()[0]!.querySelectorAll("button")].find((one) => one.textContent === "Keep theirs")!.click());
    expect(keepTheirs).toHaveBeenCalledTimes(1);
    expect(toasts()).toEqual([]);
  });

  it("is on the pages alone too", async () => {
    const embed = await mounted(mountPages as unknown as typeof mount);
    act(() => void embed.notify({ kind: "toast", sentence: "Saved." }));
    expect(toasts()).toHaveLength(1);
  });
});
