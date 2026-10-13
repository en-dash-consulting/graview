import { KEEP_LINK, type AnySchema, type LinkProvenance, type Principal, type Store } from "@graview/core";
import { provenanceWords } from "@graview/core/provenance";
import { failureWords } from "@graview/core/words";
import { useState } from "react";
import { button, quiet } from "./page-typography.js";

/**
 * A LINK MADE LESS THAN SURE, MARKED ON THE PAGE (FR-172). A small mark
 * beside the name says the link is not yet kept by a person; its title says
 * who made it and what it was based on, on hover, and pressing it — a tap
 * where there is no hover — says the same in place, with "Keep this link"
 * beside it. Kept, the mark is gone: the store says the link is ordinary.
 */
export function ProvisionalMark<S extends AnySchema>({
  store,
  link,
  principal,
}: {
  readonly store: Store<S>;
  readonly link: LinkProvenance;
  readonly principal?: Principal;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const said = provenanceWords(link);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button
        type="button"
        data-graview-provisional=""
        title={said}
        aria-label={`Unsure link: ${said}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{
          border: "1px dashed var(--graview-ink-muted)",
          borderRadius: 999,
          background: "transparent",
          color: "var(--graview-ink-muted)",
          font: "inherit",
          fontSize: "0.75rem",
          lineHeight: 1,
          padding: "2px 6px",
          cursor: "pointer",
        }}
      >
        unsure
      </button>
      {open ? (
        <span style={{ ...quiet, display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{said}</span>
          <button
            type="button"
            style={{ ...button, padding: "4px 10px" }}
            onClick={() => {
              try {
                store.apply({ name: KEEP_LINK, args: { kind: link.edge.kind, from: link.edge.from, to: link.edge.to } }, principal ? { author: principal } : {});
                setOpen(false);
              } catch (error) {
                setFailed(failureWords(store.schema, store.allMutations(), error));
              }
            }}
          >
            Keep this link
          </button>
          {failed ? <span role="alert">{failed}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
