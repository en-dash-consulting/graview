import { retryingImport } from "@graview/core/retry";
import { lazyModule, useAiDeskState, useGraview, type MenuSectionSource, type MenuTarget } from "@graview/react/provider";
import { inlineAiOn } from "@graview/tools/frame";
import { MenuSections } from "@graview/react/drawing";
import { Suspense, useMemo, type ComponentType, type ReactNode } from "react";
import type { InlineAiMenuProps } from "./inline-ai-menu.js";

/**
 * THE DOOR TO THE INLINE AI (Roadmap f-ai-candidate-catalog): a section of
 * the context menu on both faces, and the ghost of what it proposed, each
 * fetched when it is first drawn — a page whose reader never right-clicks
 * carries none of the catalog, the models' slots or the tray.
 *
 * Drawn only where the host gave a model (`ai.fast`, `ai.thinking`, or the
 * `decide` and `complete` behind them) and did not say AI is off: then
 * there is no section, no tray and no row anywhere — hidden, not disabled.
 */
const menuModule = /* @__PURE__ */ lazyModule(retryingImport(() => import("./inline-ai-menu.js")));
const Menu = /* @__PURE__ */ menuModule.part(
  (module, props: InlineAiMenuProps) => {
    const Drawn = module.InlineAiMenu as ComponentType<InlineAiMenuProps>;
    return <Drawn {...props} />;
  },
  { what: "The AI's suggestions" },
);
const Tray = /* @__PURE__ */ menuModule.part((module, props: GhostDoorProps) => {
  const Drawn = module.GhostTray as ComponentType<GhostDoorProps>;
  return <Drawn {...props} />;
}, { quiet: true });

export interface GhostDoorProps {
  /** Over the scene's picture (the default), or over a page's window. */
  readonly placement?: "picture" | "page";
}

/** The inline AI's section of the context menu, or null where it is not drawn. Hand it to `MenuSections`. */
export function useInlineAiSection(): MenuSectionSource | null {
  const { ai } = useGraview();
  const on = inlineAiOn(ai);
  return useMemo<MenuSectionSource | null>(
    () =>
      on
        ? (target: MenuTarget) => ({
            id: "inline-ai",
            heading: "AI",
            render: (close: () => void) => (
              <Suspense fallback={null}>
                <Menu target={target} close={close} />
              </Suspense>
            ),
            // Fetched while the pointer rests, so the section draws with the menu's first frame; nothing is asked of a model (FR-186).
            prepare: () => menuModule.prefetch(),
          })
        : null,
    [on],
  );
}

const NONE: readonly MenuSectionSource[] = [];

/** The context menu drawn inside, with the inline AI's section where it is drawn at all. */
export function InlineAiSections({ children }: { readonly children: ReactNode }) {
  const section = useInlineAiSection();
  const sections = useMemo(() => (section ? [section] : NONE), [section]);
  return <MenuSections sections={sections}>{children}</MenuSections>;
}

/** What the inline AI proposed and has not made, with Accept, Accept some and Dismiss — then the one undo. Nothing while nothing waits. */
export function GhostDoor(props: GhostDoorProps) {
  const { ai, aiDesk } = useGraview();
  const { ghost } = useAiDeskState(aiDesk);
  // One the quick ask's card draws itself is not drawn again at the foot.
  if (ghost === null || ghost.onCard || ai.off) return null;
  return (
    <Suspense fallback={null}>
      <Tray {...props} />
    </Suspense>
  );
}
