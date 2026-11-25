---
name: graview-todoist
description: Keep a kind of a Graview app in step with a Todoist project, or one section or label of it, declared as a connection — a task's content, due date, deadline, priority, labels, section, assignee, parent and completion each in a field, both ways through a personal API token the host holds — and verify with graview check and a scripted Todoist that the first run sends nothing and a task completed there removes no record.
---

# Keep a kind in step with Todoist

A Todoist project is a connection of the document: each of its tasks is a
record of one kind, and a change on either side reaches the other. What a
sync engine does in general — conflicts, refusals, reports, the acts an
inbound change lands through — is `graview-sync`.

## Do this

1. **Declare it** under `connections.<name>`:

   ```json
   { "system": "todoist", "project": { "env": "HOME_PROJECT" }, "kind": "task", "direction": "both",
     "fields": { "content": "name", "description": "notes", "due": "due", "deadline": "deadline",
       "priority": "priority", "labels": "labels", "section": "list", "assignee": "who",
       "parent": "parent", "completed": "done" } }
   ```

   `project` is its id or its name, or the environment variable that holds
   one. `section` or `label` beside it keeps only those tasks; a task made
   here is put in the section, or given the label, which the labels field
   does not show. `direction` is `"both"` or `"read"` (Todoist owns the
   records, and acts here that would change one are refused); `conflicts`,
   `every` and `paused` are as any connection's.

2. **Give each part a field that can hold it.** Only `content` is required.

   | Part | Field |
   |------|-------|
   | `content`, `description` | `string` or `text` |
   | `due` | `date` (its day) or `datetime` (its moment; a full day is midnight in the account's time zone) |
   | `deadline` | `date` |
   | `priority` | `integer`, 1 the most urgent as p1 to 4; or an enum of `p1`…`p4`, or of `urgent`, `high`, `medium`, `low` |
   | `labels` | `list` of strings |
   | `section` | `string`, or an enum whose options are its sections |
   | `assignee` | `string` (the name) or `email` |
   | `parent` | a relation of one, to a kind a Todoist connection keeps |
   | `completed` | `boolean` |

3. **Map `completed`.** A task completed in Todoist sets that field and never
   removes a record; unmapped, it looks open here for good. Completing a
   task that repeats, on either side, moves it to its next date: the field
   clears and the date follows. A task deleted there, or moved out of the
   project, section or label, is removed here. Removing a record here, or
   setting it aside, deletes its task, and Todoist deletes every subtask
   with it, kept here or not; a record linked by a mapped `parent` is moved
   out from under it first.

4. **Say a repeat with `repeats: true` on the due field.** "every day",
   "every 2 weeks", "every mon, wed" and "every 2, 15" are the repeat beside
   the date. What cannot be said back with the same meaning — "every! 3
   months", "every last workday", hours, start and end dates, a repeating
   time in an account of another time zone than the app's — stays in
   Todoist, its date kept here; a change to that date here is held unsent
   and said in `report.refused`, while the rest of the record is sent; a
   repeat made here with an until, a count or a skipped day is held too, and
   a new record that says one waits whole.

5. **Give the host the token, never the document.** `serve` and `preview`
   read the account's personal API token (Todoist's Settings → Integrations
   → Developer) from `TODOIST_TOKEN`, or `<auth.env>_TOKEN`; a host that
   keeps it hands `runConnections({ token, project })`. OAuth is the host's
   own.

The transport is `packages/core/src/sync/todoist.ts`; its first comment says
what it relies on in Todoist's documentation.

## Then find out whether it worked

```sh
npx graview check --document app.json
```

It refuses a part in a field that cannot hold it (`connection-field-type`),
a field the kind lacks or one named twice (`connection-field`), a parent
that is no relation of one (`connection-relation`) or reaches a kind no
Todoist connection keeps (`connection-relation-target`), and a token written
in the declaration (`connection-secret`); it warns when nothing holds
`completed` (`connection-completed`). Report what it said.

Then run it against `scriptedTodoist()` from `@graview/core/sync` in a test,
as `declared-connections-run-beside-the-store.test.ts` does: the first pass
sends no command, a task completed there leaves its record, a record changed
here sends only what changed, and a field changed on both sides is held.
Against a real account, `node scripts/verify-todoist.mjs` (a token of your
own, never in CI) writes its claims to `docs/todoist.json`; `--stub` runs
them against the scripted one, which proves the claims and not Todoist.

## What the check cannot see

- Whether the account sees the project, and whether its plan takes
  deadlines: the pass says what Todoist refused (`report.problem`,
  `report.refused`).
- What the host keeps of the engine (`connections.json` beside the data):
  without it, a record made from a task stays as it is here and is not sent.
  A declared project, section or label that changes stops the connection,
  and removes nothing.
- Whether records already here before the connection should be sent: they
  are made in Todoist on the first pass, as any record not there is. Start
  with `"direction": "read"` to look first.
- Whether an enum's sections are the project's: a section it does not name
  is refused as it arrives.
