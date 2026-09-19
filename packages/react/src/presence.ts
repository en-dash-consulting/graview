import { hueFor, type AnySchema, type Presence, type PresenceChannel, type Principal, type SettingDeclaration, type Store } from "@graview/core";
import { fromUrl, kindsOfAggregate, sameView, toUrl, type ViewState } from "@graview/layout";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DrawnBox } from "./context.js";
import { pickedFrom } from "./picking.js";
import { participantOf as keyOf, type RobotState } from "./robot.js";

/*
 * WHO IS WHERE — the others, on your own map.
 *
 * Presence is a payload and never a pixel: a participant, the stop they are
 * on (`toUrl(view)`, the complete answer), what they are hovering if they
 * chose to share it, where their robot stands, and when they last said so.
 * Each viewer places the others with its own `whereIs`, so two windows of
 * different sizes agree about who is at the tasks plot while agreeing about
 * nothing else. Nothing here writes to the store: a person standing
 * somewhere is a fact about that person at that screen, like their text
 * size — the recorded precedent is `settings.ts`.
 */

const SESSION_KEY = "graview:session";

/**
 * ONE ID PER TAB, kept for the tab's life. It fills `Author.session` on
 * this tab's ops AND the presence key, so the log's `participantOf(op)`
 * and the figure standing on the map are the same person by construction.
 * (Before this, every seat's session was "ui", and two tabs of one seat
 * were one participant.)
 */
export function tabSession(): string {
  const fresh = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  try {
    const held = sessionStorage.getItem(SESSION_KEY);
    if (held) return held;
    const made = fresh();
    sessionStorage.setItem(SESSION_KEY, made);
    return made;
  } catch {
    // A private window or a test: this visit still has a session, it is just not remembered.
    return fresh();
  }
}

/**
 * PRIVACY IS A READER SETTING, in the profile pane with the others and kept
 * in the browser, never the graph. Where you are is shared by default for
 * a named seat and never for an anonymous one; what you point at is
 * private until you say otherwise.
 */
export const SHARE_WHERE: SettingDeclaration = {
  name: "share-where",
  title: "Where you are",
  description: "Whether the others here see which stop you are on.",
  honoured: "root-attribute",
  options: [
    { value: "shared", label: "Shown" },
    { value: "private", label: "Hidden" },
  ],
  initial: "shared",
};
export const SHARE_OVER: SettingDeclaration = {
  name: "share-over",
  title: "What you point at",
  description: "Whether the others see the thing under your pointer, outlined in your colour.",
  honoured: "root-attribute",
  // Four labels, all different: two pairs reading "Seen / Private" put the
  // same word twice on the pane, which the audit counts as the repeat it is.
  options: [
    { value: "private", label: "Kept to yourself" },
    { value: "shared", label: "Outlined for others" },
  ],
  initial: "private",
};
export const PRESENCE_SETTINGS: readonly SettingDeclaration[] = [SHARE_WHERE, SHARE_OVER];

/** How often a tab says where it is, unprompted: the served poll's own pace. */
export const HEARTBEAT_MS = 800;

/* ------------------------------------------------------------- placement */

export type Placed =
  | {
      readonly kind: "person";
      readonly presence: Presence;
      readonly point: { x: number; y: number };
      /** What they stand at: a plot, or the audience row of a screen. */
      readonly at: string;
      readonly index: number;
      readonly of: number;
      readonly audience: boolean;
    }
  | { readonly kind: "edge"; readonly presence: Presence; readonly point: { x: number; y: number } }
  | { readonly kind: "count"; readonly at: string; readonly point: { x: number; y: number }; readonly n: number }
  | { readonly kind: "robot"; readonly presence: Presence; readonly point: { x: number; y: number }; readonly mode: string }
  | { readonly kind: "over"; readonly presence: Presence; readonly box: DrawnBox };

/** How many stand in a row before the rest are a number. */
export const AUDIENCE_ROW = 3;

/** Where a stop puts somebody: the audience row of the showing they are watching, else the plot their focus names. */
export function anchorOf(stop: string): { readonly at: string; readonly audience: boolean } | null {
  const view = fromUrl(stop);
  const focus = view.focusId;
  if (!focus) return null;
  const showing = view.within?.["view"];
  if (showing) {
    const [kind] = kindsOfAggregate(focus);
    if (kind) return { at: `screen:${kind}`, audience: true };
  }
  return { at: focus, audience: false };
}

