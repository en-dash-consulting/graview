import { subscriberOf, type AnyGraphNode, type AnySchema, type Subscription, type SubscriptionWhen } from "@graview/core";
import { subscriptionProblem, subscriptionWords } from "@graview/core/subscriptions";
import { useGraview } from "@graview/react/provider";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/**
 * "NOTIFY ME", AS THE FACES DRAW IT (Roadmap f-notify-subscriptions) —
 * fetched with the first sheet or list (`notify-door.tsx`).
 *
 * THE SHEET is one step, already filled in with what it was opened on:
 * its first button keeps it, so a person subscribes from the context menu
 * in two presses. The other choices stand beside it — "when anything is
 * done to it", "when it reaches …" — and "Only when someone else does it"
 * is ticked. A condition is written in the app's own rule language, and a
 * subscription that could never be told anything is said, not kept.
 *
 * THE LIST is Activity's: what the reader is told of, each with one press
 * to stop.
 */

/** What the sheet is asked to offer: the subscription it opens on, and the others beside it. */
export interface NotifyAsk {
  /** The choices, the first chosen: "when it changes", "when someone runs …". */
  readonly choices: readonly SubscriptionWhen[];
  /** Where the keyboard goes back to when the sheet closes. */
  readonly returnTo?: HTMLElement | null | undefined;
}

export interface NotifySheetProps {
  readonly ask: NotifyAsk;
  readonly close: () => void;
}

/** A first guess at a condition for a kind: its first field that is false on a record of it, as true. */
function guessCondition(records: readonly AnyGraphNode[]): string {
  for (const record of records) {
    for (const [field, value] of Object.entries(record)) if (value === false) return `${field} == true`;
  }
  return "";
}

const QUIET: CSSProperties = { margin: 0, fontSize: "0.8125rem", color: "var(--graview-ink-muted)" };

