import { describe, expect, it } from "vitest";
import {
  agreedLessons,
  changedTelling,
  memoryTold,
  similarTellings,
  tellingChange,
  tellingExamples,
  tellingOf,
  toldFor,
  toldMatching,
  toldSeenBy,
  toldTeachingWords,
  type Telling,
  type TellingDraft,
} from "../../src/told.js";
import type { Author } from "../../src/ops/types.js";

const ada = { kind: "human", id: "ada" } as const;
const sam = { kind: "human", id: "sam" } as const;
const lee = { kind: "human", id: "lee" } as const;

const finish = (by: Author, words = "finish all these", extra: Partial<TellingDraft> = {}): Telling =>
  tellingOf(
    {
      words,
      target: { on: "record", kind: "column", id: "col-week" },
      reading: { which: "held", kind: "task", records: ["t1", "t2", "t3"] },
      decided: { type: "act", act: "finish", records: 3 },
      slot: "graph",
      outcome: "accepted",
      ...extra,
    },
    by,
  )!;

describe("a telling is kept with what it did and how it ended", () => {
  it("keeps the words, the target by kind and id, the reading, the people, the decision, the slot, the stages and the outcome", () => {
    const telling = tellingOf(
      {
        words: "  assign these​ to Sam  ",
        target: { on: "record", kind: "column", id: "col-week" },
        reading: { which: "held", kind: "task", records: ["t1", "t2"] },
        people: ["user-sam"],
        decided: { type: "act", act: "assign", records: 2 },
        slot: "graph",
        stages: [{ stage: "fast", ms: 212.4, model: "jev" }],
        ms: 230,
        outcome: "previewed",
      },
      { ...ada, session: "s1" } as never,
      { at: "2026-10-30T10:00:00.000Z", id: "tl-1" },
    );
    expect(telling).toEqual({
      id: "tl-1",
      at: "2026-10-30T10:00:00.000Z",
      by: { kind: "human", id: "ada" },
      words: "assign these to Sam",
      target: { on: "record", kind: "column", id: "col-week" },
      reading: { which: "held", kind: "task", records: ["t1", "t2"] },
      people: ["user-sam"],
      decided: { type: "act", act: "assign", records: 2 },
      slot: "graph",
      stages: [{ stage: "fast", ms: 212, model: "jev" }],
      ms: 230,
      outcome: "previewed",
      conversation: "tl-1",
    });
  });

  it("links a follow-up to the conversation it began", () => {
    const first = finish(ada);
    const reply = tellingOf({ words: "only the open ones", target: first.target, decided: { type: "act", act: "finish", records: 2 }, outcome: "previewed", conversation: first.conversation, follows: first.id }, ada)!;
    expect(reply.conversation).toBe(first.id);
    expect(reply.follows).toBe(first.id);
  });

  it("never keeps a visitor's, nor a draft with no words or no decision", () => {
    expect(tellingOf({ words: "hello", target: { on: "place", place: "home" }, decided: { type: "answer" }, outcome: "previewed" }, { kind: "visitor", id: "v" })).toBeUndefined();
    expect(tellingOf({ words: "  ", target: { on: "place", place: "home" }, decided: { type: "answer" }, outcome: "previewed" }, ada)).toBeUndefined();
    expect(tellingOf({ words: "hi", target: { on: "place", place: "home" }, decided: { type: "guess" } as never, outcome: "previewed" }, ada)).toBeUndefined();
  });

  it("keeps a 👎's 'what should it have done' and drops it when the rating changes", () => {
    const telling = finish(ada);
    const down = changedTelling(telling, tellingChange({ rating: "down", should: "Only the open ones" })!);
    expect(down.rating).toBe("down");
    expect(down.should).toBe("Only the open ones");
    const up = changedTelling(down, { rating: "up" });
    expect(up.rating).toBe("up");
    expect(up.should).toBeUndefined();
    expect(changedTelling(up, { rating: null }).rating).toBeUndefined();
  });

  it("ends an accepted telling only as undone: a card closed after Yes did not abandon it", () => {
    const accepted = finish(ada);
    expect(changedTelling(accepted, { outcome: "abandoned" }).outcome).toBe("accepted");
    expect(changedTelling(accepted, { outcome: "undone" }).outcome).toBe("undone");
    const previewed = finish(ada, "finish all these", { outcome: "previewed" });
    expect(changedTelling(previewed, { outcome: "abandoned" }).outcome).toBe("abandoned");
    expect(changedTelling(changedTelling(previewed, { outcome: "declined" }), { outcome: "abandoned" }).outcome).toBe("declined");
  });

  it("is added, changed and removed in a held store", () => {
    const store = memoryTold();
    const telling = finish(ada);
    store.add(telling);
    store.change(telling.id, { excluded: true });
    expect(store.list()[0]!.excluded).toBe(true);
    store.remove(telling.id);
    expect(store.list()).toEqual([]);
  });
});

