import { useContext, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type SyntheticEvent } from "react";
import { PageDoorContext, ViewContentHeight } from "./content-height.js";

interface ScenePreviewProps {
  /** The picture's name: its place's title, the kind's plural, or the record's label. */
  readonly title: string;
  /** What the card is of, said on it (`data-graview-preview`): its place's slug, or the record's id. */
  readonly name: string;
  /** Its page on Pages, where it has one — `/places/<as>`, or the record's page — which Open goes to. */
  readonly path?: string | undefined;
  /** The tallest the preview is drawn, in pixels (`scene.maxHeight`); the box the Scene gives it otherwise. */
  readonly maxHeight?: number | undefined;
  readonly children: ReactNode;
}

/**
 * A VIEW AS TALL AS WHAT IT DRAWS, ON THE SCENE (Roadmap f-view-content-height,
 * f-scene-record-view-card).
 *
 * A worker view flows on Pages: it is as long as it draws. On the Scene the
 * same view stood in its box as the whole of itself — a view of the members
 * sixty rows and three screens tall, spilling up under the bar and down past
 * every card around it; a view of one record held to its box and scrolling
 * inside it (FR-141), a page inside a picture. Here either is a card like
 * the Scene's other pictures: its title, as much of the view as fits — at
 * most what it drew, which is measured, at most the box the Scene gives it
 * and at most `maxHeight` — and, where there is more than that, the foot
 * fading into the card's own ground. Open goes to its page on Pages — the
 * place, or the record's page — where it is drawn whole. Nothing in it
 * scrolls.
 *
 * A host with no Pages (a Shell drawn without the embed's page door) has no
 * page to send a reader to: there the card is expanded in place instead, to
 * the height of what it drew — still nothing in it scrolls — and collapsed
 * again.
 */
export function ScenePreview({ title, name, path, maxHeight, children }: ScenePreviewProps) {
  const door = useContext(PageDoorContext);
  /* How tall the view's drawing is, as its host measured it; how tall all the card holds is; and how tall the card lets it be drawn. */
  const [content, setContent] = useState<number | undefined>(undefined);
  const [whole, setWhole] = useState<number | undefined>(undefined);
  const [shown, setShown] = useState<number | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const body = useRef<HTMLDivElement | null>(null);
  const drawn = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = body.current;
    const inner = drawn.current;
    if (!element || !inner || typeof ResizeObserver === "undefined") return;
    /* The layout's sizes, never the drawn box: the Scene's plane scales the box, not what the view drew. */
    const read = () => {
      setShown(element.clientHeight);
      setWhole(inner.offsetHeight || undefined);
    };
    read();
    const watch = new ResizeObserver(read);
    watch.observe(element);
    watch.observe(inner);
    return () => watch.disconnect();
  }, []);
  /* What the card holds: the view, as its host measured it, and whatever is drawn with it (a record's own fields, under its view). */
  const tall = Math.max(content ?? 0, whole ?? 0) || undefined;
  /* More than the card holds: a pixel's grace, so a rounding is not "more". */
  const more = !expanded && tall !== undefined && shown !== undefined && tall > shown + 1;
  const opens = door && path ? path : undefined;
  const href = opens && door?.href ? door.href(opens) : undefined;
  /* The card's own presses, not the Scene's: no selection under Open, no drag from it, no Enter taken for the card. */
  const keep = (event: SyntheticEvent) => event.stopPropagation();
  const own = {
    onPointerDown: keep,
    onDoubleClick: keep,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      /* Enter and Space are the control's own: they press it, and the card does not also take them as "choose me". */
      if (event.key !== "Enter" && event.key !== " ") return;
      keep(event);
      /* A link with no address is not clicked by Enter on its own: it is pressed here, as a link with one is. */
      if (event.key === "Enter" && event.currentTarget.tagName === "A" && !event.currentTarget.hasAttribute("href")) {
        event.preventDefault();
        event.currentTarget.click();
      }
    },
  };
  return (
    <section
      data-graview-preview={name}
      aria-label={title}
      /* Expanded, it is laid over the cards below it on purpose, as a panel is over the map: Escape collapses it before the Scene takes the key. */
      {...(expanded ? { "data-graview-expanded": "", "data-graview-overlay": "" } : {})}
      onKeyDown={
        expanded
          ? (event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              setExpanded(false);
            }
          : undefined
      }
      style={{ ...CARD, ...(expanded ? EXPANDED : {}) }}
    >
      <div style={HEAD}>
        <strong style={TITLE}>{title}</strong>
        {opens ? (
          <a
            data-graview-preview-open=""
            /* The page's address where the host's page has one; where it has none (an embed's memory routing), a link by its role and the keyboard. */
            {...(href ? { href } : { role: "link", tabIndex: 0 })}
            aria-label={`Open ${title}`}
            style={CONTROL}
            {...own}
            onClick={(event) => {
              keep(event);
              /* A new tab, where a person asked for one and the page has an address to give it. */
              if (href && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return;
              event.preventDefault();
              door?.open(opens);
            }}
          >
            Open
          </a>
        ) : more || expanded ? (
          /* No page to open it on: the card grows in place to what it drew, and back. */
          <button
            type="button"
            data-graview-preview-expand=""
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
            style={{ ...CONTROL, ...BUTTON }}
            {...own}
            onClick={(event) => {
              keep(event);
              setExpanded((was) => !was);
            }}
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        ) : null}
      </div>
      <div
        ref={body}
        data-graview-preview-body=""
        {...(content !== undefined ? { "data-graview-content-height": content } : {})}
        {...(more ? { "data-graview-more": "" } : {})}
        /* While the keyboard is in the view, a ring at its top or foot paints whole: the ring's reach past the body's edge, as the view's region lets it past its own. */
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...BODY, ...(maxHeight !== undefined && !expanded ? { maxHeight } : {}), ...(focused ? { overflowClipMargin: 4 } : {}) }}
      >
        <div ref={drawn} data-graview-preview-drawn="" style={DRAWN}>
          <ViewContentHeight.Provider value={setContent}>{children}</ViewContentHeight.Provider>
        </div>
        {/* There is more than the card holds: the foot fades into the card's ground, and Open — or Expand — is the way to the rest. */}
        {more ? <div aria-hidden="true" data-graview-preview-fade="" style={FADE} /> : null}
      </div>
    </section>
  );
}

