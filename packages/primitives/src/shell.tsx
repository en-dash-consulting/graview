import type { AnySchema } from "@graview/core";
import { Scene, useGraview, UrlSync, type Scheme, type SceneProps } from "@graview/react";
import type { ToolCall } from "@graview/tools";
import { useCallback, useState, type ReactNode } from "react";
import { ChatPanel } from "./chat.js";
import { VISUALLY_HIDDEN } from "./primitives/index.js";
import { ShowInstallation } from "./installation.js";
import { Profile } from "./profile.js";
import { Places } from "./places.js";
import { QuickRelations } from "./quick-relations.js";
import { RelationKey } from "./relation-key.js";
import {
  ActivityRail,
  BackOut,
  Backtrack,
  Inspector,
  OverviewButton,
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
  readonly attachRenderer?: SceneProps<S>["attachRenderer"];
  readonly scheme: Scheme;
  readonly onScheme: (scheme: Scheme) => void;
  /** The chat seat, on by default: it answers from the graph with no key. */
  readonly chat?: boolean;
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
}

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
}: ShellProps<S>) {
  const { brand } = useGraview<S>();
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
  const other = scheme === "dark" ? "light" : "dark";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <header
        /*
         * THE BAR WRAPS RATHER THAN RUNNING OFF THE EDGE.
         *
         * One unwrapping row, a fixed 56 high, inside a wrapper that clips:
         * at 390 the row wanted 649, so the standing sentence was cut and
         * Ask, Activity and the scheme toggle were painted entirely off the
         * right — with `canScrollX` false, because the wrapper hides the
         * overflow. On a phone a scaffolded app had no undo, no activity, no
         * chat and no way back to light, and nothing said so.
         *
         * Wrapping is the same answer as the strip's at W-029: where there
         * is no room beside something, it goes underneath, and the layout
         * re-runs into what is left. The height is a MINIMUM now, so one row
         * is unchanged on any screen with the room for it.
         */
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          rowGap: 6,
          // Vertical padding the one-row bar never feels: border-box, so
          // 4 + 35 + 4 + the rule is under the minimum and a bar with room
          // is exactly the 57 it always was.
          boxSizing: "border-box",
          padding: "4px 22px",
          minHeight: 57,
          flex: "0 0 auto",
          borderBottom: "1px solid var(--graview-edge)",
          background: "var(--graview-bar)",
          backdropFilter: "blur(14px)",
          position: "relative",
          zIndex: 20,
        }}
      >
        {syncUrl ? <UrlSync /> : null}
        <h1 style={{ ...VISUALLY_HIDDEN, margin: 0 }}>
          {brand?.name ?? "Graview"}
        </h1>
        <Wordmark<S> />
        {/* Every stop is a URL, so back and forward are the browser's. This
            only makes them visible, because nobody should have to know that. */}
        <Backtrack />
        {nav}
        <Trail home={home} {...(homeLabel !== undefined ? { homeLabel } : {})} />
        {/* The named pictures over the graph, if the app registered any. */}
        <Places<S> />
        {/* The way into the installation, for the seat that keeps it. */}
        <ShowInstallation<S> />
        {/* And the way into the DECLARATION, for the same seat: the app's
            own kinds, fields, acts and rules, one press away and in place. */}
        {studio}
        {/* The right-hand group wraps for the same reason the bar does: as one
            unwrapping unit it carried the whole overflow across the edge by
            itself, so the bar wrapped and the controls were still gone. */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: 12,
            rowGap: 6,
            minWidth: 0,
          }}
        >
          {pagesHref ? (
            // The scene offering the page face: two faces, one application.
            <a
              href={pagesHref}
              data-testid="pages-link"
              title="The same app, as ordinary pages"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 24,
                padding: "2px 8px",
                fontSize: "0.78125rem",
                color: "var(--graview-ink-muted)",
                textDecoration: "none",
              }}
            >
              Pages
            </a>
          ) : null}
          <Standing clean={standing} />
          {chat ? <ChatPanel<S> onCall={onCall} /> : null}
          <ActivityRail remembers={remembers} calls={calls} seat={seat?.(onCall)} />
          <button
            type="button"
            data-testid="scheme"
            aria-label={`Switch to ${other} mode`}
            title={`Switch to ${other} mode`}
            onClick={() => onScheme(other)}
            style={{ padding: "6px 9px", lineHeight: 1 }}
          >
            {scheme === "dark" ? "☀" : "☾"}
          </button>
          {/*
            * WHO YOU ARE, AND WHAT YOU SET FOR YOURSELF — last on the bar,
            * where every application in the world puts it. The seat
            * switcher lives inside it now: "who am I" and "be somebody
            * else" are one question, and two separate controls for them
            * was the bar answering it twice.
            */}
          <Profile<S>
            scheme={scheme}
            onScheme={onScheme}
            {...(profileHref ? { profileHref } : {})}
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
        tabIndex={-1}
        style={{ position: "relative", flex: "1 1 auto", minHeight: 0, containerType: "size", outline: "none" }}
      >
        <Scene renderer={renderer} {...(attachRenderer ? { attachRenderer } : {})} />
        <RelationKey<S> />
        <QuickRelations<S> />
        {/* The altitude control, on the picture it controls. */}
        <OverviewButton />
        <Inspector />
      </main>
    </div>
  );
}
