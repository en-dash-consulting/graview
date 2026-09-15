// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalIntelligence } from "../../src/local-intelligence.js";

/**
 * A DOOR THAT IS NOT THERE IS CLOSED, NOT BROKEN.
 *
 * The local door is served by a dev-server plugin, so on every deployed copy
 * of the app there is nothing behind the path — which is the normal state,
 * not a fault. Three shapes of nothing have to read the same way: a 404 from
 * a static host, an HTML index page from a dev server's history fallback
 * (where JSON.parse would throw), and a network failure with nobody
 * listening. An interface that says "failed" for any of them is telling a
 * person to fix something that is working.
 */
function Probe() {
  const local = useLocalIntelligence("/__graview/local");
  return <pre data-testid="state">{JSON.stringify(local.state === "open" ? { state: "open", version: local.version } : local)}</pre>;
}

const answering = (response: Partial<Response> | Error) =>
  vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response as Response;
  });

const body = (status: number, type: string, value: unknown): Partial<Response> => ({
  ok: status < 400,
  status,
  headers: new Headers({ "content-type": type }),
  json: async () => value,
});

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  host.remove();
  vi.unstubAllGlobals();
});

const probe = async () => {
  const root = createRoot(host);
  await act(async () => root.render(<Probe />));
  await act(async () => {
    await Promise.resolve();
  });
  const said = JSON.parse(host.querySelector('[data-testid="state"]')!.textContent!);
  await act(async () => root.unmount());
  return said as { state: string; reason?: string; version?: string };
};

describe("probing the local door", () => {
  it("reads a 404 as closed", async () => {
    vi.stubGlobal("fetch", answering(body(404, "text/html", null)));
    expect((await probe()).state).toBe("closed");
  });

  it("reads an HTML answer as closed, rather than throwing on the parse", async () => {
    vi.stubGlobal("fetch", answering(body(200, "text/html; charset=utf-8", null)));
    const said = await probe();
    expect(said.state).toBe("closed");
    expect(said.reason).toContain("Nothing is serving");
  });

  it("reads a network failure as closed", async () => {
    vi.stubGlobal("fetch", answering(new TypeError("Failed to fetch")));
    expect((await probe()).state).toBe("closed");
  });

  it("carries the door's own reason when the door itself says it is shut", async () => {
    vi.stubGlobal(
      "fetch",
      answering(body(200, "application/json", { available: false, reason: "Nothing to run on this machine (claude: not found)" })),
    );
    expect((await probe()).reason).toContain("not found");
  });

  it("is open, with a version, when something is behind it", async () => {
    vi.stubGlobal("fetch", answering(body(200, "application/json", { available: true, version: "2.1.0" })));
    const said = await probe();
    expect(said.state).toBe("open");
    expect(said.version).toBe("2.1.0");
  });
});