describe("a viewer never sees a telling about a record they cannot see", () => {
  it("hides a telling whose target, reading or people name a record hidden from the viewer", () => {
    const shown = finish(ada);
    const hidden = finish(ada, "finish these", { reading: { which: "held", kind: "task", records: ["t1", "secret"] } });
    const named = finish(ada, "assign to her", { people: ["secret-person"] });
    const sees = (id: string) => !id.startsWith("secret");
    expect(toldSeenBy([shown, hidden, named], sees).map((one) => one.id)).toEqual([shown.id]);
  });
});

describe("another person's telling is not suggested until enough agree", () => {
  it("suggests the reader's own at once, and somebody else's only once two other people's agree", () => {
    const mine = finish(ada, "finish all of these");
    const samOnly = [finish(sam, "finish everything here")];
    expect(similarTellings([...samOnly], { words: "finish these", kind: "task" }, { reader: lee })).toEqual([]);
    expect(similarTellings([mine], { words: "finish these", kind: "task" }, { reader: ada }).map((one) => one.telling.id)).toEqual([mine.id]);
    const two = [...samOnly, finish(ada, "finish all of them")];
    expect(agreedLessons(two, { reader: lee }).size).toBe(1);
    expect(similarTellings(two, { words: "finish these", kind: "task" }, { reader: lee })).toHaveLength(1);
    // The reader's own never counts toward agreement with one other person.
    expect(agreedLessons([finish(sam), finish(lee)], { reader: lee }).size).toBe(0);
  });

  it("serves a reader their own and the others' only in agreed lessons; an owner all", () => {
    const tellings = [finish(sam, "finish these"), finish(ada, "something odd", { decided: { type: "act", act: "archive", records: 1 } })];
    expect(toldFor(tellings, lee).length).toBe(0);
    expect(toldFor(tellings, ada).map((one) => one.by.id)).toEqual(["ada"]);
    expect(toldFor(tellings, lee, { curator: true })).toHaveLength(2);
  });
});

describe("a similar telling that worked is suggested", () => {
  it("ranks by the words, the kind and the act, never offers a 👎, an excluded or an undone one, and gives each lesson once", () => {
    const worked = finish(ada, "finish all these tasks");
    const again = finish(ada, "finish the tasks here");
    const down = finish(ada, "finish them all", { rating: "down", decided: { type: "act", act: "archive", records: 3 } });
    const excluded = { ...finish(ada, "finish everything", { decided: { type: "act", act: "remove", records: 3 } }), excluded: true };
    const undone = finish(ada, "finish them", { outcome: "undone", decided: { type: "act", act: "move", records: 3 } });
    const found = similarTellings([worked, again, down, excluded, undone], { words: "finish these", kind: "task" }, { reader: ada });
    expect(found).toHaveLength(1);
    expect([worked.id, again.id]).toContain(found[0]!.telling.id);
    expect(similarTellings([worked], { words: "rename the board", kind: "task" }, { reader: ada })).toEqual([]);
  });

  it("gives the slots examples by name, never an id", () => {
    const examples = tellingExamples(similarTellings([finish(ada, "finish all these", { rating: "up" })], { words: "finish these" }, { reader: ada, rated: true }));
    expect(examples).toEqual([{ said: "finish all these", did: "act finish over each record it holds", reading: "held" }]);
  });
});

describe("the Studio says what is teaching the system", () => {
  it("counts the tellings that worked, and filters by rating, outcome and kind", () => {
    const tellings = [finish(ada), finish(sam, "finish these", { rating: "up" }), finish(lee, "finish", { outcome: "declined" }), finish(lee, "x", { outcome: "previewed", rating: "down" })];
    expect(toldTeachingWords(tellings)).toBe("Suggestions come from 2 rated tellings in this app.");
    expect(toldMatching(tellings, { rating: "down" })).toHaveLength(1);
    expect(toldMatching(tellings, { rating: "none" })).toHaveLength(2);
    expect(toldMatching(tellings, { outcome: "declined" })).toHaveLength(1);
    expect(toldMatching(tellings, { kind: "task" })).toHaveLength(4);
  });
});
