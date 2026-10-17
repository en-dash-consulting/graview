import { describe, expect, it } from "vitest";
import { chooseRenderer, framesHeld, gpuCapturePresent, planeBlurOn, rendererAsked } from "../../src/index.js";

const capturing = {
  navigator: { gpu: {} },
  GPUQueue: { prototype: { drawElementImageToTexture() {} } },
  HTMLCanvasElement: { prototype: { requestPaint() {} } },
};

describe("a scene draws on the GPU where it can", () => {
  it("finds the GPU path present only with WebGPU, an element capture and a paint event", () => {
    expect(gpuCapturePresent(capturing)).toBe(true);
    expect(gpuCapturePresent({ ...capturing, GPUQueue: { prototype: { copyElementImageToTexture() {} } } })).toBe(true);
    // Firefox, older Safari: no WebGPU at all.
    expect(gpuCapturePresent({ navigator: {} })).toBe(false);
    // Chromium stable, Safari 26: WebGPU without element capture.
    expect(gpuCapturePresent({ ...capturing, GPUQueue: { prototype: {} } })).toBe(false);
    expect(gpuCapturePresent({ ...capturing, HTMLCanvasElement: { prototype: {} } })).toBe(false);
  });

  it("starts auto on the GPU where it is present, and on the DOM path where it is not, whatever was asked", () => {
    expect(chooseRenderer("auto", { present: true })).toBe("gpu");
    expect(chooseRenderer("auto", { present: false })).toBe("dom");
    expect(chooseRenderer("gpu", { present: false })).toBe("dom");
    expect(chooseRenderer("auto", { present: false, operator: "gpu" })).toBe("dom");
  });

  it("lets an operator decide auto either way, and leaves a host's named path alone", () => {
    expect(chooseRenderer("auto", { present: true, operator: "dom" })).toBe("dom");
    expect(chooseRenderer("dom", { present: true, operator: "gpu" })).toBe("dom");
    expect(chooseRenderer("gpu", { present: true, operator: "dom" })).toBe("gpu");
  });

  it("reads the operator's ask from the address or from the page, the page first", () => {
    expect(rendererAsked({ location: { search: "?renderer=dom" } })).toBe("dom");
    expect(rendererAsked({ location: { search: "?fresh=1&renderer=gpu" } })).toBe("gpu");
    expect(rendererAsked({ location: { search: "?renderer=webgl" } })).toBeNull();
    expect(rendererAsked({ location: { search: "" } })).toBeNull();
    expect(rendererAsked({ location: { search: "?renderer=dom" }, graviewRenderer: "gpu" })).toBe("gpu");
  });
});

describe("a receded plane is blurred", () => {
  it("unless the host turned blur off, or the reader asked for less motion or less transparency", () => {
    expect(planeBlurOn({})).toBe(true);
    expect(planeBlurOn({ off: true })).toBe(false);
    expect(planeBlurOn({ reducedMotion: true })).toBe(false);
    expect(planeBlurOn({ reducedTransparency: true })).toBe(false);
  });

  it("and the frames that carry it are held to a budget by their 95th percentile", () => {
    const steady = Array.from({ length: 40 }, () => 8);
    expect(framesHeld(steady)).toBe(true);
    expect(framesHeld([...steady, 40])).toBe(true);
    expect(framesHeld([...steady, ...Array.from({ length: 5 }, () => 40)])).toBe(false);
    expect(framesHeld(steady, 5)).toBe(false);
  });
});
