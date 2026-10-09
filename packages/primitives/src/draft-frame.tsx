import { isCurrent, layer, type AnySchema } from "@graview/core";
import { ViewBoundary } from "@graview/react/drawing";
import { useGraph, useGraview, useSeatTalkState } from "@graview/react/provider";
import type { SeatMove } from "@graview/tools";
import { useEffect, useState, type CSSProperties } from "react";
import { LINK } from "./chat.js";
import { declaredLensView } from "./declared-lenses.js";
import { useLensKeeping } from "./lens-keeping.js";
import { problemsShown, useSceneGo } from "./seat-move.js";

/**
 * A VIEW THE SEAT DREW, IN PLACE OF THE PICTURE — fetched when the seat
 * first draws one (`draft-door.tsx`).
 *
 * Under one hairline line, "Draft — Tasks by day · Keep as a lens ·
 * Discard", the drawn lens itself: live on the app's data as the reader
 * may see it, drawn by the same factory a declared lens is, so it can
 * write nothing but through the acts the app declares. Asking again
 * replaces it; an ask that cannot be drawn says why on a line under it and
 * the last good one stays. On the scene it stands over the picture, under
 * the seat; on Pages it is the main column at `/~draft`.
 */

export interface DraftFrameProps {
  /** Drawn as a page's main column (Pages' `/~draft`) rather than over the scene's picture. */
  readonly page?: boolean;
  /** How the face goes somewhere: the router on Pages; the scene's own stops when unsaid. */
  readonly go?: (move: SeatMove) => void;
  /** Where a record pressed in the draft goes: its page on Pages; on the scene, focused. */
  readonly onPick?: (id: string) => void;
  /** Put away: on Pages, back to where the reader was. */
  readonly onDiscard?: () => void;
}

export function DraftFrame({ page = false, go, onPick, onDiscard }: DraftFrameProps) {
  const { store, seatTalk } = useGraview<AnySchema>();
  const talk = useSeatTalkState(seatTalk);
  const sceneGo = useSceneGo();
  const goes = go ?? sceneGo;
  const { keep } = useLensKeeping(goes);
  const [keeping, setKeeping] = useState(false);
  // The draft is live: drawn again as the graph changes.
  useGraph();
  const draft = talk.draft;
  // A draft that was kept or put away while a press was on its way: the press is over.
  useEffect(() => setKeeping(false), [draft]);
  // Over the scene, the view is what the reader asked to see: a list of problems left open over it is put away.
  useEffect(() => {
    if (!page) problemsShown(false);
  }, [page]);
  if (!draft) return null;
  const View = declaredLensView(draft.drawn);
  const definition = store.schema.tryDefinition(draft.kind);
  const nodes = store.graph.nodesOfKind(draft.kind as never).filter((node) => isCurrent(definition, node));
  const discard = () => {
    seatTalk.setDraft(null);
    onDiscard?.();
  };
  return (
    <section
      data-testid="draft-frame"
      aria-label={`Draft: ${draft.title}`}
      style={
        page
          ? { display: "grid", gap: 12, minWidth: 0 }
          : { position: "absolute", inset: 0, zIndex: layer("rail"), display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr)", background: "var(--graview-ground, var(--graview-panel))", minHeight: 0 }
      }
    >
      <p data-testid="draft-line" style={{ ...LINE, ...(page ? {} : { padding: "10px 16px" }) }}>
        {page ? (
          /* On a page the title is the page's own heading: the line says only what it is. */
          <span>Draft</span>
        ) : (
          <span>
            Draft — <span data-testid="draft-title" style={{ color: "var(--graview-ink)", fontWeight: 600 }}>{draft.title}</span>
          </span>
        )}
        <span aria-hidden="true">·</span>
        <button
          type="button"
          data-testid="draft-keep"
          disabled={keeping}
          title={`Keep “${draft.title}” as a lens: a place of its own`}
          onClick={() => {
            setKeeping(true);
            void keep(draft).finally(() => setKeeping(false));
          }}
          style={LINK}
        >
          Keep as a lens
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" data-testid="draft-discard" onClick={discard} style={LINK}>
          Discard
        </button>
      </p>
      {talk.draftNote ? (
        <p data-testid="draft-note" role="status" style={{ margin: 0, padding: page ? 0 : "0 16px 8px", fontSize: "0.8125rem", color: "var(--graview-warn)" }}>
          {talk.draftNote}
        </p>
      ) : (
        <span />
      )}
      <div
        data-testid="draft-lens"
        data-graview-draft={draft.lens.name}
        style={page ? { height: "min(72vh, 760px)", display: "grid", gridTemplateRows: "minmax(0, 1fr)", overflow: "auto", scrollbarGutter: "stable", border: "1px solid var(--graview-edge)", borderRadius: 12, background: "var(--graview-panel)" } : { minHeight: 0, overflow: "auto", scrollbarGutter: "stable", display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}
        onClick={(event) => {
          const id = (event.target as HTMLElement | null)?.closest("[data-graview-pick]")?.getAttribute("data-graview-pick");
          if (!id || !store.graph.getNode(id)) return;
          event.preventDefault();
          const node = store.graph.getNode(id)!;
          if (onPick) {
            seatTalk.setDraft(null);
            onPick(id);
          } else goes({ to: "record", id, kind: node.kind as string, label: id, address: "", said: "" });
        }}
      >
        <ViewBoundary kind={draft.kind} view={draft.title}>
          <View nodes={nodes} label={draft.title} fidelity="full" cardinality="many" mode="fullscreen" selected={false} />
        </ViewBoundary>
      </div>
    </section>
  );
}

/** The one line over a draft: what it is, and the two things to do with it. A hairline under it, nothing more. */
const LINE: CSSProperties = {
  margin: 0,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: "4px 8px",
  fontSize: "0.875rem",
  color: "var(--graview-ink-muted)",
  borderBottom: "1px solid var(--graview-edge)",
  paddingBottom: 8,
};
