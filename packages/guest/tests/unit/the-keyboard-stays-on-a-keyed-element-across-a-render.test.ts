import "@remote-dom/core/polyfill";
// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createViewRuntime } from "../../src/worker/view-global.js";

/*
 * THE KEYBOARD STAYS ON A KEYED ELEMENT ACROSS A RENDER (0.1.47). A view
 * draws again on every push, and a list that re-sorts as its records
 * change would take the keyboard from whoever was tabbing through it. The
 * view's runtime keeps an element with the same `data-key` and moves it
 * where the view moved it; the host used to draw a moved element anew,
 * and now puts that same element back where it was told — with what it
 * knows of it — and gives it the keyboard again if it had it, since moving
 * an element in a page takes its focus away.
 */
function view() {
  const page = new JSDOM("<!doctype html><main></main>");
  const host = page.window.document.querySelector("main")!;
  const shadow = host.attachShadow({ mode: "open" });
  const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: () => {} });
  const made = createViewRuntime({
    send: (request) => void (request.type === "render" && drawing.apply(structuredClone(request.records))),
    act: () => Promise.resolve({ type: "answer", id: 0, ok: false, reason: "refused", message: "" }),
    navigate: () => {},
    microtask: (task) => queueMicrotask(task),
    now: () => 0,
    threw: (error) => {
      throw error;
    },
    warn: () => {},
    hardening: () => ({ removed: [], stuck: [], sealed: false }),
  });
  const draw = async (rows: readonly (readonly [string, string])[]) => {
    made.view.render(`<ul>${rows.map(([key, words]) => `<li data-key="${key}"><button data-key="b-${key}">${words}</button></li>`).join("")}</ul>`);
    for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const button = (key: string) => shadow.querySelector(`button[data-key="b-${key}"]`) as HTMLButtonElement | null;
  return { shadow, draw, button };
}

describe("the keyboard, across a view's render", () => {
  it("stays on the element it was on when the view draws it again in the same place", async () => {
    const { shadow, draw, button } = view();
    await draw([["phishing", "Invoice phishing"], ["vpn", "Old VPN appliance"], ["ddos", "A flood of requests"]]);
    const vpn = button("vpn")!;
    vpn.focus();
    expect(shadow.activeElement).toBe(vpn);
    await draw([["phishing", "Invoice phishing"], ["vpn", "Old VPN appliance — acknowledged"], ["ddos", "A flood of requests"]]);
    expect(button("vpn")).toBe(vpn);
    expect(vpn.textContent).toBe("Old VPN appliance — acknowledged");
    expect(shadow.activeElement).toBe(vpn);
  });

  it("stays on the same element when the view moves it among its siblings by its data-key", async () => {
    const { shadow, draw, button } = view();
    await draw([["phishing", "Invoice phishing"], ["vpn", "Old VPN appliance"], ["ddos", "A flood of requests"]]);
    const vpn = button("vpn")!;
    vpn.focus();
    await draw([["ddos", "A flood of requests"], ["phishing", "Invoice phishing"], ["vpn", "Old VPN appliance"]]);
    expect([...shadow.querySelectorAll("li")].map((li) => li.getAttribute("data-key"))).toEqual(["ddos", "phishing", "vpn"]);
    expect(button("vpn")).toBe(vpn);
    expect(shadow.activeElement).toBe(vpn);
    await draw([["vpn", "Old VPN appliance"], ["ddos", "A flood of requests"], ["phishing", "Invoice phishing"]]);
    expect(button("vpn")).toBe(vpn);
    expect(shadow.activeElement).toBe(vpn);
  });

  it("goes when the element it was on goes: nothing else is handed it", async () => {
    const { shadow, draw, button } = view();
    await draw([["phishing", "Invoice phishing"], ["vpn", "Old VPN appliance"]]);
    button("vpn")!.focus();
    await draw([["phishing", "Invoice phishing"]]);
    expect(button("vpn")).toBeNull();
    expect(shadow.activeElement).toBeNull();
  });
});
