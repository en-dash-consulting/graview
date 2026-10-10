import { faviconHref, pagesTitle, sceneTitle, type AnySchema } from "@graview/core";
import { Scene, useGraview, useNavigation, UrlSync, useTheKeyboardLandsSomewhere, type Scheme, type SceneProps } from "@graview/react";
import type { Responder, ToolCall } from "@graview/tools";
import { useCallback, useState, type ReactNode, useRef } from "react";
import { withOverview } from "@graview/layout/view";
import { SeatField, type SeatStart } from "./seat-field.js";
import { LinesKey } from "./lines-key.js";
import { ShowInstallation } from "./installation.js";
import { Profile, type HostAction } from "./profile.js";
import { createNoticeBoard, NoticeBoardContext, Notices, type NoticeBoard } from "./notices.js";
import { DraftDoor } from "./draft-door.js";
import { appKeyOf } from "./reader-lenses.js";
import { registerReaderLenses } from "./declared-lens-doors.js";
import { AppBar, type BarFind } from "./app-bar.js";
import { useScenePlaces } from "./scene-places.js";
import { SceneBarTools, SceneTrail, useCallLog } from "./scene-bar.js";
import { SceneWayBack } from "./scene-way-back.js";
import { BackOut, Inspector, OverviewButton, Standing } from "./workbench/index.js";
import { useFavicon } from "./app-title.js";

/**
 * The shell: everything an application's window holds that is not about
 * its domain.
 *
 * The one app bar (`AppBar`, FR-131) — the app's mark and name, the way
 * home; the switch between the scene and the pages (FR-137); what the scene
 * shows and every picture it can (FR-144, FR-145); Find, Activity when
 * something has happened, the standing and the person — exactly as an
 * embed's scene face wears it, so the whole-page app and an embed are one
 * app on both faces. Then the scene with its key, the altitude control, what
 * the picture is doing (`SceneTrail`), the ask field and the inspector.
 * Three apps carried this same eighty lines each and drifted; now an app
 * supplies a home, a sentence for when nothing is wrong, and whatever seat
 * it wants to give an agent, and the rest is derived.
 *
 * Landmarks are here too, once: the bar is the banner and says the app's
 * name as the page's one heading, and a main region holds the scene.
 */
export interface ShellProps<S extends AnySchema> {
  /** The view id that is "home" for the trail and for Escape; null for the whole graph. */
  readonly home?: string | null;
  /** What Standing says when no rule is broken. */
  readonly standing?: string;
  /** The seat in Activity, given Activity's own call recorder. */
  readonly seat?: (onCall: (call: ToolCall) => void) => ReactNode;
  /** Where the routed face lives — the switch's "Pages" and the way home go there; null, and the bar has no switch. */
  readonly pagesHref?: string | null;
  /** Whether the store is remembered in this browser (the rail says so, and offers the way back). */
  readonly remembers?: boolean;
  /** Whether the view rides the URL. */
  readonly syncUrl?: boolean;
  readonly renderer?: "gpu" | "dom" | "auto";
  readonly attachRenderer?: SceneProps["attachRenderer"];
  readonly scheme: Scheme;
  readonly onScheme: (scheme: Scheme) => void;
  /**
   * The chat seat, on by default: it answers from the graph with no key.
   *
   * `{ respond }` hands it the app's OWN responder. `ChatPanel` has always
   * taken one — the agent-seat skill is about writing one — and the shell
   * that every app uses, and that the scaffolder wires up, exposed the panel
   * as a boolean. So an app that wrote a domain responder had no way to put
   * it in the scene's chat: it could turn the chat off and rebuild that part
   * of the shell, or leave the generic answer in the surface most people
   * actually type into. A seam is only as reachable as the most convenient
   * component sitting on top of it, and a prop the shell does not forward is
   * in practice a prop that does not exist.
   */
  readonly chat?: boolean | { readonly respond?: Responder<S> };
  /**
   * Where a person's own record lives on the routed face. Given, the
   * profile pane links to it; absent, the pane says who you are without
   * pretending there is somewhere to go.
   */
  readonly profileHref?: (userId: string) => string;
  /**
   * The way into the app's own declaration — `<StudioPlace app={...} />`
   * from `@graview/studio`, which an app passes because only the app knows
   * which declaration it is running.
   *
   * A slot rather than a direct import: the shell would otherwise depend on
   * the studio, the studio already depends on the shell's own primitives,
   * and the cycle would be real rather than a typing accident.
   */
  readonly studio?: ReactNode;
  /**
   * THE HOST'S OWN ACTIONS (FR-72): links or presses drawn in the profile
   * menu under who is signed in — a hosting service's "Your apps", say.
   */
  readonly hostActions?: readonly HostAction[];
  /**
   * A GRAVIEW SIGNATURE: a quiet "Built with Graview" at the foot of the
   * person's menu, linking to graview.dev. Off by default — an app leads
   * with its own name and mark; Graview's own examples turn it on.
   */
  readonly signature?: boolean;
  /**
   * THE ASK FIELD at the picture's foot (the seat): `"field"`, the default,
   * or `"hidden"` for none. `chat: false` hides it too.
   */
  readonly ask?: SeatStart;
  /**
   * A BOARD OF NOTICES (FR-75), made with `createNoticeBoard()`: what the
   * app or its host says on it is drawn over the scene — banners at its
   * top, toasts at its foot — and said aloud.
   */
  readonly notices?: NoticeBoard;
}

