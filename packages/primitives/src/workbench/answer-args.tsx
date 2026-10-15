import { humanizeField, isRepeatField, labelOf, linkedRelationOf, nounOf, repeatedBy, type AnySchema, type Store } from "@graview/core";
import { edgeWords } from "@graview/core/words";
import { amountBox, amountInBox, argumentWords, parseDuration, readAmount, tellApart } from "@graview/core/words";
import { edgeOfSelection, kindsOf } from "@graview/layout/view";
import { useGraviewIfAny } from "@graview/react/provider";
import type { Affordance, OpenParameter } from "@graview/tools";
import { Files } from "../files-door.js";
import { LinkedPicker } from "../linked-record-door.js";
import { RepeatPicker } from "../repeat-picker-door.js";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";


/**
 * The controls for one action's unanswered arguments, walked in order.
 *
 * One at a time and in sequence, because an action can need several: drafting
 * work needs both what it is and how big it is, and asking for the first
 * while ignoring the second would produce a deliverable with an invented
 * size. Each argument draws the control its declared shape asks for — a
 * picker when it names a node, a date field when it is a date, an enum's own
 * options when it is a choice.
 */
export function AnswerArgs({
  affordance,
  onApply,
  onCancel,
  store: given,
}: {
  readonly affordance: Affordance;
  /** The store it asks about, where it is drawn outside a provider (a routed face's list); the provider's otherwise. */
  readonly store?: Store<AnySchema>;
  /** Applies the answers. Returns the arguments a refusal named, when it named any, so the ask goes back to them. */
  onApply: (args: Record<string, unknown>) => readonly string[] | void;
  onCancel: () => void;
}) {
  const provided = useGraviewIfAny<AnySchema>();
  const store = (given ?? provided?.store)!;
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState("");
  /** What has been chosen so far, for an argument that takes several. */
  const [picked, setPicked] = useState<readonly string[]>(NOTHING_PICKED);
  /** How a date repeats, for an argument that says so: what the picker holds. */
  const [repeat, setRepeat] = useState<unknown>(undefined);

  // Stable across the walk's steps, so the group's label never dangles.
  const promptId = useId();
  const asked = useRef<HTMLDivElement>(null);

  const remaining = affordance.open.filter((parameter) => !(parameter.name in answers));
  const parameter = remaining[0];
  const act = store.allMutations().find((mutation) => mutation.name === affordance.mutation);
  /*
   * A RECORD'S CHANGE ASKS FROM WHAT THE RECORD HOLDS (Roadmap
   * f-edit-form-prefilled): each question of "Change the feature" opens on
   * the record's value — typed in its box, or its choice marked — and an
   * answer left as it was is not sent, so the change says only what changed.
   */
  const start = useMemo(() => editStartOf(act, store, affordance.args ?? {}), [act, store, affordance.args]);
  const now = parameter ? start[parameter.name] : undefined;

  useEffect(() => {
    setDraft(typedOf(now, parameter?.shape));
    setPicked(Array.isArray(now) ? (now as string[]) : NOTHING_PICKED);
    setRepeat(now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameter?.name]);

  /*
   * AND IT IS ON THE SCREEN.
   *
   * The pane scrolls inside itself, and an ask opened under a list of acts
   * taller than the pane lands below its fold: on a phone the field, the
   * Apply and the Skip were all off the bottom of the window, so pressing
   * an act looked like pressing a button that did nothing. The ask is the
   * thing that just happened, so it is what the pane shows. `nearest`
   * moves the pane the least amount that works and leaves everything
   * already visible where it is.
   */
  useEffect(() => {
    // Optional: jsdom has no scrolling at all, and a pane that cannot
    // scroll needs none.
    asked.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [parameter?.name]);

  /*
   * THE NEXT QUESTION TAKES THE KEYBOARD. A text field asks with
   * `autoFocus`; a question of choices had nothing, so a choice pressed
   * before another question of choices took its button away with it and
   * left the keyboard on <body> — "Fuel", then "Gearbox", sixteen questions
   * into "Put a car on sale" (the seventh walk).
   */
  useLayoutEffect(() => {
    const box = asked.current;
    const now = typeof document === "undefined" ? null : document.activeElement;
    if (!box || (now && now !== document.body && !box.contains(now))) return;
    const first = box.querySelector<HTMLElement>("form input, [role=group] button:not([disabled])");
    if (first && first !== now) first.focus();
  }, [parameter?.name]);

  if (!parameter) return null;

  /*
   * An OPTIONAL argument may be passed over. A skipped one is answered
   * `undefined` here so the walk moves on, and left out of what is applied,
   * so the mutation sees only what was actually said. Skipping every one
   * of them is allowed: the mutation's own refusal then says what it
   * needed, on the button, which is the honest answer to an empty change.
   */
  const answer = (given: unknown) => {
    // An answer the record already holds changes nothing, and is not sent.
    const value = now !== undefined && JSON.stringify(given) === JSON.stringify(now) ? undefined : given;
    const next = { ...answers, [parameter.name]: value };
    const outstanding = affordance.open.filter((other) => !(other.name in next));
    if (outstanding.length === 0) {
      const refused = onApply(Object.fromEntries(Object.entries(next).filter(([, given]) => given !== undefined)));
      /*
       * BACK TO THE ANSWER THAT WAS REFUSED. Sixteen questions in, "Photos —
       * invalid URL" left the ask on its last step, where Apply could only
       * be refused again: the one wrong answer was three questions back and
       * the only way to it was to start over.
       */
      if (refused && refused.length > 0) {
        setAnswers(Object.fromEntries(Object.entries(next).filter(([name]) => !refused.includes(name))));
      }
    } else setAnswers(next);
  };
  const skip = parameter.optional ? (
    <button type="button" onClick={() => answer(undefined)} style={{ fontSize: "0.8125rem" }}>
      Skip
    </button>
  ) : null;

  const shape = parameter.shape ?? { type: "unknown" as const };
  const amount = shape.type === "number" ? shape.amount : undefined;
  const choices = choicesFor(parameter, shape);
  /* The record's own words for an argument that fills one of its fields: "Body style", "SUV" (see `argumentWords`). */
  const words = argumentWords(store.schema, act, parameter.name);
  // A record in another app (FR-171), read off the act's own input.
  const linked = linkedRelationOf(((act?.input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {})[parameter.name]);
  // How a date repeats, asked with the picker the pages ask with, beside the date it repeats — never as a box to type in.
  const repeats = isRepeatField(((act?.input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {})[parameter.name]);
  const repeated = repeatedBy(parameter.name);
  // The choice the record holds, marked among the others: a yes or no as one of the two.
  const was = typeof now === "boolean" ? (now ? "yes" : "no") : now;
  /*
   * A PICKER THAT DROPS CHOICES MAKES THE ACT IMPOSSIBLE, AND SAYS NOTHING.
   *
   * This listed the first ten and stopped. A property with twenty-two
   * practices on it offered ten of them under "Name something that helps",
   * and the other twelve could not be chosen at all — not behind a control,
   * not summarized as "+12", simply absent, with the panel looking exactly
   * as it would if ten were all there were.
   *
   * Ten is still the right number to SHOW; a wall of forty chips is its own
   * kind of unusable. What was missing is the way through — a filter, and a
   * count of what is not on screen. Neither is a new idea here: the strip
   * has had both since it was written. It just never reached the ask.
   */
  const [among, setAmong] = useState("");
  /* Two candidates with one name are told apart by what differs (see `tellApart`). */
  const apart = useMemo(() => {
    const nodes = choices.map((choice) => store.graph.getNode(choice)).filter((node): node is NonNullable<typeof node> => node !== undefined);
    return tellApart(nodes, (kind) => store.schema.tryDefinition(kind));
  }, [choices, store]);
  const say = (choice: string) => {
    const plain = said(store, shape, choice);
    const named = (shape.type === "choice" || (shape.type === "several" && shape.of.type === "choice")) ? words.option(choice) : plain;
    const told = apart.get(choice);
    return told ? `${named} · ${told}` : named;
  };
  const matching = useMemo(() => {
    const term = among.trim().toLowerCase();
    if (term === "") return choices;
    return choices.filter((choice) => say(choice).toLowerCase().includes(term));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices, among, store, shape, apart]);
  /*
   * AN ARGUMENT THAT TAKES A LIST IS ANSWERED WITH A LIST.
   *
   * "Invite somebody as coordinator and gardener" is one act with several
   * roles in one argument. Answered one press at a time it would be one
   * role, silently — so the presses TOGGLE and a separate one settles the
   * question. Nothing else about the walk changes: it is still one
   * parameter, still skippable when optional, still applied when the last
   * outstanding one is answered.
   */
  const several = shape.type === "several";
  const fileShape = shape.type === "file" ? shape : shape.type === "several" && shape.of.type === "file" ? shape.of : undefined;
  /* Several of something typed rather than chosen: one field, its entries separated by commas. */
  const listed = several && choices.length === 0;

  /*
   * THE ASK SAYS WHAT IT IS ASKING, IN WORDS.
   *
   * The text branch has said so since W-004 — the input's own label and
   * placeholder are the question. The CHOICES branch said nothing at all: an
   * act with one node reference to fill put two bare buttons on the strip
   * ("Ana", "Bo") under no heading, so what was being asked was a guess for
   * anyone looking and unsaid entirely for anyone listening. And where a
   * step counter did name the parameter it used the declaration's
   * IDENTIFIER — "dependsOn · 1 of 2" — which is the same bug W-004 fixed
   * one element lower down.
   */
  /*
   * A NODE PICKER IS NAMED BY WHAT IT PICKS — "Item", not "Id".
   *
   * The routed face has said so since it was written ("the argument's name
   * is an implementation detail, and the kinds it accepts are the
   * declaration's own word for the thing" — `formFields` in
   * `@graview/pages`), and the strip asked with the argument's identifier.
   * Every scaffolded app names its subject argument `id`, as the skills'
   * own examples do, so an act offered from the FAR END of its tie — "Hand
   * one back", standing on the person — put the word "Id" over a list of
   * items.
   */
  const asking =
    parameter.kinds && parameter.kinds.length > 0 && !parameter.kinds.includes("*")
      ? parameter.kinds.map((kind) => humanizeField(nounOf(store.schema.tryDefinition(kind), kind))).join(" or ")
      : words.label;
  const step =
    affordance.open.length > 1
      ? `${asking} · ${affordance.open.length - remaining.length + 1} of ${affordance.open.length}`
      : asking;

  return (
    <div
      ref={asked}
      // An ask says it is one, so a harness can ask whether the thing it
      // opened is on the screen rather than off the side of the pane.
      data-graview-asking={affordance.id}
      style={{
        display: "grid",
        /*
         * THE ASK FITS THE PANE IT OPENS IN.
         *
         * An auto track takes the min-content width of what is in it, and a
         * text input's is its own default size — so a field, an Apply and a
         * Skip came to 257 inside a 236-wide rail, and the Skip was drawn
         * past the pane's edge, half of it painted and none of it reachable
         * without scrolling a pane that shows no scrollbar. `minmax(0, 1fr)`
         * says the track may not be wider than the pane; the input already
         * carries `minWidth: 0`, so it is the thing that gives.
         */
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 4,
        padding: "5px 0 2px",
      }}
    >
      {/* A single text field is named by the field itself; naming it twice
          over is the same sentence twice. Anything else needs the question. */}
      {affordance.open.length > 1 || choices.length > 0 ? (
        <span id={promptId} style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>
          {step}
        </span>
      ) : null}

      {choices.length > SHOWN ? (
        <input
          type="search"
          value={among}
          onChange={(event) => setAmong(event.target.value)}
          placeholder={`Filter ${choices.length}…`}
          aria-label={`Filter ${asking}`}
          data-testid="ask-filter"
          style={{ font: "inherit", fontSize: "0.8125rem", minWidth: 0, padding: "3px 7px" }}
        />
      ) : null}

      {repeats ? (
        <form
          style={{ display: "grid", gap: 4 }}
          onSubmit={(event) => {
            event.preventDefault();
            // Repeating no more is said as null, which the field keeps; what it held before is not sent again.
            answer(repeat ?? (now === undefined ? undefined : null));
          }}
        >
          <RepeatPicker value={repeat} onChange={setRepeat} start={repeated ? (answers[repeated] ?? start[repeated]) : undefined} label={`${repeated ? argumentWords(store.schema, act, repeated).label : words.label} repeats`} name={parameter.name} />
          <span style={{ display: "flex", gap: 4 }}>
            <button type="submit" style={{ fontSize: "0.8125rem" }}>
              {remaining.length > 1 ? "Next" : "Apply"}
            </button>
            {skip}
          </span>
        </form>
      ) : linked ? (
        /* A record in another app (FR-171) is answered by picking one there, from what the host lists for this seat. */
        <div style={{ display: "grid", gap: 4 }}>
          <LinkedPicker relation={linked} value={now} onChange={answer} label={words.label} />
          {skip}
        </div>
      ) : fileShape ? (
        /* A picture or a document is answered by putting it there: the host's upload, then the act (FR-163). */
        <div style={{ display: "grid", gap: 4 }}>
          <Files as="control" value={now} onChange={answer} several={several} image={fileShape.image === true} label={words.label} />
          {skip}
        </div>
      ) : choices.length > 0 ? (
        <div
          role="group"
          aria-labelledby={promptId}
          style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
        >
          {matching.slice(0, SHOWN).map((choice) => {
            const held = several ? picked.includes(choice) : choice === was;
            return (
              <button
                key={choice}
                type="button"
                // The question travels with the answer: a control read on its
                // own says what choosing it would mean.
                aria-label={`${asking}: ${say(choice)}`}
                {...(several ? { "aria-pressed": held } : held ? { "aria-current": true } : {})}
                style={{
                  padding: "3px 9px",
                  fontSize: "0.8125rem",
                  ...(held
                    ? { borderColor: "var(--graview-accent)", color: "var(--graview-accent)" }
                    : {}),
                }}
                onClick={() =>
                  several
                    ? setPicked((current) =>
                        current.includes(choice)
                          ? current.filter((other) => other !== choice)
                          : [...current, choice],
                      )
                    : answer(shape.type === "boolean" ? choice === "yes" : choice)
                }
              >
                {say(choice)}
              </button>
            );
          })}
          {matching.length > SHOWN ? (
            <span
              data-testid="ask-more"
              style={{ alignSelf: "center", fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}
            >
              {matching.length - SHOWN} more — type to narrow
            </span>
          ) : null}
          {matching.length === 0 ? (
            <span
              data-testid="ask-none"
              style={{ alignSelf: "center", fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}
            >
              None of the {choices.length} match that.
            </span>
          ) : null}
          {several ? (
            <button
              type="button"
              disabled={picked.length === 0}
              style={{ fontSize: "0.8125rem" }}
              onClick={() => {
                const chosen = picked;
                setPicked(NOTHING_PICKED);
                answer(chosen);
              }}
            >
              {remaining.length > 1 ? "Next" : "Apply"}
            </button>
          ) : null}
          {skip}
        </div>
      ) : (
        <form
          // And where even a shrunk field would leave no room to type, the
          // buttons drop to a line of their own rather than squeezing it to
          // nothing.
          style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
          onSubmit={(event) => {
            event.preventDefault();
            // The record's own value, left as it was typed in: nothing to change.
            if (now !== undefined && draft === typedOf(now, shape)) {
              answer(undefined);
              return;
            }
            /*
             * SEVERAL WORDS, typed as one line: "Heated seats, Apple CarPlay"
             * is two features, and nothing is none. A list of text asked as
             * one field sent the line as a string, and the car could not be
             * put on sale from the scene.
             */
            if (listed) {
              answer(draft.split(/[,\n]/).map((one) => one.trim()).filter(Boolean));
              return;
            }
            if (draft.trim().length === 0) return;
            // An amount as it is said: "$1,250.50" is 1250.5; what is no number is not sent.
            if (amount) {
              const read = readAmount(draft, amount);
              if (read !== undefined) answer(read);
              return;
            }
            answer(shape.type === "number" ? (shape.duration ? (parseDuration(draft) ?? draft) : Number(draft)) : draft);
          }}
        >
          {shape.type === "text" && shape.long ? (
            /* Prose is asked for in a text area (FR-147): Enter is a new line, Ctrl or ⌘ with Enter answers. */
            <textarea
              autoFocus
              name={parameter.name}
              aria-label={words.label}
              placeholder={words.label}
              value={draft}
              rows={4}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") onCancel();
                else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              style={{
                flex: "1 1 100%",
                minWidth: 0,
                font: "inherit",
                fontSize: "0.875rem",
                lineHeight: 1.45,
                padding: "5px 8px",
                borderRadius: 7,
                border: "1px solid var(--graview-edge)",
                background: "var(--graview-panel)",
                color: "var(--graview-ink)",
                resize: "vertical",
                fieldSizing: "content",
                minHeight: "5.5em",
                maxHeight: "40vh",
              } as CSSProperties}
            />
          ) : (
          <input
            autoFocus
            type={shape.type === "date" ? (shape.time ? "datetime-local" : "date") : shape.type === "number" && !shape.duration && !amount ? "number" : shape.type === "text" && shape.holds === "phone" ? "tel" : "text"}
            {...(amount ? { inputMode: "decimal" as const, "data-graview-amount": amount.format ?? "unit" } : {})}
            /*
             * A FIELD IS ASKED FOR IN WORDS. `dependsOn` and `label` are the
             * declaration's identifiers; the pages face has always humanized
             * them ("Depends on", "Label") and the scene asked with the raw
             * key, so the same act read two ways on the two faces.
             */
            name={parameter.name}
            aria-label={words.label}
            placeholder={listed ? `${words.label}, separated by commas` : amount ? `${words.label}, ${amountBox(amount).hint} — ${amountBox(amount).prefix ?? ""}${amountBox(amount).placeholder}${amountBox(amount).suffix ? ` ${amountBox(amount).suffix}` : ""}` : words.label}
            value={draft}
            {...(shape.type === "number" && shape.min !== undefined ? { min: shape.min } : {})}
            {...(shape.type === "number" && shape.max !== undefined ? { max: shape.max } : {})}
            {...(shape.type === "number" && shape.step !== undefined ? { step: shape.step } : {})}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancel();
            }}
            style={{
              flex: 1,
              minWidth: 0,
              font: "inherit",
              fontSize: "0.875rem",
              padding: "5px 8px",
              borderRadius: 7,
              border: "1px solid var(--graview-edge)",
              background: "var(--graview-panel)",
              color: "var(--graview-ink)",
            }}
          />
          )}
          <button type="submit" disabled={!listed && draft.trim().length === 0} style={{ fontSize: "0.8125rem" }}>
            {remaining.length > 1 ? "Next" : "Apply"}
          </button>
          {skip}
        </form>
      )}
    </div>
  );
}

const NOTHING_PICKED: readonly string[] = [];

/**
 * The record's own values for each field its derived edit asks — what
 * `editStart` (`@graview/core/forms`) gives a page's form, read here
 * without that barrel, which the scene would otherwise fetch whole before
 * it draws. Nothing for any other act.
 */
function editStartOf(act: { readonly derived?: { readonly act: string }; readonly subject?: { readonly arg: string }; readonly writes?: readonly string[] } | undefined, store: Store<AnySchema>, args: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const id = act?.derived?.act === "edit" && act.subject ? args[act.subject.arg] : undefined;
  const node = typeof id === "string" ? (store.graph.getNode(id) as Readonly<Record<string, unknown>> | undefined) : undefined;
  return node ? Object.fromEntries((act!.writes ?? []).filter((field) => node[field] !== undefined && node[field] !== null).map((field) => [field, node[field]])) : {};
}

/** A record's value as its ask's box holds it: "1,250.50" beside its "$", "2026-10-20", "Heated seats, CarPlay". */
function typedOf(value: unknown, shape: OpenParameter["shape"]): string {
  if (typeof value === "number") return shape?.type === "number" && shape.amount ? amountInBox(value, shape.amount) : String(value);
  if (Array.isArray(value)) return value.every((one) => typeof one === "string") ? value.join(", ") : "";
  if (typeof value !== "string") return "";
  return shape?.type === "date" ? (shape.time ? value.slice(0, 16).replace(" ", "T") : value.slice(0, 10)) : value;
}

/** How many choices an ask shows at once. Past this it offers a filter. */
export const SHOWN = 10;

function choicesFor(
  parameter: OpenParameter,
  shape: NonNullable<OpenParameter["shape"]>,
): readonly string[] {
  if (parameter.candidates && parameter.candidates.length > 0) return parameter.candidates;
  if (shape.type === "choice") return shape.options;
  // SEVERAL OF A CHOICE is the same list of buttons; what differs is that
  // pressing one adds it rather than settling the question.
  if (shape.type === "several" && shape.of.type === "choice") return shape.of.options;
  // Yes or no is a choice of two, and reads better as two buttons than as
  // a text field somebody has to know to type "true" into.
  if (shape.type === "boolean") return YES_NO;
  return [];
}

/** The two answers to a boolean, in the words a person would use. */
const YES_NO = ["yes", "no"] as const;

/**
 * How one possible answer reads.
 *
 * A node reference reads as the node's own label; anything else reads as
 * itself. `nameOf` would look "yes" up as a node id, fail to find one, and
 * show the id — which is right for nodes and nonsense for a boolean or an
 * enum value.
 */
export function said(
  store: Store<AnySchema>,
  shape: NonNullable<OpenParameter["shape"]>,
  choice: string,
): string {
  if (shape.type === "boolean" || shape.type === "choice") return choice;
  if (shape.type === "several" && shape.of.type === "choice") return choice;
  return nameOf(store, choice);
}

/** A node's own label where there is one, so a picker never offers raw ids. */
export function nameOf(store: Store<AnySchema>, id: string): string {
  /*
   * A selected KIND CARD names its kind, in the plural the declaration
   * already carries — "Gardeners", never "kind:gardener". In an empty app
   * the kind card is the first thing anyone selects, so the raw id here was
   * the first string the interface ever showed them.
   */
  const edge = edgeOfSelection(id);
  // A relation by its words ("Where they work"), never its name ("Works at").
  if (edge) {
    // In the words of the kind the line leaves: kinds may word a shared relation their own way.
    const words = edgeWords(store.schema, store.graph.getNode(edge.from)?.kind ?? "", edge.kind, "out");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  const kinds = kindsOf(id);
  if (kinds.length > 0) {
    return kinds
      .map((kind) => {
        const definition = store.schema.tryDefinition(kind);
        return definition?.plural ?? `${kind}s`;
      })
      .join(" + ");
  }
  const node = store.graph.getNode(id);
  if (!node) return id;
  return labelOf(store.schema.tryDefinition(node.kind), node);
}
