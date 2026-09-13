import { figureFaults } from "@graview/core";
import { describe, expect, it } from "vitest";
import { drawFigure, FIGURE_STYLE, nearestFigure, onlyTheSvg } from "../../src/index.js";

/**
 * AN AGENT DRAWS A KIND'S FIGURE — in the house style, or not at all.
 *
 * Twelve figures drawn without a shared discipline read as twelve clip-art
 * imports rather than as one city, which is the entire reason a figure is
 * worth having. So the answer is JUDGED before it is offered, by the same
 * function `graview check` runs: a drawing that would fail the build never
 * reaches a person as a proposal.
 */

const GOOD =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">' +
  '<path d="M4 18 12 6l8 12z"/></svg>';

describe("the style guide", () => {
  it("asks for the isometric line art the city is drawn in, and nothing else", () => {
    for (const said of ["currentColor", "viewBox", 'fill="none"', "three-quarter", "twenty pixels"]) {
      expect(FIGURE_STYLE).toContain(said);
    }
    // A drawing of the THING, said in as many words, because this is the
    // rule a model breaks first.
    expect(FIGURE_STYLE).toMatch(/not an emblem|drawing of the THING/i);
  });
});

describe("what comes back", () => {
  it("takes the drawing out of whatever it was wrapped in", () => {
    expect(onlyTheSvg(`Here you go!\n\`\`\`svg\n${GOOD}\n\`\`\`\nHope that helps.`)).toBe(GOOD);
    expect(onlyTheSvg("I am afraid I cannot draw.")).toBeUndefined();
  });

  it("keeps a drawing that holds the style", async () => {
    const drawn = await drawFigure("temple", "a building people gather in", async () => GOOD);
    expect(drawn).toMatchObject({ kind: "temple", figure: GOOD, from: "model" });
    expect(figureFaults(drawn.figure)).toEqual([]);
  });

  it("refuses one that does not, and says what was wrong with it", async () => {
    const drawn = await drawFigure("temple", undefined, async () =>
      '<svg viewBox="0 0 24 24"><path stroke="#c0ffee" d="M0 0"/></svg>',
    );
    expect(drawn.from).toBe("shipped");
    expect(drawn.refused?.join(" ")).toContain("#c0ffee");
    // And what it fell back to is itself drawable, or the refusal would
    // have traded one broken figure for another.
    expect(figureFaults(drawn.figure)).toEqual([]);
  });

  it("survives a model that throws, rather than taking the interface with it", async () => {
    const drawn = await drawFigure("temple", undefined, async () => {
      throw new Error("no key");
    });
    expect(drawn.from).toBe("shipped");
    expect(drawn.refused).toEqual(["no key"]);
  });
});

describe("the nearest shipped figure", () => {
  it("matches by NAME and never by guesswork", () => {
    expect(nearestFigure("person")).toBe("person");
    expect(nearestFigure("Volunteer")).toBe("note");
    expect(nearestFigure("shift")).toBe("shift");
    expect(nearestFigure("task-list")).toBe("task");
    /*
     * A cleat is not a box. Guessing that both are objects would be the
     * framework having an opinion about a domain it has never met — so the
     * answer is the note, which is honest about being a placeholder.
     */
    expect(nearestFigure("cleat")).toBe("note");
  });
});
