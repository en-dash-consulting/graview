/**
 * AN ERROR KNOWN BY WHAT IT IS, FROM WHICHEVER COPY OF CORE MADE IT (Roadmap
 * f-light-composer).
 *
 * A page can hold two copies of `@graview/core`: Graview Cloud lent its
 * owner and editor pages a composer bundled apart from the shell, and the
 * app it composed came with that bundle's schema, its mutations and its
 * errors. The shell's store reads an error by `instanceof` (a kind the
 * schema lacks is its `SchemaError`, a record not there a
 * `MissingRecordError`, an act's own refusal an `ActRefusal`), and another
 * copy's class is never this one's: the schema's error was read as a field
 * that did not fit, and a refusal as an invalid call.
 *
 * So each of those classes says what it is with a registered symbol
 * (`Symbol.for`, shared by every copy on a page) on its prototype, and
 * answers `instanceof` for an error carrying it as well as for its own. A
 * subclass registered under its own name is known apart from its parent;
 * one that is not registered is judged only by its own prototype chain.
 */
const MARK = Symbol.for("@graview/core:known-as");

type Known = { readonly [MARK]?: symbol; readonly prototype: object };

/** Marks a class as known across copies by `name`, and returns it. */
export function knownAcrossCopies<C extends abstract new (...args: never[]) => object>(cls: C, name: string): C {
  const known = Symbol.for(`@graview/core:${name}`);
  Object.defineProperty(cls.prototype, known, { value: true });
  Object.defineProperty(cls, MARK, { value: known });
  Object.defineProperty(cls, Symbol.hasInstance, {
    value(this: Known, value: unknown): boolean {
      if (Function.prototype[Symbol.hasInstance].call(this, value)) return true;
      // A subclass that is not registered is judged by its own chain alone, never by its parent's mark.
      if (!Object.prototype.hasOwnProperty.call(this, MARK)) return false;
      const mark = this[MARK];
      return mark !== undefined && value !== null && typeof value === "object" && (value as Record<symbol, unknown>)[mark] === true;
    },
  });
  return cls;
}
