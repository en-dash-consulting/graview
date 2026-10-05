import "@remote-dom/core/polyfill";
import * as remoteDom from "@remote-dom/core";
import { RemoteRootElement } from "@remote-dom/core/elements";
// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { VIEW_TONES } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createKitRenderer } from "../../src/host/kit.js";
import { GUEST_KIT, KIT_TONES, type Kit } from "../../src/kit.js";
import { defineKit } from "../../src/worker/elements.js";

/**
 * ONE DECLARATION, BOTH SIDES (FR-69). The worker's remote elements and the
 * host's renderer are both made from the kit's declaration, so a property
 * added to it is a property on both sides with nothing else changed: the
 * guest can set it (as a property or as an attribute), it crosses as a
 * mutation record, and the host draws it. Here the worker's side is Remote
 * DOM's polyfill in this process, and the host's a JSDOM document.
 */

/** The kit with one property more: a count on the badge. */
const grown: Kit = {
  ...GUEST_KIT,
  "gv-badge": { ...GUEST_KIT["gv-badge"], properties: { ...GUEST_KIT["gv-badge"].properties, count: { type: "number" } } },
};
defineKit(grown);
customElements.define("graview-root", RemoteRootElement as unknown as CustomElementConstructor);

function joined(hostKit: Kit) {
  const records: unknown[] = [];
  const root = document.createElement("graview-root") as unknown as RemoteRootElement;
  root.connect({ mutate: (batch) => records.push(...JSON.parse(JSON.stringify(batch))), call: () => undefined });
  const dom = new JSDOM("<!doctype html><main></main>");
  const into = dom.window.document.querySelector("main") as HTMLElement;
  const renderer = createKitRenderer(into, { kit: hostKit, onEvent: () => {} });
  const flush = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    renderer.apply(records.splice(0));
  };
  return { root: root as unknown as Element, into, renderer, flush };
}

describe("one declaration of the kit", () => {
  it("adds a property on the worker's side and the host's at once", async () => {
    const { root, into, renderer, flush } = joined(grown);
    const badge = document.createElement("gv-badge") as HTMLElement & { count?: number; tone?: string };
    badge.count = 3;
    badge.setAttribute("tone", "good");
    badge.textContent = "Three left";
    root.append(badge);
    await flush();
    const drawn = into.querySelector("[data-gv=badge]")!;
    expect(drawn.getAttribute("data-gv-count")).toBe("3");
    expect(drawn.getAttribute("data-gv-tone")).toBe("good");
    expect(drawn.textContent).toBe("Three left");
    // As an attribute too, and as an update after it is drawn.
    badge.setAttribute("count", "4");
    await flush();
    expect(drawn.getAttribute("data-gv-count")).toBe("4");
    expect(renderer.refused).toEqual([]);
  });

  it("is what the host held the guest to: without the declaration the same property is refused", async () => {
    const { root, into, renderer, flush } = joined(GUEST_KIT);
    const badge = document.createElement("gv-badge") as HTMLElement & { count?: number };
    badge.count = 3;
    root.append(badge);
    await flush();
    expect(into.querySelector("[data-gv=badge]")!.hasAttribute("data-gv-count")).toBe(false);
    expect(renderer.refused).toEqual([{ reason: "property", element: "gv-badge", name: "count" }]);
  });

  it("gives every component's remote element exactly the properties and events it declares", () => {
    for (const [name, component] of Object.entries(grown)) {
      const element = customElements.get(name) as unknown as { remotePropertyDefinitions: Map<string, unknown>; remoteEventDefinitions: Map<string, unknown> };
      expect([...element.remotePropertyDefinitions.keys()].sort()).toEqual(Object.keys(component.properties).sort());
      expect([...element.remoteEventDefinitions.keys()].sort()).toEqual(Object.keys(component.events).sort());
    }
  });

  it("takes its tones from FR-03's, and reads Remote DOM's records by Remote DOM's own numbers", () => {
    expect([...KIT_TONES]).toEqual([...VIEW_TONES]);
    expect([remoteDom.MUTATION_TYPE_INSERT_CHILD, remoteDom.MUTATION_TYPE_REMOVE_CHILD, remoteDom.MUTATION_TYPE_UPDATE_TEXT, remoteDom.MUTATION_TYPE_UPDATE_PROPERTY]).toEqual([0, 1, 2, 3]);
    expect([remoteDom.UPDATE_PROPERTY_TYPE_PROPERTY, remoteDom.UPDATE_PROPERTY_TYPE_ATTRIBUTE, remoteDom.UPDATE_PROPERTY_TYPE_EVENT_LISTENER]).toEqual([1, 2, 3]);
    expect([remoteDom.NODE_TYPE_ELEMENT, remoteDom.NODE_TYPE_TEXT, remoteDom.NODE_TYPE_COMMENT, remoteDom.ROOT_ID]).toEqual([1, 3, 8, "~"]);
  });
});
