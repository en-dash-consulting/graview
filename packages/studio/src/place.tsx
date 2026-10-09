import { INSTALLATION_MODULE, layer, type AnySchema, type GraviewApp, type MigrationDeclaration, type Store } from "@graview/core";
import type { CheckResult } from "@graview/core/check";
import type { DocumentEdit, Finding, GraviewDocument } from "@graview/core/document";
import { EMPTY_VIEW, withWithin } from "@graview/layout";
import { GraviewProvider, Scene, createViews, useGraview, useGraviewIfAny, useNavigation, useTheKeyboardLandsSomewhere } from "@graview/react";
import { ActivityRail, AgentSeat, Inspector, Places, registerDefaultViews } from "@graview/primitives";
import type { ToolCall } from "@graview/tools";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStoreTick } from "@graview/pages";
import { StudioAgentPanel } from "./agent-panel.js";
import { createStudioLens } from "./lens.js";
import { studioApp, type StudioSchema } from "./meta.js";
import { createStudio, type Studio } from "./studio.js";
import type { WrittenFile } from "./source.js";
import { Downloads, InPlaceWriter } from "./in-place.js";
import { useStudioDoor } from "./write-in-place.js";

/**
 * THE STUDIO IS A PLACE ON THE BAR, not a package you mount by hand.
 *
 * `@graview/studio` shipped as a package and as a chapter of the seedbed,
 * and there was no way into it from the app you were looking at: to open a
 * studio over your own declaration you wrote code. So the thing the whole
 * platform story rests on — that the declaration is a graph you can change
 * with the same gestures you change data with — was true and unreachable.
 *
 * One press, in place. The running app's declaration is read into a studio
 * store; the scene draws its kinds, fields, edges, acts, rules, roles and
 * grants as ordinary districts; the actions strip offers the acts that
 * change them; "What the checker says" is a place beside them; every change
 * has an author and an inverse. Applying runs `graview check` first and
 * refuses on errors, naming them. What comes back is the files
 * `graview create` writes and the migration a stored graph needs — offered
 * as downloads, because a browser cannot write your checkout and pretending
 * otherwise would be the one dishonest thing in the whole flow.
 *
 * AND OPENING IT IS A STOP. It was component state — so the one door in
 * this interface that Back did not know about was the door into the app's
 * own declaration: you pressed Escape or Back and left the whole app
 * instead of the studio. It is `in.studio=open` in the address now, which
 * means the browser's arrows and the bar's own carry you in and out of it,
 * a link can open it, and closing puts you back exactly where you were —
 * which is what the stop you came from IS.
 */
/**
 * WHAT APPLYING HANDS A HOST that keeps the declaration itself (FR-19): the
 * app the studio's declaration compiles to, the migration a stored graph
 * needs, and the files `graview create` would write for it.
 */
export interface StudioApplied {
  readonly app: GraviewApp<AnySchema>;
  readonly migration: MigrationDeclaration | null;
  readonly files: readonly WrittenFile[];
  /** For an app compiled from a document: the document the change makes, and the edits that make it (FR-54). */
  readonly document?: GraviewDocument;
  readonly edits?: readonly DocumentEdit[];
  /** For an app compiled from a document: why no document came back, one sentence each. */
  readonly documentFindings?: readonly Finding[];
}

/**
 * APPLY, HANDED TO A HOST THAT KEEPS THE DECLARATION: what the checker
 * passed — for a studio opened on a document, the document and the app it
 * compiles to — or the verdict that refused it, in which case the host is
 * handed nothing.
 */
export function handedToTheHost(
  studio: Studio<AnySchema>,
  onApply: StudioOnApply,
): (StudioApplied & { readonly ok: true; readonly answer: StudioHostAnswer }) | { readonly ok: false; readonly check: CheckResult } {
  const result = studio.apply();
  if (!result.ok) return result;
  const applied: StudioApplied = {
    app: result.app,
    migration: result.migration,
    files: studio.files(),
    ...(result.document ? { document: result.document, ...(result.edits ? { edits: result.edits } : {}) } : {}),
    ...(result.documentFindings ? { documentFindings: result.documentFindings } : {}),
  };
  const answer = onApply(applied);
  return { ok: true, ...applied, answer };
}

