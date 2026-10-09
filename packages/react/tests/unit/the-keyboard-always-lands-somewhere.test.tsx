// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTheKeyboardLandsSomewhere } from "../../src/index.js";

/**
 * THE KEYBOARD ALWAYS LANDS SOMEWHERE. Eight walk findings were the keyboard
 * on <body> after an act removed what it stood on, each on a different
 * surface. The root holds the rule now: the keyboard lands on the nearest
 * thing that still stands where it was.
 */
const later = () => act(async () => new Promise((resolve) => setTimeout(resolve, 150)));

let rects: PropertyDescriptor | undefined;
beforeEach(() => {
  rects = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getClientRects");
  // jsdom lays nothing out; everything rendered here is shown, but what is hidden.
  HTMLElement.prototype.getClientRects = function (this: HTMLElement) {
    return (this.closest("[hidden]") ? [] : [{}]) as unknown as DOMRectList;
  };
});
afterEach(() => {
  if (rects) Object.defineProperty(HTMLElement.prototype, "getClientRects", rects);
  document.body.innerHTML = "";
});

function Bar({ start }: { readonly start: "open" | "chip" }) {
  const root = useRef<HTMLDivElement>(null);
  useTheKeyboardLandsSomewhere(root);
  const [open, setOpen] = useState(start === "open");
  const [round, setRound] = useState(0);
  const [sending, setSending] = useState(false);
  return (
    <div ref={root}>
      <nav aria-label="Places">
        <button>Home</button>
        {open ? (
          <div role="menu">
            <button data-testid="close" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        ) : null}
      </nav>
      <section aria-label="Ask">
        <input aria-label="Question" />
        <button data-testid="send" hidden={sending} onClick={() => setSending(true)}>
          Send
        </button>
      </section>
      {/* A re-render that draws the same control again under a new key. */}
      <button key={round} data-testid="back" onClick={() => setRound((n) => n + 1)}>
        Back
      </button>
    </div>
  );
}

const mount = async (start: "open" | "chip") => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<Bar start={start} />));
  return host;
};

describe("a root that holds the keyboard", () => {
  it("lands it on what still stands where the removed control was", async () => {
    const host = await mount("open");
    const close = host.querySelector<HTMLButtonElement>('[data-testid="close"]')!;
    close.focus();
    await act(async () => close.click());
    await later();
    expect(document.activeElement?.textContent).toBe("Home");
  });

  it("lands it on the same control when a re-render drew it again", async () => {
    const host = await mount("chip");
    const back = host.querySelector<HTMLButtonElement>('[data-testid="back"]')!;
    back.focus();
    await act(async () => back.click());
    await later();
    expect(document.activeElement).not.toBe(back);
    expect(document.activeElement?.getAttribute("data-testid")).toBe("back");
  });

  it("lands it beside a control hidden while it held the keyboard", async () => {
    const host = await mount("chip");
    const send = host.querySelector<HTMLButtonElement>('[data-testid="send"]')!;
    send.focus();
    await act(async () => send.click());
    // A browser lets go of a control it stops drawing; jsdom has to be told.
    await act(async () => send.blur());
    await later();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Question");
  });

  /*
   * Firefox and Safari on macOS do not give a button the keyboard when it is
   * clicked: the press takes it off the field it was on and puts it nowhere.
   * A button pressed that way and then taken away (Keep on a drawn view)
   * left the keyboard on <body> in Firefox, where Chromium's focused button
   * was removed and the rule landed it.
   */
  it("lands it where a pressed control was when the browser never gave that control the keyboard", async () => {
    const host = await mount("open");
    const question = host.querySelector<HTMLInputElement>('[aria-label="Question"]')!;
    question.focus();
    const close = host.querySelector<HTMLButtonElement>('[data-testid="close"]')!;
    await act(async () => {
      // The press: the field lets go, the button is not focused, and it is gone.
      question.blur();
      close.click();
    });
    await later();
    await later();
    expect(document.activeElement?.textContent).toBe("Home");
  });

  it("leaves the keyboard where a surface that knew better put it", async () => {
    const host = await mount("open");
    const close = host.querySelector<HTMLButtonElement>('[data-testid="close"]')!;
    close.focus();
    await act(async () => {
      close.click();
      host.querySelector<HTMLButtonElement>('[data-testid="back"]')!.focus();
    });
    await later();
    expect(document.activeElement?.getAttribute("data-testid")).toBe("back");
  });
});
