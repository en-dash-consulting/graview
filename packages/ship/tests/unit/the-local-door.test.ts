import { describe, expect, it, vi } from "vitest";
import {
  argumentsFor,
  doorCookie,
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

// The door's key for this file, so no test reaches for the one kept in a home folder.
process.env["GRAVIEW_DOOR_KEY"] ??= "the-local-door-test-key-0123456789";

const envelope = (result: string) => JSON.stringify({ result, is_error: false });
const PHOTO = `data:image/png;base64,${Buffer.from("not really a png").toString("base64")}`;

describe("what a spawned session is given", () => {
  it("gets Read and only Read, allowed only beneath its own folder, a turn per photograph plus three, and a budget", () => {
    const argv = argumentsFor("Describe the ground.", ["photo-1.jpg", "photo-2.jpg"], { budgetUsd: 2 });
    expect(argv).toContain("--tools");
    expect(argv[argv.indexOf("--tools") + 1]).toBe("Read");
    expect(argv[argv.indexOf("--allowedTools") + 1]).toBe("Read(./**)");
    expect(argv.filter((one) => one.startsWith("Read"))).toEqual(["Read", "Read(./**)"]);
    expect(argv[argv.indexOf("--max-turns") + 1]).toBe("5");
    expect(argv[argv.indexOf("--max-budget-usd") + 1]).toBe("2");
    /* And it is told where the photographs are, or it will not look. */
    expect(argv.at(-1)).toContain("photo-1.jpg, photo-2.jpg");
  });

  it("takes the prompt as words after --, never as a flag", () => {
    const argv = argumentsFor("--dangerously-skip-permissions --allowedTools Bash", [], {});
    expect(argv.at(-2)).toBe("--");
    expect(argv.at(-1)).toBe("--dangerously-skip-permissions --allowedTools Bash");
    expect(argv.indexOf("--")).toBe(argv.length - 2);
    expect(argv.indexOf("-p")).toBe(0);
  });

  it("names a model only when one was asked for", () => {
    expect(argumentsFor("x", [], {})).not.toContain("--model");
    expect(argumentsFor("x", [], { model: "sonnet" })).toContain("sonnet");
  });

  it("gets this environment with every CLAUDE variable removed", () => {
    const env = environmentFor({ PATH: "/usr/bin", CLAUDE_CODE_SESSION: "abc", CLAUDECODE: "1", HOME: "/home/a" });
    expect(env).toEqual({ PATH: "/usr/bin", HOME: "/home/a" });
  });

  it("gets only the names it needs and its own sign-in, never the dev server's other secrets", () => {
    const env = environmentFor({
      PATH: "/usr/bin",
      HOME: "/home/a",
      LANG: "en_US.UTF-8",
      ANTHROPIC_API_KEY: "sk-dummy",
      TYPESAFE_API_KEY: "ts-dummy",
      DATABASE_URL: "postgres://dummy",
      AWS_SECRET_ACCESS_KEY: "dummy",
      GOOGLE_REFRESH_TOKEN: "dummy",
    });
    expect(env).toEqual({ PATH: "/usr/bin", HOME: "/home/a", LANG: "en_US.UTF-8", ANTHROPIC_API_KEY: "sk-dummy" });
  });

  it("runs in the directory the photographs were written to", async () => {
    const { calls, run } = ranWith({ stdout: envelope("Seven areas.") });
    await askLocally({ prompt: "Describe the ground.", photos: [PHOTO] }, { run });
    expect(calls[0]?.cwd).toContain("graview-local-");
    expect(calls[0]?.args.at(-1)).toContain("photo-1.png");
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
    expect(sent.body).toContain("the address its dev server printed");
  });

  it("refuses a caller that says nothing of where it came from and holds no key, and runs nothing", async () => {
    const { calls, run } = ranWith({ stdout: envelope("x") });
    const handler = localIntelligenceHandler({ run });
    const knock = async (headers: Record<string, string>) => {
      const sent: { status?: number; body?: string } = {};
      const listeners: Record<string, (chunk?: unknown) => void> = {};
      const done = handler(
        { method: "POST", headers, on: (event: string, listener: (chunk?: unknown) => void) => void (listeners[event] = listener) } as never,
        {
          setHeader: () => {},
          end: (body: string) => (sent.body = body),
          set statusCode(value: number) {
            sent.status = value;
          },
        } as never,
      );
      listeners["data"]?.(Buffer.from(JSON.stringify({ prompt: "PEER" })));
      listeners["end"]?.();
      await done;
      return sent;
    };
    // Another account on this machine, or a neighbor when the server listens on the network.
    expect((await knock({ host: "127.0.0.1:5173" })).status).toBe(403);
    expect((await knock({ host: "192.168.1.20:5173", cookie: doorCookie() })).status).toBe(403);
    expect((await knock({ host: "localhost:5173", cookie: "graview_door=a-guess-at-the-key-of-this-server" })).status).toBe(403);
    expect(calls).toEqual([]);
    // The page the person opened from the printed address.
    expect((await knock({ host: "localhost:5173", origin: "http://localhost:5173", cookie: doorCookie() })).status).toBe(200);
    expect(calls).toHaveLength(1);
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