/**
 * WHAT A HOST SAYS BACK (FR-60). Nothing, or `{ ok: true }`, is "kept".
 * `{ ok: false, findings }` is a refusal: the host could not keep this
 * change — Graview Cloud cannot preview a change no edit says — and the
 * studio shows the findings and stays open with the edits as they are,
 * where it used to say "Handed to the host to keep" while the host's page
 * previewed nothing.
 */
export type StudioHostVerdict =
  | { readonly ok: true }
  /*
   * IN THE HOST'S OWN WORDS (FR-65). `sentence` is said as the panel's
   * heading in place of the studio's "Not kept: the host could not keep
   * this change", and with one, `findings` may be empty or left out: a
   * reason that is one sentence ("Your plan keeps three apps") need not be
   * dressed as a finding at a made-up path.
   */
  | { readonly ok: false; readonly sentence: string; readonly findings?: readonly Finding[] }
  | { readonly ok: false; readonly sentence?: string; readonly findings: readonly Finding[] };
/** What `onApply` returns: a verdict, nothing, or a promise of either, for a host that asks its server first. */
export type StudioHostAnswer = void | StudioHostVerdict | PromiseLike<void | StudioHostVerdict>;
/** A host that keeps the declaration: handed what the checker passed, and saying whether it kept it. */
export type StudioOnApply = (applied: StudioApplied) => StudioHostAnswer;

const isPromise = (answer: StudioHostAnswer): answer is PromiseLike<void | StudioHostVerdict> =>
  typeof answer === "object" && answer !== null && typeof (answer as { then?: unknown }).then === "function";

/** A host's word on who is offered the studio: outright, or decided from the store and the seat (FR-59). */
export type StudioOffered = boolean | ((store: Store<AnySchema>, principal: Parameters<Store<AnySchema>["mayAdminister"]>[1]) => boolean);