/**
 * THE OTHERS, PLACED. Pure — a test can ask what a viewer would draw from
 * a list of presences and a `whereIs`. People at one anchor stand in a
 * row; past `AUDIENCE_ROW` the rest are "+n". Anonymous viewers are a count
 * at their plot, never a figure. Somebody whose stop is nowhere on this
 * map is an indicator at the edge, named. A robot stands where its owner's
 * presence says, captioned as theirs; a shared hover is an outline.
 */
export function placeOthers(
  who: readonly Presence[],
  whereIs: (id: string) => DrawnBox | null,
  width: number,
  height: number,
): Placed[] {
  const placed: Placed[] = [];
  const rows = new Map<string, Presence[]>();
  const counts = new Map<string, { n: number; box: DrawnBox }>();
  let edges = 0;
  for (const presence of who) {
    const anchor = anchorOf(presence.stop);
    const box = anchor ? whereIs(anchor.at) : null;
    if (!anchor || !box) {
      if (presence.name) {
        placed.push({ kind: "edge", presence, point: { x: width - 8, y: 40 + edges++ * 28 } });
      }
      continue;
    }
    if (!presence.name) {
      const held = counts.get(anchor.at);
      counts.set(anchor.at, { n: (held?.n ?? 0) + 1, box });
      continue;
    }
    const row = rows.get(anchor.at) ?? [];
    row.push(presence);
    rows.set(anchor.at, row);
    if (row.length > AUDIENCE_ROW) continue;
    const anchorBox = box;
    const index = row.length - 1;
    // A row in front of the screen; a huddle at a plot's foot, a little left of its robot.
    const point = anchor.audience
      ? { x: anchorBox.x + anchorBox.width * 0.5 + (index - 1) * 26, y: anchorBox.y + Math.min(anchorBox.height, 24) }
      : { x: anchorBox.x + anchorBox.width * 0.5 - 26 - index * 22, y: anchorBox.y + anchorBox.height - 4 };
    placed.push({ kind: "person", presence, point, at: anchor.at, index, of: row.length, audience: anchor.audience });
  }
  for (const [at, row] of rows) {
    if (row.length <= AUDIENCE_ROW) continue;
    const box = whereIs(at);
    if (!box) continue;
    placed.push({ kind: "count", at, point: { x: box.x + box.width * 0.5 + 2 * 26 + 18, y: box.y + box.height - 4 }, n: row.length - AUDIENCE_ROW });
  }
  for (const [at, { n, box }] of counts) {
    placed.push({ kind: "count", at, point: { x: box.x + box.width * 0.5 + 40, y: box.y + box.height - 4 }, n });
  }
  for (const presence of who) {
    if (!presence.name) continue;
    if (presence.robot?.at && presence.robot.mode !== "docked") {
      const box = whereIs(presence.robot.at);
      if (box) placed.push({ kind: "robot", presence, point: { x: box.x + box.width / 2 + 22, y: box.y + box.height - 4 }, mode: presence.robot.mode });
    }
    if (presence.over) {
      const box = whereIs(presence.over);
      if (box) placed.push({ kind: "over", presence, box });
    }
  }
  return placed;
}

/* ------------------------------------------------------------------ state */

export interface PresenceInputs<S extends AnySchema> {
  readonly channel: PresenceChannel | undefined;
  readonly store: Store<S>;
  readonly view: ViewState;
  readonly principal: Principal;
  readonly session: string;
  readonly robots: ReadonlyMap<string, RobotState>;
  readonly seatWho: string | null;
  readonly settingValues: Readonly<Record<string, string>>;
  setView(next: ViewState | ((current: ViewState) => ViewState)): void;
}

export interface PresenceState {
  /** The others, by participant. Empty without a channel. */
  readonly who: ReadonlyMap<string, Presence>;
  /** How this tab is seen, or null when it broadcasts nothing. */
  readonly sharing: { readonly participant: string; readonly name: string } | null;
  /** Whose stop this tab is adopting, if anybody's. */
  readonly following: Presence | null;
  follow(participant: string | null): void;
}

/**
 * Owned by the provider beside the activity and the robots. Publishes on
 * view change, robot change and heartbeat; folds what the channel says
 * into `who`; adopts a followed person's stop until you move yourself or
 * press Escape. Nothing ever writes presence to the store.
 */
