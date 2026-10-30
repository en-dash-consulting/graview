import type { AnySchema } from "@graview/core";
import type { Scheme } from "@graview/core";
import { BoardMoveSections, DraftDoor, GhostDoor, InlineAiSections, Inspector, LinesKey, MapPanel, NotifyDoor, NotifySections, OverviewButton, PastBar, QuickAskDoor, SceneBarTools, SceneTrail, sceneCss, SceneWayBack, ShowInstallation, useCallLog, viewsCss, ViewTidyingSections, SectionBetterDoor, SectionBetterSections } from "@graview/primitives/scene";
import { useBarFind } from "@graview/primitives/frame";
import { useMemo } from "react";
import { BesideTheMap, PanFree, Scene, UrlSync } from "@graview/react";
import { AUTO_SCENE_HEIGHT } from "./frame.js";

/*
 * THE SCENE AND THE GRAVIEW, fetched when one of them is drawn (FR-57). A
 * page that opens on the pages face — a phone, a chat's widget — never
 * loads the map or the inspector; a page that opens on the
 * scene loads them as it draws, not before the frame can.
 */

/** The picture: the scene, the way up and its key, the quick ask, and the acts at the pointer. */
export function SceneFace<S extends AnySchema>({ address = false, auto, quickAsk = true, scheme, scope }: {
  /** The host's page is the app (FR-106): the scene keeps its stop in the fragment, as the whole-page Shell does. */
  readonly address?: boolean;
  readonly auto: boolean;
  /** The quick ask, as the app set it (`quickAsk` in the embed's options). */
  readonly quickAsk?: boolean;
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
  const [calls] = useCallLog();
  return (
    /* A district opened here is listed in the panel beside the map. */
    <BesideTheMap.Provider value={true}>
    <div data-embed-content="" style={{ position: "relative", flex: auto ? `0 0 ${AUTO_SCENE_HEIGHT}px` : "1 1 auto", minHeight: 0, containerType: "size" }}>
      <style>{css}</style>
      {address ? <UrlSync /> : null}
      {/* The GPU where this browser can draw on it, the DOM path elsewhere, silently (see `Scene`). */}
      <Scene />
      {/* What the picture is doing, with the way back from each, on the picture — as on the whole-page Shell. */}
      <SceneTrail />
      <OverviewButton />
      <LinesKey<S> />
      {/*
        * WHAT FLOATS OVER THE PICTURE IS NOT TOLD THE PAN (`PanFree`): letting
        * go of a drag drew the panel beside the map, every record it lists,
        * and the menu at the pointer again, to say nothing new.
        */}
      <PanFree>
      {/* A panel the AI drew, in place of the picture. */}
      <DraftDoor />
      {/* The quick ask: ⌘K's bar beside what is selected, and the answers it leaves there as cards, as on the whole-page Shell. */}
      <QuickAskDoor face="scene" on={quickAsk} />
      {/* What is chosen from altitude — a lens, a record's links, a district — beside the map, at a size a person reads. */}
      <MapPanel<S> />
      {/* The acts at the pointer, and the inline AI's part of the menu where the host gave a model, as on the whole-page Shell. */}
      <NotifySections>
        <BoardMoveSections>
          <InlineAiSections>
            {/* Hide and Delete for a place, opened from the bar's places (Roadmap f-place-menu-views). */}
            <ViewTidyingSections>
              {/* "Make this better" on a section of a worker view (Roadmap f-make-this-section-better). */}
              <SectionBetterSections>
                <Inspector placement="menu" />
              </SectionBetterSections>
            </ViewTidyingSections>
          </InlineAiSections>
        </BoardMoveSections>
      </NotifySections>
      {/* The sheet "Notify me…" opens (Roadmap f-notify-subscriptions). */}
      <NotifyDoor />
      {/* A section a menu is open on, outlined; its card, where "Make this better" was asked. */}
      <SectionBetterDoor />
      {/* What the inline AI proposed and has not made. */}
      <GhostDoor />
      {/* The scene's Find and its Activity, in the bar's places for them (FR-131), as the whole-page Shell puts them. */}
      <SceneBarTools<S> find={find} calls={calls} />
      {/* After an act, the way back on the board, and ⌘Z (FR-153): as on the pages, and the whole-page Shell. */}
      <SceneWayBack />
      {/* The app as it was, and the way through it (Roadmap f-playback), as on the whole-page Shell. */}
      <PastBar face="scene" />
      </PanFree>
    </div>
    </BesideTheMap.Provider>
  );
}

/** The ways into the installation itself, in the person’s menu on the scene, for the seat that keeps it. */
export function SceneKeeping() {
  return <ShowInstallation />;
}
