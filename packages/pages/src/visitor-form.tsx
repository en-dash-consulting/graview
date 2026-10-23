import type { AnySchema, GraviewApp, Principal, Store } from "@graview/core";
import { formReceived, visitorForm } from "@graview/core/forms";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DerivedForm } from "./form.js";
import { useReadersServed } from "@graview/react/provider";

/**
 * `@graview/pages/visitor-form` — ONE ACT'S FORM, ALONE, FOR A VISITOR (Roadmap
 * f-public-forms).
 *
 * An RSVP or a sign-up link is a page with nothing on it but the question:
 * no app bar, no lists, no record, no seat — the declaration's
 * `forms.<name>` drawn as its title, its intro, the fields it names and
 * a submit, and once the answer is received, "Received — thank you." and
 * what happens next in the declaration's own words.
 *
 * The visitor is the principal the host minted for this submission
 * (`formVisitor`), and the form is drawn over the store as that seat is
 * served it, so a picker offers only what the policy shows the visitor —
 * for a form `graview check` passes, nothing — and the act runs as them,
 * judged by the store like any other.
 */
export interface VisitorFormPageProps<S extends AnySchema> {
  readonly app: GraviewApp<S>;
  readonly store: Store<S>;
  /** The form's name in the declaration's `forms`. */
  readonly form: string;
  /** The visitor minted for this submission (`formVisitor(app, form, "form:<token>")`). */
  readonly principal: Principal;
  /** The level the form's title is said at: `1` when the page is the form (the default). */
  readonly heading?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Told once the answer is received. */
  readonly onSubmitted?: (form: string) => void;
}

const page: CSSProperties = { maxWidth: 560, margin: "0 auto", padding: "40px 20px 64px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 };

export function VisitorFormPage<S extends AnySchema>({ app, store, form: name, principal, heading = 1, onSubmitted }: VisitorFormPageProps<S>) {
  const form = useMemo(() => visitorForm(app, name, store.allMutations() as never), [app, name, store]);
  // The store as the visitor is served it: a picker offers only what their sight shows — and, in an app that publishes, once how readers are served is here.
  const ready = useReadersServed(store);
  const seen = useMemo(() => (ready ? store.seenBy(principal) : store), [ready, store, principal]);
  const [received, setReceived] = useState(false);
  const told = useRef<HTMLDivElement>(null);
  // The keyboard lands on what was said, not on the page's body, once the form it was in is gone.
  useEffect(() => {
    if (received) told.current?.focus();
  }, [received]);
  const Title = `h${heading}` as "h1";
  if (!ready) return null;
  if (!form) {
    return (
      <main data-graview-visitor-form={name} style={page}>
        <p role="alert">There is no form here.</p>
      </main>
    );
  }
  const words = formReceived(form);
  return (
    <main data-graview-visitor-form={name} aria-labelledby="graview-visitor-form-title" style={page}>
      <Title id="graview-visitor-form-title" style={{ margin: 0, fontSize: "var(--graview-text-title)" }}>
        {form.title}
      </Title>
      {received ? (
        <div ref={told} role="status" tabIndex={-1} data-graview-part="received" style={{ display: "grid", gap: 8, outline: "none" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{words.said}</p>
          {words.next ? <p style={{ margin: 0 }}>{words.next}</p> : null}
        </div>
      ) : (
        <>
          {form.intro ? <p style={{ margin: 0, color: "var(--graview-ink-muted)" }}>{form.intro}</p> : null}
          <DerivedForm
            store={seen}
            mutation={form.act}
            principal={principal}
            only={form.fields.map((field) => field.name)}
            label={form.submit}
            onDone={() => {
              setReceived(true);
              onSubmitted?.(name);
            }}
          />
        </>
      )}
    </main>
  );
}
