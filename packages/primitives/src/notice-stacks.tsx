import { layer } from "@graview/core";
import { inTopLayer, raiseOverPopovers } from "@graview/react/provider";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).
import { FOOT_MOVED, placeAtTheFoot, placeAtTheTop } from "./notice-place.js";
import type { HeldNotice, NoticeBoard, NoticeTone } from "./notices.js";

/**
 * THE NOTICES, DRAWN (FR-75, FR-133): banners at the top of the picture they
 * are about, toasts at its foot, in the top layer. Fetched with the first
 * notice a page holds (`Notices`, in `notices.tsx`, says each aloud).
 */
export function NoticeStacks({ notices, anchor, board }: { readonly notices: readonly HeldNotice[]; readonly anchor: () => HTMLElement | null; readonly board: NoticeBoard }) {
  return (
    <>
      <Stack notices={notices.filter((one) => one.kind === "banner")} at="top" anchor={anchor} board={board} />
      <Stack notices={notices.filter((one) => one.kind === "toast")} at="foot" anchor={anchor} board={board} />
    </>
  );
}

const TONE: Record<NoticeTone, string> = {
  info: "var(--graview-accent)",
  good: "var(--graview-good)",
  warn: "var(--graview-warn)",
  bad: "var(--graview-bad)",
};

/** A stack of notices in the top layer, placed at the top or the foot of the picture it is about. */
function Stack({ notices, at, anchor, board }: { readonly notices: readonly HeldNotice[]; readonly at: "top" | "foot"; readonly anchor: () => HTMLElement | null; readonly board: NoticeBoard }) {
  const pane = useRef<HTMLDivElement | null>(null);
  const shown = notices.length > 0;
  useLayoutEffect(() => {
    const element = pane.current;
    if (!shown || !element) return;
    if (typeof element.showPopover === "function" && !inTopLayer(element)) {
      try {
        element.showPopover();
      } catch {
        // The toast rung holds it over every rail where the top layer is not there.
      }
    }
    const place = () => (at === "top" ? placeAtTheTop : placeAtTheFoot)(element, anchor());
    place();
    // Held while pointed at or in the keyboard's hands: no toast goes from under either (FR-152).
    if (at === "foot") board.hold?.(() => element.matches(":hover, :focus-within"));
    const unraise = raiseOverPopovers(element);
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    // Placed again when what stands at the foot comes, moves or goes, and when a notice joins the stack.
    if (at === "foot") addEventListener(FOOT_MOVED, place);
    const grows = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    grows?.observe(element);
    return () => {
      unraise();
      grows?.disconnect();
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
      removeEventListener(FOOT_MOVED, place);
      if (element.isConnected && inTopLayer(element)) {
        try {
          element.hidePopover();
        } catch {
          // Gone already.
        }
      }
    };
  }, [shown, at, anchor, board]);
  if (!shown) return null;
  return (
    <div
      ref={pane}
      popover="manual"
      role="region"
      aria-label={at === "top" ? "Notices" : "Messages"}
      data-testid={at === "top" ? "notices-banners" : "notices-toasts"}
      data-graview-offstage=""
      style={{
        position: "fixed",
        inset: "auto",
        margin: 0,
        padding: 0,
        border: "none",
        background: "none",
        overflow: "visible",
        zIndex: layer("toast"),
        width: "max-content",
        // Its own height: under the popover's `fit-content`, WebKit stands a grid as tall as the screen.
        height: "auto",
        maxWidth: "min(560px, calc(100vw - 32px))",
        display: "grid",
        gap: 8,
        color: "var(--graview-ink)",
      }}
    >
      {notices.map((notice) => (
        <NoticeCard key={notice.id} notice={notice} board={board} />
      ))}
    </div>
  );
}

/** "Meta+Z Control+Z" as a person reads it: "⌘Z or Ctrl+Z". */
const keysSaid = (keys: string) =>
  keys
    .split(/\s+/)
    .filter(Boolean)
    .map((key) => key.replace(/^Meta\+/, "⌘").replace(/^Control\+/, "Ctrl+").replace(/^Alt\+/, "Alt+"))
    .join(" or ");

function NoticeCard({ notice, board }: { readonly notice: HeldNotice; readonly board: NoticeBoard }) {
  const tone = notice.tone ?? "info";
  const acts = [...(notice.action ? [notice.action] : []), ...(notice.actions ?? [])];
  const close = () => board.dismiss(notice.id);
  return (
    <div
      data-testid="notice"
      data-kind={notice.kind}
      data-tone={tone}
      style={{
        boxSizing: "border-box",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 12px",
        padding: notice.kind === "banner" ? "8px 10px 8px 14px" : "10px 12px 10px 14px",
        borderRadius: "var(--graview-radius, 12px)",
        borderTop: "1px solid var(--graview-edge)",
        borderRight: "1px solid var(--graview-edge)",
        borderBottom: "1px solid var(--graview-edge)",
        borderLeft: `3px solid ${TONE[tone]}`,
        background: "var(--graview-float)",
        boxShadow: "var(--graview-lift-high)",
        fontSize: "0.875rem",
        lineHeight: 1.45,
      }}
    >
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, flex: "0 0 auto", background: TONE[tone] }} />
      <span style={{ flex: "1 1 16rem", minWidth: 0 }}>{notice.sentence}</span>
      {acts.length > 0 ? (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {acts.map((act, index) =>
            act.href !== undefined ? (
              <a
                key={act.label}
                href={act.href}
                {...(act.target ? { target: act.target, rel: "noopener" } : {})}
                data-testid="notice-action"
                onClick={() => {
                  act.onSelect?.();
                  close();
                }}
                style={{ ...ACT, ...(index === 0 ? FIRST : {}) }}
              >
                {act.label}
              </a>
            ) : (
              <button
                key={act.label}
                type="button"
                data-testid="notice-action"
                {...(act.keys ? { "aria-keyshortcuts": act.keys, title: `${act.label} — ${keysSaid(act.keys)}` } : {})}
                onClick={() => {
                  close();
                  act.onSelect?.();
                }}
                style={{ ...ACT, ...(index === 0 ? FIRST : {}) }}
              >
                {act.label}
              </button>
            ),
          )}
        </span>
      ) : null}
      <button type="button" data-testid="notice-dismiss" aria-label={`Dismiss: ${notice.sentence}`} title="Dismiss" onClick={close} style={DISMISS}>
        ×
      </button>
    </div>
  );
}

const ACT: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "2px 12px",
  borderRadius: 9,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  font: "inherit",
  fontWeight: 500,
  textDecoration: "none",
  cursor: "pointer",
};

/** The first act is the one the notice asks for. */
const FIRST: CSSProperties = { background: "var(--graview-accent)", borderColor: "var(--graview-accent)", color: "var(--graview-accent-ink)" };

const DISMISS: CSSProperties = {
  minWidth: 28,
  minHeight: 28,
  padding: 0,
  border: "none",
  background: "none",
  boxShadow: "none",
  color: "var(--graview-ink-muted)",
  fontSize: "1rem",
  cursor: "pointer",
};

