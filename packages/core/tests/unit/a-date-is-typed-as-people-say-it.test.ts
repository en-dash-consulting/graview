import { describe, expect, it } from "vitest";
import { endAfterStartMoved, readWhenTyped, startAndEndOf, storedOfWall, wallOfStored, zoneSaid } from "@graview/core/words";
import { describeArg } from "@graview/core/words";
import { compileDocument } from "@graview/core/check";
import { formFields } from "@graview/core/forms";

// Friday, October 16, 2026, at 11:20 in the morning, on the reader's clock.
const today = "2026-10-16";
const read = (text: string, options: { time?: boolean; base?: { day: string; minutes?: number }; locale?: string } = {}) =>
  readWhenTyped(text, { today, time: options.time ?? true, ...(options.base ? { base: options.base } : {}), ...(options.locale ? { locale: options.locale } : {}) });

describe("a date is typed as people say it", () => {
  it("reads a day said in words, and a time of day beside it", () => {
    expect(read("tomorrow 3pm")).toEqual({ day: "2026-10-17", minutes: 15 * 60 });
    expect(read("Tomorrow at 3:30 PM")).toEqual({ day: "2026-10-17", minutes: 15 * 60 + 30 });
    expect(read("today noon")).toEqual({ day: "2026-10-16", minutes: 12 * 60 });
    expect(read("yesterday 9am")).toEqual({ day: "2026-10-15", minutes: 9 * 60 });
    expect(read("tonight")).toEqual({ day: "2026-10-16", minutes: 20 * 60 });
  });

  it("reads a weekday as the next one there is, today included, and 'next' as the one after today", () => {
    expect(read("Fri 10:30")).toEqual({ day: "2026-10-16", minutes: 10 * 60 + 30 });
    expect(read("next Fri 10:30")).toEqual({ day: "2026-10-23", minutes: 10 * 60 + 30 });
    expect(read("mon")).toEqual({ day: "2026-10-19", minutes: 9 * 60 });
    expect(read("Wednesday 2pm")).toEqual({ day: "2026-10-21", minutes: 14 * 60 });
  });

  it("reads a day of a month either way round, this year unless it is long past", () => {
    expect(read("17 Oct", { time: false })).toEqual({ day: "2026-10-17" });
    expect(read("Oct 17", { time: false })).toEqual({ day: "2026-10-17" });
    expect(read("October 17th, 2027", { time: false })).toEqual({ day: "2027-10-17" });
    expect(read("3 Feb", { time: false })).toEqual({ day: "2027-02-03" });
    expect(read("Sept 1", { time: false })).toEqual({ day: "2026-09-01" });
  });

  it("reads digits in the reader's order, and a day as a record keeps one", () => {
    expect(read("10/17", { time: false })).toEqual({ day: "2026-10-17" });
    expect(read("17/10/2026", { time: false, locale: "en-GB" })).toEqual({ day: "2026-10-17" });
    expect(read("2026-12-01 14:15")).toEqual({ day: "2026-12-01", minutes: 14 * 60 + 15 });
    expect(read("12/1/26", { time: false })).toEqual({ day: "2026-12-01" });
    expect(read("2026-09-20T09:00")).toEqual({ day: "2026-09-20", minutes: 9 * 60 });
  });

  it("reads a distance from today", () => {
    expect(read("in 3 days", { time: false })).toEqual({ day: "2026-10-19" });
    expect(read("in 2 weeks", { time: false })).toEqual({ day: "2026-10-30" });
    expect(read("next week", { time: false })).toEqual({ day: "2026-10-23" });
  });

  it("keeps the day it was on when only a time is typed, and the time when only a day is", () => {
    const base = { day: "2026-11-04", minutes: 13 * 60 };
    expect(read("4:45pm", { base })).toEqual({ day: "2026-11-04", minutes: 16 * 60 + 45 });
    expect(read("17:05", { base })).toEqual({ day: "2026-11-04", minutes: 17 * 60 + 5 });
    expect(read("Fri", { base })).toEqual({ day: "2026-10-16", minutes: 13 * 60 });
  });

  it("drops a time for a field that holds only a day", () => {
    expect(read("tomorrow 3pm", { time: false })).toEqual({ day: "2026-10-17" });
  });

  it("refuses what it cannot read, rather than guessing", () => {
    expect(read("sometime soon")).toBeUndefined();
    expect(read("31 Feb", { time: false })).toBeUndefined();
    expect(read("25pm")).toBeUndefined();
    expect(read("")).toBeUndefined();
  });
});

