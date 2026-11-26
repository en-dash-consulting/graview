import { labelOf, roomsOfSchema, type AnySchema, type MessageRecord, type Principal, type Store } from "@graview/core";
import { mayEdit, mayPostIn, mayReadRoom, mayRemove, mentionablesOf, mentionsIn, messagesIn, roomKey, roomsOf, LONGEST_MESSAGE, type Mentionable, type ResolvedRoom } from "@graview/core/rooms";
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Link, useParams } from "./routing.js";
import { useStoreTick, type PageContext } from "./page-context.js";
import { PageMain } from "./page-shell.js";
import { BODY, SMALL, button, h1, h2, lede, quiet } from "./page-typography.js";
import { roomReadsFor, useRoomReads } from "./room-reads.js";

/*
 * A ROOM, DRAWN (Graview HQ feature:f-chat-rooms): what was said, live as
 * every record is, in a log a screen reader hears grow, and a composer
 * labeled for the room — Enter sends, Shift+Enter starts a new line. Your
 * own messages can be edited and removed in place; a room that lets you
 * moderate lets you remove anybody's. Reading a room moves where you have
 * read up to, which is what the bell counts from. Fetched when a room or
 * a record with a thread is first drawn.
 */

const ANYONE: Principal = { kind: "human" };

/** The rooms the store's app declares, each with its defaults. */
function roomsHere(store: Store<AnySchema>): readonly ResolvedRoom[] {
  const rooms = roomsOfSchema(store.schema);
  return rooms ? roomsOf({ rooms }) : [];
}

/** Who said it, as this reader knows them: "You", their record's name, the name they posted under, or their id. */
function authorWords(message: MessageRecord, store: Store<AnySchema>, me: string | undefined): string {
  if (me !== undefined && message.author === me) return "You";
  const record = store.graph.getNode(message.author);
  if (record) return labelOf(store.schema.tryDefinition(record.kind as string) as never, record as never);
  return message.authorName ?? message.author;
}

/** When it was said: the time today, else the day and the time. */
function whenWords(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  const today = new Date().toDateString() === date.toDateString();
  return today ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const LINK = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/;

/** One line of markdown-lite: `code`, **strong**, *emphasis*, a link, and a mention of somebody here. */
function inline(text: string, people: readonly Mentionable[], key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|(@[\p{L}\p{N}_'-]+(?: [\p{L}\p{N}_'-]+)?)/gu;
  let at = 0;
  let n = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > at) out.push(text.slice(at, start));
    const [whole, code, strong, em, link, mention] = match;
    const k = `${key}-${n++}`;
    if (code) out.push(<code key={k} style={{ fontFamily: "var(--graview-font-mono, ui-monospace, monospace)", fontSize: "0.92em", padding: "0 .25em", borderRadius: 4, background: "color-mix(in srgb, var(--graview-ink) 8%, transparent)" }}>{code.slice(1, -1)}</code>);
    else if (strong) out.push(<strong key={k}>{strong.slice(2, -2)}</strong>);
    else if (em) out.push(<em key={k}>{em.slice(1, -1)}</em>);
    else if (link && LINK.test(link)) out.push(<a key={k} href={link} target="_blank" rel="noopener noreferrer nofollow" style={{ color: "var(--graview-accent)", overflowWrap: "anywhere" }}>{link}</a>);
    else if (mention) {
      // The longest name it begins with that is somebody's: "@Sam Rivera" before "@Sam".
      const named = mentionsIn(mention, people);
      if (named.length > 0) {
        const person = people.find((one) => one.id === named[0])!;
        const said = mention.slice(1).toLowerCase().startsWith(person.name.toLowerCase()) ? `@${mention.slice(1, 1 + person.name.length)}` : mention.split(" ")[0]!;
        out.push(<strong key={k} data-testid="mention" data-person={person.id} style={{ color: "var(--graview-accent)", fontWeight: 600 }}>{said}</strong>);
        if (said.length < mention.length) out.push(mention.slice(said.length));
      } else out.push(whole);
    } else out.push(whole);
    at = start + whole.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** A message's body, drawn: paragraphs, its lines kept, markdown-lite within them. Never HTML. */
