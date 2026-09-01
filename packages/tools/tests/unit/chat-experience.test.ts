import { describe, expect, it, vi } from "vitest";
import { describeIntelligence, localCompletion, type LocalStatus } from "../../src/local.js";

/**
 * The chat's honesty at the seams the browser harness cannot isolate: the
 * header's one word for each rung, the local rung refusing FAST (and saying
 * why) where WebGPU is missing, and a failed bring-up staying failed rather
 * than re-downloading on every turn.
 */

describe("the header's word for each rung", () => {
  it("names the graph, the device, and the model — never a shrug", () => {
    expect(describeIntelligence({ source: "graph" })).toBe("graph-native");
    expect(describeIntelligence({ source: "local" })).toBe("on-device");
    expect(
      describeIntelligence({ source: "remote", remote: { preset: "xai", apiKey: "k" } }),
    ).toBe("grok-4-fast");
    expect(
      describeIntelligence({
        source: "remote",
        remote: { preset: "custom", apiKey: "k", baseUrl: "https://x/v1", model: "m-9" },
      }),
    ).toBe("m-9");
    expect(
      describeIntelligence({
        source: "remote",
        remote: { preset: "custom", apiKey: "k", baseUrl: "https://x/v1" },
      }),
    ).toBe("custom model");
    // A remote source with no key cannot answer remotely; the header must
    // not claim a model that will never be called.
    expect(describeIntelligence({ source: "remote" })).toBe("graph-native");
  });
});

describe("the local rung without WebGPU", () => {
  it("refuses fast, says why, and never reaches for the download", async () => {
    // Node has a navigator and no navigator.gpu — exactly the engine the
    // gate exists for. A unique model name keeps the module-wide engine
    // cache out of this test.
    const statuses: LocalStatus[] = [];
    const local = localCompletion({
      model: `test-no-webgpu-${Date.now()}`,
      onStatus: (status) => statuses.push(status),
    });
    local.warm();
    await vi.waitFor(() => {
      expect(statuses.some((status) => status.state === "failed")).toBe(true);
    });
    const failed = statuses.find((status) => status.state === "failed")!;
    expect(failed.detail).toContain("WebGPU");
    expect(local.ready()).toBe(false);
    await expect(local.complete("hi")).rejects.toThrow(/not warm/);
  });
});

describe("a failed bring-up stays failed", () => {
  it("does not retry the load on every warm — a reload is the retry", async () => {
    const load = vi.fn().mockRejectedValue(new Error("no adapter"));
    const statuses: LocalStatus[] = [];
    const local = localCompletion({ load, onStatus: (status) => statuses.push(status) });
    local.warm();
    await vi.waitFor(() => {
      expect(statuses.some((status) => status.state === "failed")).toBe(true);
    });
    local.warm();
    local.warm();
    // The failure is re-STATED (the header keeps saying why) but the
    // two-gigabyte bring-up is not re-attempted.
    expect(load).toHaveBeenCalledTimes(1);
    expect(statuses.filter((status) => status.state === "failed").length).toBeGreaterThanOrEqual(2);
  });
});
