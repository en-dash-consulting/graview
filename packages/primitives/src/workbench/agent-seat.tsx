import type { AnySchema } from "@graview/core";
import { kindCardId } from "@graview/layout/view";
import { useAttention } from "@graview/react/drawing";
import { useGraview } from "@graview/react/provider";
import {
  createInAppAdapter,
  createToolRuntime,
  loadPins,
  type InAppAgent,
  type ToolCall,
  type ToolRuntime,
} from "@graview/tools";
import { useEffect, useMemo, useState } from "react";


export interface AgentSeatProps<S extends AnySchema> {
  /** What the seat would do right now, given how much there is to do. */
  label(count: number): string;
  /** Shown while the turn is running. */
  readonly busyLabel: string;
  /** How many things it would touch. Zero means there is nothing to do. */
  readonly count: number;
  /** Said in the tooltip when there is nothing to do. */
  readonly idle: string;
  /**
   * The mutation this seat is really asking for.
   *
   * Named so the seat can be refused BEFORE it is pressed rather than after:
   * the store already knows what this principal may run, and a button that
   * looks live and throws is the worst of both.
   */
  readonly gate?: string;
  /**
   * WHO IS SITTING IN IT. The author every op this seat writes is signed
   * with, and the name Activity reads back.
   *
   * Required, because the default was "claude" for every seat in every app —
   * so two seats on one embed were indistinguishable in the history, and a
   * seat that is a scheduled job, a rules mender or somebody else's model
   * wore a vendor's name. The chat seat has always signed "chat"; this is the
   * same contract, said out loud.
   */
  readonly who: string;
  readonly testId: string;
  onCall(call: ToolCall): void;
  /** The turn itself. Everything the app knows and the framework does not. */
  run(agent: InAppAgent<S>, runtime: ToolRuntime<S>): Promise<void>;
}

/**
 * A seat an agent sits in, with the chrome that is not about the domain.
 *
 * Four apps had the same forty lines around four different scripts, and the
 * same three faults in all of them: the button never said how much there was
 * to do, it stayed live and silently did nothing when there was none, and a
 * refusal from the store surfaced as an unhandled rejection in the console.
 * The turn is the app's; the rest of this is not.
 *
 * The seat runs as an AGENT ACTING FOR the person sitting in it — same roles,
 * different author. That is what makes "one policy narrows the interface and
 * the agent seat alike" a thing you can watch happen: change seat, and the
 * button is refused in the same breath the actions strip is.
 */
export function AgentSeat<S extends AnySchema>({
  label,
  busyLabel,
  count,
  idle,
  gate,
  who,
  testId,
  onCall,
  run,
}: AgentSeatProps<S>) {
  const { store, views, principal, registerSeatWho, noteSeat, session } = useGraview<S>();
  /*
   * ONE ROBOT for the tab's seat and its chat: the seat registers its name
   * and the chat writes as it, so the two surfaces are one body in the city.
   */
  useEffect(() => {
    registerSeatWho(who);
    return () => registerSeatWho(null);
  }, [who, registerSeatWho]);
  const runtime = useMemo(
    () =>
      createToolRuntime(store, {
        // This tab's own session, so the robot and the log agree about which tab it was.
        author: {
          kind: "agent",
          id: who,
          session,
          ...(principal.roles ? { roles: principal.roles } : {}),
        },
        // Read per call: a pin toggled in the menu after this runtime was
        // built must still reach the seat's tool list — the strip, the
        // pointer menu and the agent must never disagree about the acts.
        derive: () => ({ pins: loadPins() }),
        places: () => views.places(),
      }),
    [store, principal, who, session, views],
  );
  const agent = useMemo(() => createInAppAdapter(runtime), [runtime]);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  useEffect(() => runtime.onCall(onCall), [runtime, onCall]);
  // What it LOOKED AT, into the picture. A read leaves no diff, so the
  // runtime is the only thing that can say it happened.
  useAttention(runtime);
  useEffect(() => setRefused(null), [principal]);

  const permitted =
    gate === undefined || runtime.definitions.some((tool) => tool.name === gate);
  const nothing = count === 0;
  const off = busy || nothing || !permitted;

  /*
   * THE REFUSAL IN THE STORE'S OWN WORDS. "The store refuses add-vehicle"
   * named the act by its identifier on the seat people read first; the
   * store's sentence says the act's title and who may.
   */
  const verdict = !permitted && gate !== undefined ? store.permits({ name: gate, args: {} }, principal) : undefined;
  const why = !permitted
    ? `Not yours to do from this seat. ${
        verdict && !verdict.ok
          ? verdict.refusal.message
          : `“${store.allMutations().find((mutation) => mutation.name === gate)?.title ?? gate}” is not offered to it.`
      } The actions strip says the same.`
    : nothing
      ? idle
      : `${runtime.definitions.length} tools, generated from the schema. Its edits produce the diffs yours do, and Activity can take the turn back.`;

  /*
   * A REFUSAL IS SAID AT THE GATE. The seat that may not act stands at the
   * plot of the kind its gate acts on and says the policy's own words from
   * there — the same sentence this control renders, spoken by the body.
   */
  useEffect(() => {
    const said = refused ?? (!permitted ? why : null);
    if (!said) return;
    const gateKind = gate ? (store.allMutations().find((m) => m.name === gate)?.subject?.kinds as readonly string[] | "*" | undefined) : undefined;
    const where = Array.isArray(gateKind) && gateKind[0] ? kindCardId(gateKind[0]) : null;
    noteSeat({ type: "refused", author: { kind: "agent", id: who, session }, where, say: said });
  }, [refused, permitted, why, gate, store, who, noteSeat]);

  /*
   * A SEAT THAT MAY NOT SIT DOWN SAYS SO, in the open.
   *
   * The reason was a `title` on a DISABLED button — unreachable by keyboard,
   * and needing a hover over a dead control otherwise — and the label
   * underneath it said something else entirely ("There is something here
   * already" when the real answer was "not from this seat"). The strip
   * strikes a withheld act through and says why beside it; a seat is the
   * same claim about the same policy.
   */
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
    <button
      type="button"
      data-testid={testId}
      data-agent-permitted={permitted || undefined}
      disabled={off}
      title={refused ?? why}
      onClick={() => {
        setBusy(true);
        setRefused(null);
        void (async () => {
          try {
            await run(agent, runtime);
          } catch (error) {
            /*
             * A refusal is a RESULT, said on the control that asked for it.
             * Unhandled, it was a console error nobody sees and a button that
             * appeared to do nothing at all.
             */
            setRefused(error instanceof Error ? error.message : String(error));
          } finally {
            setBusy(false);
          }
        })();
      }}
      style={{ whiteSpace: "nowrap" }}
    >
      {busy ? (
        busyLabel
      ) : !permitted ? (
        <s>{label(count)}</s>
      ) : nothing ? (
        idle
      ) : (
        label(count)
      )}
    </button>
      {!permitted || refused ? (
        <span
          data-testid={`${testId}-why`}
          style={{ fontSize: "0.8125rem", lineHeight: 1.4, color: "var(--graview-ink-muted)", maxWidth: 260 }}
        >
          {refused ?? why}
        </span>
      ) : null}
    </span>
  );
}