export function usePresenceState<S extends AnySchema>(inputs: PresenceInputs<S>): PresenceState {
  const { channel, store, view, principal, session, robots, seatWho, settingValues, setView } = inputs;
  const [who, setWho] = useState<ReadonlyMap<string, Presence>>(() => new Map());
  const [over, setOver] = useState<string | null>(null);
  const [followingId, setFollowingId] = useState<string | null>(null);

  const named = typeof principal.id === "string" && principal.id.length > 0;
  const shareWhere = named && (settingValues[SHARE_WHERE.name] ?? SHARE_WHERE.initial) === "shared";
  const shareOver = shareWhere && (settingValues[SHARE_OVER.name] ?? SHARE_OVER.initial) === "shared";
  const participant = keyOf({ kind: principal.kind, ...(principal.id ? { id: principal.id } : {}), session });
  const name = named ? String((store.graph.getNode(principal.id!) as { label?: string } | undefined)?.label ?? principal.id) : "";

  /* What this tab says about itself — recomputed when anything in it moves. */
  const robot = seatWho ? robots.get(`agent:${seatWho}:${session}`) : undefined;
  const mine = useMemo<Presence | null>(() => {
    if (!channel || !shareWhere) return null;
    return {
      participant,
      name,
      hue: hueFor(principal.id ?? "nobody"),
      stop: toUrl(view),
      ...(shareOver ? { over } : {}),
      ...(robot ? { robot: { at: robot.at, mode: robot.mode } } : {}),
      at: new Date().toISOString(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, shareWhere, shareOver, participant, name, principal.id, view, over, robot?.at, robot?.mode]);

  /* Say it: on change, and on the heartbeat while it stands. */
  useEffect(() => {
    if (!channel) return;
    if (!mine) return;
    channel.here(mine);
    const beat = setInterval(() => channel.here({ ...mine, at: new Date().toISOString() }), HEARTBEAT_MS);
    return () => clearInterval(beat);
  }, [channel, mine]);

  /* Hear it. */
  useEffect(() => {
    if (!channel) return;
    const stop = channel.onWho((others) => setWho(new Map(others.map((presence) => [presence.participant, presence]))));
    return stop;
  }, [channel]);

  /* Leave when the page goes, not only when React unmounts. */
  useEffect(() => {
    if (!channel || typeof window === "undefined") return;
    const gone = () => channel.leave();
    window.addEventListener("pagehide", gone);
    return () => window.removeEventListener("pagehide", gone);
  }, [channel]);

  /* What you point at, only while you share it: read the way a click reads it. */
  useEffect(() => {
    if (!shareOver || typeof document === "undefined") return;
    let last: string | null = null;
    const moved = (event: PointerEvent) => {
      const picked = pickedFrom(event.target);
      if (picked === last) return;
      last = picked;
      setOver(picked);
    };
    document.addEventListener("pointermove", moved, { passive: true });
    return () => document.removeEventListener("pointermove", moved);
  }, [shareOver]);

  /* FOLLOW A PERSON: adopt their stop as it changes, until you move yourself or press Escape. */
  const adopted = useRef<{ stop: string; at: number } | null>(null);
  const following = followingId ? (who.get(followingId) ?? null) : null;
  const follow = useCallback((next: string | null) => {
    adopted.current = null;
    setFollowingId(next);
  }, []);
  useEffect(() => {
    if (!followingId) return;
    if (!following) {
      // They left. Nothing to follow.
      setFollowingId(null);
      return;
    }
    if (following.stop === adopted.current?.stop) return;
    adopted.current = { stop: following.stop, at: Date.now() };
    setView(fromUrl(following.stop));
  }, [followingId, following, setView]);
  useEffect(() => {
    const held = adopted.current;
    if (!followingId || held === null) return;
    /*
     * A stop of your own is you leaving: the mirror of navigating away from
     * a robot. Compared as views, not strings, and not in the moment of
     * landing — the provider resolves an adopted stop against what this
     * seat may see, and that resolution is arrival, not departure.
     */
    if (Date.now() - held.at < 400) return;
    if (!sameView(view, fromUrl(held.stop))) setFollowingId(null);
  }, [view, followingId]);
  useEffect(() => {
    if (!followingId || typeof document === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFollowingId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [followingId]);

  return useMemo(
    () => ({
      who,
      sharing: mine ? { participant, name } : null,
      following,
      follow,
    }),
    [who, mine, participant, name, following, follow],
  );
}
