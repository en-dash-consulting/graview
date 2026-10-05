import { layer, type AnySchema } from "@graview/core";
import { Scene, useGraview, UrlSync, useTheKeyboardLandsSomewhere, type Scheme, type SceneProps } from "@graview/react";
import type { Responder, ToolCall } from "@graview/tools";
import { useCallback, useLayoutEffect, useState, type ReactNode, useRef } from "react";
import { Companion, type CompanionMode } from "./companion.js";
import { HomeLanding } from "./home-landing.js";
import { VISUALLY_HIDDEN, useWidth } from "./primitives/index.js";
import { FindBox } from "./find.js";
import { ShowInstallation } from "./installation.js";
import { Profile, type HostAction } from "./profile.js";
import { Notices, type NoticeBoard } from "./notices.js";
import { Places } from "./places.js";
import {
  ActivityRail,
  BackOut,
  Backtrack,
  Inspector,
  OverviewButton,
  FollowingLine,
  Standing,
  Trail,
} from "./workbench/index.js";
import { Wordmark } from "./wordmark.js";

/**
 * The shell: everything an application's window holds that is not about
 * its domain.
 *
 * The command bar — the wordmark that is the way home, the browser's own
 * back and forward made visible, the trail, the other face, whether the
 * rules hold, the chat, the activity and the seat, the scheme — then the
 * scene with its key, its quick relations, the altitude control and the
 * inspector. Three apps carried this same eighty lines each and drifted;
 * now an app supplies a home, a sentence for when nothing is wrong, and
 * whatever seat it wants to give an agent, and the rest is derived.
 *
 * Landmarks are here too, once: a heading for assistive technology (the
 * wordmark is the visible one) and a main region around the scene.
 */
export interface ShellProps<S extends AnySchema> {
  /** The view id that is "home" for the trail and for Escape; null for the whole graph. */
  readonly home?: string | null;
  readonly homeLabel?: string;
  /** What Standing says when no rule is broken. */
  readonly standing?: string;
  /** The seat in the activity rail, given the rail's own call recorder. */
  readonly seat?: (onCall: (call: ToolCall) => void) => ReactNode;
  /** Anything the bar shows between the browser controls and the trail — a places switcher, say. */
  readonly nav?: ReactNode;
  /** Where the routed face lives; null hides the link. */
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
   * HOW THE SEAT'S RAIL STARTS (FR-78): `"open"` (the default), `"collapsed"`
   * to a slim tab, or `"hidden"`. The reader can put it away and open it
   * again, and what they chose is remembered for the app (by the brand's
   * name) over this start — except `"hidden"`, which is the app's to say.
   */
  readonly companion?: CompanionMode;
  /**
   * A BOARD OF NOTICES (FR-75), made with `createNoticeBoard()`: what the
   * app or its host says on it is drawn over the scene — banners at its
   * top, toasts at its foot — and said aloud.
   */
  readonly notices?: NoticeBoard;
}

/** The narrowest the Find box gets at a desk: room for a word, not a sliver. */
const FIND_FLOOR = "6rem";

