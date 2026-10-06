import type { AnySchema } from "@graview/core";
import { Companion, HomeLanding, Inspector, OverviewButton, Places, ShowInstallation, type CompanionMode } from "@graview/primitives/scene";
import { Scene } from "@graview/react";
import { AUTO_SCENE_HEIGHT } from "./frame.js";

/*
 * THE SCENE AND THE GRAVIEW, fetched when one of them is drawn (FR-57). A
 * page that opens on the pages face — a phone, a chat's widget — never
 * loads the map, the companion or the inspector; a page that opens on the
 * scene loads them as it draws, not before the frame can.
 */

/** The picture: the scene, the way up, one panel on the frame, and the inspector. */
export function SceneFace<S extends AnySchema>({ auto, companion, rememberAs }: { readonly auto: boolean; readonly companion?: CompanionMode; readonly rememberAs?: string }) {
  return (
    <div data-embed-content="" style={{ position: "relative", flex: auto ? `0 0 ${AUTO_SCENE_HEIGHT}px` : "1 1 auto", minHeight: 0, containerType: "size" }}>
      <Scene renderer="dom" />
      <OverviewButton />
      {/* The home's own view, when the declaration writes one, over the picture at home (FR-81). */}
      <HomeLanding />
      {/* One panel on the frame — the acts, the relations, the seat, the key. */}
      <Companion<S> {...(companion ? { start: companion } : {})} {...(rememberAs ? { rememberAs } : {})} />
      <Inspector placement="menu" />
    </div>
  );
}

/** The scene's own controls on the strip: the named pictures, and the installation. */
export function SceneControls({ compact }: { readonly compact: boolean }) {
  return (
    <>
      {/* The named pictures over the graph — a lens is somewhere to go, by name. */}
      <Places compact={compact} />
      <ShowInstallation />
    </>
  );
}
