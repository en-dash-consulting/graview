import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error — a plain module of the harness, with no types of its own.
import { DESK_SERVES, portFor, portsFor } from "../scripts/lib/ports.mjs";

/**
 * THE DESK POINTS AT THE PORTS THE DEMOS RUN ON. A checkout on a moved port
 * base (`GRAVIEW_PORT_BASE`) serves todo on 5603, not 5193, and a desk that
 * still linked and probed 5193 sent a person to another checkout's app and
 * called it live. A page cannot read the environment, so the launcher's vite
 * config hands it the moved ports at build and dev time (`__GRAVIEW_PORTS__`,
 * computed by `scripts/lib/ports.mjs`), and the survey reads them; where
 * nothing was handed (Node, `graview check`), the ports are the configs'.
 */
const globals = globalThis as { __GRAVIEW_PORTS__?: Record<string, number> };
const was = process.env["GRAVIEW_PORT_BASE"];
afterEach(() => {
  delete globals.__GRAVIEW_PORTS__;
  if (was === undefined) delete process.env["GRAVIEW_PORT_BASE"];
  else process.env["GRAVIEW_PORT_BASE"] = was;
  vi.resetModules();
});

const survey = async () => {
  vi.resetModules();
  return import("../apps/launcher/src/domain/survey.js");
};

describe("the ports the launcher's vite config hands the page", () => {
  it("are every port the desk names, moved onto the base when it is set", () => {
    delete process.env["GRAVIEW_PORT_BASE"];
    expect(portsFor(DESK_SERVES)).toEqual({ todo: 5193, seedbed: 5194, rota: 5195, served: 5196 });
    process.env["GRAVIEW_PORT_BASE"] = "5600";
    expect(portsFor(DESK_SERVES)).toEqual({ todo: 5603, seedbed: 5604, rota: 5605, served: 5606 });
    // The apps' own vite configs move with it: what they claim is read through `moved`.
    expect([portFor("launcher"), portFor("gauntlet"), portFor("discography"), portFor("discography-preview")]).toEqual([5609, 5601, 5607, 5608]);
  });
});

describe("the survey", () => {
  it("names the configs' ports when nothing was handed to it", async () => {
    const { APPS, CAPABILITIES, addressOf, surveySnapshot } = await survey();
    expect(Object.fromEntries(APPS.map((entry) => [entry.id, entry.port]))).toEqual({ todo: 5193, rota: 5195, seedbed: 5194 });
    expect(addressOf(APPS[0]!)).toBe("http://localhost:5193");
    expect(CAPABILITIES.find((one) => one.id === "cap-server-persistence")?.stop).toBe("?server=http://localhost:5196#overview=1");
    expect(surveySnapshot().nodes.find((node) => node["id"] === "todo")?.["port"]).toBe(5193);
  });

  it("names the moved ports in every address and every probe when the build handed them", async () => {
    process.env["GRAVIEW_PORT_BASE"] = "5600";
    globals.__GRAVIEW_PORTS__ = portsFor(DESK_SERVES);
    const { APPS, CAPABILITIES, addressOf, surveySnapshot } = await survey();
    expect(Object.fromEntries(APPS.map((entry) => [entry.id, entry.port]))).toEqual({ todo: 5603, rota: 5605, seedbed: 5604 });
    // What liveness probes and what the views link to.
    expect(APPS.map((entry) => addressOf(entry))).toEqual(["http://localhost:5603", "http://localhost:5605", "http://localhost:5604"]);
    expect(CAPABILITIES.find((one) => one.id === "cap-server-persistence")?.stop).toBe("?server=http://localhost:5606#overview=1");
    const snapshot = surveySnapshot();
    expect(snapshot.nodes.filter((node) => node["kind"] === "app").map((node) => node["port"])).toEqual([5603, 5605, 5604]);
    expect(JSON.stringify(snapshot)).not.toMatch(/localhost:51\d\d/);
  });
});
