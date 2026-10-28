import type { Expr } from "./parse.js";
import { isWeekday, minutesOfTime, patternHasTime, patternProblem } from "./when.js";

/*
 * WHAT AN EXPRESSION WORKS OUT, READ WITHOUT RUNNING IT (Roadmap
 * f-formula-text-datetime). The evaluator says a type mistake in a
 * sentence when a record is judged; `graview check` says the ones it can
 * see in the declaration alone — `format(hours, 'EEE')` of a number field,
 * a pattern piece the language does not know, a time of day not written
 * `HH:MM` — at the expression's path, so a document is not kept with a
 * title that can never be built. Coarse on purpose: a name whose type the
 * declaration does not say is unknown, and unknown is never a finding.
 */

export type ValueType = "text" | "number" | "boolean" | "date" | "datetime" | "record" | "set" | "list" | "nothing" | "unknown";

/** A declared field's type as the language sees it. */
export function valueTypeOfField(type: string | undefined): ValueType {
  switch (type) {
    case "string":
    case "text":
    case "enum":
    case "url":
    case "email":
    case "phone":
    case "place":
      return "text";
    case "number":
    case "integer":
    case "duration":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    case "list":
      return "list";
    default:
      return "unknown";
  }
}

const DATES: ReadonlySet<ValueType> = new Set(["date", "datetime", "nothing", "unknown"]);

/** A finding the reading makes: its code, the sentence, and what to do. */
export interface TypeProblem {
  readonly code: "expr-type" | "format-pattern";
  readonly sentence: string;
  readonly fix?: string;
}

/**
 * What an expression works out, as far as the declaration says.
 * `fieldTypeOf` answers a bare name of the subject with its declared field
 * type, or undefined for a relation, a computed field or an argument.
 */
export function typeOfExpr(expr: Expr, fieldTypeOf: (name: string) => string | undefined): ValueType {
  const type = (e: Expr): ValueType => {
    switch (e.t) {
      case "lit":
        return e.value === null ? "nothing" : typeof e.value === "string" ? "text" : typeof e.value === "number" ? "number" : "boolean";
      case "ident": {
        const declared = fieldTypeOf(e.name);
        return declared === undefined ? "unknown" : valueTypeOfField(declared);
      }
      case "list":
        return "list";
      case "member":
        return "unknown";
      case "unary":
        return e.op === "!" ? "boolean" : "number";
      case "where":
        return "set";
      case "binary": {
        if (["||", "&&", "==", "!=", "<", "<=", ">", ">=", "in"].includes(e.op)) return "boolean";
        if (e.op === "&" || e.op === "|") return "set";
        const [a, b] = [type(e.left), type(e.right)];
        if (e.op === "-" && (a === "set" || b === "set")) return "set";
        if (e.op === "+" && (a === "text" || b === "text")) return "text";
        return "number";
      }
      case "call":
        switch (e.fn) {
          case "today":
          case "date":
          case "startOfWeek":
            return "date";
          case "now":
          case "datetime":
          case "at":
          case "addMinutes":
            return "datetime";
          case "format":
          case "concat":
          case "lower":
          case "weekday":
            return "text";
          case "count":
          case "sum":
          case "min":
          case "max":
          case "len":
          case "days":
          case "hours":
          case "round":
            return "number";
          case "exists":
          case "every":
          case "some":
          case "present":
          case "contains":
          case "startsWith":
          case "archived":
            return "boolean";
          case "out":
          case "in":
          case "all":
          case "sort":
            return "set";
          case "first":
            return "record";
          case "if": {
            const [, then, otherwise] = e.args;
            const a = then ? type(then) : "unknown";
            const b = otherwise ? type(otherwise) : "unknown";
            return a === b ? a : a === "nothing" ? b : b === "nothing" ? a : "unknown";
          }
          default:
            return "unknown";
        }
    }
  };
  return type(expr);
}

/** How a value the reading knows is said in a sentence. */
const said = (t: ValueType): string => (t === "text" ? "words" : t === "number" ? "a number" : t === "boolean" ? "a yes or no" : t === "list" ? "a list" : t === "set" ? "a set of records" : t === "record" ? "a record" : t);