export function StudioPlace<S extends AnySchema>({
  app,
  label = "Studio",
  within = "page",
  landmark,
  offered,
  onApply,
}: {
  /** The declaration to open. The running app's own, in every case that matters. */
  readonly app: GraviewApp<S>;
  readonly label?: string;
  /**
   * How much of the screen the studio takes.
   *
   * "page" fills the window, which is what a whole app wants. "box" fills
   * the nearest positioned ancestor, which is what an EMBED wants: a studio
   * that escaped its box would cover somebody else's page.
   *
   * Said rather than inferred, because the control lives on a bar whose own
   * `position: relative` would otherwise become the containing block — the
   * first cut drew the whole studio inside a 57-pixel-tall header, where its
   * scene was laid out under the bar it was drawn in.
   */
  readonly within?: "page" | "box";
  /**
   * WHAT THE STUDIO'S PICTURE IS TO THE PAGE AROUND IT (FR-58).
   *
   * "main" when the studio is the document's own: a whole app's window.
   * "region" when it is drawn into an element of somebody else's page. An
   * embed's studio drew a `<main>` inside the embed's labeled section, so
   * axe failed the host twice (`landmark-main-is-top-level`,
   * `landmark-no-duplicate-main`) whatever the host did. Omitted, it
   * follows `within`: a boxed studio is a region, a page-filling one the main.
   */
  readonly landmark?: "main" | "region";
  /**
   * WHO IS OFFERED IT, WHEN A HOST HAS ALREADY DECIDED (FR-59).
   *
   * `maySeeTheStudio` reads the app's own policy, which grants the app's
   * people, not its builders: a host that let an editor onto its builder
   * page saw the studio withheld from them, and could only take the policy
   * off the store to get it back. `true` or `false` is the host's word over
   * the policy's; a function decides from the store and the seat. Omitted,
   * `maySeeTheStudio` decides, as it always has.
   */
  readonly offered?: StudioOffered;
  /**
   * A HOST THAT KEEPS THE DECLARATION. Given, Apply hands it what the
   * checker passed and the studio writes nothing: no door is asked after,
   * no files are offered. A hosted app keeps declarations on its own
   * server, versioned and reviewed, where a dev server's door is not.
   *
   * It may say it did not keep the change (FR-60): return, or resolve to,
   * `{ ok: false, findings }`, and the studio shows those findings and
   * stays open with the edits intact.
   */
  readonly onApply?: StudioOnApply;
}) {
  const { store, principal } = useGraview<S>();
  const { view, go } = useNavigation();
  const open = view.within?.["studio"] === "open";
  const setOpen = (next: boolean) => go(withWithin(view, "studio", next ? "open" : null));
  /*
   * THE BOX IS THE EMBED'S (FR-131). The way in lives in the person's menu
   * on the app bar, a popover that is out of sight when it is closed; a
   * studio drawn beside it took the menu for its box, and was out of sight
   * with it. Boxed, it is drawn into the embed's own element, which it fills.
   */
  const way = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setBox(way.current?.closest<HTMLElement>("[data-graview-embed]") ?? null), []);
  const may = offered === undefined ? maySeeTheStudio(store, principal) : typeof offered === "function" ? offered(store as unknown as Store<AnySchema>, principal) : offered;
  if (!may) return null;
  return (
    <>
      <button
        ref={way}
        type="button"
        data-testid="studio-place"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title="Open this app's own declaration — its kinds, fields, acts and rules — and change it"
        style={{
          padding: "3px 11px",
          borderRadius: 999,
          fontSize: "0.875rem",
          whiteSpace: "nowrap",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: open ? "var(--graview-accent)" : "var(--graview-edge)",
          color: open ? "var(--graview-accent)" : "var(--graview-ink-muted)",
          background: open ? "var(--graview-panel)" : "transparent",
        }}
      >
        {label}
      </button>
      {open ? (
        /*
         * OUT OF THE BAR ENTIRELY, for the page-filling case.
         *
         * The control lives on a bar that carries `backdrop-filter`, and a
         * filtered element is a containing block for its fixed descendants
         * as well as its absolute ones — so neither `absolute` nor `fixed`
         * escaped it, and the whole studio was drawn inside a 57-pixel-tall
         * header with its scene laid out under the bar it was drawn in. A
         * portal is the only thing no ancestor's filter can capture.
         *
         * The boxed case stays where it is on purpose: an embed's studio
         * must not escape the embed.
         */
        within === "page" ? (
          createPortal(<StudioOverlay app={app} within={within} landmark={landmark ?? "main"} onClose={() => setOpen(false)} {...(onApply ? { onApply } : {})} />, document.body)
        ) : box ? (
          createPortal(<StudioOverlay app={app} within={within} landmark={landmark ?? "region"} onClose={() => setOpen(false)} {...(onApply ? { onApply } : {})} />, box)
        ) : (
          <StudioOverlay app={app} within={within} landmark={landmark ?? "region"} onClose={() => setOpen(false)} {...(onApply ? { onApply } : {})} />
        )
      ) : null}
    </>
  );
}

/**
 * Who is offered it.
 *
 * The same shape as "Show the installation": where the app declares
 * something administered, the studio belongs to the seat that administers
 * it and to nobody else. Where it declares nothing administered — a
 * scaffolded project on its first day, which has no installation yet — it
 * belongs to whoever is here, because there is no one else and a project
 * you cannot open the studio on is a project you cannot grow; unless a
 * policy says who may do everything, and then it is theirs.
 */
export function maySeeTheStudio<S extends AnySchema>(
  store: Store<S>,
  principal: Parameters<Store<S>["mayAdminister"]>[1],
): boolean {
  const administered = [...store.modules.administered.keys()];
  if (administered.length > 0) return administered.some((name) => store.mayAdminister(name, principal));
  /*
   * WITH A POLICY AND NO INSTALLATION, the declaration is the business of
   * whoever may already do everything in it — a grant of every act, on
   * every kind, not only their own. A storefront with shoppers and staff
   * offered its own declaration, roles and rules to somebody browsing who
   * may do nothing but sign up (the seventh walk).
   */
  const policy = store.policy;
  if (!policy) return true;
  const roles = principal?.roles ?? [];
  return policy.grants.some(
    (grant) => grant.mutations === "*" && !grant.self && (grant.kinds === undefined || grant.kinds === "*") && (grant.roles === "*" || roles.some((role) => (grant.roles as readonly string[]).includes(role))),
  );
}

