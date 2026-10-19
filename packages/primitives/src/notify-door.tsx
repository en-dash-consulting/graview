import { retryingImport } from "@graview/core/retry";
import type { AnySchema, Principal, SignIn, SubscriptionStore, SubscriptionWhen } from "@graview/core";
import { isAggregateId, kindOfCard, kindsOfAggregate } from "@graview/layout/view";
import { MenuSections } from "@graview/react/drawing";
import { lazyModule, useGraview, useGraviewIfAny, type MenuItem, type MenuSectionSource, type MenuTarget } from "@graview/react/provider";
import { Suspense, useEffect, useId, useMemo, useState, useSyncExternalStore, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { NotifyAsk, NotifySheetProps } from "./notify-sheet.js";

/**
 * THE DOOR TO "NOTIFY ME" (Roadmap f-notify-subscriptions): offered on the
 * context menu of both faces — for a record, a kind's list, an act — on a
 * record's page and after an act's form, each opening one sheet, already
 * filled in, whose first button keeps it: two presses from the menu. The
 * sheet and the list of what a reader is told of are fetched when first
 * drawn, so a page nobody subscribes from carries neither.
 *
 * Offered only to a reader the app knows by id: there is nobody else to
 * tell. Kept where the provider keeps subscriptions (`subscriptions` on it,
 * the host's; else the page's own).
 */

/** The sheet asked, and the doors that could draw it, per store of subscriptions — one provider's. */
interface Asked {
  ask: NotifyAsk | null;
  readonly doors: string[];
  readonly listeners: Set<() => void>;
}
const ASKED = new WeakMap<SubscriptionStore, Asked>();
const askedOf = (subscriptions: SubscriptionStore): Asked => {
  let held = ASKED.get(subscriptions);
  if (!held) ASKED.set(subscriptions, (held = { ask: null, doors: [], listeners: new Set() }));
  return held;
};
const told = (asked: Asked) => {
  for (const listener of asked.listeners) listener();
};

/** Open the sheet, filled in with these choices. */
export function askToNotify(subscriptions: SubscriptionStore, ask: NotifyAsk | null): void {
  const asked = askedOf(subscriptions);
  asked.ask = ask;
  told(asked);
}

const sheetModule = /* @__PURE__ */ lazyModule(retryingImport(() => import("./notify-sheet.js")));
const Sheet = /* @__PURE__ */ sheetModule.part(
  (module, props: NotifySheetProps) => {
    const Drawn = module.NotifySheet as ComponentType<NotifySheetProps>;
    return <Drawn {...props} />;
  },
  { what: "Notify me" },
);
const List = /* @__PURE__ */ sheetModule.part((module, props: { readonly style?: CSSProperties }) => {
  const Drawn = module.NotifiedList as ComponentType<{ readonly style?: CSSProperties }>;
  return <Drawn {...props} />;
}, { quiet: true });

/** Whether a reader is somebody the app can tell: one it knows by id, and not a visitor the host offers a way in (FR-183). */
export const canBeTold = (principal: Principal, signIn?: SignIn): boolean => signIn === undefined && (principal.onBehalfOf ?? principal).id !== undefined;

/** The choices a menu opened on this offers, or none. */
export function choicesAt(target: Pick<MenuTarget, "on" | "about" | "act">, kindOf: (id: string) => string | undefined, schema: AnySchema): { readonly label: string; readonly choices: readonly SubscriptionWhen[] } | null {
  const noun = (kind: string) => schema.tryDefinition(kind)?.noun ?? kind.replace(/[-_]+/g, " ");
  const record = target.on !== undefined ? target.on : target.about.length === 1 ? target.about[0] : undefined;
  if (target.act !== undefined) {
    const on = record !== undefined && kindOf(record) !== undefined ? record : undefined;
    return { label: "Notify me when someone does this…", choices: [{ on: "act", act: target.act, ...(on !== undefined ? { record: on } : {}) }, ...(on !== undefined ? [{ on: "act" as const, act: target.act }] : [])] };
  }
  if (record === undefined) return null;
  const kind = kindOf(record);
  if (kind !== undefined) return { label: "Notify me when this changes…", choices: [{ on: "changed", record }, { on: "act", record }, { on: "reaches", kind, condition: "", record }] };
  const kinds = kindOfCard(record) !== null ? [kindOfCard(record)!] : isAggregateId(record) ? kindsOfAggregate(record) : [];
  if (kinds.length !== 1 || !(schema.kinds as readonly string[]).includes(kinds[0]!)) return null;
  const listed = kinds[0]!;
  const word = noun(listed);
  return { label: `Notify me when ${/^[aeiou]/i.test(word) ? "an" : "a"} ${word} is added…`, choices: [{ on: "created", kind: listed }, { on: "changed", kind: listed }, { on: "reaches", kind: listed, condition: "" }] };
}

/** "Notify me…" on the context menu, or nothing where there is nobody to tell or nothing to be told of. */
export function useNotifySection(): MenuSectionSource | null {
  const { store, principal, subscriptions, signIn } = useGraview<AnySchema>();
  const able = canBeTold(principal, signIn);
  return useMemo<MenuSectionSource | null>(
    () =>
      able
        ? (target: MenuTarget) => {
            const offered = choicesAt(target, (id) => store.graph.getNode(id)?.kind, store.schema);
            if (!offered) return null;
            const item: MenuItem = { id: "notify-me", label: offered.label, run: () => askToNotify(subscriptions, { choices: offered.choices, returnTo: target.element ?? null }) };
            // The sheet it opens, fetched while the pointer rests (FR-186).
            return { id: "notify", items: [item], prepare: () => sheetModule.prefetch() };
          }
        : null,
    [able, store, subscriptions],
  );
}

const NONE: readonly MenuSectionSource[] = [];

/** The context menu drawn inside, with "Notify me…" in it where there is somebody to tell. */
export function NotifySections({ children }: { readonly children: ReactNode }) {
  const section = useNotifySection();
  const sections = useMemo(() => (section ? [section] : NONE), [section]);
  return <MenuSections sections={sections}>{children}</MenuSections>;
}

/**
 * WHERE THE SHEET IS DRAWN: once per provider, by the first door drawn — a
 * routed face inside a scene's shell draws it once, not twice.
 */
export function NotifyDoor() {
  const { subscriptions } = useGraview<AnySchema>();
  const id = useId();
  const asked = askedOf(subscriptions);
  useEffect(() => {
    asked.doors.push(id);
    told(asked);
    return () => {
      asked.doors.splice(asked.doors.indexOf(id), 1);
      told(asked);
    };
  }, [asked, id]);
  const subscribe = useMemo(() => (listener: () => void) => {
    asked.listeners.add(listener);
    return () => void asked.listeners.delete(listener);
  }, [asked]);
  const ask = useSyncExternalStore(subscribe, () => asked.ask, () => null);
  const mine = useSyncExternalStore(subscribe, () => asked.doors[0] === id, () => false);
  if (!ask || !mine) return null;
  return (
    <Suspense fallback={null}>
      <Sheet ask={ask} close={() => askToNotify(subscriptions, null)} />
    </Suspense>
  );
}

/** A "Notify me" press of a face's own — on a record's page, after an act — opening the sheet on these choices. */
export function NotifyButton({ choices, label = "Notify me", style, className, testId = "notify-me" }: { readonly choices: readonly SubscriptionWhen[]; readonly label?: string; readonly style?: CSSProperties; readonly className?: string; readonly testId?: string }) {
  const { principal, subscriptions, signIn } = useGraview<AnySchema>();
  if (!canBeTold(principal, signIn)) return null;
  return (
    <button type="button" data-testid={testId} className={className} onClick={(event) => askToNotify(subscriptions, { choices, returnTo: event.currentTarget })} style={style}>
      {label}
    </button>
  );
}

/** How many subscriptions the reader has, followed as they change: 0 until the store has answered. */
export function useNotifiedCount(): number {
  // Asked where there may be no provider (a routed face drawn alone): then nobody is told of anything.
  const here = useGraviewIfAny<AnySchema>();
  const subscriptions = here?.subscriptions;
  const who = here ? (here.principal.onBehalfOf ?? here.principal).id : undefined;
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (who === undefined || !subscriptions) return;
    let live = true;
    const read = () =>
      void Promise.resolve(subscriptions.list(who)).then(
        (all) => live && setCount(all.length),
        () => live && setCount(0),
      );
    read();
    const off = subscriptions.onChange?.(read);
    return () => {
      live = false;
      off?.();
    };
  }, [subscriptions, who]);
  return count;
}

/** What the reader is told of, each with its one-press "Stop": Activity's part, fetched when there is any. */
export function NotifiedDoor({ style }: { readonly style?: CSSProperties }) {
  if (useNotifiedCount() === 0) return null;
  return (
    <Suspense fallback={null}>
      <List {...(style ? { style } : {})} />
    </Suspense>
  );
}
