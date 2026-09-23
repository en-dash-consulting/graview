import { aggregateId, EMPTY_VIEW, type ViewState } from "@graview/layout";
import { GraviewProvider, useGraview, type Scheme, type SceneProps } from "@graview/react";
import { AgentSeat, Shell } from "@graview/primitives";
import { StudioPlace } from "@graview/studio";
import type { Principal } from "@graview/core";
import type { ToolCall } from "@graview/tools";
import { useMemo, useState } from "react";
import example from "../data/example.json";
import { createRotaStore, rotaApp, type RotaStore } from "../domain/app.js";
import { rotaBrand } from "../domain/brand.js";
import type { RotaSchema } from "../domain/schema.js";
import { rotaViews } from "./views.js";
import { today } from "./when.js";

type S = RotaSchema;

export { EXAMPLE_TODAY, today } from "./when.js";

/**
 * THREE SEATS, and the third is the point.
 *
 * A coordinator keeps the roster and the installation; a volunteer works it;
 * a viewer reads. Sitting in the viewer's seat is what makes a policy
 * legible rather than merely present — every act on every surface struck
 * through, each carrying the sentence that says who could take it instead.
 *
 * A principal's id is its USER NODE's id, which is what a self grant
 * compares: Ada may edit Ada's profile and nobody else's, with no code out
 * here deciding it.
 */
export const SEATS = [
  { label: "Jo, coordinator", principal: { kind: "human", id: "user-jo", roles: ["coordinator"] } },
  { label: "Ada, volunteer", principal: { kind: "human", id: "user-ada", roles: ["volunteer"] } },
  { label: "Sam, viewer", principal: { kind: "human", id: "user-sam", roles: ["viewer"] } },
] as const satisfies readonly { label: string; principal: Principal }[];

/** `?as=user-sam` sits a harness, a screenshot or a link down somewhere else. */
export function openingSeat(): Principal {
  if (typeof window !== "undefined") {
    const asked = new URLSearchParams(window.location.search).get("as");
    const found = SEATS.find((seat) => seat.principal.id === asked);
    if (found) return found.principal;
  }
  return SEATS[0].principal;
}

/** The roster opens on the week, which is what a rota on a wall shows. */
export const HOME = aggregateId("shift");
export const INITIAL_VIEW: ViewState = { ...EMPTY_VIEW, focusId: HOME };

export function createRotaUiStore(when: string = today()): RotaStore {
  return createRotaStore({
    snapshot: example as never,
    invariantOptions: { context: { today: when } },
  });
}

export interface RotaAppProps {
  readonly store?: RotaStore;
  readonly initialView?: ViewState;
  readonly syncUrl?: boolean;
  readonly renderer?: "gpu" | "dom" | "auto";
  readonly attachRenderer?: SceneProps["attachRenderer"];
  readonly initialScheme?: Scheme;
  readonly onSchemeChange?: (scheme: Scheme) => void;
  readonly remembers?: boolean;
  readonly principal?: Principal;
}

export function RotaApp({
  store,
  initialView = INITIAL_VIEW,
  syncUrl = false,
  renderer = "dom",
  attachRenderer,
  initialScheme = "light",
  onSchemeChange,
  remembers = false,
  principal,
}: RotaAppProps) {
  const created = useMemo(() => store ?? createRotaUiStore(), [store]);
  const views = useMemo(() => rotaViews(), []);
  const [scheme, setScheme] = useState<Scheme>(initialScheme);

  return (
    <GraviewProvider
      store={created}
      views={views}
      initialView={initialView}
      scheme={scheme}
      brand={rotaBrand}
      principal={principal ?? openingSeat()}
      seats={SEATS}
      settings={rotaApp.settings ?? []}
    >
      <Shell<S>
        home={HOME}
        standing="Every shift is covered"
        seat={(onCall) => <FillTheGaps onCall={onCall} />}
        profileHref={(userId) => `/pages/people/${userId}`}
        studio={<StudioPlace app={rotaApp} />}
        remembers={remembers}
        syncUrl={syncUrl}
        renderer={renderer}
        scheme={scheme}
        onScheme={(next) => {
          setScheme(next);
          onSchemeChange?.(next);
        }}
        {...(attachRenderer ? { attachRenderer } : {})}
      />
    </GraviewProvider>
  );
}

/**
 * THE SEAT THAT FILLS THE GAPS.
 *
 * It asks the framework what is wrong rather than deciding out here what
 * "covered" means, then applies the repair the rule itself named — and
 * chooses the volunteer with the most room left, which is a judgement about
 * rosters rather than about graphs and therefore belongs in this app.
 *
 * Its acts run through the same tool surface a person's do, so its turns are
 * attributed, watchable and undoable; and where the seat is a viewer's, the
 * store refuses it exactly as it refuses the person.
 */
function FillTheGaps({ onCall }: { onCall: (call: ToolCall) => void }) {
  const { store } = useGraview<S>();
  const open = store
    .violations({ today: today() })
    .filter((violation) => violation.invariant === "every-shift-covered");

  return (
    <AgentSeat<S>
      who="rota"
      testId="agent-rota"
      count={open.length}
      gate="cover"
      label={(n) => `Fill ${n} gap${n === 1 ? "" : "s"}`}
      busyLabel="Asking around…"
      idle="Every shift is covered"
      onCall={onCall}
      run={async (agent) => {
        const violations = (await agent.run("get_violations", {})) as {
          invariant: string;
          repairs: { mutation: string; args?: Record<string, unknown> }[];
        }[];
        for (const violation of violations) {
          if (violation.invariant !== "every-shift-covered") continue;
          const repair = violation.repairs.find((candidate) => candidate.mutation === "cover");
          if (!repair) continue;
          const who = roomiest(store);
          if (!who) break;
          await agent.run("cover", { ...repair.args, volunteerId: who });
        }
      }}
    />
  );
}

/**
 * Whoever has the most room left against what they said they could do.
 *
 * A judgement about rosters, not about graphs: the framework can say which
 * shifts are uncovered and who could legally take one, and it should not
 * have an opinion about who to ask. Ties go to the lowest id, so the seat's
 * turn is the same turn twice.
 */
function roomiest(store: RotaStore): string | null {
  const people = (store.graph.nodesOfKind("volunteer" as never) as unknown as {
    id: string;
    status: string;
    limit: number;
  }[]).filter((person) => person.status === "available");
  const room = people
    .map((person) => ({ id: person.id, left: person.limit - store.graph.in(person.id, "covered-by").length }))
    .filter((person) => person.left > 0)
    .sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));
  return room[0]?.id ?? null;
}
