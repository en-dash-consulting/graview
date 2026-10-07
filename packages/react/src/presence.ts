import { foldPresence, hueFor, nameOfAuthor, REMOTE_PRESENCE_TTL_MS, type AnySchema, type Person, type Presence, type PresenceChannel, type Principal, type SettingDeclaration, type Store } from "@graview/core";
import { fromUrl, sameView, toUrl, type ViewState } from "@graview/layout/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pickedFrom } from "./picked.js";
import { participantOf as keyOf, type RobotState } from "./robot.js";
import type { ReaderMemory } from "./settings.js";

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
export function tabSession(memory?: ReaderMemory): string {
  const fresh = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  try {
    const kept = memory ?? sessionStorage;
    const held = kept.getItem(SESSION_KEY);
    if (held) return held;
    const made = fresh();
    kept.setItem(SESSION_KEY, made);
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
  honored: "root-attribute",
  options: [
    { value: "shared", label: "Shown" },
    { value: "private", label: "Hidden" },
  ],
  initial: "shared",
};
export const SHARE_OVER: SettingDeclaration = {
  name: "share-over",
  title: "What you point at",
  description: "Whether the others see the thing under your pointer, outlined in your color.",
  honored: "root-attribute",
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
  /** How long a participant the channel told of stands without a fresh word. Default `REMOTE_PRESENCE_TTL_MS`. */
  readonly ttlMs?: number;
  /** The host's directory and the seats, so this tab is called what everybody else calls it. */
  readonly people?: readonly Person[];
  readonly seats?: readonly { readonly label: string; readonly principal: Principal }[];
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
  const { channel, store, view, principal, session, robots, seatWho, settingValues, setView, ttlMs = REMOTE_PRESENCE_TTL_MS, people, seats } = inputs;
  const [who, setWho] = useState<ReadonlyMap<string, Presence>>(() => new Map());
  const [over, setOver] = useState<string | null>(null);
  const [followingId, setFollowingId] = useState<string | null>(null);

  const named = typeof principal.id === "string" && principal.id.length > 0;
  const shareWhere = named && (settingValues[SHARE_WHERE.name] ?? SHARE_WHERE.initial) === "shared";
  const shareOver = shareWhere && (settingValues[SHARE_OVER.name] ?? SHARE_OVER.initial) === "shared";
  const participant = keyOf({ kind: principal.kind, ...(principal.id ? { id: principal.id } : {}), session });
  const name = named ? nameOfAuthor(principal, { graph: store.graph as never, schema: store.schema, ...(seats ? { seats } : {}), ...(people ? { people } : {}) }) : "";

  /* What this tab says about itself — recomputed when anything in it moves. */
  const robot = seatWho ? robots.get(`agent:${seatWho}:${session}`) : undefined;
  const mine = useMemo<Presence | null>(() => {
    if (!channel || !shareWhere) return null;
    return {
      participant,
      kind: principal.kind,
      name,
      // For whom this seat acts, said as a server would say it (FR-47); a server builds its own from the seat regardless.
      ...(principal.onBehalfOf?.id ? { onBehalfOf: principal.onBehalfOf.id, ...(principal.onBehalfOf.name ? { onBehalfOfName: principal.onBehalfOf.name } : {}) } : {}),
      hue: hueFor(principal.id ?? "nobody"),
      stop: toUrl(view),
      ...(shareOver ? { over } : {}),
      ...(robot ? { robot: { at: robot.at, mode: robot.mode } } : {}),
      at: new Date().toISOString(),
    };
  }, [channel, shareWhere, shareOver, participant, name, principal.id, principal.kind, principal.onBehalfOf?.id, principal.onBehalfOf?.name, view, over, robot?.at, robot?.mode]);

  /* Say it: on change, and on the heartbeat while it stands. */
  useEffect(() => {
    if (!channel) return;
    if (!mine) return;
    channel.here(mine);
    const beat = setInterval(() => channel.here({ ...mine, at: new Date().toISOString() }), HEARTBEAT_MS);
    return () => clearInterval(beat);
  }, [channel, mine]);

  /*
   * HEAR IT, AND FORGET THE GONE (FR-13). What a channel says is folded
   * through the TTL as it arrives, so a stale word is never drawn, and
   * swept again while anybody stands, so somebody the channel never drops
   * leaves the map when their last word is older than the TTL. A host's own
   * channel need not keep time for the framework.
   */
  useEffect(() => {
    if (!channel) return;
    const stop = channel.onWho((others) => setWho(foldPresence(new Map(), others, Date.now(), ttlMs)));
    return stop;
  }, [channel, ttlMs]);
  const anybody = who.size > 0;
  useEffect(() => {
    if (!anybody) return;
    const sweep = setInterval(() => {
      setWho((current) => {
        const kept = foldPresence(current, [], Date.now(), ttlMs);
        return kept.size === current.size ? current : kept;
      });
    }, Math.max(250, Math.min(1000, ttlMs / 4)));
    return () => clearInterval(sweep);
  }, [anybody, ttlMs]);

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
