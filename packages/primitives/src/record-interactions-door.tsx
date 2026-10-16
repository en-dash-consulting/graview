import type { AiInteraction } from "@graview/core/catalog";
import { retryingImport } from "@graview/core/retry";
import { lazyModule, useAiDeskState, useGraview } from "@graview/react/provider";
import { Suspense, useEffect, useMemo, type ComponentType, type CSSProperties } from "react";
import type { RecordInteractionsProps } from "./record-interactions.js";

/**
 * WHAT AI DID ON A RECORD, ON ITS PAGE (Roadmap f-activity-ai-entries): the
 * interactions about it — asked of it, offering it, or making a change
 * that wrote it — as Activity draws them, with their undo. Nothing at all
 * while there are none, or when the host says AI is off; the rows are
 * fetched with the first.
 */
const rowsModule = /* @__PURE__ */ lazyModule(retryingImport(() => import("./record-interactions.js")));
const Rows = /* @__PURE__ */ rowsModule.part(
  (module, props: RecordInteractionsProps) => {
    const Drawn = module.RecordInteractions as ComponentType<RecordInteractionsProps>;
    return <Drawn {...props} />;
  },
  { quiet: true },
);

/** Whether an entry is about this record: its target names it, it offered it, or a batch it made wrote it. */
function about(entry: AiInteraction, id: string, written: (batch: string) => readonly string[]): boolean {
  const target = entry.target;
  const named = target.on === "record" || target.on === "field" ? target.id === id : target.on === "selection" ? target.ids.includes(id) : target.on === "act" ? target.id === id : false;
  return named || entry.offered.some((offer) => offer.id === `record:${id}` || offer.id.startsWith(`fill:${id}:`)) || (entry.batches ?? []).some((batch) => written(batch).includes(id));
}

export function RecordInteractionsDoor({ id, style, headingStyle, className }: { readonly id: string; readonly style?: CSSProperties; readonly headingStyle?: CSSProperties; readonly className?: string }) {
  const { ai, aiDesk, store } = useGraview();
  const { entries } = useAiDeskState(aiDesk);
  const off = ai.off === true;
  useEffect(() => {
    if (!off) aiDesk.load();
  }, [aiDesk, off]);
  const length = store.log.length;
  const here = useMemo(() => {
    const written = (batch: string) => store.log.all().flatMap((op) => (op.batch === batch ? op.writes : []));
    return entries.filter((entry) => about(entry, id, written));
    // The log only grows at its end: its length says when to read it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, id, store, length]);
  if (off || here.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <Rows entries={here} {...(style ? { style } : {})} {...(headingStyle ? { headingStyle } : {})} {...(className ? { className } : {})} />
    </Suspense>
  );
}