/** What the argument is called in a sentence: a field by name, anything else by what it works out. */
const named = (e: Expr, t: ValueType): string => (e.t === "ident" ? `"${e.name}" is ${said(t)}` : `it was given ${said(t)}`);

/**
 * The type mistakes the declaration alone shows in an expression: a date
 * function given what is not a date, a `format(…)` pattern with a piece the
 * language does not know, a time of day or a weekday not written as the
 * language takes them. Each once, in the order met.
 */
export function typeProblemsOf(expr: Expr, fieldTypeOf: (name: string) => string | undefined): TypeProblem[] {
  const out: TypeProblem[] = [];
  const type = (e: Expr) => typeOfExpr(e, fieldTypeOf);
  const needsDate = (fn: string, e: Expr | undefined) => {
    if (!e) return;
    const t = type(e);
    if (!DATES.has(t) && !(e.t === "lit" && typeof e.value === "string" && !Number.isNaN(Date.parse(e.value)))) {
      out.push({ code: "expr-type", sentence: `${fn}(…) needs a date, and ${named(e, t)}`, fix: "give it a date or datetime field, today(), now(), or a value the date functions build" });
    }
  };
  const visit = (e: Expr): void => {
    switch (e.t) {
      case "lit":
      case "ident":
        return;
      case "list":
        e.items.forEach(visit);
        return;
      case "member":
        visit(e.object);
        return;
      case "unary":
        visit(e.operand);
        return;
      case "binary":
        visit(e.left);
        visit(e.right);
        return;
      case "where":
        visit(e.set);
        visit(e.filter);
        return;
      case "call": {
        e.args.forEach(visit);
        const [first, second] = e.args;
        switch (e.fn) {
          case "format": {
            needsDate("format", first);
            if (second?.t === "lit" && typeof second.value === "string") {
              const problem = patternProblem(second.value);
              if (problem) out.push({ code: "format-pattern", sentence: problem, fix: "write the pattern from EEE, EEEE, d, MMM, MMMM, yyyy, h:mm a and HH:mm, with any other words in single quotes" });
              // A day alone has no time of day to say: a time piece of it would say nothing.
              else if (first && type(first) === "date" && patternHasTime(second.value)) {
                out.push({ code: "format-pattern", sentence: `format(…) asks for a time of day, and ${first.t === "ident" ? `"${first.name}"` : "what it is given"} is a date with no time of day`, fix: "say a datetime field, or leave h:mm a and HH:mm out of the pattern" });
              }
            } else if (second) {
              out.push({ code: "format-pattern", sentence: "format(…) says its pattern in quotes, like format(start, 'EEE h:mm a')", fix: "write the pattern as a quoted word" });
            }
            return;
          }
          case "datetime":
          case "at": {
            needsDate(e.fn, first);
            if (second?.t === "lit" && (typeof second.value !== "string" || minutesOfTime(second.value) === undefined)) {
              out.push({ code: "expr-type", sentence: `${e.fn}(…) needs a time of day written like '09:30', and was given ${typeof second.value === "string" ? `"${second.value}"` : said(type(second))}`, fix: "write the time as hours and minutes, '09:30' or '17:00'" });
            } else if (second && second.t !== "lit") {
              const t = type(second);
              if (t !== "text" && t !== "unknown" && t !== "nothing") out.push({ code: "expr-type", sentence: `${e.fn}(…) needs a time of day written like '09:30', and ${named(second, t)}`, fix: "give it a string field holding a time of day, or write the time in quotes" });
            }
            return;
          }
          case "addMinutes": {
            needsDate("addMinutes", first);
            if (second) {
              const t = type(second);
              if (t !== "number" && t !== "unknown" && t !== "nothing") out.push({ code: "expr-type", sentence: `addMinutes(…) needs a number of minutes, and ${named(second, t)}`, fix: "give it a number" });
            }
            return;
          }
          case "weekday":
            needsDate("weekday", first);
            return;
          case "startOfWeek":
            needsDate("startOfWeek", first);
            if (second?.t === "lit" && !isWeekday(second.value)) out.push({ code: "expr-type", sentence: "startOfWeek(…) starts the week on a day said 'mon' to 'sun'", fix: "write the first day of the week as 'mon', 'sun', or another of the seven" });
            return;
          default:
            return;
        }
      }
    }
  };
  visit(expr);
  return out;
}
