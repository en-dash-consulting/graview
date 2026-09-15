import { describe, expect, it, vi } from "vitest";
import {
  argumentsFor,
  askLocally,
  decodePhoto,
  environmentFor,
  localIntelligence,
  localIntelligenceHandler,
  parseEnvelope,
  sameOrigin,
  type Runner,
} from "../../src/dev.js";

/**
 * THE FOURTH DOOR, driven with an injected runner and never a real session.
 *
 * Three of the assertions below are hung processes somebody already paid
 * for: stdin closed, the parent session's environment stripped, and Read as
 * the only tool with a turn cap and a budget beside it.
 */
const ranWith = (spawned: Partial<{ code: number; stdout: string; stderr: string }> = {}) => {
  const calls: { command: string; args: readonly string[]; env: NodeJS.ProcessEnv; cwd: string }[] = [];
  const run: Runner = async (command, args, options) => {
    calls.push({ command, args, env: options.env, cwd: options.cwd });
    return { code: spawned.code ?? 0, stdout: spawned.stdout ?? "", stderr: spawned.stderr ?? "" };
  };
  return { calls, run };
};

const envelope = (result: string) => JSON.stringify({ result, is_error: false });
const PHOTO = `data:image/png;base64,${Buffer.from("not really a png").toString("base64")}`;

describe("what a spawned session is given", () => {
  it("gets Read and only Read, a turn per photograph plus three, and a budget", () => {
    const argv = argumentsFor("Describe the ground.", ["photo-1.jpg", "photo-2.jpg"], { budgetUsd: 2 });
    expect(argv).toContain("--tools");
    expect(argv[argv.indexOf("--tools") + 1]).toBe("Read");
    expect(argv[argv.indexOf("--allowedTools") + 1]).toBe("Read");
    expect(argv[argv.indexOf("--max-turns") + 1]).toBe("5");
    expect(argv[argv.indexOf("--max-budget-usd") + 1]).toBe("2");
    /* And it is told where the photographs are, or it will not look. */
    expect(argv[argv.indexOf("-p") + 1]).toContain("photo-1.jpg, photo-2.jpg");
  });

  it("names a model only when one was asked for", () => {
    expect(argumentsFor("x", [], {})).not.toContain("--model");
    expect(argumentsFor("x", [], { model: "sonnet" })).toContain("sonnet");
  });

  it("gets this environment with every CLAUDE variable removed", () => {
    const env = environmentFor({ PATH: "/usr/bin", CLAUDE_CODE_SESSION: "abc", CLAUDECODE: "1", HOME: "/home/a" });
    expect(env).toEqual({ PATH: "/usr/bin", HOME: "/home/a" });
  });

  it("runs in the directory the photographs were written to", async () => {
    const { calls, run } = ranWith({ stdout: envelope("Seven areas.") });
    await askLocally({ prompt: "Describe the ground.", photos: [PHOTO] }, { run });
    expect(calls[0]?.cwd).toContain("graview-local-");
    expect(calls[0]?.args[1]).toContain("photo-1.png");
  });
});

describe("a photograph", () => {
  it("is a data URL of an image, or it is refused with a sentence", () => {
    expect(decodePhoto(PHOTO).extension).toBe("png");
    expect(decodePhoto(`data:image/jpeg;base64,${Buffer.from("x").toString("base64")}`).extension).toBe("jpg");
    expect(() => decodePhoto("https://example.com/a.png")).toThrow(/base64 data URL/);
  });
});

describe("what comes back", () => {
  it("is the text of the envelope", async () => {
    const { run } = ranWith({ stdout: envelope("Seven areas, no outlines.") });
    expect(await askLocally({ prompt: "Describe the ground." }, { run })).toBe("Seven areas, no outlines.");
  });

  it("says plainly when the envelope is not one", () => {
    expect(() => parseEnvelope("<!doctype html>")).toThrow(/other than its JSON envelope/);
  });

  it("says what ran out when the turns did", () => {
    expect(() => parseEnvelope(JSON.stringify({ subtype: "error_max_turns" }))).toThrow(/ran out of turns/);
  });

  it("carries a non-zero exit with whatever was on stderr", async () => {
    const { run } = ranWith({ code: 1, stdout: "", stderr: "not logged in" });
    await expect(askLocally({ prompt: "x" }, { run })).rejects.toThrow(/not logged in/);
  });
});

describe("who may knock", () => {
  it("answers this app and nothing else", () => {
    expect(sameOrigin({ origin: "http://localhost:5173", host: "localhost:5173" })).toBe(true);
    expect(sameOrigin({ host: "localhost:5173" })).toBe(true);
    expect(sameOrigin({ origin: "https://example.com", host: "localhost:5173" })).toBe(false);
    expect(sameOrigin({ origin: "nonsense", host: "localhost:5173" })).toBe(false);
  });

  it("refuses a cross-origin caller with 403 rather than spending the machine", async () => {
    const handler = localIntelligenceHandler({ run: ranWith().run });
    const sent: { status?: number; body?: string } = {};
    await handler(
      { method: "POST", headers: { origin: "https://example.com", host: "localhost:5173" }, on: () => {} } as never,
      {
        setHeader: () => {},
        end: (body: string) => (sent.body = body),
        set statusCode(value: number) {
          sent.status = value;
        },
      } as never,
    );
    expect(sent.status).toBe(403);
    expect(sent.body).toContain("this app only");
  });
});

describe("the plugin", () => {
  it("is a dev-server plugin, so a build carries no door at all", () => {
    const plugin = localIntelligence();
    expect(plugin.apply).toBe("serve");
    const use = vi.fn();
    plugin.configureServer({ middlewares: { use } } as never);
    expect(use).toHaveBeenCalledWith("/__graview/local", expect.any(Function));
  });

  it("answers wherever the app declared its bridge", () => {
    const use = vi.fn();
    localIntelligence({ path: "/__grounds/claude" }).configureServer({ middlewares: { use } } as never);
    expect(use).toHaveBeenCalledWith("/__grounds/claude", expect.any(Function));
  });
});
