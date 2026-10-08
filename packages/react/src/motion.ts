import { useSyncExternalStore } from "react";
import { useGraview } from "./context.js";

export { createMotionStore } from "./motion-store.js";
export type { MotionStore } from "./motion-store.js";

/** True while the scene is still. */
export function useSceneStill(): boolean {
  const { motion } = useGraview();
  return useSyncExternalStore(motion.subscribe, () => !motion.moving(), () => true);
}
