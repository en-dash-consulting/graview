import type { AnySchema } from "@graview/core";
import type { Scheme } from "@graview/core";
import { DraftDoor, Inspector, LinesKey, OverviewButton, SceneBarTools, SceneTrail, sceneCss, SceneWayBack, SeatField, ShowInstallation, useCallLog, viewsCss, type SeatStart } from "@graview/primitives/scene";
import { useBarFind } from "@graview/primitives/frame";
import { useMemo } from "react";
import { Scene, UrlSync } from "@graview/react";
import { AUTO_SCENE_HEIGHT } from "./frame.js";

/*
 * THE SCENE AND THE GRAVIEW, fetched when one of them is drawn (FR-57). A
 * page that opens on the pages face — a phone, a chat's widget — never
 * loads the map, the seat's field or the inspector; a page that opens on the
 * scene loads them as it draws, not before the frame can.
 */

/** The picture: the scene, the way up and its key, the ask field at its foot, and the acts at the pointer. */
export function SceneFace<S extends AnySchema>({ address = false, auto, seat, scheme, scope }: {
  /** The host's page is the app (FR-106): the scene keeps its stop in the fragment, as the whole-page Shell does. */
  readonly address?: boolean;
  readonly auto: boolean;
  readonly seat?: SeatStart;
  readonly scheme: Scheme;
  readonly scope: string;
}) {
  /*
   * THE SCENE'S OWN RULES, drawn with the scene (FR-104): after the frame's
   * sheet, where they stand in `themeCss`, so a page that never draws the
   * scene never carries them.
   */
  const css = useMemo(() => `${viewsCss({ scope: `.${scope}` })}\n${sceneCss(scheme, { scope: `.${scope}` })}`, [scheme, scope]);
  // Where the app bar keeps the scene's Find — its hits are the picture's — and its Activity (FR-131).
  const find = useBarFind();
  const [calls, onCall] = useCallLog();
  return (
    <div data-embed-content="" style={{ position: "relative", flex: auto ? `0 0 ${AUTO_SCENE_HEIGHT}px` : "1 1 auto", minHeight: 0, containerType: "size" }}>
      <style>{css}</style>
      {address ? <UrlSync /> : null}
      <Scene renderer="dom" />
      {/* What the picture is doing, with the way back from each, on the picture — as on the whole-page Shell. */}
      <SceneTrail />
      <OverviewButton />
      <LinesKey<S> />
      {/* A view the seat drew, in place of the picture, under the seat. */}
      <DraftDoor />
      {/* The ask field at the picture's foot, that grows into the conversation when asked. */}
      <SeatField<S> {...(seat ? { start: seat } : {})} onCall={onCall} />
      <Inspector placement="menu" />
      {/* The scene's Find and its Activity, in the bar's places for them (FR-131), as the whole-page Shell puts them. */}
      <SceneBarTools<S> find={find} calls={calls} />
      {/* After an act, the way back on the board, and ⌘Z (FR-153): as on the pages, and the whole-page Shell. */}
      <SceneWayBack />
    </div>
  );
}

/** The ways into the installation itself, in the person’s menu on the scene, for the seat that keeps it. */
export function SceneKeeping() {
  return <ShowInstallation />;
}
