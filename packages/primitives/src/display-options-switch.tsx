import { isCurrent, isoToday, type AnySchema, type DisplayChoice, type GraviewApp } from "@graview/core";
import { ViewBoundary } from "@graview/react/drawing";
import { useGraph, useGraview } from "@graview/react/provider";
import { draftSight } from "@graview/tools/draft";
import { inlineAiOn } from "@graview/tools/frame";
import { documentOfApp } from "@graview/tools/reshape";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { DraftBar } from "./better-bar.js";
import { declaredLensView } from "./declared-lenses.js";
import { createOptionSwitch, displayOptionsFor, modelOption, namesOfRecords, optionOfOffer, readChoices, type DisplayOption, type OptionsInput, type OptionSwitch } from "./display-options.js";
import { appKeyOf } from "./reader-lenses.js";
import type { SectionAsk } from "./section-menu.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * OTHER WAYS TO SHOW THIS, DRAWN (Roadmap f-display-options-switch), fetched
 * as the menu that offers it is prepared.
 *
 * DRAWN AHEAD. Every option is drawn at once, in real data, in a stage under
 * the page's heading, each stacked on the others and out of sight: flipping
 * lights one and puts out another, and nothing is drawn or fetched at the
 * flip. What a drawing could not show of the records is dropped before
 * anybody is offered it, so a draft is checked before it is shown.
 *
 * NOTHING IS WRITTEN UNTIL IT IS KEPT. An option is a picture to look at
 * and no more (`inert`): a card on a board cannot be carried to another
 * column in a draft of a board. The page as it stands is the first of the
 * options, one arrow from any other, so before and after are side by side
 * in the same place. Keep hands the host one change, with one Undo after.
 */

/** What a switch asked for is at, kept apart from what draws it: a host that hands the page a changed app may draw it all again, and this with it. */
const SWITCHES = /* @__PURE__ */ new Map<number, { readonly flips: OptionSwitch; opened: boolean }>();

/** The page's own region inside the face: its <main>, never the app's bar and footer around it. */
const regionOf = (face: Element | null | undefined): Element | null => face?.querySelector("main") ?? face ?? null;
const pageNow = (part: { readonly main: Element | null }): Element | null => regionOf(part.main?.isConnected ? part.main : (document.querySelector("[data-graview-page-main], main") ?? document.querySelector("[data-graview-face]")));

/** What stays over the option: the page's heading. A page with none has the stage first. */
function headOf(region: Element): Element | null {
  const title = region.querySelector("[data-graview-page-title]");
  const head = title?.closest("header") ?? title?.parentElement ?? null;
  return head && head !== region && region.contains(head) ? head : null;
}

const UNDER = "data-graview-under-option";
/* A place's page stands in the wider column: the option is shown as wide as it would be kept. */
const WIDE = "data-graview-option-wide";
const NOW = "__now__";

/** The picture of one option, live on the app's data, drawn whether it is shown or not; it tells when it first shows any of the records. */
const OptionPane = memo(function OptionPane({ option, shown, names, nodes, drew, failed }: { readonly option: DisplayOption; readonly shown: boolean; readonly names: readonly string[]; readonly nodes: readonly never[]; readonly drew: (key: string) => void; readonly failed: (key: string) => void }) {
  const at = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (inner.current) inner.current.inert = true;
  }, []);
  /* Judged as it draws: the option that never shows one of the records is taken away. A lens may draw in a moment or two, not longer. */
  useLayoutEffect(() => {
    const shows = () => {
      const text = (at.current?.textContent ?? "").toLowerCase();
      return names.some((name) => text.includes(name.toLowerCase()));
    };
    if (shows()) return drew(option.key);
    const times = [100, 400, 1500].map((ms, index, all) =>
      setTimeout(() => {
        if (shows()) drew(option.key);
        else if (index === all.length - 1) failed(option.key);
      }, ms),
    );
    return () => times.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option.key]);
  const View = useMemo(() => declaredLensView(option.drawn), [option.drawn]);
  const flows = option.drawn.lens === "blocks";
  return (
    <div ref={at} data-testid="display-option-pane" data-display-option={option.key} data-shown={shown ? "" : undefined} style={{ ...(flows ? PANE_FLOWS : PANE), ...(shown ? {} : PANE_OFF) }}>
      <div ref={inner} style={flows ? undefined : INNER}>
        <ViewBoundary kind={option.drawn.kinds[0] ?? ""} view={option.title}>
          <View nodes={nodes} label={option.title} fidelity="full" cardinality="many" mode="fullscreen" selected={false} />
        </ViewBoundary>
      </div>
    </div>
  );
});