describe("a date and time is kept as an instant and read on the reader's clock", () => {
  it("is stored with its zone and read back as the same wall time", () => {
    const stored = storedOfWall({ day: "2026-10-17", minutes: 15 * 60 }, { time: true, instant: true });
    expect(stored).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
    expect(new Date(stored).getHours()).toBe(15);
    expect(wallOfStored(stored)).toEqual({ day: "2026-10-17", minutes: 15 * 60 });
  });

  it("keeps a wall time as written where the field takes no zone, and a day as a day", () => {
    expect(storedOfWall({ day: "2026-10-17", minutes: 9 * 60 + 5 }, { time: true, instant: false })).toBe("2026-10-17T09:05");
    expect(storedOfWall({ day: "2026-10-17", minutes: 9 * 60 }, { time: false, instant: false })).toBe("2026-10-17");
    expect(wallOfStored("2026-10-17T09:05")).toEqual({ day: "2026-10-17", minutes: 9 * 60 + 5 });
    expect(wallOfStored("2026-10-17")).toEqual({ day: "2026-10-17" });
    expect(wallOfStored("not a day")).toBeUndefined();
  });

  it("reads an instant as a record keeps one, pasted with its seconds and its zone, on the reader's clock (the twelfth walk)", () => {
    // A festival's screening kept as "…-05:00" was refused by its own editor: "Not a date this reads".
    const stored = storedOfWall({ day: "2026-10-20", minutes: 15 * 60 }, { time: true, instant: true });
    expect(read(stored)).toEqual({ day: "2026-10-20", minutes: 15 * 60 });
    expect(read(new Date(stored).toISOString())).toEqual({ day: "2026-10-20", minutes: 15 * 60 });
    expect(read("2026-10-20T15:00:00")).toEqual({ day: "2026-10-20", minutes: 15 * 60 });
    const offset = -new Date(stored).getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
    expect(read(`2026-10-20T15:00:00${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`)).toEqual({ day: "2026-10-20", minutes: 15 * 60 });
  });

  it("names the reader's zone", () => {
    const zone = zoneSaid();
    expect(zone.zone.length).toBeGreaterThan(0);
    expect(zone.short.length).toBeGreaterThan(0);
  });
});

describe("an end moves with its start", () => {
  it("keeps the length between them when the start moves", () => {
    expect(endAfterStartMoved("2026-10-17T15:00:00Z", "2026-10-18T16:00:00Z", "2026-10-17T16:30:00Z", { time: true, instant: true })).toBe("2026-10-18T17:30:00Z");
    expect(endAfterStartMoved("2026-10-17", "2026-10-20", "2026-10-19", { time: false, instant: false })).toBe("2026-10-22");
    expect(endAfterStartMoved("2026-10-17T09:00", "2026-10-17T10:00", "2026-10-17T11:00", { time: true, instant: false })).toBe("2026-10-17T12:00");
  });

  it("starts an end an hour after a start that had none, and leaves a day's end alone", () => {
    expect(endAfterStartMoved(undefined, "2026-10-17T15:00:00Z", undefined, { time: true, instant: true })).toBe("2026-10-17T16:00:00Z");
    expect(endAfterStartMoved(undefined, "2026-10-17", undefined, { time: false, instant: false })).toBeUndefined();
    // An end the person set before the start was given is theirs.
    expect(endAfterStartMoved(undefined, "2026-10-17T15:00:00Z", "2026-10-17T18:00:00Z", { time: true, instant: true })).toBe("2026-10-17T18:00:00Z");
  });

  it("finds a start and its end by their roles, else by their names", () => {
    expect(startAndEndOf(["name", "starts", "ends"])).toEqual({ start: "starts", end: "ends" });
    expect(startAndEndOf(["from", "until"])).toEqual({ start: "from", end: "until" });
    expect(startAndEndOf(["opens", "closes"], { start: "opens", end: "closes" })).toEqual({ start: "opens", end: "closes" });
    expect(startAndEndOf(["due"])).toBeUndefined();
  });
});

describe("a document's date and time is asked for as one", () => {
  it("is a date with a time, kept as an instant, in an act's form and in its edit", () => {
    const compiled = compileDocument({
      format: "graview-document",
      formatVersion: 1,
      name: "Meetings",
      kinds: { meeting: { fields: { name: { type: "string", required: true }, starts: { type: "datetime" }, on: { type: "date" } } } },
      acts: { "add-meeting": { title: "Add a meeting", creates: "meeting" } },
    });
    if (!compiled.ok) throw new Error("the document compiles");
    const add = compiled.app.mutations!.find((one) => one.name === "add-meeting")!;
    const shape = (add.input as unknown as { shape: Record<string, unknown> }).shape;
    expect(describeArg(shape["starts"])).toEqual({ type: "date", time: true, instant: true });
    expect(describeArg(shape["on"])).toEqual({ type: "date", partial: true });
    expect(formFields(add.input).find((field) => field.name === "starts")).toMatchObject({ control: "date", time: true, instant: true });
  });
});
