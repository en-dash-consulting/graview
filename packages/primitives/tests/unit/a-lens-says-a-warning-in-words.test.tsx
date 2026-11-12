// @vitest-environment jsdom
import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TimelineView } from "../../src/index.js";

/**
 * A LENS SAYS A WARNING ONCE, WITH THE NAME (Roadmap
 * f-better-bare-app-defaults). A flagged span too short to show its name
 * said only "Implicated in a problem:" to a screen reader, with nothing
 * after it; and a hover and hidden words together said the warning twice.
 */
const shift = defineNode("shift", { fields: z.object({ label: z.string(), day: z.enum(["mon"]), from: z.number(), until: z.number() }), plural: "Shifts" });
const schema = createSchema([shift]);
const nodes = [
  { id: "s1", kind: "shift", label: "Long desk", day: "mon", from: 0, until: 600 },
  { id: "s2", kind: "shift", label: "Quick check", day: "mon", from: 700, until: 712 },
] as never[];
const text = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
};

describe("a timeline's broken span", () => {
  const html = renderToStaticMarkup(
    <GraviewProvider store={new Store({ schema, mutations: [], invariants: [] })} views={createViews(schema)}>
      <TimelineView schema={schema} nodes={nodes} flagged={["s1", "s2"]} options={{ bindings: { shift: { start: "from", end: "until", column: "day" } }, columns: [{ id: "mon", label: "Monday" }], extent: 1440 }} cardinality="many" fidelity="full" mode="scene" selected={false} />
    </GraviewProvider>,
  );
  const host = text(html);

  it("carries the warning's mark and says it with its name, even where the bar is too short to show the name", () => {
    for (const id of ["s1", "s2"]) {
      const span = host.querySelector(`[data-graview-span="${id}"]`)!;
      expect(span.querySelector("[data-graview-warning-mark]")?.textContent?.trim()).toBe("⚠");
      const label = id === "s1" ? "Long desk" : "Quick check";
      // The words and the name, whichever way the span is drawn: a bar, or a moment on the axis.
      const said = span.textContent!.replace(/\s+/g, " ");
      expect(said).toMatch(/implicated in a problem/i);
      expect(said).toContain(label);
    }
  });

  it("says the warning once: its hover is the name and the time alone", () => {
    for (const span of host.querySelectorAll("[data-graview-span]")) expect(span.getAttribute("title")).not.toMatch(/problem/);
  });
});