export function Shell<S extends AnySchema>({
  home = null,
  standing = "Everything is in order",
  seat,
  pagesHref = "/pages",
  remembers = false,
  syncUrl = false,
  renderer = "dom",
  attachRenderer,
  scheme,
  onScheme,
  chat = true,
  profileHref,
  studio,
  hostActions,
  signature = false,
  ask = "field",
  notices,
}: ShellProps<S>) {
  const { brand, views, store } = useGraview<S>();
  const { view, go } = useNavigation();
  /* The lenses this reader kept from the seat, beside the app's own places, before anything draws them. */
  useState(() => registerReaderLenses(views, store.schema, appKeyOf(brand, store.schema)));
  /* The board the app speaks on: the host's, else the shell's own — a kept lens is said there, with Take back. */
  const [ownBoard] = useState(() => createNoticeBoard());
  const board = notices ?? ownBoard;
  // The Shell owns the whole page, so the page wears the brand's icon (FR-124).
  useFavicon(faviconHref(brand));
  // An act that removes what the keyboard stood on lands it on what still stands.
  const shell = useRef<HTMLDivElement>(null);
  useTheKeyboardLandsSomewhere(shell);
  // The picture the notices are drawn over (FR-75).
  const picture = useRef<HTMLElement>(null);
  const scene = useCallback(() => picture.current, []);
  const [calls, onCall] = useCallLog();
  // Where the bar keeps Find and the face's own tool, once it has drawn them.
  const [barFind, setBarFind] = useState<BarFind | null>(null);
  // What the scene shows, and every picture it can (FR-144).
  const scenePlaces = useScenePlaces();
  const arrangement = views.arrangement?.();
  /*
   * THE WAY HOME: the app's front page on the pages, as an embed's is; with
   * no pages, the scene's home stop — from above, where it names none.
   */
  const homeWay = pagesHref
    ? { href: pagesHref, current: false }
    : {
        go: () => go(home ? { ...view, focusId: home, overview: false } : withOverview(view, true)),
        current: home ? view.focusId === home && !view.overview : Boolean(view.overview),
      };

  return (
    <NoticeBoardContext.Provider value={board}>
    <div ref={shell} style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {syncUrl ? <UrlSync /> : null}
      {/*
        * THE ONE APP BAR, as an embed's scene face wears it: the same parts
        * under the same test ids, one row on a desk and on a phone.
        */}
      <AppBar
        brand={brand}
        name={brand?.name ?? "Graview"}
        description={brand?.subtitle}
        home={homeWay}
        {...(pagesHref
          ? {
              faces: {
                scene: { label: sceneTitle(arrangement), current: true, go: () => undefined },
                // The pages are on their own address.
                pages: { label: pagesTitle(arrangement), current: false, go: () => window.location.assign(pagesHref) },
              },
            }
          : {})}
        places={[]}
        current={null}
        reach={{}}
        scenePlaces={scenePlaces}
        onFind={setBarFind}
        tools={
          <>
            <Standing clean={standing} />
            {/*
              * WHO YOU ARE, AND WHAT YOU SET FOR YOURSELF — last on the bar,
              * where every application in the world puts it. The seat
              * switcher lives inside it: "who am I" and "be somebody else"
              * are one question. The installation and the studio are behind
              * it too, with the other things only the keeper can use.
              */}
            <Profile<S>
              scheme={scheme}
              onScheme={onScheme}
              {...(profileHref ? { profileHref } : {})}
              {...(hostActions ? { hostActions } : {})}
              signature={signature}
              keeping={
                <>
                  <ShowInstallation<S> />
                  {studio}
                </>
              }
            />
          </>
        }
      />
      {/* The scene's Find and its Activity, in the bar's places for them. */}
      <SceneBarTools<S> find={barFind} calls={calls} remembers={remembers} {...(seat ? { seat: seat(onCall) } : {})} />
      {/* Escape backs out to home, whatever the app says home is. */}
      <BackOut home={home} />
      {/* The scene's box is the container the panes size against (cqh), so
          a pane never reaches past the picture it belongs to — here or in
          an embed the size of a paragraph. */}
      {/* Focusable only programmatically: where the keyboard lands when the
          pane it was in stops existing (see `Inspector`). */}
      <main
        ref={picture}
        tabIndex={-1}
        style={{ position: "relative", flex: "1 1 auto", minHeight: 0, containerType: "size", outline: "none" }}
      >
        <Scene renderer={renderer} {...(attachRenderer ? { attachRenderer } : {})} />
        {/* What the picture is doing — the past, a move, a raised relation — each with its way back, on the picture. */}
        <SceneTrail home={home} />
        {/* The altitude control, on the picture it controls. */}
        <OverviewButton />
        {/* What the lines mean, beside Up: the picture's own key. */}
        <LinesKey<S> />
        {/* A view the seat drew, in place of the picture, under the seat. */}
        <DraftDoor />
        {/*
          * THE SEAT: a quiet ask field at the picture's foot that grows into
          * a panel over it when asked — never a rail, never a column of acts.
          */}
        <SeatField<S>
          start={chat === false ? "hidden" : ask}
          onCall={onCall}
          {...(typeof chat === "object" && chat.respond ? { respond: chat.respond } : {})}
        />
        {/* The acts at the pointer: right-click, or the acts key on a card, is the context menu. */}
        <Inspector placement="menu" />
        {/* After an act, the way back on the board, and ⌘Z (FR-153): as on the pages. */}
        <SceneWayBack />
      </main>
      <Notices board={board} anchor={scene} />
    </div>
    </NoticeBoardContext.Provider>
  );
}