/* The Scene's card, as a picture's panel is drawn there: the brand's radius, a lit edge, the plane's shadow. */
const CARD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--graview-gap, 7px)",
  width: "100%",
  maxHeight: "100%",
  minHeight: 0,
  padding: "var(--graview-pad, 15px)",
  boxSizing: "border-box",
  borderRadius: "var(--graview-radius, 12px)",
  border: "1px solid var(--graview-edge, #e4e0d8)",
  boxShadow: "var(--graview-lift-low)",
  background: "var(--graview-panel, #ffffff)",
  color: "var(--graview-ink, #1a1a1a)",
  overflow: "hidden",
};
/*
 * Expanded, the card is as tall as what it holds, from the top of its box down: its box centers what it holds, and a
 * card taller than the box centered in it would rise under the bar as much as it fell past the foot.
 */
const EXPANDED: CSSProperties = { maxHeight: "none", position: "absolute", top: 0, left: 0, right: 0, width: "auto" };
const HEAD: CSSProperties = { display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8, minWidth: 0, flex: "0 0 auto" };
const TITLE: CSSProperties = {
  fontFamily: "var(--graview-font-display, inherit)",
  fontSize: "0.9375rem",
  lineHeight: 1.25,
  fontWeight: 560,
  letterSpacing: "0.005em",
  minWidth: 0,
  overflowWrap: "anywhere",
};
const CONTROL: CSSProperties = {
  marginLeft: "auto",
  fontSize: "0.8125rem",
  fontWeight: 560,
  color: "var(--graview-accent, #2f6f5e)",
  textDecoration: "none",
  textUnderlineOffset: "0.2em",
};
/* Expand is a word, as Open is: the button's own ground, edge and type are not drawn. */
const BUTTON: CSSProperties = { font: "inherit", fontSize: "0.8125rem", fontWeight: 560, background: "none", border: 0, padding: 0, cursor: "pointer" };
/*
 * Held to what is left of the card, and clipped there — never a box that scrolls. A flex item clips only once its least
 * height is nothing. Clipped top and bottom only: the view's region clips its own sides, and a focus ring at its edge
 * stands in the card's padding rather than being cut by the body.
 */
const BODY: CSSProperties = { position: "relative", flex: "0 1 auto", minHeight: 0, overflowX: "visible", overflowY: "clip", minWidth: 0 };
/* What the view drew, at its own height: what the card measures to know whether there is more, and what Expand grows it to. */
const DRAWN: CSSProperties = { display: "flow-root", minWidth: 0 };
const FADE: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 48,
  pointerEvents: "none",
  background: "linear-gradient(to bottom, transparent, var(--graview-panel, #ffffff))",
};
