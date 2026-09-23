import type { AnySchema, DeclarationChange, StudioDoorSource } from "@graview/core";
import { useGraview } from "@graview/react";
import { completionFor } from "@graview/tools";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { codeTouched, type Rewrite } from "./changes.js";
import { rewriteCode } from "./rewrite.js";
import type { WrittenFile } from "./source.js";
import type { Studio } from "./studio.js";
import { readCode, writeChanges, type InPlace } from "./write-in-place.js";

/**
 * THE CHANGE, WRITTEN INTO THE CHECKOUT — and the code it leaves wrong,
 * rewritten first.
 *
 * A change to the declaration is only half of a change to the app: the act
 * that ties a gardener to a plot is code, and moving the tie to plantings
 * leaves that code tying gardeners to plots. The checker cannot see it and
 * the compiler will not mind. So before anything is written, every act and
 * rule the change touches is put in front of the person — as it is written,
 * editable here, with the seat one press away for a first draft — and the
 * change is written only once each has been rewritten or said to still
 * hold. Then the door compiles the result before a byte lands.
 */
export function InPlaceWriter({
  studio,
  migration,
  files,
}: {
  readonly studio: Studio<AnySchema>;
  readonly migration: string | null;
  readonly files: readonly WrittenFile[];
}): ReactNode {
  const { intelligence } = useGraview();
  const complete = useMemo(() => completionFor(intelligence), [intelligence]);
  // Read once, as Apply was pressed: what is written is what was checked.
  const plan = useMemo(() => studio.sourceChanges(), [studio]);
  const blockers = plan.unwritten;
  const [code, setCode] = useState<StudioDoorSource | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [texts, setTexts] = useState<ReadonlyMap<string, string>>(new Map());
  const [holds, setHolds] = useState<ReadonlySet<string>>(new Set());
  const [asking, setAsking] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<InPlace | null>(null);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    if (blockers.length > 0) return;
    readCode()
      .then(setCode)
      .catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
  }, [blockers]);

  /** Every act and rule that must be rewritten or said to hold, once each. */
  const rewrites = useMemo(() => {
    if (!code) return [];
    const all = [...plan.rewrite, ...codeTouched(plan.changes, code)];
    const seen = new Map<string, Rewrite>();
    for (const one of all) {
      const key = `${one.sort}:${one.name}`;
      const held = seen.get(key);
      seen.set(key, held ? { ...held, why: `${held.why} ${one.why}` } : one);
    }
    return [...seen.values()];
  }, [code, plan]);

  /** The code as the checkout writes it — or, for one the studio is adding, as the studio would. */
  const original = (rewrite: Rewrite): string => {
    const written = (rewrite.sort === "act" ? code?.acts : code?.rules)?.[rewrite.name]?.text;
    if (written !== undefined) return written;
    return addedAs(rewrite)?.text ?? "";
  };
  /** The change that adds this act or rule, when the studio is adding it. */
  const addedAs = (rewrite: Rewrite) =>
    plan.changes.find(
      (change): change is Extract<DeclarationChange, { what: "add-act" | "add-rule" }> =>
        (change.what === "add-rule" && rewrite.sort === "rule" && change.rule === rewrite.name) ||
        (change.what === "add-act" && rewrite.sort === "act" && change.act === rewrite.name),
    );
  const keyOf = (rewrite: Rewrite) => `${rewrite.sort}:${rewrite.name}`;
  const textOf = (rewrite: Rewrite) => texts.get(keyOf(rewrite)) ?? original(rewrite);
  const settled = (rewrite: Rewrite) => holds.has(keyOf(rewrite)) || textOf(rewrite) !== original(rewrite);

  /** The changes, with each rewrite in place of what it replaces. */
  const withRewrites = (): DeclarationChange[] => {
    const edited = rewrites.filter((rewrite) => textOf(rewrite) !== original(rewrite));
    const changes = plan.changes.map((change): DeclarationChange => {
      const mine = edited.find((rewrite) => addedAs(rewrite) === change);
      return mine ? { ...change, text: textOf(mine) } as DeclarationChange : change;
    });
    for (const rewrite of edited) {
      if (addedAs(rewrite)) continue;
      changes.push(rewrite.sort === "act" ? { what: "replace-act", act: rewrite.name, text: textOf(rewrite) } : { what: "replace-rule", rule: rewrite.name, text: textOf(rewrite) });
    }
    return changes;
  };

  const write = async () => {
    setWriting(true);
    setOutcome(await writeChanges(withRewrites()));
    setWriting(false);
  };

  // Nothing to rewrite: nothing to ask the person, so it is written straight away.
  useEffect(() => {
    if (code && rewrites.length === 0 && !outcome && !writing) void write();
    // Once, when the code has been read and found untouched.
  }, [code, rewrites.length]);

  const ask = async (rewrite: Rewrite) => {
    if (!complete) return;
    setAsking(keyOf(rewrite));
    try {
      const text = await rewriteCode(complete, { ...rewrite, text: original(rewrite), changes: plan.changes });
      setTexts((current) => new Map(current).set(keyOf(rewrite), text));
    } catch (error) {
      setFailed(`The seat could not rewrite ${rewrite.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
    setAsking(null);
  };

  const quiet = { fontSize: "0.75rem", color: "var(--graview-ink-muted)" } as const;

  if (outcome?.state === "written") {
    return (
      <strong data-testid="studio-written" style={{ fontSize: "0.8125rem", fontWeight: 550 }}>
        The checker is happy, and the change is written into {outcome.paths.join(", ")}. The app reloads onto it
        {migration ? `, and a stored graph is carried forward: ${migration}` : ""}.
      </strong>
    );
  }

  const reasons = [...blockers, ...(failed ? [failed] : []), ...(outcome?.state === "not-written" ? outcome.reasons : [])];
  return (
    <>
      {/* Said before it happens: what the graph somebody already has goes through. */}
      {migration && blockers.length === 0 ? (
        <span data-testid="studio-carried" style={quiet}>
          A stored graph is carried forward when it next opens: {migration}.
        </span>
      ) : null}
      <strong style={{ fontSize: "0.8125rem", fontWeight: 550 }}>
        {blockers.length > 0
          ? "The checker is happy, but this cannot be written into the checkout yet:"
          : rewrites.length > 0
            ? `The checker is happy. Before it is written, ${rewrites.length === 1 ? "one piece of code needs" : `${rewrites.length} pieces of code need`} to say what the change means:`
            : writing || !code
              ? "Writing it into the checkout…"
              : "The checker is happy."}
      </strong>
      {reasons.length > 0 ? (
        <ul data-testid="studio-not-written" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: "0.78125rem" }}>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
          {outcome?.state === "not-written"
            ? (outcome.diagnostics ?? []).map((diagnostic) => (
                <li key={`${diagnostic.path}:${diagnostic.line}:${diagnostic.message}`}>
                  <code>
                    {diagnostic.path}:{diagnostic.line}
                  </code>{" "}
                  {diagnostic.message}
                </li>
              ))
            : null}
        </ul>
      ) : null}
      {blockers.length === 0
        ? rewrites.map((rewrite) => (
            <div key={keyOf(rewrite)} data-testid="studio-rewrite" data-name={rewrite.name} style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: "0.78125rem" }}>
                <strong>
                  The {rewrite.sort} “{rewrite.name}”
                </strong>{" "}
                <span style={quiet}>— {rewrite.why}</span>
              </span>
              <textarea
                data-testid="studio-rewrite-code"
                aria-label={`The ${rewrite.sort} ${rewrite.name}, as it will be written`}
                value={textOf(rewrite)}
                onChange={(event) => setTexts((current) => new Map(current).set(keyOf(rewrite), event.target.value))}
                spellCheck={false}
                rows={Math.min(18, textOf(rewrite).split("\n").length + 1)}
                style={{
                  font: "0.75rem/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid var(--graview-edge)",
                  background: "var(--graview-float)",
                  color: "var(--graview-ink)",
                  resize: "vertical",
                }}
              />
              <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <button
                  type="button"
                  data-testid="studio-rewrite-ask"
                  disabled={!complete || asking !== null}
                  title={complete ? "A first draft from the model the ladder has chosen — yours to read and correct" : "Choose a model from the seat's gear to have it draft this"}
                  onClick={() => void ask(rewrite)}
                  style={{ fontSize: "0.75rem" }}
                >
                  {asking === keyOf(rewrite) ? "Asking…" : "Ask the seat to rewrite it"}
                </button>
                <label style={{ ...quiet, display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    data-testid="studio-rewrite-holds"
                    checked={holds.has(keyOf(rewrite))}
                    onChange={(event) =>
                      setHolds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(keyOf(rewrite));
                        else next.delete(keyOf(rewrite));
                        return next;
                      })
                    }
                  />
                  It still holds as written
                </label>
              </span>
            </div>
          ))
        : null}
      {blockers.length === 0 && rewrites.length > 0 ? (
        <button
          type="button"
          data-testid="studio-write"
          disabled={writing || !rewrites.every(settled)}
          title={rewrites.every(settled) ? "Write the change and these into the checkout, once the compiler agrees" : "Each piece of code above needs rewriting, or saying it still holds"}
          onClick={() => void write()}
          style={{ justifySelf: "start", fontSize: "0.78125rem", fontWeight: 600 }}
        >
          {writing ? "Writing…" : "Write it into the checkout"}
        </button>
      ) : null}
      {blockers.length > 0 || failed ? <Downloads files={files} /> : null}
    </>
  );
}

/** The files, as downloads: what the studio hands over when it cannot write in place. */
export function Downloads({ files }: { readonly files: readonly WrittenFile[] }): ReactNode {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {files.map((file) => (
        <a
          key={file.path}
          data-testid={`studio-file-${file.path}`}
          download={file.path.split("/").pop()}
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(file.contents)}`}
          style={{
            minHeight: 24,
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: 999,
            border: "1px solid var(--graview-edge)",
            fontSize: "0.78125rem",
            color: "var(--graview-accent)",
            textDecoration: "none",
          }}
        >
          {file.path} ↓
        </a>
      ))}
    </div>
  );
}