/** Every option, drawn ahead, in the stage under the heading. */
function Stage({ options, shown, names, drew, failed, kind }: { readonly options: readonly DisplayOption[]; readonly shown: string | null; readonly names: readonly string[]; readonly drew: (key: string) => void; readonly failed: (key: string) => void; readonly kind: string }) {
  const { store } = useGraview<AnySchema>();
  // Live: drawn again as the graph changes, as what is kept would be.
  useGraph();
  const definition = store.schema.tryDefinition(kind);
  const nodes = store.graph.nodesOfKind(kind as never).filter((node) => isCurrent(definition, node)) as unknown as readonly never[];
  return (
    <>
      <style>{`[${UNDER}]{display:none !important}[${WIDE}]{max-width:1160px !important}`}</style>
      {options.map((option) => (
        <OptionPane key={option.key} option={option} shown={option.key === shown} names={names} nodes={nodes} drew={drew} failed={failed} />
      ))}
    </>
  );
}

export function DisplaySwitch({ ask, close }: { readonly ask: Extract<SectionAsk, { part: object }>; readonly close: () => void }) {
  const here = useGraview<AnySchema>();
  const { ai, app, brand, composeChange, displayOptions: host, onProposeChange, principal, store } = here;
  const part = ask.part;
  const kind = part.kind!;
  const appKey = appKeyOf(brand, store.schema);
  const nodesOf = () => store.graph.nodesOfKind(kind as never).filter((node) => isCurrent(store.schema.tryDefinition(kind), node));
  const [names] = useState(() => namesOfRecords(store.schema, kind, nodesOf() as never));
  const [held] = useState(() => {
    const had = SWITCHES.get(ask.at);
    if (had) return had;
    const declared = { ...(app as object), schema: store.schema } as GraviewApp<AnySchema>;
    const input: OptionsInput = {
      app: declared,
      document: documentOfApp(app ?? {}),
      compose: composeChange,
      kind,
      name: part.name,
      nodes: nodesOf() as never,
      today: store.today() ?? isoToday(),
      sight: draftSight(declared, principal),
      linked: (id, edge) => store.graph.outEdges(id).some((one) => one.kind === edge),
      ...(part.slot === "place" ? { place: part.name } : {}),
    };
    const choices: readonly DisplayChoice[] = [...readChoices(appKey), ...(host?.chosen?.() ?? [])];
    const asked = { kind, name: part.name, ...(part.slot === "place" ? { place: part.name } : {}) };
    const offers = host?.offers?.(asked);
    const flips = createOptionSwitch({
      options: displayOptionsFor({ ...input, choices, ...(Array.isArray(offers) ? { offers: offers as never } : {}) }),
      name: part.name,
      kind,
      appKey,
      propose: (proposal) => onProposeChange!(proposal),
      ...(host?.onChoice ? { onKept: host.onChoice } : {}),
    });
    /* What is slower than the first draw joins when it answers, and what is shown does not move: a host's promise, a model the host lent. */
    if (offers && !Array.isArray(offers)) void (offers as Promise<readonly never[]>).then((late) => flips.join(late.flatMap((offer) => optionOfOffer(input, offer) ?? []))).catch(() => {});
    if (inlineAiOn(ai)) {
      const thinking = ai.thinking;
      const complete = thinking ? ((asked: { readonly prompt: string; readonly system?: string }) => thinking.think({ prompt: asked.prompt, system: asked.system ?? "", state: {}, catalog: [] } as never)) : ai.complete;
      if (complete) void modelOption(input, complete as never).then((one) => (one ? flips.join([one]) : undefined));
    }
    const made = { flips, opened: false };
    SWITCHES.set(ask.at, made);
    return made;
  });
  const { flips } = held;
  const state = useSyncExternalStore(flips.subscribe, flips.get, flips.get);
  const { options, shown, phase, said, note } = state;
  const choosing = phase === "choosing" || phase === "keeping";

  /* What has shown the records: only these are offered, and the first of them is what opens. */
  const [passed, setPassed] = useState<ReadonlySet<string>>(() => new Set());
  const drew = useMemo(() => (key: string) => setPassed((was) => (was.has(key) ? was : new Set([...was, key]))), []);
  const failed = useMemo(() => (key: string) => flips.drop(key), [flips]);
  const offered = options.filter((one) => passed.has(one.key));
  useEffect(() => {
    if (held.opened || phase !== "choosing" || offered.length === 0) return;
    held.opened = true;
    flips.flip(offered[0]!.key);
  }, [held, flips, phase, offered]);

  /* The stage: a child of the page's region under its heading, while there is a choice to make. */
  const [stage, setStage] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!choosing) return;
    const region = pageNow(part);
    if (!region) return;
    const own = document.createElement("div");
    own.setAttribute("data-testid", "display-options-stage");
    Object.assign(own.style, STAGE);
    const head = headOf(region);
    if (head?.parentElement) head.parentElement.insertBefore(own, head.nextSibling);
    else region.insertBefore(own, region.firstChild);
    setStage(own);
    return () => {
      own.remove();
      setStage(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choosing]);
  /* The page under the heading gives way to the option shown, and comes straight back. React draws on underneath; its elements are only marked. */
  useLayoutEffect(() => {
    const region = stage ? pageNow(part) : null;
    if (!region) return;
    const asItIs = shown === null;
    stage!.style.position = asItIs ? "absolute" : "relative";
    stage!.style.height = asItIs ? "0" : "auto";
    stage!.style.visibility = asItIs ? "hidden" : "visible";
    stage!.setAttribute("data-display-shown", shown ?? NOW);
    if (!asItIs) {
      region.setAttribute(WIDE, "");
      for (let at: Element = stage!; at !== region && at.parentElement; at = at.parentElement) {
        for (const child of at.parentElement.children) if (child !== at && child !== headOf(region) && child.localName !== "style") child.setAttribute(UNDER, "");
      }
    }
    return () => {
      region.removeAttribute(WIDE);
      for (const child of region.querySelectorAll(`[${UNDER}]`)) child.removeAttribute(UNDER);
    };
  });

  const put = () => {
    SWITCHES.delete(ask.at);
    close();
  };
  /* Gone from the page: the switch goes with it, nothing kept. */
  useEffect(() => {
    if (!choosing) return;
    const was = location.pathname;
    const watching = setInterval(() => {
      if (location.pathname !== was) put();
    }, 250);
    return () => clearInterval(watching);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choosing]);
  /* Escape puts it away, and the keyboard back where it was. */
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      put();
      const back = ask.returnTo?.isConnected ? ask.returnTo : document.querySelector<HTMLElement>("[data-graview-page-title], main h1");
      if (back && !back.hasAttribute("tabindex") && !back.matches("a[href], button, input, select, textarea")) back.setAttribute("tabindex", "-1");
      back?.focus?.();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask.returnTo]);

  /* The keyboard on the option shown, as the switch opens and whenever it is the choosing it comes back to. */
  const group = useRef<HTMLDivElement>(null);
  const placed = useRef(false);
  useEffect(() => {
    if (phase !== "choosing" || shown === null || placed.current) return;
    placed.current = true;
    group.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus({ preventScroll: true });
  }, [phase, offered.length, shown]);

  const all: readonly { readonly key: string; readonly label: string }[] = [{ key: NOW, label: "As it is now" }, ...offered];
  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    const to = step !== 0 ? all[(all.findIndex((one) => one.key === (shown ?? NOW)) + step + all.length) % all.length] : event.key === "Home" ? all[0] : event.key === "End" ? all.at(-1) : undefined;
    if (!to) return;
    event.preventDefault();
    flips.flip(to.key === NOW ? null : to.key);
    group.current?.querySelector<HTMLElement>(`[data-option="${CSS.escape(to.key)}"]`)?.focus({ preventScroll: true });
  };
  const current = options.find((one) => one.key === shown);
  const line = choosing ? (said ?? (current ? current.label : `${part.name} as it is now`)) : (said ?? "");
  const nothing = phase === "choosing" && options.length === 0;

  return (
    <>
      {stage && choosing ? createPortal(<Stage options={options} shown={shown} names={names} drew={drew} failed={failed} kind={kind} />, stage) : null}
      <DraftBar
        phase={`options-${phase}`}
        name={part.name}
        said={nothing ? `There are no other ways to show ${part.name} yet.` : line}
        {...(choosing && !nothing ? { scope: "Nothing changes until you keep one. Everyone in this app sees the one you keep." } : {})}
        {...(note ? { note } : {})}
        {...(phase === "choosing" && current ? { keep: () => void flips.keep() } : {})}
        {...(phase === "kept" && state.canUndo ? { undo: () => void flips.undo() } : {})}
        {...(phase !== "keeping" ? { close: put } : {})}
      >
        {phase === "choosing" && !nothing ? (
          <div ref={group} role="radiogroup" aria-label={`Ways to show ${part.name}`} data-testid="display-options" onKeyDown={onKey} style={CHOICES}>
            {all.map((one) => {
              const on = one.key === (shown ?? NOW);
              return (
                <button key={one.key} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-testid="display-option" data-option={one.key} onClick={() => flips.flip(one.key === NOW ? null : one.key)} style={on ? CHOICE_ON : CHOICE}>
                  {one.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </DraftBar>
    </>
  );
}

const STAGE: Partial<CSSStyleDeclaration> = { position: "relative", minWidth: "0", maxWidth: "100%", width: "100%", overflow: "clip" };
/* What a lens fills: as its place's page gives it, a frame most of the window tall that scrolls inside itself. */
const PANE: CSSProperties = { boxSizing: "border-box", height: "min(72vh, 760px)", display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: "minmax(0, 1fr)", overflow: "auto", maxWidth: "100%", borderRadius: 12, border: "1px solid var(--graview-edge)", background: "var(--graview-panel)" };
const PANE_FLOWS: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", maxWidth: "100%" };
/* Out of sight, laid out as if shown, so showing it moves nothing. */
const PANE_OFF: CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, visibility: "hidden", pointerEvents: "none" };
const INNER: CSSProperties = { display: "grid", gridTemplateRows: "minmax(0, 1fr)", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0, minHeight: 0 };
const CHOICES: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 };
const CHOICE: CSSProperties = { minHeight: 34, padding: "0 12px", font: "inherit", borderRadius: 8, cursor: "pointer", color: "var(--graview-ink)", background: "transparent", border: "1px solid var(--graview-edge)" };
/* Which one is shown, said by its edge and its weight: the one filled button on the screen is Keep. */
const CHOICE_ON: CSSProperties = { ...CHOICE, fontWeight: 600, border: "1px solid var(--graview-accent)", boxShadow: "inset 0 0 0 1px var(--graview-accent)" };
