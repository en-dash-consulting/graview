import { describe, expect, it } from "vitest";
import { type GraviewApp } from "@graview/core";
import { gauntletApp } from "../../../../apps/gauntlet/src/domain/app.js";
import { seedbedApp } from "../../../../apps/seedbed/src/domain/app.js";
import { isDraftFailure, recipeDraft, type DraftResult, type SeatDraft } from "../../src/draft.js";

/*
 * A KIND'S DERIVED PICTURE IS A DRAFT. A kind the app drew no picture of
 * opens to one the framework derives — a board, a calendar, a list — and
 * keeping it is the same `add-lens` edit a picture the seat was asked for
 * is: made by the seat's own templates, judged as a declared lens is.
 */

const seedbed = seedbedApp as unknown as GraviewApp;
const gauntlet = { name: "program", schema: gauntletApp.schema } as unknown as GraviewApp;

function drafted(result: DraftResult): SeatDraft {
  if (isDraftFailure(result)) throw new Error(result.failed);
  return result;
}

describe("a derived picture, as a draft", () => {
  it("is a board by the main choice, titled and judged as an asked-for one", () => {
    const board = drafted(recipeDraft({ lens: "columns", kind: "planting", column: "status" }, { app: seedbed }));
    expect(board.title).toBe("Plantings by status");
    expect(board.drawn.lens).toBe("columns");
    expect(board.edit).toMatchObject({ op: "add-lens", lens: "columns", on: "planting", bindings: { planting: { column: "status" } } });
  });

  it("is a list called for every record when nothing arranges it — never the kind's own address", () => {
    const list = drafted(recipeDraft({ lens: "blocks", kind: "room", as: "row" }, { app: gauntlet }));
    expect(list.title).toBe("Every room");
    expect(list.edit).toMatchObject({ op: "add-lens", lens: "blocks", on: "room" });
    const arranged = drafted(recipeDraft({ lens: "blocks", kind: "room", as: "row", sort: { by: "seats", direction: "desc" } }, { app: gauntlet }));
    expect(arranged.title).toBe("Rooms in order of seats");
  });

  it("refuses what the kind does not have, in a sentence", () => {
    const refused = recipeDraft({ lens: "columns", kind: "room", column: "nothing" }, { app: gauntlet });
    expect(isDraftFailure(refused) && refused.failed).toMatch(/^Couldn't draw that/);
  });
});
