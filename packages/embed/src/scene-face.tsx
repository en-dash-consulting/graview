import type { AnySchema } from "@graview/core";
import type { Scheme } from "@graview/core";
import { Companion, FindBox, Inspector, OverviewButton, sceneCss, ShowInstallation, viewsCss, type CompanionMode } from "@graview/primitives/scene";
import { useBarFind } from "@graview/primitives/frame";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { Scene, UrlSync } from "@graview/react";
import { AUTO_SCENE_HEIGHT } from "./frame.js";

/*
 * THE SCENE AND THE GRAVIEW, fetched when one of them is drawn (FR-57). A
 * page that opens on the pages face — a phone, a chat's widget — never
 * loads the map, the companion or the inspector; a page that opens on the
 * scene loads them as it draws, not before the frame can.
 */

/** The picture: the scene, the way up, one panel on the frame, and the inspector. */
export function SceneFace<S extends AnySchema>({ address = false, auto, companion, rememberAs, scheme, scope }: {
  /** The host's page is the app (FR-106): the scene keeps its stop in the fragment, as the whole-page Shell does. */
  readonly address?: boolean;
  readonly auto: boolean;
  readonly companion?: CompanionMode;
  readonly rememberAs?: string;
  readonly scheme: Scheme;
  readonly scope: string;
}) {
  /*
   * THE SCENE'S OWN RULES, drawn with the scene (FR-104): after the frame's
   * sheet, where they stand in `themeCss`, so a page that never draws the
   * scene never carries them.
   */
  const css = useMemo(() => `${viewsCss({ scope: `.${scope}` })}\n${sceneCss(scheme, { scope: `.${scope}` })}`, [scheme, scope]);
  // The scene's Find — its hits are the picture's — in the app bar's place for it (FR-131).
  const find = useBarFind();
  return (
    <div data-embed-content="" style={{ position: "relative", flex: auto ? `0 0 ${AUTO_SCENE_HEIGHT}px` : "1 1 auto", minHeight: 0, containerType: "size" }}>
      <style>{css}</style>
      {address ? <UrlSync /> : null}
      <Scene renderer="dom" />
      <OverviewButton />
      {/* One panel on the frame — the acts, the relations, the seat, the key. */}
      <Companion<S> {...(companion ? { start: companion } : {})} {...(rememberAs ? { rememberAs } : {})} />
      <Inspector placement="menu" />
      {find ? createPortal(<FindBox<S> compact={find.compact} />, find.slot) : null}
    </div>
  );
}

/** The ways into the installation itself, in the person’s menu on the scene, for the seat that keeps it. */
export function SceneKeeping() {
  return <ShowInstallation />;
}
