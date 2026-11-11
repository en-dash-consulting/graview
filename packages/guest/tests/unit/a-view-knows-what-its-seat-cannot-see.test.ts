import { describe, expect, it } from "vitest";
import { createGuestHost } from "../../src/host/frame.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import type { GuestProps } from "../../src/protocol.js";
import { club, member, parent, visitor } from "./club.js";
import { inbox } from "./showroom.js";

/*
 * A VIEW KNOWS WHAT ITS SEAT CANNOT SEE (Roadmap
 * f-view-knows-what-its-seat-cannot-see). A home view that draws the
 * vendors, the players, the memos and the shifts drew well for its owner
 * and was an empty section for a visitor, with nothing to tell it why. It
 * is now handed what its seat is kept from — the kinds, the fields, and a
 * count of records its sight shows it and it is handed none of — and only
 * what the seat may know of: never a count of what a sight keeps from it,
 * never a value.
 */
const home: WorkerViewManifest = { name: "club-home", attach: "home", cardinality: "many", reads: { kinds: ["vendor", "player", "memo", "shift"] } };
const props = (principal: typeof member) => workerViewProps(club(), principal, { manifest: home });

describe("what a view is told its seat is kept from", () => {
  it("tells a visitor which kinds it sees none of, and counts none of them", () => {
    const unseen = props(visitor).unseen!;
    expect(unseen.kinds).toEqual(["vendor", "memo", "shift"]);
    expect(unseen.fields).toEqual({ player: ["phone"] });
    // A kind kept from the seat has no count at all, not even 0.
    expect(unseen.withheld).toEqual({ player: 0 });
  });

  it("tells a parent the fields its sight hides, and counts the memo its sight shows it and it is handed none of", () => {
    const shown = props(parent);
    expect(shown.unseen).toEqual({ kinds: ["vendor"], fields: { player: ["phone"], memo: ["code"] }, withheld: { player: 0, memo: 1 } });
    // Two shifts are somebody else's: an `own` sight keeps them, so the shifts have no count at all.
    expect(shown.nodes!.map((node) => node.id)).toEqual(["player:ada"]);
  });

  it("never carries a hidden value, nor the label of a record withheld", () => {
    for (const seat of [parent, visitor]) {
      const wire = JSON.stringify(props(seat));
      for (const word of ["555 0101", "7731", "Gate", "Hart's Bakery", "Saturday bar"]) expect(wire, word).not.toContain(word);
    }
  });

  it("is not handed to a seat nothing of what it reads is kept from", () => {
    expect(props(member).unseen).toBeUndefined();
  });

  it("is handed to a frame guest through its bridge, over the kinds it reads", () => {
    const { said, send } = inbox();
    createGuestHost({ store: club(), principal: visitor, view: "frame", nonce: "n", send, reads: { kinds: ["vendor", "player"] } }).push();
    expect((said[0] as { props: GuestProps }).props.unseen).toEqual({ kinds: ["vendor"], fields: { player: ["phone"] }, withheld: { player: 0 } });
  });
});
