import { describe, expect, it } from "vitest";
import { foldPresence, PRESENCE_TTL_MS, presenceName, samePresence, VISITOR_PRESENCE_TTL_MS, type Presence } from "../../src/index.js";

/**
 * PRESENCE SAYS WHO AND FOR WHOM (FR-47). An agent working for somebody
 * over MCP or RPC has no socket and no tab, and a presence said only where
 * a person stood and what to call them: "Claude" in the room, never whose
 * Claude. A presence now carries its kind, and for an agent the person it
 * acts for; a visitor a host announces stands until a time the host set,
 * not for three missed heartbeats it was never going to send.
 */
const at = "2026-10-03T12:00:00.000Z";
const claude: Presence = { participant: "agent:claude:visit", kind: "agent", name: "Claude", onBehalfOf: "person:ada", onBehalfOfName: "Ada", hue: 200, stop: "", at };

describe("a presence's name", () => {
  it("says an agent as the agent, for the person it acts for", () => {
    expect(presenceName(claude)).toBe("Claude, for Ada");
  });

  it("says the agent alone when who it acts for may not be said", () => {
    const { onBehalfOf: _id, onBehalfOfName: _name, ...alone } = claude;
    expect(presenceName(alone)).toBe("Claude");
    // An id with no name is not a name: it says nothing a person could read.
    expect(presenceName({ ...alone, onBehalfOf: "person:ada" })).toBe("Claude");
  });

  it("says a person as themselves, and nobody as nothing", () => {
    expect(presenceName({ participant: "human:ada:t1", kind: "human", name: "Ada", hue: 1, stop: "", at })).toBe("Ada");
    expect(presenceName({ participant: "human::t2", hue: 1, stop: "", at })).toBe("");
  });

  it("is a different figure when the person it acts for changes", () => {
    expect(samePresence(claude, { ...claude, onBehalfOf: "person:bo", onBehalfOfName: "Bo" })).toBe(false);
    expect(samePresence(claude, { ...claude })).toBe(true);
  });
});

describe("an announced visitor", () => {
  it("stands until the time it was announced for, past a heartbeat's grace", () => {
    const now = Date.parse(at);
    const until = new Date(now + VISITOR_PRESENCE_TTL_MS).toISOString();
    const visitor = { ...claude, until };
    const later = now + PRESENCE_TTL_MS * 2;
    expect([...foldPresence(new Map(), [visitor], later, PRESENCE_TTL_MS).keys()]).toEqual(["agent:claude:visit"]);
    const known = foldPresence(new Map(), [visitor], now, PRESENCE_TTL_MS);
    expect([...foldPresence(known, [], later, PRESENCE_TTL_MS).keys()]).toEqual(["agent:claude:visit"]);
    // And not a moment after.
    expect(foldPresence(known, [], now + VISITOR_PRESENCE_TTL_MS, PRESENCE_TTL_MS).size).toBe(0);
    expect(foldPresence(new Map(), [visitor], now + VISITOR_PRESENCE_TTL_MS + 1, PRESENCE_TTL_MS).size).toBe(0);
  });
});
