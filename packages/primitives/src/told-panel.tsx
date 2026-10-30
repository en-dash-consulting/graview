import { layer, nameOfAuthor, seesId, type AnySchema, type Principal, type Store } from "@graview/core";
import {
  TELLING_OUTCOMES,
  TELLING_OUTCOME_WORDS,
  tellingDidWords,
  toldAfter,
  toldMatching,
  toldSeenBy,
  toldTeachingWords,
  type Telling,
  type TellingChange,
  type TellingOutcome,
  type ToldFilter,
  type ToldStore,
} from "@graview/core/told";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

/**
 * WHAT GRAVIEW HAS BEEN TOLD, IN THE STUDIO (Roadmap f-menu-learns): every
 * telling this app's host keeps (`HostAi.told`, `@graview/core/told`) that
 * the owner may see — a telling about a record hidden from them is not
 * listed — with its words, what it did, how it ended, its rating, who told
 * it, when, and how long it took; filtered by rating, outcome and kind.
 * From one an owner marks a good example, excludes it from suggestions, or
 * deletes it; the line at the top says what is teaching the system. Only
 * in the Studio, which only the app's owners and editors are offered.
 */
export function ToldPanel({ told, store, principal, onClose }: { readonly told: ToldStore; readonly store: Store<AnySchema>; readonly principal: Principal; readonly onClose: () => void }) {
  const [tellings, setTellings] = useState<readonly Telling[] | null>(null);
  const [filter, setFilter] = useState<ToldFilter>({});
  const panel = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.resolve()
      .then(() => told.list())
      .then((list) => live && setTellings(list), () => live && setTellings([]));
    panel.current?.focus({ preventScroll: true });
    return () => {
      live = false;
    };
  }, [told]);
  const seen = useMemo(() => (tellings ? toldSeenBy(tellings, seesId(store as never, principal)) : []), [tellings, store, principal]);
  const shown = useMemo(() => [...toldMatching(seen, filter)].sort((a, b) => (a.at < b.at ? 1 : -1)), [seen, filter]);
  const kinds = useMemo(() => [...new Set(seen.flatMap((one) => one.reading?.kind ?? one.target.kind ?? []))].sort(), [seen]);
  const titleOf = (act: string) => store.allMutations().find((one) => one.name === act)?.title ?? act;
  const plural = (kind: string) => (store.schema.tryDefinition(kind) as { plural?: string } | undefined)?.plural ?? kind;
  const who = (telling: Telling) => {
    try {
      return nameOfAuthor(telling.by, { graph: store.graph as never, schema: store.schema });
    } catch {
      return telling.by.id ?? telling.by.kind;
    }
  };
  const change = (id: string, with_: TellingChange) => {
    setTellings((list) => (list ? toldAfter(list, { change: id, with: with_ }) : list));
    void Promise.resolve()
      .then(() => told.change(id, with_))
      .catch(() => undefined);
  };
  const remove = (id: string) => {
    setTellings((list) => (list ? toldAfter(list, { remove: id }) : list));
    void Promise.resolve()
      .then(() => told.remove(id))
      .catch(() => undefined);
  };
  return (
    <section
      ref={panel}
      tabIndex={-1}
      data-testid="told-panel"
      data-graview-overlay=""
      aria-label="What Graview has been told"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
      style={PANEL}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, flex: "1 1 auto" }}>What Graview has been told</h2>
        <button type="button" data-testid="told-close" onClick={onClose} style={BUTTON}>
          Close
        </button>
      </div>
      <p data-testid="told-teaching" style={{ margin: 0, fontSize: "0.875rem", color: "var(--graview-ink-muted)" }}>
        {tellings === null ? "Reading what was told…" : toldTeachingWords(seen)}
      </p>
      <div role="group" aria-label="Show only" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: "0.8125rem" }}>
        <label style={FILTER}>
          Rating
          <select data-testid="told-filter-rating" value={filter.rating ?? ""} onChange={(event) => setFilter(({ rating: _drop, ...rest }) => (event.target.value ? { ...rest, rating: event.target.value as ToldFilter["rating"] } : rest))}>
            <option value="">Any</option>
            <option value="up">👍 Right</option>
            <option value="down">👎 Wrong</option>
            <option value="none">Not rated</option>
          </select>
        </label>
        <label style={FILTER}>
          Outcome
          <select data-testid="told-filter-outcome" value={filter.outcome ?? ""} onChange={(event) => setFilter(({ outcome: _drop, ...rest }) => (event.target.value ? { ...rest, outcome: event.target.value as TellingOutcome } : rest))}>
            <option value="">Any</option>
            {TELLING_OUTCOMES.map((outcome) => (
              <option key={outcome} value={outcome}>
                {TELLING_OUTCOME_WORDS[outcome]}
              </option>
            ))}
          </select>
        </label>
        <label style={FILTER}>
          Kind
          <select data-testid="told-filter-kind" value={filter.kind ?? ""} onChange={(event) => setFilter(({ kind: _drop, ...rest }) => (event.target.value ? { ...rest, kind: event.target.value } : rest))}>
            <option value="">Any</option>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {plural(kind)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {tellings !== null && shown.length === 0 ? (
        <p data-testid="told-none" style={{ margin: 0, fontSize: "0.875rem", color: "var(--graview-ink-muted)" }}>
          {seen.length === 0 ? "Nothing has been told here yet." : "Nothing told here fits these."}
        </p>
      ) : null}
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8, overflowY: "auto" }}>
        {shown.map((telling) => (
          <li key={telling.id} data-testid="told-entry" data-telling={telling.id} data-outcome={telling.outcome} data-rating={telling.rating ?? ""} data-excluded={telling.excluded ? "" : undefined} data-pinned={telling.pinned ? "" : undefined} style={ENTRY}>
            <p style={{ margin: 0, fontWeight: 550, overflowWrap: "anywhere" }}>“{telling.words}”</p>
            <p style={{ margin: 0, fontSize: "0.8125rem" }}>
              {tellingDidWords(telling, titleOf)} · {TELLING_OUTCOME_WORDS[telling.outcome]}
              {telling.rating ? ` · ${telling.rating === "up" ? "👍 right" : "👎 wrong"}` : ""}
              {telling.pinned ? " · a good example" : ""}
              {telling.excluded ? " · excluded from suggestions" : ""}
            </p>
            {telling.should ? <p style={{ margin: 0, fontSize: "0.8125rem", fontStyle: "italic" }}>Should have: {telling.should}</p> : null}
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
              {who(telling)} · <time dateTime={telling.at}>{new Date(telling.at).toLocaleString()}</time>
              {telling.ms !== undefined ? ` · ${telling.ms < 1000 ? `${telling.ms} ms` : `${(telling.ms / 1000).toFixed(1)} s`}` : ""}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button type="button" data-testid="told-pin" aria-pressed={telling.pinned === true} onClick={() => change(telling.id, { pinned: !telling.pinned })} style={BUTTON}>
                {telling.pinned ? "Not a good example" : "A good example"}
              </button>
              <button type="button" data-testid="told-exclude" aria-pressed={telling.excluded === true} onClick={() => change(telling.id, { excluded: !telling.excluded })} style={BUTTON}>
                {telling.excluded ? "Suggest it again" : "Exclude from suggestions"}
              </button>
              <button type="button" data-testid="told-delete" onClick={() => remove(telling.id)} style={BUTTON}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const PANEL: CSSProperties = {
  position: "absolute",
  insetBlock: "60px 12px",
  insetInlineEnd: 12,
  width: "min(440px, calc(100% - 24px))",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 14,
  borderRadius: 12,
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-float)",
  color: "var(--graview-ink)",
  boxShadow: "var(--graview-lift-high)",
  // Over the studio's own picture, under nothing else the dialog holds.
  zIndex: layer("popover"),
  overflow: "hidden",
};
const ENTRY: CSSProperties = { display: "grid", gap: 4, padding: 10, borderRadius: 10, border: "1px solid var(--graview-edge)", background: "var(--graview-panel)" };
const BUTTON: CSSProperties = { padding: "2px 10px", minHeight: 28, font: "inherit", fontSize: "0.8125rem", borderRadius: 8 };
const FILTER: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4 };
