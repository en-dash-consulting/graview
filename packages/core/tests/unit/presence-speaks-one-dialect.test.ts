import { describe, expect, it } from "vitest";
import { createSchema, defineNode, Graph, nameOfAuthor, parseParticipant, participantKey, REMOTE_PRESENCE_TTL_MS, PRESENCE_TTL_MS, z } from "../../src/index.js";

/**
 * PRESENCE SPEAKS ONE DIALECT (FR-13). A participant is `kind:id:session`
 * in the op log, in a figure and on the wire; a host that builds presence
 * itself (a chat widget, a hosted room) had nothing that named the format,
 * so it wrote its own and hoped. And a host names people the app has no
 * record of — every member of a hosted app — through a directory, not by
 * offering each as a seat.
 */
describe("a participant key", () => {
  it("is kind:id:session, and reads back even when the id holds a colon", () => {
    expect(participantKey({ kind: "human", id: "nick", session: "a1b2" })).toBe("human:nick:a1b2");
    expect(participantKey({ kind: "agent", id: "mcp:claude", session: "s" })).toBe("agent:mcp:claude:s");
    expect(participantKey({ kind: "human" })).toBe("human::");
    expect(parseParticipant("agent:mcp:claude:s")).toEqual({ kind: "agent", id: "mcp:claude", session: "s" });
    expect(parseParticipant("human::")).toEqual({ kind: "human", session: "" });
    expect(parseParticipant("nonsense")).toBeNull();
    expect(parseParticipant("robot:x:y")).toBeNull();
  });

  it("gives remote presence a longer TTL than a tab's own channel", () => {
    expect(REMOTE_PRESENCE_TTL_MS).toBeGreaterThan(PRESENCE_TTL_MS);
  });
});

describe("a people directory", () => {
  const schema = createSchema([defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" })]);
  const graph = new Graph(schema as never);

  it("names an author nothing else here knows", () => {
    const people = [{ id: "acct_7f3", name: "Nick Daniel" }];
    expect(nameOfAuthor({ kind: "human", id: "acct_7f3" }, { graph: graph as never, schema })).toBe("somebody");
    expect(nameOfAuthor({ kind: "human", id: "acct_7f3" }, { graph: graph as never, schema, people })).toBe("Nick Daniel");
  });

  it("names a person only of the kind it was told, when it was told one", () => {
    const people = [{ id: "claude", name: "Claude", kind: "agent" as const }];
    expect(nameOfAuthor({ kind: "agent", id: "claude" }, { graph: graph as never, schema, people })).toBe("Claude");
    expect(nameOfAuthor({ kind: "human", id: "claude" }, { graph: graph as never, schema, people })).toBe("claude");
  });
});
