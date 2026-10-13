# A spreadsheet brought in (FR-177)

Most apps begin as a spreadsheet somebody already keeps: the vendors for a
wedding, the volunteers for a rota, the parts in a shop. Retyping it one act at
a time — or having a chat call `act_batch` fifty records at a time — is how a
sheet used to become an app. `@graview/core/import` takes the rows as they are.

```ts
import { importRows, parseCsv, previewImport, proposeMapping } from "@graview/core/import";

const rows = parseCsv(text);                                 // a file, or a paste from a sheet
const { mapping, unmatched, missing } = proposeMapping(app, "vendor", rows[0]);
const preview = previewImport(store, "vendor", rows, mapping, { by: person });
// preview.sentence: "56 rows: 52 vendors would be made, with 61 links; 4 rows would be refused."
// preview.rows[n].sentence: "Row 4 would make The Rolling Bakery, linked to Smith wedding and Garcia rehearsal dinner."

const done = importRows(store, "vendor", rows, mapping, { by: person });
store.undo(done.batch);                                      // the whole import, back the way it came
```

## The rows and the mapping

`rows` is either arrays of cells whose first row is the header, or records keyed
by header (what a spreadsheet library hands back, with numbers, booleans and
`Date`s as they are). A row is numbered as the sheet numbers it — the header is
row 1 — and a blank row is passed over without losing its number.

`mapping` maps a column header to where its cells go:

| Target | Means |
|--------|-------|
| `"bookedOn"` | The field of that name, or else the relation of that name |
| `{ field: "bookedOn" }` | The field, and only the field |
| `{ relation: "serves" }` | A relation the kind declares: the new record links to the record the cell names |
| `{ relation: "holds", direction: "in" }` | A relation another kind declares toward this one: the named record links to the new one |
| `null` | Not imported (as is a column the mapping leaves out) |

A mapping that names a field or relation the kind has not got, or a column the
header has not got, throws `ImportMappingError` before any row is read: it is
the caller's to fix, not the sheet's.

`proposeMapping(app, kind, header)` proposes one from the header row: a field
by its name, its label, or its name spoken ("Booked on" for `bookedOn`); a
relation by its name, its words from either end, or the noun or plural of the
kind at its far end ("Event" for a link to an event). A header that starts with
the kind's noun is read without it ("Vendor name" is the name). It answers
`{ mapping, columns, unmatched, missing }` — each column with the words it was
matched by, the headers nothing answers to, and the required fields no column
fills — for a seat or a builder to offer and a person to correct.

## How a cell is read

By its field's type in the declaration:

| Type | Reads |
|------|-------|
| `date` | `2023-09-10`, `9/10/2023` (US; `dayFirst: true` for `10/9/2023`), `9/10/23`, `Sep 10, 2023`, `10 September 2023`, a sheet's serial day, a `Date` |
| `datetime` | A date as above, then `14:30`, `2:30 PM` or `2pm`; an ISO instant with a zone is kept as written |
| `number`, `integer` | `$1,200.50`, `USD 40`, `12 kg`, `(300)` for a loss, `15%` as 0.15; an integer refuses `4.5` |
| `enum` | The option or its words (`display.format`), case and spacing aside: `MUSIC`, `Music`, `music` |
| `boolean` | yes/no, y/n, true/false, x, ✓/✗, 1/0, on/off |
| `url` | An address without a scheme gets `https://` |
| `list` | Split on semicolons or line breaks, else commas, each part read as the list's own type |
| `string`, `text`, `email` | As written, trimmed |

A blank cell leaves the field unset (or at its declared default); `n/a`, `-`,
`none` and `tbd` are blank in a column of numbers, dates or choices. The field's
own schema has the last word — a rating of 9 where the field allows 1 to 5 is
refused in its words.

A cell under a relation names a record of the kind at the far end, the way acts
take names: an exact label, or the one label it starts. Several names in one
cell — `Smith wedding; Garcia rehearsal dinner` — are several links, unless the
relation is to one. A name is looked up under the importer's sight, so a record
kept from them is one no row can name; failing that, among the rows the same
import makes above it.

## What is kept

Every row that fits lands as **one batch**: each record is its own op ("Add a
vendor: Bloom & Co"), under the batch intent "Import 52 vendors", attributed to
`by` and recorded `via: "import"`. `store.undo(result.batch)` takes all of it
back. Ids are minted as an act's `freshId` mints them, `vendor:bloom-co`,
numbered past one already held.

A row that does not fit is left out, with every reason it does not:

- "“soon” under Booked on is not a date"
- "“Juggling” under Category is none of its 12 choices"
- "“Smith” under Event could be Smith reunion or Smith wedding"
- "no event is called “Johnson gala”"
- "it has no Name, which every vendor needs"

and the rest still land. `result` says `made`, `linked`, `refused`, the columns
`ignored`, the rows each with its sentence, `batch`, `ops`, and the problems the
import `introduces` (rules it broke that were not broken before).

## Who may import

The importer is held to the acts that **create** the kind: who may bring one
into being by hand may bring one in from a sheet. A policy that refuses every
such act to them, or an agent's `may` that names none, refuses every row in its
own words ("Not permitted: “Add a vendor” — a planner can."). A kind of a module
the workspace has turned off is refused. Where no policy is declared, a kind no
act creates is the host's to import; where one is, nobody's.

A host's `admit` (as on `applyAll`) is asked with the import as planned before
anything is kept, and whatever it throws goes on up with nothing kept — the way
a host holds a workspace to its size.

`preview: true`, or `previewImport`, answers all of the above and keeps
nothing: the log, the graph and the subscribers are as they were.

## What it is not

- **Not an agent tool.** No tool is derived for it: a seat that proposes
  changes would hand a sheet's worth of records to a model for no reason. A
  host that wants a chat to import exposes `importRows` behind its own tool,
  with the rows the person handed it.
- **Not a sync.** An import makes records; it does not match a row to a record
  already there. Importing the same sheet twice makes each record twice (the
  second numbered `-2`). Two-way sync is `@graview/core/sync`.
- **Not several kinds at once.** One import, one kind; a sheet that holds
  vendors and their events is two imports, the events first so the vendors can
  name them.
