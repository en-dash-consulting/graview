// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewBoundary } from "../../src/view-boundary.js";

/**
 * A VIEW THAT THROWS KEEPS THE KEYBOARD OFF THE BODY (the review of pull
 * request 549). A view that held the keyboard and threw on its redraw — a
 * press ticked the store, and what the press changed broke it — took the
 * focused element with it, and the keyboard fell to <body>. The panel takes
 * it; and a view drawn again while the panel holds it gives it to what it drew.
 */
function View({ broken, press }: { readonly broken: boolean; readonly press: boolean }) {
  if (broken) throw new Error("the view threw on its redraw");
  return <div data-testid="drawn">{press ? <button type="button">Mark it done</button> : <p>Nothing to press</p>}</div>;
}

let quiet: ReturnType<typeof vi.spyOn>;
let host: HTMLElement;
let root: Root;
beforeEach(() => {
  quiet = vi.spyOn(console, "error").mockImplementation(() => {});
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  quiet.mockRestore();
});

const draw = (broken: boolean, tick: number, press = true) =>
  act(async () =>
    root.render(
      <ViewBoundary kind="task" view="This task's view" said="" reset={[tick]}>
        <View broken={broken} press={press} />
      </ViewBoundary>,
    ),
  );

describe("a view that throws keeps the keyboard off the body", () => {
  it("the panel takes the keyboard from a view that held it and threw", async () => {
    await draw(false, 0);
    host.querySelector("button")!.focus();
    expect(document.activeElement).toBe(host.querySelector("button"));
    await draw(true, 0);
    const panel = host.querySelector<HTMLElement>("[data-graview-view-error]")!;
    expect(panel.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(panel);
  });

  it("a view drawn again gives the keyboard from the panel to the first thing it drew to press", async () => {
    await draw(false, 0);
    host.querySelector("button")!.focus();
    await draw(true, 0);
    await draw(false, 1);
    expect(host.querySelector("[data-graview-view-error]")).toBeNull();
    expect(document.activeElement).toBe(host.querySelector("button"));
  });

  it("or to what it drew, where it drew nothing to press", async () => {
    await draw(false, 0);
    host.querySelector("button")!.focus();
    await draw(true, 0);
    await draw(false, 1, false);
    expect(document.activeElement).toBe(host.querySelector('[data-testid="drawn"]'));
  });

  it("a view that threw while the keyboard was elsewhere leaves it there", async () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    await draw(false, 0);
    outside.focus();
    await draw(true, 0);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
