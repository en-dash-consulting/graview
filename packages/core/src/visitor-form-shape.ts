/**
 * A FORM FOR A VISITOR (Roadmap f-public-forms): one act, opened to people
 * who never join the workspace — an RSVP, a sign-up, a request — whose
 * answers land as records.
 *
 *   forms: { rsvp: { act: "add-guest", title: "RSVP", say: "The hosts will write to you a week before." } }
 *
 * The form is not a second permission system. A visitor is a principal
 * like any other, holding one role (`visitor` unless the form says
 * another), and the policy decides what that role may do and see exactly as
 * it decides a member's: a grant lets the role run the form's act, and a
 * sight that never names the role keeps every record from it. The host
 * mints the visitor once per submission (`formVisitor` in
 * `@graview/core/forms`, an id such as `form:<token>`), so the log names
 * each answer "a visitor via the RSVP form", and draws the form alone
 * (`@graview/embed/form`). `graview check` holds the declaration to that
 * (`form-*`): an act the role is not granted, a field the visitor could
 * not fill, a picker that would show records, a policy that serves the
 * visitor every record.
 */
export interface VisitorFormDeclaration {
  /** The act the form runs: one that makes a record, or another that acts on none. */
  readonly act: string;
  /** What the form is called, at its head and in the log ("a visitor via the RSVP form"). The form's name in words, unsaid. */
  readonly title?: string;
  /** A sentence or two above the fields: what is being asked, and for what. */
  readonly intro?: string;
  /** The act's arguments the form asks for, in order. Every one a visitor can fill, unsaid. */
  readonly fields?: readonly string[];
  /** What the visitor is told once it is received: what happens next, in the app's own words. */
  readonly say?: string;
  /** What the submit button says. The act's title, unsaid. */
  readonly submit?: string;
  /** The role the visitor holds. `visitor`, unsaid. */
  readonly role?: string;
}

/** The role a visitor holds where the form names none. */
export const VISITOR_ROLE = "visitor";
