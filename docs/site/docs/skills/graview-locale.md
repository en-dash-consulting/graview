# graview-locale

`graview-locale` is one of Graview's 31 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Say a Graview app's money, days, times and numbers the way its people say them — a currency, a locale and a time zone declared once on the brand, a field kept as money, {net | money} and {at | time} in a template — and let graview check refuse a code, a locale or a zone it cannot write rather than trusting the page.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Money, days and times in the app's own words

A sum with no currency is a bare number, a date in somebody else's order is a misread deadline, and an instant said on the server's clock is a meeting missed by five hours. Each is said once, on the brand, and every face — record, list, card, table, form, rule and act sentence, Activity, the static page and a worker view — says it the same way. The rest of the brand, the name, mark, typeface and palette, is `graview-brand`.

### Do this

1. **Say its money.** `currency: "EUR"` and `locale: "de-DE"` on the brand (a document's `brand` may carry them alone, without an accent; the edit is `set-brand`) are what a sum is said in wherever a block names none: a figure or a field shown as money, and `{net | money}` in a template — "21.000 €". A block's own `currency` wins. Without one, sums are numbers.

1. **Mark a field as money.** A document field marked `"format": "money"` is said in it on every face — record, list, card, table, form ("$" beside the box, "$1,250.50" taken as typed) — and its own `"unit": "EUR"` wins. `set-format` changes only a field's format or unit.

1. **Say its days and numbers.** The locale says every day, time and number on every face: en-US unless it says ("Sep 10, 2023", "3:30 PM", "1,250"); "en-GB" keeps the day first. The reader's, a host's `locale` on the embed or the provider, wins over it.

1. **Say the clock an instant is read on.** `timeZone: "America/New_York"` (an IANA name, never an offset) is the clock every instant kept with a zone (`2026-10-16T14:47:00Z`) is said on: lists, record pages, an act's sentence and its echo to an agent, Activity, the date editor. A moment kept without a zone is still the wall time written. A person's zone wins where a host passes one — `timeZone` on `GraviewProvider`, the embed and the pages face, beside `locale`. A worker view is handed `locale` and `timeZone` rather than formatted strings (`graview-worker-view`).

1. **Say them in templates.** `{at | time}` ("10:47 AM"), `{at | datetime}` ("Oct 16, 2026, 10:47 AM EDT"), `{at | date}` and `relative` (an instant's day counted on the app's clock); a field block takes `as: "time"`, `as: "datetime"` and `as: "money"`.

### Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
npx graview check --document app.json   # a document
```

It refuses what it cannot write — a currency that is not a three-letter code (`brand-currency`), a locale it does not know (`brand-locale`), a zone the runtime does not know or an offset (`brand-time-zone`) — and warns `money-currency` where a money field has neither its own unit nor the app's currency. Report what it said. Then open a record holding a sum and an instant with your machine's clock set elsewhere: the sum carries its symbol, and the time is on the declared clock, not the machine's.

### What the check cannot see

- Whether the zone is the one the people work in. A team across two zones wants each reader's zone passed by the host, not one declared for all.
- Whether a field that holds money was marked as money. An unmarked number is said as a number, faithfully.

---

Say a Graview app's money, days, times and numbers the way its people say them — a currency, a locale and a time zone declared once on the brand, a field kept as money, {net | money} and {at | time} in a template — and let graview check refuse a code, a locale or a zone it cannot write rather than trusting the page.

The page: https://graview.dev/docs/skills/graview-locale.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
