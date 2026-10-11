import { createSchema, defineNode, isoDate, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { placeOnCalendar, placeOnTimeline, type CalendarBindings, type TimelineBindings } from "../../src/index.js";

/**
 * A TIMELINE OR A CALENDAR STANDS ON A KIND'S NATURAL TIME. n-dx's Runs
 * timeline bound `start: "startedAt"` in the lens because nothing else could
 * say it. A kind says it once — `fieldRoles: { when: "startedAt" }` — and a
 * lens that binds no start draws each record there; one that binds a start
 * of its own keeps it.
 */
const run = defineNode("run", {
  fields: z.object({ title: z.string(), startedAt: isoDate, finishedAt: isoDate.optional(), from: z.number(), until: z.number(), lane: z.enum(["a", "b"]) }),
  fieldRoles: { when: "startedAt" },
});
const schema = createSchema([run]);
const node = { id: "r1", kind: "run", title: "First run", startedAt: "2026-10-09", finishedAt: "2026-10-10", from: 540, until: 600, lane: "a" } as never;

describe("a lens over a kind that says when a record is", () => {
  it("places each record on a calendar at its natural time when the lens binds no start", () => {
    expect(placeOnCalendar(node, { run: { end: "finishedAt" } } as unknown as CalendarBindings, schema)).toMatchObject({ id: "r1", from: "2026-10-09", to: "2026-10-10" });
  });

  it("keeps a start the lens binds itself", () => {
    const placed = placeOnTimeline(node, { run: { start: "from", end: "until", column: "lane" } } as TimelineBindings, schema);
    expect(placed).toMatchObject({ start: 540, end: 600 });
  });
});
