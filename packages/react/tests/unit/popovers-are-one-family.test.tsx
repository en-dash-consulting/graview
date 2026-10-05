// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POPOVERS, usePopover, type PopoverName } from "../../src/popover.js";

/**
 * POPOVERS BEHAVE AS ONE FAMILY (FR-77).
 *
 * Every popover had its own way of closing and none of the same habits:
 * two could be open at once, one gave the keyboard back and the next left
 * it on <body>, none moved it in. These are generated over the registry,
 * so a popover added to `POPOVERS` is held to the same rules with nothing
 * written here.
 */
function One({ name }: { readonly name: PopoverName }) {
  const popover = usePopover(name);
  return (
    <div>
      <button type="button" data-testid={`${name}-trigger`} {...popover.trigger} onClick={popover.toggle}>
        {name}
      </button>
      {popover.open ? (
        <div data-testid={`${name}-pane`} {...popover.pane}>
          <button type="button" data-testid={`${name}-first`}>
            first
          </button>
          <button type="button">second</button>
        </div>
      ) : null}
    </div>
  );
}

const NAMES = Object.keys(POPOVERS) as PopoverName[];
let root: Root;
let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<>{NAMES.map((name) => <One key={name} name={name} />)}<p data-testid="ground">ground</p></>));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const $ = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const press = (id: string) => act(() => $(id)!.click());
const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

describe.each(NAMES)("the %s popover", (name) => {
  const other = NAMES.find((one) => one !== name)!;

  it("closes any other when it opens", () => {
    press(`${other}-trigger`);
    expect($(`${other}-pane`)).not.toBeNull();
    press(`${name}-trigger`);
    expect($(`${name}-pane`)).not.toBeNull();
    expect($(`${other}-pane`)).toBeNull();
    expect($(`${other}-trigger`)!.getAttribute("aria-expanded")).toBe("false");
  });

  it(POPOVERS[name].focus === "into" ? "takes the keyboard in when it opens" : "leaves the keyboard in its box, a combobox's", () => {
    $(`${name}-trigger`)!.focus();
    press(`${name}-trigger`);
    const pane = $(`${name}-pane`)!;
    if (POPOVERS[name].focus === "into") expect(document.activeElement).toBe($(`${name}-first`));
    else expect(pane.contains(document.activeElement)).toBe(false);
    expect($(`${name}-trigger`)!.getAttribute("aria-controls")).toBe(pane.id);
  });

  it("closes on Escape and gives the keyboard back to its trigger", () => {
    press(`${name}-trigger`);
    $(`${name}-first`)!.focus();
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect($(`${name}-pane`)).toBeNull();
    expect(document.activeElement).toBe($(`${name}-trigger`));
  });

  it(
    POPOVERS[name].focus === "into" ? "closes on a press outside it and gives the keyboard back to its trigger" : "closes on a press outside it, and leaves the keyboard where the press put it",
    async () => {
      press(`${name}-trigger`);
      $(`${name}-first`)!.focus();
      act(() => $("ground")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
      expect($(`${name}-pane`)).toBeNull();
      await frame();
      if (POPOVERS[name].focus === "into") expect(document.activeElement).toBe($(`${name}-trigger`));
      else expect(document.activeElement).not.toBe($(`${name}-trigger`));
    },
  );

  it("stays open on a press inside it", () => {
    press(`${name}-trigger`);
    act(() => $(`${name}-first`)!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    expect($(`${name}-pane`)).not.toBeNull();
  });
});

/**
 * A DIALOG A POPOVER OPENS TAKES OVER. The studio opens from a button in the
 * profile; in the top layer the profile stood over it. The keyboard going
 * into the dialog closes the popover, and when the dialog is gone the
 * keyboard goes back to the popover's trigger.
 */
describe("a dialog a popover opens", () => {
  function Opener() {
    const popover = usePopover("profile");
    const [dialog, setDialog] = useState(false);
    return (
      <div>
        <button type="button" data-testid="opener" {...popover.trigger} onClick={popover.toggle}>
          profile
        </button>
        <div data-testid="opener-pane" {...popover.pane} hidden={!popover.open}>
          <button type="button" data-testid="open-dialog" onClick={() => setDialog(true)}>
            studio
          </button>
          {dialog
            ? createPortal(
                <div role="dialog" tabIndex={-1} data-testid="dialog" ref={(element) => element?.focus()}>
                  <button type="button" data-testid="close-dialog" onClick={() => setDialog(false)}>
                    close
                  </button>
                </div>,
                document.body,
              )
            : null}
        </div>
      </div>
    );
  }

  it("closes the popover, and gives the keyboard back to its trigger when it goes", async () => {
    act(() => root.render(<Opener />));
    press("opener");
    press("open-dialog");
    expect($("dialog")).not.toBeNull();
    expect($("opener")!.getAttribute("aria-expanded")).toBe("false");
    $("close-dialog")!.focus();
    press("close-dialog");
    await frame();
    await frame();
    expect(document.activeElement).toBe($("opener"));
  });
});
