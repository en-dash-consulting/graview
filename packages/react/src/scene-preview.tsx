import { useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from "react";
import { PageDoorContext, ViewContentHeight } from "./content-height.js";

interface ScenePreviewProps {
  /** The picture's name: its place's title, or the kind's plural. */
  readonly title: string;
  /** Its place's slug (`placeSlug(title)`), where it is one: Open goes to `/places/<as>`. */
  readonly as?: string | undefined;
  /** The tallest the preview is drawn, in pixels (`scene.maxHeight`); the box the Scene gives it otherwise. */
  readonly maxHeight?: number | undefined;
  readonly children: ReactNode;
}

/**
 * A VIEW AS TALL AS WHAT IT DRAWS, ON THE SCENE (Roadmap f-view-content-height).
 *
 * A worker view of a kind's members flows on Pages: it is as long as it
 * draws. On the Scene the same view stood in its place's box as the whole
 * of itself — sixty rows, three screens tall, spilling up under the bar and
 * down past every card around it, with nothing drawn behind it. Here it is
 * a card like the Scene's other pictures: its title, as much of the view as
 * fits — at most its content height, which the host measures, at most the
 * box the Scene gives it and at most `maxHeight` — and, where there is more
 * than that, the foot fading into the card's own ground. Open goes to its
 * place on Pages, where it is drawn whole. Nothing in it scrolls.
 */
export function ScenePreview({ title, as, maxHeight, children }: ScenePreviewProps) {
  const door = useContext(PageDoorContext);
  /* How tall the view's drawing is, as its host measured it; and how tall the card lets it be drawn. */
  const [content, setContent] = useState<number | undefined>(undefined);
  const [shown, setShown] = useState<number | undefined>(undefined);
  const body = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = body.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const read = () => setShown(element.clientHeight);
    read();
    const watch = new ResizeObserver(read);
    watch.observe(element);
    return () => watch.disconnect();
  }, []);
  /* More than the card holds: a pixel's grace, so a rounding is not "more". */
  const more = content !== undefined && shown !== undefined && content > shown + 1;
  const path = as ? `/places/${as}` : undefined;
  const href = path && door?.href ? door.href(path) : undefined;
  /* The card's own presses, not the Scene's: no selection under Open, no drag from it, no Enter taken for the card. */
  const keep = (event: SyntheticEvent) => event.stopPropagation();
  return (
    <section data-graview-preview={as ?? ""} aria-label={title} style={CARD}>
      <div style={HEAD}>
        <strong style={TITLE}>{title}</strong>
        {door && path ? (
          <a
            data-graview-preview-open=""
            href={href ?? path}
            aria-label={`Open ${title}`}
            style={OPEN}
            onPointerDown={keep}
            onDoubleClick={keep}
            onKeyDown={(event) => {
              /* Enter is the link's own: it clicks it, and the card does not also take it as "choose me". */
              if (event.key === "Enter") keep(event);
            }}
            onClick={(event) => {
              keep(event);
              /* A new tab, where a person asked for one and the page has an address to give it. */
              if (href && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return;
              event.preventDefault();
              door.open(path);
            }}
          >
            Open
          </a>
        ) : null}
      </div>
      <div
        ref={body}
        data-graview-preview-body=""
        {...(content !== undefined ? { "data-graview-content-height": content } : {})}
        {...(more ? { "data-graview-more": "" } : {})}
        style={{ ...BODY, ...(maxHeight !== undefined ? { maxHeight } : {}) }}
      >
        <ViewContentHeight.Provider value={setContent}>{children}</ViewContentHeight.Provider>
        {/* There is more than the card holds: the foot fades into the card's ground, and Open is the way to the rest. */}
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
const OPEN: CSSProperties = {
  marginLeft: "auto",
  fontSize: "0.8125rem",
  fontWeight: 560,
  color: "var(--graview-accent, #2f6f5e)",
  textDecoration: "none",
  textUnderlineOffset: "0.2em",
};
/* Held to what is left of the card, and clipped there — never a box that scrolls. A flex item clips only once its least height is nothing. */
const BODY: CSSProperties = { position: "relative", flex: "0 1 auto", minHeight: 0, overflow: "clip", minWidth: 0 };
const FADE: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 48,
  pointerEvents: "none",
  background: "linear-gradient(to bottom, transparent, var(--graview-panel, #ffffff))",
};