export { INSTALLATION_MODULE };

/**
 * The studio itself, over the whole picture it was opened from.
 *
 * A face rather than a route: you are still in your app, and closing puts
 * you back exactly where you were rather than at whatever the studio's own
 * address happened to be.
 */
function StudioOverlay<S extends AnySchema>({
  app,
  within,
  landmark,
  onClose,
  onApply,
}: {
  readonly app: GraviewApp<S>;
  readonly within: "page" | "box";
  readonly landmark: "main" | "region";
  readonly onClose: () => void;
  readonly onApply?: StudioOnApply;
}) {
  const { principal, brand, scheme } = useGraview<S>();
  const studio = useMemo(() => createStudio(app, { principal }), [app, principal]);
  /*
   * A DIALOG GIVES THE KEYBOARD BACK. The studio opens over the app from a
   * button in the profile; closing it removed the dialog the keyboard was
   * in and left it on <body>. Whatever held the keyboard when it opened
   * holds it again when it closes — and inside, an act that removes what
   * the keyboard stood on lands it on what still stands.
   */
  const dialog = useRef<HTMLDivElement>(null);
  useTheKeyboardLandsSomewhere(dialog);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Opened, it takes the keyboard: a dialog the keyboard is not in is one it cannot reach.
    dialog.current?.focus({ preventScroll: true });
    /*
     * AND HOLDS IT WHILE IT IS OPEN. Taken once, at mount, the keyboard could
     * still be taken back by what opened the studio — the profile's menu
     * closing behind it — and on the nightly's runner it sat on <body> with
     * the studio open. A modal dialog keeps the keyboard inside itself: when
     * it lands on nothing while the studio is open, it comes back to the
     * studio.
     */
    const onNothing = () => {
      const active = document.activeElement;
      return active === null || active === document.body || active === document.documentElement;
    };
    const holdIt = () => {
      if (onNothing()) dialog.current?.focus({ preventScroll: true });
    };
    const watch = (event: FocusEvent) => {
      if (event.relatedTarget === null) setTimeout(holdIt, 0);
    };
    document.addEventListener("focusout", watch, true);
    const sweep = setInterval(holdIt, 250);
    const stopSweep = setTimeout(() => clearInterval(sweep), 3000);
    return () => {
      document.removeEventListener("focusout", watch, true);
      clearInterval(sweep);
      clearTimeout(stopSweep);
      const active = document.activeElement;
      const onNothing = active === null || active === document.body || dialog.current?.contains(active);
      if (onNothing && opener?.isConnected) opener.focus({ preventScroll: true });
      else if (onNothing) setTimeout(() => {
        // The opener went with the menu it was in: the profile button that opened that.
        document.querySelector<HTMLElement>('[data-testid="profile-button"]')?.focus({ preventScroll: true });
      }, 0);
    };
  }, []);
  const views = useMemo(() => studioViews(app), [app]);
  /* The app's own AI, as its host gave it: the studio's seat uses the same model, and nobody chooses one here. */
  const ai = useGraviewIfAny()?.ai;
  /*
   * Re-read on every change rather than cached: the checker is cheap, the
   * declaration is small, and a verdict that can go stale is a verdict
   * nobody should trust. The store's own subscription is what says a change
   * happened — an act taken from the strip, from the keyboard, from an
   * agent's seat or from an undo all arrive the same way.
   */
  const turn = useStoreTick(studio.store);
  const verdict: CheckResult = useMemo(() => studio.check(), [studio, turn]);
  const [applied, setApplied] = useState<Applied | null>(null);
  const presses = useRef(0);
  // A host that keeps the declaration is the only door there is.
  const door = useStudioDoor(onApply ? null : undefined);
  const [calls, setCalls] = useState<readonly ToolCall[]>(NO_CALLS);
  const noteCall = useCallback((call: ToolCall) => {
    setCalls((current) => {
      const settling =
        call.phase !== "running" && current[0]?.name === call.name && current[0]?.at === call.at;
      return [call, ...(settling ? current.slice(1) : current)].slice(0, 12);
    });
  }, []);

  return (
    <GraviewProvider<StudioSchema>
      store={studio.store}
      views={views}
      scheme={scheme}
      principal={principal}
      {...(brand ? { brand } : {})}
      {...(ai ? { ai } : {})}
      initialView={AT_ALTITUDE}
    >
    <div
      ref={dialog}
      data-testid="studio"
      // The studio edits the declaration: its ids are what it is about.
      data-graview-speaks-ids=""
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Studio · ${app.name}`}
      /*
       * ESCAPE CLOSES THE INNERMOST THING.
       *
       * The studio's own rail and any other popover in it already close on
       * Escape; this closed the WHOLE STUDIO at the same time, so opening
       * the history and pressing Escape to dismiss it threw away the studio
       * around it. Anything marked as an overlay inside gets the press
       * first, and the studio takes the next one.
       */
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (event.currentTarget.querySelector("[data-graview-overlay]")) return;
        onClose();
      }}
      style={{
        position: within === "page" ? "fixed" : "absolute",
        inset: 0,
        /*
         * OVER EVERYTHING IN THE BOX. Boxed, the studio is drawn from the
         * embed's strip, which comes before the embed's own picture, and the
         * picture's seat once sat at the studio's own number: later in the
         * page and no lower, the embed's seat was drawn over the studio and
         * took its presses. A modal dialog is above what it covers — the
         * ladder's dialog rung, over every rail (FR-76).
         */
        zIndex: layer("dialog"),
        display: "flex",
        flexDirection: "column",
        background: "var(--graview-ground-deep)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          rowGap: 6,
          padding: "6px 18px",
          minHeight: 49,
          boxSizing: "border-box",
          flex: "0 0 auto",
          borderBottom: "1px solid var(--graview-edge)",
          background: "var(--graview-bar)",
        }}
      >
        <strong style={{ fontSize: "0.9375rem", fontWeight: 550 }}>Studio</strong>
        <span style={{ fontSize: "0.875rem", color: "var(--graview-ink-muted)" }}>{app.name}</span>
        <Places<StudioSchema> />
        <span
          data-testid="studio-verdict"
          data-errors={verdict.errors}
          data-warnings={verdict.warnings}
          style={{
            marginLeft: "auto",
            fontSize: "0.875rem",
            color: verdict.errors > 0 ? "var(--graview-warn)" : "var(--graview-ink-muted)",
          }}
        >
          {said(verdict)}
        </span>
        {/*
          * THE STUDIO'S OWN HISTORY, and its own undo.
          *
          * Every change here is an op on the declaration with an author and
          * an inverse — including an agent's proposal, which is exactly how
          * a person keeps or declines one. The app's rail is behind the
          * studio and is about the app's data; reaching for it from in here
          * would be reaching past the thing you are editing.
          */}
        {/*
          * AND A SEAT YOU CAN TALK TO, beside the declaration it is about.
          *
          * The rail's seat runs one derived turn when pressed; this one
          * takes words. Both propose rather than write, both are attributed,
          * both are undone from the same rail — the difference is only that
          * one of them had to be asked.
          */}
        <StudioAgentPanel studio={studio as unknown as Studio<AnySchema>} />
        <ActivityRail calls={calls} seat={<StudioSeat studio={studio as unknown as Studio<AnySchema>} onCall={noteCall} />} />
        <button
          type="button"
          data-testid="studio-apply"
          onClick={() => {
            if (onApply) {
              /*
               * NOTHING CHANGED, SAID BY THE STUDIO (FR-65). A host handed
               * an empty change previews nothing, or refuses it in words
               * about something else; the studio knows before it asks.
               */
              if (studio.unchanged()) {
                ++presses.current;
                setApplied({ ok: false, unchanged: true });
                return;
              }
              const handed = handedToTheHost(studio as unknown as Studio<AnySchema>, onApply);
              if (!handed.ok) {
                setApplied({ ok: false, check: handed.check });
                return;
              }
              /*
               * KEPT ONLY WHEN THE HOST SAYS SO (FR-60). A refusal is shown
               * in the host's own findings, and nothing else moves: the
               * studio stays open on the edits as they are. An answer to an
               * earlier press that arrives late says nothing.
               */
              const press = ++presses.current;
              const kept: Applied = { ok: true, files: handed.files, migration: handed.migration?.title ?? null, door: false, handed: true };
              const heard = (verdict: void | StudioHostVerdict) => {
                if (press !== presses.current) return;
                if (!verdict || verdict.ok !== false) return setApplied(kept);
                const sentence = verdict.sentence?.trim();
                setApplied({ ok: false, refused: verdict.findings ?? [], ...(sentence ? { sentence } : {}) });
              };
              if (isPromise(handed.answer)) {
                setApplied({ ...kept, asking: true });
                handed.answer.then(heard, (error: unknown) =>
                  heard({ ok: false, findings: [{ severity: "error", code: "host-refused", path: "", message: error instanceof Error ? error.message : String(error) }] }),
                );
              } else heard(handed.answer);
              return;
            }
            const result = studio.apply();
            setApplied(
              result.ok
                ? { ok: true, files: studio.files(), migration: result.migration?.title ?? null, door: door !== null }
                : { ok: false, check: result.check },
            );
          }}
          style={{ padding: "3px 11px", fontSize: "0.875rem" }}
        >
          Apply
        </button>
        <button
          type="button"
          data-testid="studio-close"
          onClick={onClose}
          aria-label="Close the studio"
          style={{ padding: "3px 11px", fontSize: "0.875rem" }}
        >
          Close
        </button>
      </header>

      {applied ? <Written applied={applied} studio={studio as unknown as Studio<AnySchema>} onDismiss={() => setApplied(null)} /> : null}

      {/*
        * THE PICTURE IS THE PAGE'S MAIN ONLY WHEN THE STUDIO IS THE PAGE
        * (FR-58). Inside somebody else's page (an embed, itself a labeled
        * region of it) a main can never be top-level, and the host's own
        * makes it a second one: there the picture is a region, named.
        */}
      {landmark === "main" ? (
        <main style={PICTURE}>
          <Scene renderer="dom" />
          <Inspector />
        </main>
      ) : (
        <section aria-label="The declaration" style={PICTURE}>
          <Scene renderer="dom" />
          <Inspector />
        </section>
      )}
    </div>
    </GraviewProvider>
  );
}

const PICTURE = { position: "relative", flex: "1 1 auto", minHeight: 0, containerType: "size" } as const;

/**
 * The studio OPENS FROM ALTITUDE: a declaration's first honest picture is
 * the map of what it declares — kinds, acts, rules, roles — as districts,
 * rather than one of them chosen arbitrarily.
 */
const AT_ALTITUDE = { ...EMPTY_VIEW, overview: true };

/** The studio has no agent turns of its own yet; the rail is here for the history. */
const NO_CALLS: readonly never[] = [];

type Applied =
  | {
      readonly ok: true;
      readonly files: readonly WrittenFile[];
      readonly migration: string | null;
      /** Whether the dev server's studio door is open to write it through. */
      readonly door: boolean;
      /** Handed to the host's `onApply`, which keeps it: nothing to write here. */
      readonly handed?: boolean;
      /** Handed, and the host has not answered yet. */
      readonly asking?: boolean;
    }
  | { readonly ok: false; readonly check: CheckResult }
  /** The host's `onApply` said it could not keep the change, and why (FR-60). */
  | { readonly ok: false; readonly refused: readonly Finding[]; readonly sentence?: string }
  /** Apply pressed with nothing changed: the host is not asked (FR-65). */
  | { readonly ok: false; readonly unchanged: true };

/**
 * WHAT APPLYING ACTUALLY GIVES YOU.
 *
 * On errors, the findings — each naming the thing to change, because the
 * checker's messages are written for somebody editing the declaration. On
 * success, with the dev server's studio door open, the change written into
 * the checkout's own files. Without it — a deployed app, or a change the
 * studio cannot yet write in place, each reason said — the files `graview
 * create` would write, as downloads: a browser cannot write your checkout,
 * and a button that claimed to would be the one lie in a flow whose whole
 * point is that nothing is hidden.
 */
function Written({
  applied,
  studio,
  onDismiss,
}: {
  readonly applied: Applied;
  readonly studio: Studio<AnySchema>;
  readonly onDismiss: () => void;
}): ReactNode {
  return (
    <section
      data-testid="studio-applied"
      aria-label={applied.ok ? "What the studio wrote" : "unchanged" in applied ? "Nothing to apply" : "refused" in applied ? "What the host refused" : "What the checker refused"}
      data-applied={applied.ok ? (applied.asking ? "asking" : "kept") : "unchanged" in applied ? "unchanged" : "refused" in applied ? "refused-by-host" : "refused-by-checker"}
      style={{
        flex: "0 0 auto",
        display: "grid",
        gap: 8,
        padding: "10px 18px",
        borderBottom: "1px solid var(--graview-edge)",
        background: applied.ok || "unchanged" in applied ? "var(--graview-panel)" : "var(--graview-panel-warning)",
      }}
    >
      {applied.ok && applied.asking ? (
        <strong role="status" style={{ fontSize: "0.875rem", fontWeight: 550 }}>
          The checker is happy. Handing it to the host…
        </strong>
      ) : applied.ok && applied.handed ? (
        <strong style={{ fontSize: "0.875rem", fontWeight: 550 }}>
          The checker is happy. Handed to the host to keep
          {applied.migration ? `, with a migration: ${applied.migration}` : ", and no migration needed"}.
        </strong>
      ) : applied.ok && applied.door ? (
        <InPlaceWriter studio={studio} migration={applied.migration} files={applied.files} />
      ) : applied.ok ? (
        <>
          <strong style={{ fontSize: "0.875rem", fontWeight: 550 }}>
            The checker is happy. {applied.files.length} file
            {applied.files.length === 1 ? "" : "s"} to write
            {applied.migration ? `, and a migration: ${applied.migration}` : ", and no migration needed"}.
          </strong>
          <span style={{ fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}>
            A browser cannot write your checkout. Run the app with the studio door (studioDoor() from @graview/ship/dev) and Apply writes the change in place.
          </span>
          <Downloads files={applied.files} />
        </>
      ) : "unchanged" in applied ? (
        <strong role="status" style={{ fontSize: "0.875rem", fontWeight: 550 }}>
          Nothing to apply: the declaration is as the studio opened it. Change something, then Apply.
        </strong>
      ) : "refused" in applied ? (
        <>
          <strong style={{ fontSize: "0.875rem", fontWeight: 550, color: "var(--graview-warn)" }}>
            {applied.sentence ?? "Not kept: the host could not keep this change. Your edits are still here."}
          </strong>
          {applied.refused.length > 0 ? (
            <ul data-testid="studio-host-findings" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              {applied.refused.map((finding, at) => (
                <li key={`${finding.code}:${finding.path}:${at}`} style={{ fontSize: "0.875rem" }}>
                  {finding.path ? <><code>{finding.path}</code> — </> : null}
                  {finding.message} {finding.fix ? <em>{finding.fix}</em> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <>
          <strong style={{ fontSize: "0.875rem", fontWeight: 550, color: "var(--graview-warn)" }}>
            Not applied — {applied.check.errors} error
            {applied.check.errors === 1 ? "" : "s"} in the declaration as it stands.
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            {applied.check.findings
              .filter((finding) => finding.severity === "error")
              .slice(0, 6)
              .map((finding) => (
                <li key={`${finding.code}:${finding.where}`} style={{ fontSize: "0.875rem" }}>
                  <code>{finding.where}</code> — {finding.message} <em>{finding.fix}</em>
                </li>
              ))}
          </ul>
        </>
      )}
      <button
        type="button"
        onClick={onDismiss}
        style={{ justifySelf: "start", padding: "3px 10px", fontSize: "0.8125rem" }}
      >
        Dismiss
      </button>
    </section>
  );
}

/**
 * AN AGENT SEAT IN THE STUDIO — and the thing it is actually good for.
 *
 * A rule that says what is wrong without naming what puts it right is a
 * rule the interface can only complain about: no repair in the strip, no
 * repair in the menu, nothing an agent may lawfully do about it. That is
 * the framework's own central seam, left unconnected. Finding the rules in
 * this state, and the act that plausibly repairs each, is a derivation over
 * the declaration graph — no model, no prompt.
 *
 * Every proposal is an ordinary act under the AGENT's own name, in a batch
 * of its own, so the trail beside it says who did it and one press takes it
 * back. Keeping is doing nothing; declining is undo. That is the whole
 * review mechanism, and it is the same one a person's own changes get.
 */
function StudioSeat({
  studio,
  onCall,
}: {
  readonly studio: Studio<AnySchema>;
  readonly onCall: (call: ToolCall) => void;
}) {
  const { principal } = useGraview<StudioSchema>();
  const unrepaired = useMemo(() => unnamedRepairs(studio), [studio, studio.store.batches().length]);
  return (
    <AgentSeat<StudioSchema>
      who="studio"
      testId="studio-seat"
      count={unrepaired.length}
      gate="name-repair"
      label={(n) => `Name a repair for ${n} rule${n === 1 ? "" : "s"}`}
      busyLabel="Reading the declaration…"
      idle="Every rule names what puts it right"
      onCall={onCall}
      run={async () => {
        for (const { rule, act, why } of unnamedRepairs(studio)) {
          studio.propose(
            { name: "name-repair", args: { rule, act } },
            { kind: "agent", id: "studio", session: "ui", ...(principal.roles ? { roles: principal.roles } : {}) },
            why,
          );
        }
      }}
    />
  );
}

/**
 * The rules that name no repair, each with the act that plausibly puts it
 * right: an act whose subject is the kind the rule judges. Read off the
 * declaration graph, so the seat proposes something the checker and the
 * store would both accept rather than something a model imagined.
 */
function unnamedRepairs(
  studio: Studio<AnySchema>,
): readonly { rule: string; act: string; why: string }[] {
  const graph = studio.store.graph;
  const named = new Set(graph.allEdges().filter((edge) => edge.kind === "repairs").map((edge) => edge.from));
  const found: { rule: string; act: string; why: string }[] = [];
  for (const rule of graph.allNodes().filter((node) => node.kind === "rule")) {
    if (named.has(rule.id)) continue;
    const judged = graph.out(rule.id, "judges").map((kind) => kind.id);
    if (judged.length === 0) continue;
    const act = graph
      .allNodes()
      .filter((node) => node.kind === "act")
      .find((candidate) => graph.out(candidate.id, "on").some((kind) => judged.includes(kind.id)));
    if (!act) continue;
    const say = (node: { id: string } & Record<string, unknown>) => String(node["label"] ?? node.id);
    found.push({
      rule: rule.id,
      act: act.id,
      why: `"${say(rule)}" names no repair; "${say(act)}" acts on what it judges`,
    });
  }
  return found;
}

/** The default views over the meta-schema, plus the checker's own place. */
function studioViews(app: GraviewApp<AnySchema>) {
  const meta = studioApp();
  const check = createStudioLens(app);
  return registerDefaultViews(meta.schema, createViews(meta.schema))
    .register("kind", { cardinality: "many", fidelity: "full" }, check.View, {
      title: "What the checker says",
    })
    .register("kind", { cardinality: "many", fidelity: "summary" }, check.View, {
      title: "What the checker says",
    });
}

function said(verdict: CheckResult): string {
  if (verdict.errors === 0 && verdict.warnings === 0) return "The checker finds nothing wrong";
  const parts: string[] = [];
  if (verdict.errors > 0) parts.push(`${verdict.errors} error${verdict.errors === 1 ? "" : "s"}`);
  if (verdict.warnings > 0) parts.push(`${verdict.warnings} warning${verdict.warnings === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export type { Studio };
