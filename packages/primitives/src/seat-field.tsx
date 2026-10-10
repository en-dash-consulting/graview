import { layer, type AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { lazyModule, useGraview, useSeatTalkState } from "@graview/react/provider";
import type { Responder, ToolCall } from "@graview/tools";
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { FOOT_MOVED } from "./notice-place.js";
import { VISUALLY_HIDDEN } from "./primitives/measure.js";
import type { SeatPanelProps } from "./seat-panel.js";

/**
 * THE SEAT FLOATS, AND IS QUIET.
 *
 * It was a rail down the scene's left edge — "SELECTED · Pay the deposit",
 * nine acts with nine stars, a filter field, "Show 1 more", three canned
 * questions, the relations, a log, the key to the lines — and on Pages a
 * "◆ Ask" pill that opened the same rail as a drawer, beside the record
 * page's own acts. A person read it as everything that could be done with
 * the selected thing, in the mutations' own words.
 *
 * Now it is one quiet field at the foot of the picture, "Ask Things…",
 * the Find box's geometry and nothing more. Asked, it grows up from the
 * field into a panel over the picture — never pushing the page — that says
 * where you are in a line, offers a few things to ask and at most three
 * acts, and holds the conversation. A ⇄ snaps it to the other foot; on a
 * phone it is a bottom sheet with a grab line to put it away. The same
 * seat on the scene and on Pages, holding the app's one conversation.
 *
 * This file is what a page carries up front: the field. The panel —
 * the conversation, the models behind it, what it offers — is fetched when
 * the seat is first opened (or reached for), from `./seat-panel.js`.
 *
 * Accessible as a non-modal region named "Ask <the app>": opening it puts
 * the keyboard in the field, Escape closes it and puts the keyboard back
 * where it was, and everything in it is an ordinary button or link in the
 * tab order. The person never reads the word "seat".
 */

/** The seat is drawn as an ask field, or not at all (the host's choice). */
export type SeatStart = "field" | "hidden";

export interface SeatFieldProps<S extends AnySchema> {
  /** How the seat answers; when unsaid, the graph first and the host's model (`ai` on the provider) after it. */
  readonly respond?: Responder<S>;
  /** Feeds the app's activity rail, like any other seat. */
  readonly onCall?: (call: ToolCall) => void;
  /** Where a name in an answer goes: the scene's own travel when unsaid; a record's page on Pages. */
  readonly onPick?: (id: string) => void;
  /** `"field"` (the default) draws the ask field; `"hidden"` draws no seat at all. */
  readonly start?: SeatStart;
  /** Where an answer takes the app: the router on Pages; the scene's own stops when unsaid. */
  readonly onMove?: SeatPanelProps["onMove"];
  /** The place the reader stands in, by its slug, when the face knows it (Pages' route). */
  readonly place?: string;
  /** A view was drawn: the face shows it (Pages goes to `/~draft`). */
  readonly onDraft?: () => void;
}

/** The field's width on a desk, and the gap between it and the picture's edges. */
export const SEAT_WIDTH = 336;
const GAP = 16;
/** Narrower than this the seat is a field across the foot, and a bottom sheet when open. */
export const SEAT_PHONE_BELOW = 640;

const panelModule = lazyModule(retryingImport(() => import("./seat-panel.js")));
const Panel = panelModule.part(
  (module, props: SeatPanelProps) => {
    const Drawn = module.SeatPanel as ComponentType<SeatPanelProps>;
    return <Drawn {...props} />;
  },
  { what: "The conversation" },
);

/**
 * The seat, at the foot of the box it is drawn in — the scene's picture, or
 * on Pages a box the routed face lays over the window (or its embed).
 */
export function SeatField<S extends AnySchema>({ respond, onCall, onPick, start = "field", onMove, place, onDraft }: SeatFieldProps<S>) {
  const { brand, seatTalk } = useGraview<S>();
  const talk = useSeatTalkState(seatTalk);
  const name = brand?.name?.trim() || "this app";
  const region = useRef<HTMLElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");
  const [phone, setPhone] = useState(false);
  /* Where the keyboard was before it came into the seat: where Escape puts it back. */
  const cameFrom = useRef<HTMLElement | null>(null);
  const hidden = start === "hidden";
  const open = talk.open && !hidden;

  /* Drawn: Find offers "Ask:" where a seat is. */
  useEffect(() => (hidden ? undefined : seatTalk.drawn()), [seatTalk, hidden]);

  /* A PHONE'S SEAT is a field across the foot, measured from the box it is drawn in, not the window. */
  useLayoutEffect(() => {
    const box = region.current?.parentElement;
    if (!box) return;
    const measure = () => setPhone(box.getBoundingClientRect().width < SEAT_PHONE_BELOW);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure);
    watch.observe(box);
    return () => watch.disconnect();
  }, [hidden]);

  /* What stands above the foot — a notice — places itself again when the seat grows, shrinks or moves. */
  useEffect(() => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(FOOT_MOVED));
  }, [open, talk.side, phone]);

  /*
   * THE END OF A PAGE SCROLLS CLEAR OF THE FIELD. The field stands over the
   * page's foot, and on a phone it covered a list's last row however far
   * the page scrolled. Closed, it says how much room it takes from the
   * bottom — its height, where it stands, and a gutter — as
   * `--graview-foot-room` on the embed (or the page), and a page that ends
   * under it pads its end by that much (`PageMain`, an app's own main).
   */
  useEffect(() => {
    const element = region.current;
    if (hidden || open || !element || typeof window === "undefined") return;
    const holder = (element.closest<HTMLElement>("[data-graview-embed]") ?? document.documentElement).style;
    const measure = () => {
      const box = element.getBoundingClientRect();
      const frame = element.offsetParent?.getBoundingClientRect();
      const from = frame ? frame.bottom - box.top : box.height + GAP;
      holder.setProperty("--graview-foot-room", `${Math.max(0, Math.round(from + GAP))}px`);
    };
    measure();
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    watch?.observe(element);
    return () => {
      watch?.disconnect();
      holder.removeProperty("--graview-foot-room");
    };
  }, [hidden, open, phone, talk.side]);

  /* ASKED FROM ELSEWHERE (Find's "Ask:" row): the keyboard comes to the field, so the reader can go on. */
  useEffect(() => {
    if (!open || talk.pending === null) return;
    remember();
    field.current?.focus({ preventScroll: true });
  }, [open, talk.pending]);

  const remember = () => {
    const at = typeof document === "undefined" ? null : document.activeElement;
    if (at instanceof HTMLElement && at !== document.body && !region.current?.contains(at)) cameFrom.current = at;
  };
  const openIt = () => {
    remember();
    panelModule.prefetch();
    seatTalk.setOpen(true);
  };
  const close = () => {
    seatTalk.setOpen(false);
    const back = cameFrom.current;
    cameFrom.current = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
    // Gone, or no longer something the keyboard can stand on (a view drawn over it): the field keeps it.
    if (document.activeElement !== back) field.current?.focus({ preventScroll: true });
  };

  if (hidden) return null;
  const right = !phone && talk.side === "right";
  const style: CSSProperties = phone
    ? open
      ? { left: 0, right: 0, bottom: 0, padding: `8px 12px calc(12px + env(safe-area-inset-bottom, 0px))`, borderRadius: "12px 12px 0 0", ...OPEN_BOX }
      : { left: GAP, right: GAP, bottom: `calc(${GAP}px + env(safe-area-inset-bottom, 0px))` }
    : open
      ? /* The box around the field, so the field itself stays where it stood: its padding and hairline outside it. */
        { [right ? "right" : "left"]: GAP / 2 - 1, bottom: GAP / 2 - 1, width: SEAT_WIDTH + GAP + 2, padding: GAP / 2, borderRadius: 12, ...OPEN_BOX }
      : { [right ? "right" : "left"]: GAP, bottom: GAP, width: SEAT_WIDTH };
  return (
    <section
      ref={region}
      role="region"
      aria-label={`Ask ${name}`}
      data-testid="seat"
      data-graview-seat={open ? "open" : "closed"}
      data-graview-seat-side={right ? "right" : "left"}
      data-graview-seat-shape={phone ? "phone" : "desk"}
      // At the foot: a notice placed there stands above it, or beside it when it is open (FR-133).
      data-graview-foot=""
      // Chrome, not scene: no line is ever anchored to what this repeats.
      data-graview-offstage=""
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        // The seat's Escape is the seat's: the scene's back-out does not hear it too.
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
      style={{
        position: "absolute",
        zIndex: layer("rail"),
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "auto",
        ...style,
      }}
    >
      {/* A HEADING FOR THE REGION (FR-25): a reader moving by headings finds the seat, named as its region is. */}
      <h2 style={{ ...VISUALLY_HIDDEN, margin: 0 }}>Ask {name}</h2>
      {open ? (
        <Suspense fallback={null}>
          <Panel
            phone={phone}
            side={right ? "right" : "left"}
            name={name}
            onClose={close}
            {...(respond ? { respond: respond as unknown as SeatPanelProps["respond"] } : {})}
            {...(onCall ? { onCall } : {})}
            {...(onPick ? { onPick } : {})}
            {...(onMove ? { onMove } : {})}
            {...(place ? { place } : {})}
            {...(onDraft ? { onDraft } : {})}
          />
        </Suspense>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const asked = draft.trim();
          if (!open) openIt();
          if (!asked || talk.busy) return;
          seatTalk.ask(asked);
          setDraft("");
        }}
        style={{ display: "flex", margin: 0 }}
      >
        <input
          ref={field}
          data-testid="seat-field"
          type="text"
          enterKeyHint="send"
          autoComplete="off"
          value={draft}
          placeholder={`Ask ${name}…`}
          aria-label={`Ask ${name}`}
          onPointerEnter={() => panelModule.prefetch()}
          onFocus={() => panelModule.prefetch()}
          onClick={() => {
            if (!open) openIt();
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            if (!open) openIt();
          }}
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            boxSizing: "border-box",
            height: 38,
            padding: "0 12px",
            font: "inherit",
            fontSize: "0.9375rem",
            color: "var(--graview-ink)",
            background: "var(--graview-panel)",
            border: "1px solid var(--graview-edge)",
            borderRadius: 8,
          }}
        />
      </form>
    </section>
  );
}

/** The open seat: the floating panel's ground, a hairline, and the lift that says it is over the picture. */
const OPEN_BOX: CSSProperties = {
  background: "var(--graview-float)",
  border: "1px solid var(--graview-edge)",
  boxShadow: "var(--graview-lift-high)",
};