export function MessageBody({ body, people }: { readonly body: string; readonly people: readonly Mentionable[] }) {
  const paragraphs = body.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((paragraph, p) => (
        <p key={p} style={{ margin: p === 0 ? 0 : "0.5em 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {paragraph.split("\n").map((line, l) => (
            <Fragment key={l}>
              {l > 0 ? <br /> : null}
              {inline(line, people, `${p}-${l}`)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

/** What a room holds for this reader, live: its messages, the people it may name, and who the reader is in it. */
function useRoom(context: PageContext<AnySchema>, room: string, about: string | undefined) {
  const tick = useStoreTick(context.store);
  const store = context.store;
  const messages = useMemo(() => messagesIn(store.graph as never, room, about), [store, tick, room, about]);
  const people = useMemo(() => mentionablesOf(store.graph as never, store.schema), [store, tick]);
  return { messages, people };
}

/** The textarea's style, shared by the composer and an edit in place. */
const field: CSSProperties = {
  font: "inherit",
  fontSize: BODY,
  lineHeight: 1.45,
  width: "100%",
  boxSizing: "border-box",
  minHeight: "2.75rem",
  maxHeight: "12rem",
  resize: "vertical",
  padding: "10px 12px",
  borderRadius: "var(--graview-radius-sm, 8px)",
  border: "1px solid var(--graview-edge-bright)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
};

const primary: CSSProperties = { ...button, minHeight: 44, minWidth: 44, background: "var(--graview-accent)", color: "var(--graview-accent-ink)", borderColor: "transparent", fontWeight: 600 };
const small: CSSProperties = { ...button, minHeight: 32, minWidth: 44, padding: "4px 10px", background: "transparent", borderColor: "transparent", color: "var(--graview-ink-muted)" };

/** Enter sends, Shift+Enter (and a word being composed) is a new line. */
const sends = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => event.key === "Enter" && !event.shiftKey && !event.altKey && !event.nativeEvent.isComposing;

/** The words a refusal says, from whatever was thrown. */
const refusalWords = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * THE LOG OF A ROOM OR A THREAD: each message with who said it and when,
 * edited or removed where it was, and — on your own, or any for a role the
 * room lets moderate — Edit and Remove. A `log` region, so a screen reader
 * says what arrives without being asked.
 */
export function ChatLog({ context, room, about, label, tall }: { readonly context: PageContext<AnySchema>; readonly room: ResolvedRoom; readonly about?: string; readonly label: string; readonly tall?: boolean }) {
  const { messages, people } = useRoom(context, room.id, about);
  const principal = context.principal ?? ANYONE;
  const me = principal.id;
  const reads = roomReadsFor(context.viewerState, me);
  const box = useRef<HTMLDivElement>(null);
  const near = useRef(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const last = messages.at(-1);
  // Reading it is having read it: where you read up to moves to the last message here.
  useEffect(() => {
    if (last && (typeof document === "undefined" || document.visibilityState !== "hidden")) reads.mark(roomKey(room.id, about), last.at);
  }, [last?.id, last?.at, reads, room.id, about]);
  // The newest stays in sight as it arrives, unless the reader scrolled back to read.
  useLayoutEffect(() => {
    const at = box.current;
    if (at && near.current) at.scrollTop = at.scrollHeight;
  }, [messages.length]);
  const act = (name: string, args: Record<string, unknown>) => {
    try {
      context.store.apply({ name, args }, context.principal ? { author: context.principal } : {});
      setSaid(null);
      return true;
    } catch (error) {
      setSaid(refusalWords(error));
      return false;
    }
  };
  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
      <div
        ref={box}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label={label}
        data-testid="chat-log"
        data-room={room.id}
        {...(about ? { "data-about": about } : {})}
        tabIndex={0}
        onScroll={(event) => {
          const at = event.currentTarget;
          near.current = at.scrollHeight - at.scrollTop - at.clientHeight < 48;
        }}
        style={{ maxHeight: tall ? "min(62dvh, 640px)" : "min(48dvh, 420px)", overflowY: "auto", overscrollBehavior: "contain", borderRadius: "var(--graview-radius, 12px)", border: "1px solid var(--graview-edge)", background: "var(--graview-panel)", padding: "4px 0", outlineOffset: 2 }}
      >
        {messages.length === 0 ? (
          <p data-testid="chat-empty" style={{ ...quiet, margin: 0, padding: "16px" }}>
            Nothing said here yet. {mayPostIn(room, principal.roles) ? "Say the first thing." : ""}
          </p>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {messages.map((message) => {
              const mine = me !== undefined && message.author === me;
              const who = authorWords(message, context.store, me);
              const answers = message.replyTo ? messages.find((one) => one.id === message.replyTo) : undefined;
              const editable = mayEdit(message, { id: me });
              const removable = mayRemove(room, message, { id: me, roles: principal.roles });
              return (
                <li key={message.id} data-testid="message" data-message-id={message.id} {...(mine ? { "data-mine": "" } : {})} {...(message.removed ? { "data-removed": "" } : {})} style={{ display: "grid", gap: 2, padding: "8px 14px", borderTop: "1px solid color-mix(in srgb, var(--graview-edge) 55%, transparent)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0 8px" }}>
                    <span data-testid="message-author" style={{ fontWeight: 600, fontSize: SMALL, color: mine ? "var(--graview-accent)" : "var(--graview-ink)" }}>{who}</span>
                    <time dateTime={message.at} style={{ ...quiet }}>{whenWords(message.at)}</time>
                    {message.editedAt && !message.removed ? <span style={quiet}>(edited)</span> : null}
                  </div>
                  {answers ? <p style={{ ...quiet, margin: 0 }}>Replying to {authorWords(answers, context.store, me)}</p> : null}
                  {message.removed ? (
                    <p data-testid="message-removed" style={{ ...quiet, margin: 0, fontStyle: "italic" }}>This message was removed.</p>
                  ) : editing === message.id ? (
                    <EditInPlace
                      body={message.body}
                      label={`Edit your message from ${whenWords(message.at)}`}
                      onSave={(body) => {
                        if (act("edit-message", { id: message.id, body })) setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <div data-testid="message-body" style={{ fontSize: BODY, lineHeight: 1.45, color: "var(--graview-ink)" }}>
                      <MessageBody body={message.body} people={people} />
                    </div>
                  )}
                  {(editable || removable) && editing !== message.id ? (
                    <div style={{ display: "flex", gap: 4, marginInlineStart: -10 }}>
                      {editable ? (
                        <button type="button" data-testid="message-edit" style={small} aria-label={`Edit your message from ${whenWords(message.at)}`} onClick={() => setEditing(message.id)}>
                          Edit
                        </button>
                      ) : null}
                      {removable ? (
                        <button type="button" data-testid="message-remove" style={small} aria-label={mine ? `Remove your message from ${whenWords(message.at)}` : `Remove ${who}'s message from ${whenWords(message.at)}`} onClick={() => act("remove-message", { id: message.id })}>
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {said ? (
        <p role="alert" data-testid="chat-refused" style={{ ...quiet, margin: 0, color: "var(--graview-bad)" }}>
          {said}
        </p>
      ) : null}
    </div>
  );
}

/** A message edited where it stands: Enter saves, Escape leaves it as it was. */
function EditInPlace({ body, label, onSave, onCancel }: { readonly body: string; readonly label: string; readonly onSave: (body: string) => void; readonly onCancel: () => void }) {
  const [text, setText] = useState(body);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    area.current?.focus();
    area.current?.setSelectionRange(text.length, text.length);
  }, []);
  return (
    <form
      data-testid="message-editing"
      style={{ display: "grid", gap: 6 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(text);
      }}
    >
      <textarea
        ref={area}
        aria-label={label}
        value={text}
        maxLength={LONGEST_MESSAGE}
        rows={2}
        style={field}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (sends(event)) {
            event.preventDefault();
            onSave(text);
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={{ ...primary, minHeight: 36 }} data-testid="message-save">
          Save
        </button>
        <button type="button" style={{ ...button, minHeight: 36 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * THE COMPOSER: one labeled field, Enter to send and Shift+Enter for a new
 * line, and Send for a pointer. A room you may read but not post in says
 * who may, rather than offering a field that would be refused.
 */
export function Composer({ context, room, about, label }: { readonly context: PageContext<AnySchema>; readonly room: ResolvedRoom; readonly about?: string; readonly label: string }) {
  const principal = context.principal ?? ANYONE;
  const [text, setText] = useState("");
  const [said, setSaid] = useState<string | null>(null);
  const id = useId();
  const hint = `${id}-hint`;
  if (!mayPostIn(room, principal.roles)) {
    const who = room.post ?? room.read ?? [];
    return (
      <p data-testid="composer-closed" style={{ ...quiet, margin: 0 }}>
        Only {who.join(", ")} may post here.
      </p>
    );
  }
  const send = () => {
    if (text.trim() === "") return;
    try {
      context.store.apply({ name: "post-message", args: { room: room.id, ...(about ? { about } : {}), body: text } }, context.principal ? { author: context.principal } : {});
      setText("");
      setSaid(null);
    } catch (error) {
      setSaid(refusalWords(error));
    }
  };
  return (
    <form
      data-testid="composer"
      aria-label={label}
      style={{ display: "grid", gap: 6 }}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label htmlFor={id} style={{ fontSize: SMALL, fontWeight: 600, color: "var(--graview-ink)" }}>
        {label}
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          id={id}
          data-testid="composer-field"
          aria-describedby={hint}
          value={text}
          maxLength={LONGEST_MESSAGE}
          rows={2}
          placeholder="Write a message"
          style={{ ...field, flex: "1 1 auto", minWidth: 0 }}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (sends(event)) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" data-testid="composer-send" style={primary} disabled={text.trim() === ""}>
          Send
        </button>
      </div>
      <span id={hint} style={{ ...quiet }}>
        Enter sends; Shift+Enter starts a new line.{room.mentions ? " Write @ and a name to tell somebody." : ""}
      </span>
      {said ? (
        <p role="alert" data-testid="composer-refused" style={{ ...quiet, margin: 0, color: "var(--graview-bad)" }}>
          {said}
        </p>
      ) : null}
    </form>
  );
}

/** A ROOM'S OWN PAGE, at `/rooms/<room>`: its title, what it is for, what was said, and the composer. */
export function RoomPage({ context }: { readonly context: PageContext<AnySchema> }) {
  const params = useParams();
  const rooms = roomsHere(context.store);
  const room = rooms.find((one) => one.id === params["room"] && !one.about);
  const principal = context.principal ?? ANYONE;
  const heading = useId();
  useEffect(() => {
    if (room && typeof document !== "undefined") document.title = `${room.title} · ${context.brand?.name ?? "Graview"}`;
  }, [room?.title]);
  if (!room || !mayReadRoom(room, principal.roles)) {
    return (
      <PageMain context={context} data-testid="room-missing">
        <h1 style={h1}>No room here</h1>
        <p style={lede}>{room ? "This room is for some people only, and you are not among them." : "There is no room at this address."}</p>
      </PageMain>
    );
  }
  return (
    <PageMain context={context} data-testid="room-page" data-room={room.id}>
      <header style={{ display: "grid", gap: 6 }}>
        <h1 id={heading} style={h1} data-graview-page-title="">
          {room.title}
        </h1>
        {room.description ? <p style={lede}>{room.description}</p> : null}
      </header>
      <section aria-label={`What was said in ${room.title}`} style={{ display: "grid", gap: 12, minWidth: 0 }}>
        <ChatLog context={context} room={room} label={`Messages in ${room.title}`} tall />
        <Composer context={context} room={room} label={`Write in ${room.title}`} />
      </section>
    </PageMain>
  );
}

/** THE ROOMS, at `/rooms`: each app-wide room this reader may read, with what is new in it. */
export function RoomsPage({ context }: { readonly context: PageContext<AnySchema> }) {
  useStoreTick(context.store);
  const principal = context.principal ?? ANYONE;
  const rooms = roomsHere(context.store).filter((room) => !room.about && mayReadRoom(room, principal.roles));
  const reads = useRoomReads(roomReadsFor(context.viewerState, principal.id));
  return (
    <PageMain context={context} data-testid="rooms-page">
      <h1 style={h1} data-graview-page-title="">
        Rooms
      </h1>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {rooms.map((room) => {
          const messages = messagesIn(context.store.graph as never, room.id);
          const fresh = messages.filter((one) => !one.removed && one.author !== principal.id && (reads[room.id] === undefined || one.at > reads[room.id]!)).length;
          return (
            <li key={room.id}>
              <Link to={`/rooms/${room.id}`} data-testid="room-link" data-room={room.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", minHeight: 44, boxSizing: "border-box", borderRadius: "var(--graview-radius-sm, 8px)", border: "1px solid var(--graview-edge)", color: "var(--graview-ink)", textDecoration: "none" }}>
                <span style={{ fontWeight: 600 }}>{room.title}</span>
                <span style={quiet}>{fresh > 0 ? `${fresh} new` : `${messages.length} ${messages.length === 1 ? "message" : "messages"}`}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </PageMain>
  );
}

/**
 * THE THREAD UNDER A RECORD'S PAGE: each room declared about its kind,
 * with what was said about this record and the composer — a labeled
 * region of its own after the page, whoever designed the page.
 */
export function RecordThreads({ context, record }: { readonly context: PageContext<AnySchema>; readonly record: { readonly id: string; readonly kind: string } }) {
  useStoreTick(context.store);
  const principal = context.principal ?? ANYONE;
  const rooms = roomsHere(context.store).filter((room) => room.about === record.kind && mayReadRoom(room, principal.roles));
  const node = context.store.graph.getNode(record.id);
  if (!node || rooms.length === 0) return null;
  const name = labelOf(context.store.schema.tryDefinition(record.kind) as never, node as never);
  return (
    <>
      {rooms.map((room) => (
        <Thread key={room.id} context={context} room={room} record={record.id} name={name} />
      ))}
    </>
  );
}

function Thread({ context, room, record, name }: { readonly context: PageContext<AnySchema>; readonly room: ResolvedRoom; readonly record: string; readonly name: string }) {
  const heading = useId();
  const count = messagesIn(context.store.graph as never, room.id, record).filter((one) => !one.removed).length;
  const held = useRef<HTMLElement>(null);
  const lined = useLinedUpWithThePage(held);
  return (
    <section ref={held} aria-labelledby={heading} data-testid="record-thread" data-room={room.id} data-about={record} style={{ maxWidth: 760, margin: "0 auto", padding: "0 var(--graview-gutter, 20px) 40px", display: "grid", gap: 12, boxSizing: "border-box", width: "100%", ...lined }}>
      <h2 id={heading} style={h2}>
        {room.title} <span style={{ ...quiet, fontWeight: 400 }}>{count > 0 ? `· ${count}` : ""}</span>
      </h2>
      <ChatLog context={context} room={room} about={record} label={`${room.title}: messages about ${name}`} />
      <Composer context={context} room={room} about={record} label={`Write about ${name}`} />
    </section>
  );
}

/**
 * THE THREAD STANDS IN THE PAGE'S OWN COLUMN, whoever designed the page:
 * its start where the page's title starts, and no wider than the page's
 * column, measured as the page lays out — so a design's record page and
 * the thread under it read as one page.
 */
function useLinedUpWithThePage(held: { readonly current: HTMLElement | null }): CSSProperties {
  const [lined, setLined] = useState<CSSProperties>({});
  const [, again] = useState(0);
  // The page above may arrive after the thread (a design's page is fetched): asked again for a moment after the first draw.
  useEffect(() => {
    const later = [120, 600, 1500].map((ms) => setTimeout(() => again((n) => n + 1), ms));
    return () => later.forEach(clearTimeout);
  }, []);
  useLayoutEffect(() => {
    const at = held.current;
    const parent = at?.parentElement;
    if (!at || !parent || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const title = parent.querySelector<HTMLElement>("[data-graview-page-title], main h1, [data-graview-page-main] h1");
      const column = title?.closest<HTMLElement>("[data-graview-page-main], main") ?? null;
      if (!title || !column) return setLined({});
      const box = parent.getBoundingClientRect();
      const style = getComputedStyle(parent);
      const left = box.left + (parseFloat(style.paddingLeft) || 0);
      const right = box.right - (parseFloat(style.paddingRight) || 0);
      const start = Math.max(0, Math.round(title.getBoundingClientRect().left - left));
      const end = Math.min(right, column.getBoundingClientRect().right - (parseFloat(getComputedStyle(column).paddingRight) || 0)) - left;
      const width = Math.min(760, end - start);
      if (!(width > 240)) return setLined((was) => (Object.keys(was).length === 0 ? was : {}));
      setLined((was) => (was.marginInlineStart === start && was.width === width ? was : { margin: 0, marginInlineStart: start, padding: "0 0 40px", width, maxWidth: "none" }));
    };
    measure();
    const watching = new ResizeObserver(measure);
    watching.observe(parent);
    return () => watching.disconnect();
  });
  return lined;
}

export default RoomPage;
