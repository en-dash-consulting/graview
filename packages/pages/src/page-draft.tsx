import type { AnySchema } from "@graview/core";
import { DraftDoor } from "@graview/primitives/pages";
import { useGraviewIfAny, useSeatTalkState, createSeatTalk } from "@graview/react/provider";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageMain, PageTitle } from "./page-shell.js";
import type { PageContext } from "./pages.js";
import { recordPath } from "./registry.js";

/**
 * A VIEW THE SEAT DREW, AS A PAGE (`/~draft`): the main column holds it
 * under its one line — "Draft — Tasks by day · Keep as a lens · Discard" —
 * as the scene holds it over the picture. Kept, the face goes to its place;
 * put away, back to where the reader was.
 */
export function DraftPage<S extends AnySchema>({ context }: { readonly context: PageContext<S> }) {
  const navigate = useNavigate();
  const here = useGraviewIfAny<S>();
  const [none] = useState(() => createSeatTalk(null));
  const talk = useSeatTalkState(here?.seatTalk ?? none);
  const back = () => {
    // Where the reader came from, when this face took them here; else the home.
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) navigate(-1);
    else navigate("/");
  };
  return (
    <PageMain context={context} data-testid="draft-page">
      <PageTitle context={context} {...(talk.draft ? { "data-testid": "draft-title" } : {})}>
        {talk.draft ? talk.draft.title : "Nothing drawn"}
      </PageTitle>
      {talk.draft ? (
        <DraftDoor
          page
          go={(move) => navigate(move.address)}
          onPick={(id) => {
            const node = context.store.graph.getNode(id);
            if (node) navigate(recordPath(context.store.schema, node.kind as string, id));
          }}
          onDiscard={back}
        />
      ) : (
        <p style={{ margin: 0, color: "var(--graview-ink-muted)" }}>
          Ask for a way of seeing — “a board of tasks by status” — and it is drawn here.{" "}
          <Link to="/" style={{ color: "var(--graview-accent)" }}>
            Home →
          </Link>
        </p>
      )}
    </PageMain>
  );
}
