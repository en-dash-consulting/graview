// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { memoryTold, type Telling, type ToldStore } from "@graview/core/told";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { RateTelling } from "../../src/told-card.js";

/*
 * A KEPT NOTE SAYS WHERE THE HOST SENT IT (Roadmap f-told-card-says-where-it-went).
 * "Kept, to learn from." says nothing about who reads the 👎 note; a host
 * that files it somewhere says so with `keptSays` on its told store.
 */
const telling = { id: "t1", rating: "down" } as unknown as Telling;

async function keep(told: ToldStore): Promise<string> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<RateTelling told={told} telling={telling} />));
  const input = host.querySelector<HTMLInputElement>("[data-testid=quick-ask-should]")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, "Move it to Friday");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  const said = host.querySelector("[data-testid=quick-ask-should-kept]")?.textContent ?? "";
  await act(async () => root.unmount());
  host.remove();
  return said;
}

describe("a kept note says where the host sent it", () => {
  it("says the host's sentence once the note is kept", async () => {
    const told: ToldStore = Object.assign(memoryTold(), { keptSays: "Sent to Graview. You'll find it with your feedback." });
    expect(await keep(told)).toBe("Sent to Graview. You'll find it with your feedback.");
  });
  it("says it is kept to learn from when the host names nowhere", async () => {
    expect(await keep(memoryTold())).toBe("Kept, to learn from.");
  });
});
