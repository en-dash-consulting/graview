import { mountThreePlanes } from "./three-planes.js";

const root = document.getElementById("scene")!;
const status = document.getElementById("status")!;

mountThreePlanes(root as HTMLElement)
  .then(async (scene) => {
    await scene.run(3);
    const report = {
      capabilities: scene.compositor.capabilities,
      views: scene.views.map((v) => ({ id: v.id, plane: v.plane, x: v.x, y: v.y })),
    };
    status.textContent = JSON.stringify(report, null, 2);
    (window as unknown as Record<string, unknown>).__graviewScene = scene;
    (window as unknown as Record<string, unknown>).__graviewReady = report;
  })
  .catch((error: unknown) => {
    status.textContent = `Scene failed: ${String(error)}\n${error instanceof Error ? error.stack : ""}`;
    (window as unknown as Record<string, unknown>).__graviewReady = { error: String(error) };
  });
