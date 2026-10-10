import { labelOf, pluralLabel, type AnySchema, type Presence, type Principal, type Store } from "@graview/core";
import { fromUrl, kindsOfAggregate } from "@graview/layout/view";
import { POPOVER_STYLE, useGraview, usePopover } from "@graview/react/provider";
import { useEffect, useState } from "react";

/*
 * WHO ELSE IS HERE, ON THE BAR (FR-155).
 *
 * Presence was drawn as figures on the scene and nowhere else: on Pages, on
 * a phone, a reader had no way to learn who was on the app with them. The
 * bar says it now on every face, from the presence the provider already
 * holds — each other person a letter in a circle, as the person's own tool
 * is drawn, ringed in their own hue; an agent a letter in a square, as the
 * scene draws an agent as a block; the rest counted. Pressed, it lists each
 * by name — "Claude, for Ada" for an agent — and where each one is, in the
 * declaration's words, in the places list's own rows; on the scene a name
 * goes where they are. Said once, politely, to whoever cannot see it;
 * drawn not at all when nobody else is.
 *
 * Fetched with the bar's panes, and only once somebody else is here: a
 * reader alone never carries it (`Here` in app-bar.tsx). Nothing here
 * imports the bar itself, which would split the bar out of the page's
 * first chunk.
 */

const HERE_CSS = `
.graview-here{display:flex;flex:none}
.graview-here>button{display:inline-flex;align-items:center;gap:4px;height:30px;margin:0;padding:0 4px;border:1px solid transparent;border-radius:8px;background:none;box-shadow:none;font:inherit;font-size:.75rem;color:var(--graview-ink-muted);cursor:pointer}
.graview-here-mark{display:inline-flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box;width:24px;height:24px;border-radius:50%;border:1.5px solid hsl(var(--graview-hue) 50% 48%);background:var(--graview-panel-muted);color:var(--graview-ink);font-size:.75rem;font-weight:600;box-shadow:0 0 0 2px var(--graview-bar)}
.graview-here-mark+.graview-here-mark{margin-left:-10px}
.graview-here-mark[data-agent]{border-radius:5px}
.graview-here-mark[data-counted]{--graview-hue:0;border-color:var(--graview-edge)}
.graview-here small{display:block;font-size:.75rem;color:var(--graview-ink-muted)}
.graview-bar[data-finding] .graview-here{display:none}`;

/** Said to assistive technology, and to no eye. */
const UNSEEN = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } as const;

/**
 * The others, as the bar says them: everybody here but this reader, in any
 * tab of theirs, each person once however many tabs they have open — the
 * one they said something from last. A viewer not signed in is one per tab.
 */
export function othersHere(who: ReadonlyMap<string, Presence>, principal: Principal): readonly Presence[] {
  // A participant is `kind:id:session` (`participantKey`): one person's tabs share all but the session.
  const mine = principal.id === undefined ? null : `${principal.kind}:${principal.id}`;
  const people = new Map<string, Presence>();
  for (const one of who.values()) {
    const person = one.participant.slice(0, one.participant.lastIndexOf(":"));
    if (person === mine) continue;
    const key = person.endsWith(":") ? one.participant : person;
    const held = people.get(key);
    if (!held || held.at < one.at) people.set(key, one);
  }
  return [...people.values()];
}

/*
 * What to call them: "Claude, for Ada" for an agent whose person may be
 * named (`presenceName` in @graview/core, said here so the page that draws
 * the bar does not carry it for a list it may never open).
 */
const nameOf = (one: Presence): string => (one.name && one.onBehalfOfName ? `${one.name}, for ${one.onBehalfOfName}` : (one.name ?? ""));

const viewers = (count: number): string => (count === 1 ? "1 viewer" : `${count} viewers`);

/**
 * WHAT IS HERE, IN A SENTENCE: "Ada Lovelace is here", "Ada Lovelace,
 * Claude, for Ada and 2 viewers are here". What the bar is called and what
 * a screen reader is told when somebody comes or goes.
 */
export function hereSaid(others: readonly Presence[]): string {
  const names = others.map(nameOf).filter(Boolean);
  const parts = names.length < others.length ? [...names, viewers(others.length - names.length)] : names;
  const last = parts.pop()!;
  return `${parts.length > 0 ? `${parts.join(", ")} and ${last}` : last} ${others.length === 1 ? "is" : "are"} here`;
}

/**
 * WHERE SOMEBODY IS, IN THE DECLARATION'S WORDS: the picture in view, by
 * its title; the record they are on, by its label; the kind they are on, by
 * its plural; the whole thing, from above. Nothing where their stop names
 * none of those, or names what this reader may not see — never an id.
 */
