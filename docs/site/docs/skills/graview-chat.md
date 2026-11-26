# graview-chat

`graview-chat` is one of Graview's 33 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Let the people in a Graview app talk to each other inside it — a room for the whole app, a thread on each record of a kind, mentions that tell the person named, unread counts on the bell — declared as rooms and checked by graview check; and let a host offer "Chat with …" its own staff through a support transport, each message carrying where the person was.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Let people talk inside the app

People who share an app talk about it somewhere else — a group chat, an email thread — and lose the record they were talking about. A **room** puts that talk in the app: declared once, beside `kinds`, so the checker reads it, every face draws it, and what is said is a record the app's sight, roles, history and undo already hold.

```jsonc
"rooms": {
  "household": { "title": "Household" },                       // one room for the whole app
  "task-talk": { "title": "Talk about it", "about": "task",     // a thread on each task
                 "moderate": ["keeper"] },
  "keepers":   { "title": "Keepers", "read": ["keeper"] }        // only some roles read it
}
```

The same shape in `defineApp({ rooms })`. A room's address word is lowercase and hyphenated; `title` is what people see. `read`, `post` and `moderate` name roles: unsaid, whoever may see the app (or the record, for a thread) reads it, whoever reads it posts, and only each message's author removes it. `mentions: false` reads `@Name` as plain words. Every key is in `@graview/core/dist/document.schema.json` under `rooms`.

### What you get without writing it

- **The `message` kind and three acts**, folded in by `defineApp` and a compiled document: `post-message`, `edit-message` (its author's) and `remove-message` (its author's, or anybody's for a `moderate` role). They are ordinary acts: an agent's seat has them as tools and posts as itself, and undo takes a message back. Do not declare a `message` kind or acts of those names yourself.
- **Sight.** A room that `read`s only some roles is kept from everybody else — the room, its messages and their history. A thread follows its record: a seat that may not see a task sees none of what was said about it. Hand a page `store.seenBy(principal)` and it is already so.
- **The face.** Each app-wide room is a page at `/rooms/<word>` (and in the bar's More); a record with a thread shows it under its page, in the page's column, whoever designed the page. A log a screen reader hears grow, a labeled composer — Enter sends, Shift+Enter is a new line — and Edit and Remove on what is yours.
- **Mentions and unread.** `@Nora` tells Nora through the subscriptions' hook (`onSubscriptionMatch`, `when.on: "mentioned"`), where a host sends an email or a push. What a person has not read is counted on the bell ("2 new in Household"; "Sam mentioned you" needs them), from a read-up-to marker kept like any per-viewer value (`viewerState`, view `graview:rooms`).
- **Kept out of** lists, the Map's districts, the home, Activity and a static export. For a template or a remix, pass the snapshot through `withoutTalk` from `@graview/core/rooms`.

The worked example is `apps/todo/src/domain/app.ts` (a room and a thread on each task); `apps/gauntlet/src/domain/app.ts` has one only some roles read and a thread on a kind a visitor cannot see.

### Chat with the host's staff

A host — Graview Cloud, your own product — offers its people a way to ask it for help from inside any app. Give `PagesApp`'s context, or `mount`, `support`:

```ts
import { memorySupport } from "@graview/core/rooms";
support: { title: "Graview", transport: myStaffTransport ?? memorySupport() }
```

The person's menu then says "Chat with Graview" and opens a panel that says replies come later. The transport is `{ send(message, context), subscribe(onReply), history?() }`; the thread is the person's and the staff's, never in the app's graph. Each message carries `context`: the app, the place and record, the person and their roles, what they last could not do (the friction digest) and the version — so staff never ask. Without `support`, nothing shows.

### Then find out whether it worked

```sh
npx graview check            # room-* findings, each with its fix
npx graview describe .       # "Where its people talk": each room, who reads and posts
```

`graview check` names a thread on a kind the app lacks (`room-about-unknown`), a role the policy does not know (`room-role-unknown`), two rooms of one title or a room titled as a place (`room-title-taken`), a room with no title (`room-title-missing`), an address word that is not one (`room-id`), a role that may post but not read (`room-post-not-read`), and a `message` kind or a room act of your own (`room-kind-taken`, `room-act-taken`). Each says the edit.

Then open it as two people. Two browsers on one served store (`graview serve`, and the example's `server` parameter) each see the other's message as it is said; sit down as a seat a room does not admit and it says "No room here"; open the record page of a record that seat cannot see and there is nothing to read. `pnpm verify rooms` in the framework does all of it, at a desk, on a phone and from the keyboard.

### What the check cannot see

- **Whether people will use it.** A room nobody opens is noise on the bar; start with one, and threads where talk is already about a record.
- **Delivery.** A mention is a subscription match; whether it reaches a phone is the host's hook. A page alone tells only its own bell.
- **The staff behind a transport.** `memorySupport` answers in the page for development; a real inbox, its replies and its limits are the host's.
- **Moderation as policy.** `moderate` lets roles remove; deciding what should be removed is people's.

---

Let the people in a Graview app talk to each other inside it — a room for the whole app, a thread on each record of a kind, mentions that tell the person named, unread counts on the bell — declared as rooms and checked by graview check; and let a host offer "Chat with …" its own staff through a support transport, each message carrying where the person was.

The page: https://graview.dev/docs/skills/graview-chat.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
