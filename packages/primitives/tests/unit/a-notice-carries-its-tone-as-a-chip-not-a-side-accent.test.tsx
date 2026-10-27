// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createNoticeBoard, fetchNotices, Notices, type NoticeTone } from "../../src/frame.js";

// What draws a notice is fetched with the first; here it is fetched before.
beforeAll(() => fetchNotices());

/**
 * A NOTICE CARRIES ITS TONE AS A CHIP, NOT A SIDE ACCENT (FR-236).
 *
 * Every toast and banner drew a thick colored border on its left side
 * alone, the tone's color — which Nick called a major AI tell. The card
 * now wears one hairline all round, the app's radius, and a small tinted
 * chip at its head carrying a glyph for the tone, hidden from a reader,
 * who is told the tone by how the notice is announced.
 */
let root: Root | undefined;
let host: HTMLElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  host?.remove();
});

async function drawn() {
  const board = createNoticeBoard();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<Notices board={board} anchor={() => host} />));
  return board;
}

const cards = () => [...document.querySelectorAll<HTMLElement>('[data-testid="notice"]')];

describe("a notice's tone", () => {
  it("is one hairline all round, never a thick border on one side, in every tone and on a banner as on a toast", async () => {
    const board = await drawn();
    const tones: NoticeTone[] = ["info", "good", "warn", "bad"];
    await act(async () => {
      for (const tone of tones) board.notify({ kind: "toast", tone, sentence: `A ${tone} toast.` });
      board.notify({ kind: "banner", tone: "warn", sentence: "Offline — changes will be sent when you reconnect." });
    });
    expect(cards()).toHaveLength(5);
    for (const card of cards()) {
      // One `border` shorthand, one width: no side set apart from the others (jsdom keeps the shorthand as written).
      const style = card.getAttribute("style") ?? "";
      expect(style).toMatch(/(^|; )border: 1px solid var\(--graview-edge\);/);
      expect(style).not.toMatch(/border-(left|right|top|bottom)/);
      expect(card.style.borderRadius).toBe("var(--graview-radius, 12px)");
    }
  });

  it("is a small tinted chip at the card's head with a glyph for the tone, hidden from a reader", async () => {
    const board = await drawn();
    await act(async () => {
      board.notify({ kind: "toast", tone: "good", sentence: "Kept." });
      board.notify({ kind: "toast", tone: "bad", sentence: "That change was refused." });
      board.notify({ kind: "toast", sentence: "The app was changed — now version 4" });
    });
    const chips = cards().map((card) => card.querySelector<HTMLElement>('[data-testid="notice-chip"]')!);
    expect(chips.every((chip) => chip !== null && chip.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(chips.map((chip) => chip.textContent)).toEqual(["✓", "!", "i"]);
    expect(cards().map((card) => card.getAttribute("data-tone"))).toEqual(["good", "bad", "info"]);
    // The chip is the card's first child, the sentence right after it.
    for (const card of cards()) {
      expect(card.firstElementChild?.getAttribute("data-testid")).toBe("notice-chip");
      expect(card.children[1]?.getAttribute("data-testid")).toBe("notice-sentence");
    }
    expect(chips[1]!.style.background).toContain("var(--graview-bad)");
  });
});
