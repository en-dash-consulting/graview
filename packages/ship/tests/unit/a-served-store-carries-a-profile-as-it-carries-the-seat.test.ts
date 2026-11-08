import { describe, expect, it } from "vitest";
import { meOf, profilePersonId, type Principal } from "@graview/core";
import { SEAT_HEADERS, seatFromHeaders } from "../../src/handler.js";
import { seatHeaders } from "../../src/remote.js";

/**
 * A SERVED STORE CARRIES A PROFILE THE WAY IT CARRIES THE SEAT (Roadmap
 * f-viewer-state-and-me-framework): in headers only a host that trusts them
 * reads, and otherwise in its own `seatOf`. Either way a profile is only ever
 * its account's own: a client that names one cannot reach another's.
 */
const request = (headers: Record<string, string>) => new Request("http://x/graview/ops", { headers });
const mia: Principal = { kind: "human", id: "user:nick", roles: ["family"], name: "Nick", profile: { id: "prf_mia", name: "Mía Ñ" } };

describe("the seat's headers", () => {
  it("say a profile and read back as it was, its name written as a person wrote it", () => {
    const seat = seatFromHeaders(request(seatHeaders(mia)));
    expect(seat).toEqual(mia);
  });

  it("say the profile of the person an agent acts for", () => {
    const agent: Principal = { kind: "agent", id: "claude", onBehalfOf: mia };
    const seat = seatFromHeaders(request(seatHeaders(agent)));
    expect(seat.onBehalfOf?.profile).toEqual(mia.profile);
    expect(meOf(seat)).toBe(profilePersonId("user:nick", { id: "prf_mia" }));
  });

  it("say nothing of a profile on a seat with none, as they always did", () => {
    const { profile: _, ...nick } = mia;
    const sent = seatHeaders(nick);
    expect(Object.keys(sent)).not.toContain(SEAT_HEADERS.profile);
    expect(seatFromHeaders(request(sent))).toEqual(nick);
  });
});

describe("a client naming a profile", () => {
  it("reaches only its own account's person, whichever profile it names", () => {
    const seat = seatFromHeaders(request({ [SEAT_HEADERS.seat]: "user:ann", [SEAT_HEADERS.profile]: "prf_mia", [SEAT_HEADERS.profileName]: "Mia" }));
    expect(meOf(seat)).toBe(profilePersonId("user:ann", { id: "prf_mia" }));
    expect(meOf(seat)).not.toBe(meOf(mia));
  });

  it("cannot name a member's record, or another account's profile's, as its profile", () => {
    for (const id of ["user:nick", "user:nick~prf_mia", "../user:nick", "a b"]) {
      const seat = seatFromHeaders(request({ [SEAT_HEADERS.seat]: "user:ann", [SEAT_HEADERS.profile]: id, [SEAT_HEADERS.profileName]: "x" }));
      expect(meOf(seat)).toBe("user:ann");
    }
  });
});
