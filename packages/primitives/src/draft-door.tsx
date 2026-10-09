import { retryingImport } from "@graview/core/retry";
import { lazyModule, useGraview } from "@graview/react/provider";
import { Suspense, useSyncExternalStore, type ComponentType } from "react";
import type { DraftFrameProps } from "./draft-frame.js";

/**
 * THE DOOR TO A DRAWN VIEW: nothing at all until the seat draws one, and
 * then the frame (`draft-frame.tsx`), fetched when it is first needed — a
 * page whose reader never asks for a view carries none of it.
 */
const frameModule = lazyModule(retryingImport(() => import("./draft-frame.js")));
const Frame = frameModule.part(
  (module, props: DraftFrameProps) => {
    const Drawn = module.DraftFrame as ComponentType<DraftFrameProps>;
    return <Drawn {...props} />;
  },
  { what: "The view" },
);

export function DraftDoor(props: DraftFrameProps) {
  const { seatTalk } = useGraview();
  const shown = useSyncExternalStore(seatTalk.subscribe, () => seatTalk.get().draft !== null, () => false);
  if (!shown) return null;
  return (
    <Suspense fallback={null}>
      <Frame {...props} />
    </Suspense>
  );
}
