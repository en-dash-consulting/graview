import { describe, expect, it } from "vitest";
import { seatTrust } from "../../src/cli.js";

/** FR-06: `graview serve` believes seat headers only where only this machine can reach it, or when told. */
describe("graview serve and the seat headers", () => {
  it("believes them on loopback, and says so", () => {
    for (const host of ["127.0.0.1", "::1", "localhost"]) {
      const trust = seatTrust(host, false);
      expect(trust).toMatchObject({ trust: true });
      expect("says" in trust && trust.says).toMatch(/only this machine/);
    }
  });

  it("bound to a non-loopback address, refuses to start unless --trust-seat-headers is given", () => {
    expect(seatTrust("0.0.0.0", false)).toMatchObject({ refuse: expect.stringMatching(/refusing to listen on 0\.0\.0\.0/) });
    expect(seatTrust("0.0.0.0", true)).toMatchObject({ trust: true });
  });
});