export function NotifySheet({ ask, close }: NotifySheetProps) {
  const { store, principal, subscriptions, app } = useGraview<AnySchema>();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [chosen, setChosen] = useState(0);
  const [othersOnly, setOthersOnly] = useState(true);
  const [condition, setCondition] = useState(() => {
    const reaches = ask.choices.find((one): one is Extract<SubscriptionWhen, { on: "reaches" }> => one.on === "reaches");
    if (!reaches) return "";
    const node = reaches.record !== undefined ? store.graph.getNode(reaches.record) : undefined;
    return guessCondition(node ? [node as AnyGraphNode] : (store.graph.nodesOfKind(reaches.kind) as AnyGraphNode[]).slice(0, 5));
  });
  const [problem, setProblem] = useState<string | null>(null);
  const [keeping, setKeeping] = useState(false);

  useEffect(() => {
    const shown = dialog.current;
    if (shown && !shown.open) shown.showModal();
  }, []);

  /** Gone, and the keyboard back where the sheet was asked from — or where the page's title is. */
  const done = () => {
    const back = ask.returnTo;
    close();
    requestAnimationFrame(() => {
      if (back?.isConnected) back.focus();
      else document.querySelector<HTMLElement>("[data-graview-page-title], main h1, [data-testid='activity-button']")?.focus();
    });
  };

  const whenOf = (choice: SubscriptionWhen): SubscriptionWhen => (choice.on === "reaches" ? { ...choice, condition } : choice);
  const words = (choice: SubscriptionWhen) => subscriptionWords(store, { when: whenOf(choice), alsoMine: !othersOnly });

  const keep = async () => {
    const when = whenOf(ask.choices[chosen]!);
    const wrong = subscriptionProblem(store, when);
    if (wrong) {
      setProblem(wrong);
      return;
    }
    setKeeping(true);
    try {
      await subscriptions.add({ who: subscriberOf(principal), app: app?.name ?? "app", when, ...(othersOnly ? {} : { alsoMine: true }) });
      done();
    } catch (error) {
      setKeeping(false);
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={heading}
      data-testid="notify-sheet"
      onClose={done}
      onClick={(event) => {
        // A press on the dimmed page around the sheet puts it away.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      style={{ width: "min(92vw, 420px)", padding: 0, border: "1px solid var(--graview-edge)", borderRadius: "var(--graview-radius, 12px)", background: "var(--graview-panel)", color: "var(--graview-ink)", boxShadow: "var(--graview-lift-high)" }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          void keep();
        }}
        style={{ display: "grid", gap: 12, padding: 18 }}
      >
        <h2 id={heading} style={{ margin: 0, fontSize: "1.0625rem" }}>
          Notify me
        </h2>
        <fieldset style={{ margin: 0, padding: 0, border: 0, display: "grid", gap: 6 }}>
          <legend style={{ ...QUIET, marginBottom: 6 }}>Tell me</legend>
          {ask.choices.map((choice, at) => (
            <label key={at} style={{ display: "flex", gap: 8, alignItems: "baseline", cursor: "pointer" }}>
              <input type="radio" name={`${heading}-when`} checked={chosen === at} onChange={() => setChosen(at)} data-notify-choice={choice.on} />
              <span>{choice.on === "reaches" ? `When ${choice.record !== undefined ? "it" : "one"} reaches a condition` : words(choice)}</span>
            </label>
          ))}
        </fieldset>
        {ask.choices[chosen]?.on === "reaches" ? (
          <label style={{ display: "grid", gap: 4 }}>
            <span style={QUIET}>The condition, in the app's own words (done == true, amount &gt; 100)</span>
            <input value={condition} onChange={(event) => setCondition(event.target.value)} data-testid="notify-condition" autoComplete="off" spellCheck={false} />
          </label>
        ) : null}
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={othersOnly} onChange={(event) => setOthersOnly(event.target.checked)} data-testid="notify-others-only" />
          Only when someone else does it
        </label>
        <p style={QUIET} data-testid="notify-said">
          {words(ask.choices[chosen]!)}.
        </p>
        {problem ? (
          <p role="alert" style={{ margin: 0, color: "var(--graview-danger, var(--graview-ink))" }}>
            {problem}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" autoFocus disabled={keeping} data-testid="notify-keep" style={{ borderColor: "var(--graview-accent)", color: "var(--graview-accent)" }}>
            Notify me
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** What the reader is told of, each with "Stop": Activity's part. */
export function NotifiedList({ style }: { readonly style?: CSSProperties }) {
  const { store, principal, subscriptions, app } = useGraview<AnySchema>();
  const who = (principal.onBehalfOf ?? principal).id;
  const [mine, setMine] = useState<readonly Subscription[]>([]);
  useEffect(() => {
    if (who === undefined) return;
    let live = true;
    const read = () =>
      void Promise.resolve(subscriptions.list(who)).then(
        (all) => live && setMine(all.filter((one) => one.app === (app?.name ?? "app"))),
        () => live && setMine([]),
      );
    read();
    const off = subscriptions.onChange?.(read);
    return () => {
      live = false;
      off?.();
    };
  }, [subscriptions, who, app]);
  if (mine.length === 0) return null;
  return (
    <section aria-label="What you are told of" data-testid="notified" style={{ display: "grid", gap: 6, ...style }}>
      <span style={{ fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--graview-ink-faint)" }}>You are told</span>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
        {mine.map((one) => (
          <li key={one.id} style={{ display: "flex", gap: 8, alignItems: "baseline", justifyContent: "space-between" }} data-subscription={one.id}>
            <span style={{ fontSize: "0.8125rem" }}>{subscriptionWords(store, one)}</span>
            <button
              type="button"
              data-testid="notify-stop"
              aria-label={`Stop: ${subscriptionWords(store, one)}`}
              onClick={(event) => {
                // The keyboard stays in the list: on the next Stop, else Activity's own button.
                const item = event.currentTarget.closest("li");
                const next = (item?.nextElementSibling ?? item?.previousElementSibling)?.querySelector<HTMLElement>("button");
                void Promise.resolve(subscriptions.remove(one.id)).then(() => (next ?? document.querySelector<HTMLElement>("[data-testid='activity-button']"))?.focus());
              }}
              style={{ padding: "1px 8px", fontSize: "0.8125rem" }}
            >
              Stop
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
