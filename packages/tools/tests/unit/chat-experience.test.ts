import { describe, expect, it, vi } from "vitest";
import { localCompletion, type LocalStatus } from "../../src/local.js";

/**
 * The on-device model's honesty at the seams the browser harness cannot
 * isolate: refusing FAST (and saying why) where WebGPU is missing, and a
 * failed bring-up staying failed rather than re-downloading on every turn.
 */

describe("the on-device model without WebGPU", () => {
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
    // The failure is re-STATED (the seat keeps saying AI didn't answer) but the
    // two-gigabyte bring-up is not re-attempted.
    expect(load).toHaveBeenCalledTimes(1);
    expect(statuses.filter((status) => status.state === "failed").length).toBeGreaterThanOrEqual(2);
  });
});
