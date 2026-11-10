// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { describe, expect, it } from "vitest";
import { builder, edit, handles, until } from "../support/a-builder-in-the-studio.js";

/**
 * THE HISTORY OPENS UNDER AN OPEN STUDIO AS THE APP'S OWN (Roadmap
 * f-host-opens-history). The studio draws the declaration in a provider of
 * its own, with no timeline. A host's `showHistory()` while it is open opens
 * the app's timeline, where the scene draws it, and leaves the studio's own
 * provider at now: its map still offers its acts, and no timeline is drawn
 * inside the studio.
 */
describe("showHistory() with the studio open", () => {
  it("opens the app's timeline outside the studio, and the studio still offers its acts", async () => {
    const element = await builder(() => ({ ok: true }));
    let heard: boolean | undefined;
    await act(async () => {
      heard = handles[0]!.showHistory();
    });
    expect(heard).toBe(true);
    await until(() => element.querySelector('[data-testid="timeline"]') !== null);
    const timeline = element.querySelector('[data-testid="timeline"]');
    expect(timeline, "the app's timeline").not.toBeNull();
    expect(timeline!.closest('[data-testid="studio"]'), "not the studio's").toBeNull();
    expect(element.querySelector('[data-testid="studio"] [data-testid="timeline"]')).toBeNull();
    // The studio's own map is at now, and an act on it is offered and taken.
    await edit(element);
  });
});