export function whereSaid(stop: string, input: { readonly store: Store<AnySchema>; readonly principal: Principal; readonly hidden: ReadonlySet<string>; readonly pictures: readonly { readonly kind: string; readonly as: string; readonly title: string }[] }): string | null {
  const { store, hidden, pictures } = input;
  const view = fromUrl(stop);
  const kept = store.kindsKeptFrom(input.principal);
  const may = (kind: string) => !hidden.has(kind) && !kept.has(kind) && !store.modules.disabledKinds.has(kind);
  const picture = pictures.find((one) => one.as === view.within?.["view"] && may(one.kind));
  if (picture) return picture.title;
  if (!view.focusId) return view.overview ? "the whole thing" : null;
  const kinds = kindsOfAggregate(view.focusId);
  if (kinds.length > 0) {
    if (!kinds.every(may)) return null;
    // Each by its plural as the declaration says it, a kind's name humanized where it says none: never the name as written.
    return kinds.map((kind) => pluralLabel(store.schema, kind)).join(" and ");
  }
  const node = store.graph.getNode(view.focusId);
  return node && may(node.kind as string) ? labelOf(store.schema.tryDefinition(node.kind as string), node) : null;
}

/**
 * THE OTHERS, ON THE BAR (FR-155): their marks — three, two on a phone's
 * bar — the rest counted, and the list a press opens. On the scene
 * (`scene`) a name in the list goes where they are, as their figure does;
 * on Pages it says where they are.
 */
export function Here({ scene, compact }: { readonly scene: boolean; readonly compact: boolean }) {
  const { who, principal, store, views, hiddenKinds, follow } = useGraview<AnySchema>();
  const popover = usePopover("here");
  const others = othersHere(who, principal);
  const said = others.length === 0 ? "" : hereSaid(others);
  /*
   * Written into the status after it is on the page, not with it: a live
   * region that arrives with its words already in it is read by no screen
   * reader, so the first person to come in was never said.
   */
  const [told, setTold] = useState("");
  useEffect(() => setTold(said), [said]);
  if (others.length === 0) return null;
  const named = others.filter((one) => one.name);
  const marked = named.slice(0, compact ? 2 : 3);
  const counted = others.length - marked.length;
  const unnamed = others.length - named.length;
  const pictures = views.places();
  return (
    <div className="graview-here" data-testid="here">
      <style>{HERE_CSS}</style>
      {/* Told when somebody comes or goes; where they are moves too often to be said aloud. */}
      <span role="status" aria-live="polite" style={UNSEEN}>
        {told}
      </span>
      <button type="button" data-testid="here-open" {...popover.trigger} onClick={popover.toggle} aria-label={`${said} — who and where`} title={said}>
        {marked.length > 0 ? (
          <span style={{ display: "flex" }}>
            {marked.map((one) => (
              <Mark key={one.participant} one={one} />
            ))}
          </span>
        ) : (
          <Mark count={counted} />
        )}
        {marked.length > 0 && counted > 0 ? <span aria-hidden="true">+{counted}</span> : null}
      </button>
      {/* The places list's own pane and rows (`.graview-bar-list`): one way a list hangs from the bar. */}
      <ul {...popover.pane} aria-label="Who is here" data-testid="here-list" hidden={!popover.open} className="graview-bar-list" style={POPOVER_STYLE}>
        {named.map((one) => {
          const where = whereSaid(one.stop, { store, principal, hidden: hiddenKinds, pictures });
          const name = nameOf(one);
          const Row = (scene ? "button" : "span") as "button";
          return (
            <li key={one.participant}>
              <Row
                className="graview-bar-item"
                data-testid="here-one"
                {...(scene
                  ? {
                      type: "button" as const,
                      title: `Go where ${name} is`,
                      onClick: () => {
                        popover.setOpen(false);
                        follow(one.participant);
                      },
                    }
                  : { style: { cursor: "default" } })}
              >
                <Mark one={one} />
                <span>
                  {name}
                  {where ? <small>On {where}</small> : null}
                </span>
              </Row>
            </li>
          );
        })}
        {unnamed > 0 ? (
          <li>
            <span className="graview-bar-item" data-testid="here-viewers" style={{ cursor: "default" }}>
              <Mark count={unnamed} />
              <span>
                {viewers(unnamed)}
                <small>Not signed in</small>
              </span>
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * One of the others: their letter in a circle ringed in their hue, or in a
 * square for an agent; or, for those not signed in, how many.
 */
function Mark({ one, count }: { readonly one?: Presence; readonly count?: number }) {
  return (
    <span className="graview-here-mark" aria-hidden="true" {...(one ? { style: { ["--graview-hue" as string]: Math.round(one.hue) } } : { "data-counted": "" })} {...(one?.kind === "agent" ? { "data-agent": "" } : {})}>
      {one ? (one.name ?? "").trim().charAt(0).toUpperCase() : count}
    </span>
  );
}
