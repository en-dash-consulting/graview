import { describe, expect, it } from "vitest";
import { foldRobots, participantOf, standingFor, type RobotState } from "../../src/robot.js";

/**
 * WHERE THE ROBOT STANDS IS DERIVED. A read puts it at what it read, a
 * write at what it wrote, a refusal at the gate with the policy's words,
 * a question on the node's doorstep; rest sends it home; more than a
 * handful of targets and it stands at the neighbourhood instead. Only an
 * agent has a body. The fold is pure, so this is the whole contract.
 */
const seat = { kind: "agent", id: "tidy", session: "ui" } as const;
const person = { kind: "human", id: "nora" } as const;
const kindOf = (id: string) => (id.startsWith("t-") ? "task" : id.startsWith("l-") ? "list" : undefined);
const none = new Map<string, RobotState>();

describe("the robot's standing", () => {
  it("is keyed the way the log attributes: kind:id:session", () => {
    expect(participantOf(seat)).toBe("agent:tidy:ui");
    expect(participantOf({ kind: "rule" })).toBe("rule::");
  });

  it("stands at what it read, then at what it wrote, and keeps a trail", () => {
    const read = foldRobots(none, { type: "read", author: seat, ids: ["t-1", "t-2"], at: 1 }, kindOf);
    const robot = read.get("agent:tidy:ui")!;
    expect(robot).toMatchObject({ who: "tidy", at: "t-1", mode: "reading", trail: ["t-1"] });
    const wrote = foldRobots(read, { type: "write", author: seat, ids: ["t-2"], at: 2 }, kindOf);
    expect(wrote.get("agent:tidy:ui")).toMatchObject({ at: "t-2", mode: "writing", trail: ["t-1", "t-2"] });
  });

  it("has no body for a person, a rule or a system", () => {
    expect(foldRobots(none, { type: "write", author: person, ids: ["t-1"], at: 1 }, kindOf).size).toBe(0);
    expect(foldRobots(none, { type: "read", author: { kind: "rule" }, ids: ["t-1"], at: 1 }, kindOf).size).toBe(0);
  });

  it("stands at the neighbourhood rather than sprinting between many targets", () => {
    expect(standingFor(["t-1", "t-2", "t-3", "t-4"], kindOf)).toBe("t-1");
    expect(standingFor(["t-1", "t-2", "t-3", "t-4", "t-5"], kindOf)).toBe("kind:task");
    expect(standingFor(["t-1", "l-1", "t-2", "t-3", "t-4"], kindOf)).toBe("t-1");
    expect(standingFor([], kindOf)).toBeNull();
  });

  it("parks at the gate with the policy's own words when refused, and asks from the doorstep", () => {
    const refused = foldRobots(none, { type: "refused", author: seat, at: 1, where: "kind:list", say: "Not yours to do from this seat." }, kindOf);
    expect(refused.get("agent:tidy:ui")).toMatchObject({ mode: "refused", at: "kind:list", say: "Not yours to do from this seat." });
    const asking = foldRobots(refused, { type: "asking", author: seat, at: 2, where: "t-1", say: "Which surface?", confidence: 0.4 }, kindOf);
    expect(asking.get("agent:tidy:ui")).toMatchObject({ mode: "asking", at: "t-1", say: "Which surface?", confidence: 0.4 });
  });

  it("says what the seat says on its rung, wherever it stands", () => {
    const read = foldRobots(none, { type: "read", author: seat, ids: ["t-1"], at: 1 }, kindOf);
    const said = foldRobots(read, { type: "said", author: seat, at: 2, say: "(Jev decides rather than talks — the graph is answering here.)" }, kindOf);
    expect(said.get("agent:tidy:ui")).toMatchObject({ at: "t-1", mode: "reading", say: "(Jev decides rather than talks — the graph is answering here.)" });
  });

  it("follows until released, and following survives the reads and writes of a turn", () => {
    const follow = foldRobots(none, { type: "follow", author: seat, at: 1 }, kindOf);
    expect(follow.get("agent:tidy:ui")!.mode).toBe("following");
    const over = foldRobots(follow, { type: "over", author: seat, at: 2, over: "t-3" }, kindOf);
    expect(over.get("agent:tidy:ui")!.over).toBe("t-3");
    const wrote = foldRobots(over, { type: "write", author: seat, ids: ["t-3"], at: 3 }, kindOf);
    expect(wrote.get("agent:tidy:ui")).toMatchObject({ mode: "following", at: "t-3" });
    const released = foldRobots(wrote, { type: "release", author: seat, at: 4 }, kindOf);
    expect(released.get("agent:tidy:ui")).toMatchObject({ mode: "reading", over: null });
  });

  it("goes home when told, and docks by itself after the hold — unless it is following or asking", () => {
    const wrote = foldRobots(none, { type: "write", author: seat, ids: ["t-1"], at: 1 }, kindOf);
    expect(foldRobots(wrote, { type: "home", author: seat, at: 2 }, kindOf).get("agent:tidy:ui")).toMatchObject({ at: null, mode: "docked", trail: [] });
    expect(foldRobots(wrote, { type: "rest", at: 1000, holdMs: 2600 }, kindOf).get("agent:tidy:ui")!.mode).toBe("writing");
    expect(foldRobots(wrote, { type: "rest", at: 5000, holdMs: 2600 }, kindOf).get("agent:tidy:ui")).toMatchObject({ mode: "docked", at: null });
    const asking = foldRobots(none, { type: "asking", author: seat, at: 1, where: "t-1", say: "?" }, kindOf);
    expect(foldRobots(asking, { type: "rest", at: 9000, holdMs: 2600 }, kindOf).get("agent:tidy:ui")!.mode).toBe("asking");
  });
});
