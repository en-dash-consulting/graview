import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error — a plain module of the harness, with no types of its own.
import { at, moved, movedIn, OWN, portFor } from "../scripts/lib/ports.mjs";

/**
 * EVERY HARNESS HONORS GRAVIEW_PORT_BASE. A second checkout — a worktree
 * an agent works in — runs its dev servers on `GRAVIEW_PORT_BASE + (port −
 * 5190)`, so two checkouts can run harnesses at once. A harness that wrote
 * its port into a URL drove the first checkout's server from the second,
 * so no harness writes one: it names what it serves, and `scripts/lib/ports.mjs`
 * says where that is.
 */
const scripts = resolve(__dirname, "../scripts");
const PORTISH = /\b(51[7-9]\d|52\d\d|53\d\d)\b/;

describe("the harnesses", () => {
  it("write no port of their own: every one is named and asked of ports.mjs", () => {
    const files = [
      ...readdirSync(scripts).filter((file) => file.endsWith(".mjs")).map((file) => file),
      ...readdirSync(resolve(scripts, "lib")).filter((file) => file.endsWith(".mjs") && file !== "ports.mjs").map((file) => `lib/${file}`),
    ];
    const written = files.flatMap((file) =>
      readFileSync(resolve(scripts, file), "utf8")
        .split("\n")
        .flatMap((line, index) => (PORTISH.test(line) ? [`scripts/${file}:${index + 1}: ${line.trim().slice(0, 100)}`] : [])),
    );
    expect(written).toEqual([]);
  });
});

describe("a port, asked of ports.mjs", () => {
  const was = process.env["GRAVIEW_PORT_BASE"];
  afterEach(() => {
    if (was === undefined) delete process.env["GRAVIEW_PORT_BASE"];
    else process.env["GRAVIEW_PORT_BASE"] = was;
  });

  it("is the app's vite config's, or the harness's own, when no base is set", () => {
    delete process.env["GRAVIEW_PORT_BASE"];
    expect([portFor("todo"), portFor("seedbed"), portFor("rota"), portFor("launcher"), portFor("served")]).toEqual([5193, 5194, 5195, 5199, 5196]);
    expect(at("todo")).toBe("http://localhost:5193");
  });

  it("moves onto the base, keeping every one in a block of a hundred", () => {
    process.env["GRAVIEW_PORT_BASE"] = "5600";
    expect([portFor("todo"), portFor("seedbed"), portFor("rota"), portFor("launcher")]).toEqual([5603, 5604, 5605, 5609]);
    expect(at("todo")).toBe("http://localhost:5603");
    const all = [...Object.keys(OWN), "todo", "seedbed", "rota", "launcher", "gauntlet", "discography"].map((name) => portFor(name));
    expect(all.every((port: number) => port >= 5600 && port <= 5699)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
    expect(movedIn("?server=http://localhost:5196#overview=1")).toBe("?server=http://localhost:5606#overview=1");
  });

  it("refuses a port outside the block rather than moving it somewhere nobody said", () => {
    expect(() => moved(5399)).toThrow(/outside 5190–5289/);
  });
});