export function Shell<S extends AnySchema>({
  home = null,
  homeLabel,
  standing = "Everything is in order",
  seat,
  nav,
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
  companion,
  notices,
}: ShellProps<S>) {
  const { brand, view } = useGraview<S>();
  // Below a laptop's width the standing and the profile keep their marks and
  // give up their words; the words are their titles either way.
  const bar = useRef<HTMLElement>(null);
  const barWidth = useWidth(bar);
  // An act that removes what the keyboard stood on lands it on what still stands.
  const shell = useRef<HTMLDivElement>(null);
  useTheKeyboardLandsSomewhere(shell);
  // The picture the notices are drawn over (FR-75).
  const picture = useRef<HTMLElement>(null);
  const scene = useCallback(() => picture.current, []);
  // The standing's sentence goes first — the app's own places are worth
  // more than "everything is in order" said in words — and the name behind
  // the profile's mark goes at a laptop's width.
  const quiet = barWidth !== null && barWidth < 1560;
  const compact = barWidth !== null && barWidth < 1100;
  /*
   * A PHONE GETS TWO ROWS. One row that hides what it cannot hold is the
   * failure the old bar was built against: at 390 a scaffolded app had no
   * undo, no activity and no way back to light, painted off the edge with
   * nothing to say so. Below a small laptop's width the bar wraps — the
   * places as one menu on their own line — and the picture starts under it.
   * The line is where one row stops holding the name, the places, a Find
   * box with room to type in and the profile: at 720 a long record's name
   * pushed the profile — the seat switcher — off the screen, so it is 920.
   */
  /*
   * AND WHEREVER ONE ROW DOES NOT HOLD. 920 is where a scaffolded app's row
   * stops holding; an app's own `nav` (a price against its ceiling), a long
   * crumb after a drive-in and the places menu can need more, and at 1280 a
   * bid's bar ran its profile off the edge with the places a sliver. So the
   * row is measured before it is painted: if it overflows, the bar wraps,
   * and it tries one row again when the window is wider than that or the
   * view moves — the crumb is what changes the row's need most.
   */
  const [needs, setNeeds] = useState(0);
  const narrow = barWidth !== null && (barWidth < 920 || barWidth < needs);
  /*
   * Asked of an IntersectionObserver, never by reading layout: a rise to
   * altitude renders the shell several times, and a forced layout in that
   * frame cost it a frame past 50 ms (verify-scale). The right-hand group
   * — the standing, the activity and the profile — not wholly on screen IS
   * the overflow; the observer says so after the frame, at no cost to it.
   */
  const trailing = useRef<HTMLDivElement>(null);
  const focus = view.focusId;
  useLayoutEffect(() => {
    if (needs > 0) setNeeds(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);
  useLayoutEffect(() => {
    const group = trailing.current;
    if (!group || narrow || barWidth === null || typeof IntersectionObserver === "undefined") return;
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio < 0.99) setNeeds(barWidth + 1);
      },
      { threshold: [0.99, 1] },
    );
    watcher.observe(group);
    return () => watcher.disconnect();
  }, [barWidth, focus, narrow]);
  const [calls, setCalls] = useState<readonly ToolCall[]>([]);
  const onCall = useCallback((call: ToolCall) => {
    setCalls((current) => {
      // A call that settles replaces its own "running" entry rather than
      // stacking on it, so the rail shows twelve turns, not twelve halves.
      const settling =
        call.phase !== "running" && current[0]?.name === call.name && current[0]?.at === call.at;
      return [call, ...(settling ? current.slice(1) : current)].slice(0, 12);
    });
  }, []);

  return (
    <div ref={shell} style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <header
        ref={bar}
        /*
         * ONE ROW. Three regions: who this is and the way back, on the
         * left; the app's own places, in the middle, as one segmented
         * control that hands what it cannot hold to a menu rather than
         * wrapping; and what is true and who you are, on the right, which
         * shed their words before the bar sheds anything else. The bar
         * used to wrap into two rows of equal pills at a laptop's width,
         * and a bar that is two rows tall is a picture that starts lower.
         */
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: narrow ? "wrap" : "nowrap",
          gap: narrow ? "6px 10px" : 14,
          boxSizing: "border-box",
          padding: narrow ? "8px 12px" : "0 16px",
          ...(narrow ? { minHeight: 54 } : { height: 54 }),
          flex: "0 0 auto",
          borderBottom: "1px solid var(--graview-edge)",
          background: "var(--graview-bar)",
          backdropFilter: "blur(14px)",
          position: "relative",
          zIndex: layer("rail"),
          // Never clipped: the profile, the standing and the activity hang
          // their panes from this bar, and a clip here cut them off at the
          // bar's foot. The places row keeps its own overflow.
        }}
      >
        {syncUrl ? <UrlSync /> : null}
        <h1 style={{ ...VISUALLY_HIDDEN, margin: 0 }}>
          {brand?.name ?? "Graview"}
        </h1>
        <div style={{ display: "flex", alignItems: "center", minWidth: 0, ...(narrow ? { flexWrap: "wrap" as const, flex: "1 1 auto", gap: "6px 10px" } : { flex: "0 0 auto", gap: 10 }) }}>
          <Wordmark<S> />
          {/* Every stop is a URL, so back and forward are the browser's. This
              only makes them visible, because nobody should have to know that. */}
          <Backtrack />
          {pagesHref ? (
            // THE TWO FACES, as one switch: the scene, and the same app as pages.
            <div role="group" aria-label="Face" data-testid="faces" style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: 999, border: "1px solid var(--graview-edge)", background: "var(--graview-panel-muted)", flex: "0 0 auto" }}>
              <span aria-current="page" style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "2px 11px", borderRadius: 999, fontSize: "0.8125rem", fontWeight: 600, color: "var(--graview-ink)", background: "var(--graview-panel)", border: "1px solid var(--graview-edge)" }}>
                Scene
              </span>
              <a
                href={pagesHref}
                data-testid="pages-link"
                title="The same app, as ordinary pages"
                style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "2px 11px", borderRadius: 999, fontSize: "0.8125rem", fontWeight: 500, color: "var(--graview-ink-muted)", textDecoration: "none" }}
              >
                Pages
              </a>
            </div>
          ) : null}
          {nav}
          <Trail home={home} {...(homeLabel !== undefined ? { homeLabel } : {})} />
        </div>
        {/* The named pictures over the graph, if the app registered any: the middle, and the room. */}
        <div style={narrow ? { flex: "1 1 100%", order: 3, minWidth: 0, display: "flex" } : { flex: "1 1 auto", minWidth: 0, display: "flex", justifyContent: "center" }}>
          <Places<S> compact={narrow} />
        </div>
        {/*
          * THE FIND BOX: / or ⌘K from anywhere, and the picture is the result
          * list. On a phone it takes a row of its own under the places — a
          * box squeezed between the standing and the profile is a box nobody
          * can type in — and its strip becomes a sheet the screen's width.
          *
          * At a desk it keeps a floor. With a talk of a hundred characters
          * focused, the trail's crumb took the row and left the box 23px
          * wide — under one character of room — and Chromium commits text
          * that arrives without a key (an input method, dictation, an
          * on-screen keyboard) into a field that narrow with the caret left
          * at the start: "Плинов" was written "вонилП" and found nothing.
          * The crumb is capped (`Trail`); the places hand the rest to a menu.
          */}
        <div style={narrow ? { flex: "1 1 100%", order: 4, minWidth: 0, display: "flex" } : { flex: "0 1 15rem", minWidth: FIND_FLOOR, display: "flex" }}>
          <FindBox<S> compact={narrow} />
        </div>
        <div
          ref={trailing}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            flex: narrow ? "1 1 auto" : "0 0 auto",
            minWidth: 0,
          }}
        >
          <Standing clean={standing} compact={quiet} />
          <FollowingLine />
          <ActivityRail remembers={remembers} calls={calls} seat={seat?.(onCall)} />
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
            compact={compact}
            {...(profileHref ? { profileHref } : {})}
            {...(hostActions ? { hostActions } : {})}
            keeping={
              <>
                <ShowInstallation<S> />
                {studio}
              </>
            }
          />
        </div>
      </header>
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
        {/* The altitude control, on the picture it controls. */}
        <OverviewButton />
        {/* The home's own view, when the declaration writes one, over the picture at home (FR-81). */}
        <HomeLanding />
        {/*
          * THE COMPANION: the acts, the relations, the seat and the key, on
          * the frame, about one subject. It replaces the relation key, the
          * quick relations, the inspector's rail and the bar's Ask pill —
          * four panels that each said the current subject in their own
          * corner — and the robot that used to carry the last of them
          * around the ground.
          */}
        <Companion<S>
          chat={chat !== false}
          onCall={onCall}
          {...(companion ? { start: companion } : {})}
          rememberAs={brand?.name ?? "graview"}
          {...(typeof chat === "object" && chat.respond ? { respond: chat.respond } : {})}
        />
        {/* The same pane at the pointer: right-click is the context menu, and it is this. */}
        <Inspector placement="menu" />
      </main>
      {notices ? <Notices board={notices} anchor={scene} /> : null}
    </div>
  );
}
