// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode } from "@graview/core";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GRAVIEW_BRAND, KindFigure } from "../../src/index.js";

/**
 * A FIGURE IS NOT REDRAWN WHEN NOTHING ABOUT IT CHANGED.
 *
 * The art is handed to the DOM as innerHTML, and React 19 decides whether to
 * touch a prop by comparing it to the last one BY IDENTITY — so
 * `dangerouslySetInnerHTML={{ __html: art }}`, which mints a fresh object
 * every render, tore the drawing out and parsed it again every time anything
 * on the screen moved: thirty-four times for one click on the ground.
 *
 * The cost is the smaller half. A double-click only pairs if both clicks land
 * on the SAME node, and the first click's own re-render had already replaced
 * it — so double-clicking a district on its figure selected the card and went
 * nowhere, while double-clicking the same card an inch to the left traveled
 * into it. Traveling is the primary way through the graph, and the figure
 * was a hole in it.
 */
const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  figure: "person",
});
const schema = createSchema([person]);

describe("a figure that has not changed", () => {
  it("is the same drawing after a re-render, not a new one", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let bump: (() => void) | undefined;

    function Screen() {
      const [count, setCount] = useState(0);
      bump = () => setCount((at) => at + 1);
      return (
        <div data-count={count}>
          <KindFigure kind="person" schema={schema} size={20} />
        </div>
      );
    }

    await act(async () => {
      root.render(<Screen />);
    });
    const drawn = host.querySelector("svg");
    expect(drawn).not.toBeNull();

    await act(async () => {
      bump?.();
    });
    // The same node, not an equal one: identity is the whole claim.
    expect(host.querySelector("svg")).toBe(drawn);
    expect(drawn!.isConnected).toBe(true);

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("is redrawn when the kind's art does change", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<KindFigure kind="person" schema={schema} size={20} />);
    });
    const drawn = host.querySelector("svg");

    await act(async () => {
      // A brand may override any kind's figure, and that is a different
      // drawing: the memo must not hold the old one.
      root.render(
        <KindFigure kind="person" schema={schema} size={20} brand={{ ...GRAVIEW_BRAND, figures: { person: "vehicle" } }} />,
      );
    });
    expect(host.querySelector("svg")).not.toBe(drawn);

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
