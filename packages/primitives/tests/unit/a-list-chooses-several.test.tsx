// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useChoosing, type Choosing } from "../../src/choosing.js";

/**
 * A LIST CHOOSES SEVERAL. A box at each row's start chooses it; Shift with
 * a press chooses everything between it and the last one pressed; Cmd/Ctrl-A
 * chooses the list and Space a row; a record that leaves the list is put
 * down. What a person does with the chosen is the bar's (`several-bar`).
 */
const ROWS = ["a", "b", "c", "d", "e"];
let host: HTMLDivElement;
let latest: Choosing;

function List({ order }: { readonly order: readonly string[] }) {
  const choosing = useChoosing(order);
  latest = choosing;
  return (
    <div {...choosing.listProps} ref={choosing.list as never} data-testid="list">
      {order.map((id) => (
        <div key={id} data-graview-choose={id}>
          <input {...choosing.boxProps(id, `Row ${id}`)} />
          <a href={`#${id}`}>Row {id}</a>
        </div>
      ))}
    </div>
  );
}

const draw = (order: readonly string[] = ROWS) => {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<List order={order} />));
  return root;
};
const box = (id: string) => host.querySelector<HTMLInputElement>(`[data-graview-choose-box="${id}"]`)!;
const press = (element: Element, init: MouseEventInit = {}) => act(() => void element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init })));
const key = (element: Element, init: KeyboardEventInit) => act(() => void element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })));

afterEach(() => host?.remove());

describe("a list chooses several", () => {
  it("names each box for its record, and chooses with a press", () => {
    draw();
    expect(box("b").getAttribute("aria-label")).toBe("Choose Row b");
    press(box("b"));
    expect(latest.chosen).toEqual(["b"]);
    expect(host.querySelector("[data-graview-choosing]")).not.toBeNull();
  });

  it("chooses a range with Shift, from the last row pressed, in the list's order", () => {
    draw();
    press(box("b"));
    press(box("d"), { shiftKey: true });
    expect(latest.chosen).toEqual(["b", "c", "d"]);
  });

  it("chooses the whole list with Cmd/Ctrl-A, a row with Space on its link, and puts it all down", () => {
    draw();
    key(host.querySelector('a[href="#c"]')!, { key: " " });
    expect(latest.chosen).toEqual(["c"]);
    key(box("a"), { key: "a", metaKey: true });
    expect(latest.chosen).toEqual(ROWS);
    act(() => latest.clear());
    expect(latest.chosen).toEqual([]);
  });

  it("puts down a record that leaves the list", () => {
    const root = draw();
    press(box("a"));
    press(box("e"), { shiftKey: true });
    act(() => root.render(<List order={["a", "b", "c"]} />));
    expect(latest.chosen).toEqual(["a", "b", "c"]);
  });
});
