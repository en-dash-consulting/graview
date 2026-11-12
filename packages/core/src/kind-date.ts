/**
 * THE KIND'S DATE, ONE RULE FOR EVERY READER (Roadmap
 * f-better-bare-app-defaults): the field a glance leads with when nothing
 * declares a glance, and the one `composeDesign` sorts a kind's list and
 * leads its row with. The field its `when` role names, where that is a date
 * or a moment; else its first date or moment that is not bookkeeping — the
 * day a record was made or last changed (`createdAt`, `updated_on`,
 * `lastSeen`) says when somebody typed, not when the thing is.
 */
export interface DatedField {
  readonly name: string;
  readonly type: string;
}

/** A field that keeps when a record was written or touched, not when what it is about happens. */
export const BOOKKEEPING_DATE = /^(?:created|updated|modified|edited|changed|deleted|removed|archived|restored|synced|imported|exported|indexed|seen|viewed|read|touched|last[A-Z_-]\w*)(?:[_-]?(?:at|on|date|time|stamp))?$/i;

const dated = (type: string) => type === "date" || type === "datetime";

/** The kind's date among its fields, in declared order: its `when` role's first, else its first date or moment that is not bookkeeping. */
export function kindDateField(fields: readonly DatedField[], when?: string): DatedField | undefined {
  const role = when === undefined ? undefined : fields.find((field) => field.name === when && dated(field.type));
  return role ?? fields.find((field) => dated(field.type) && !BOOKKEEPING_DATE.test(field.name));
}
