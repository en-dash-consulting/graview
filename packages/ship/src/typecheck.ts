import { resolve } from "node:path";
import type { StudioDoorDiagnostic } from "@graview/core";
import type * as TS from "typescript";

/**
 * WOULD IT COMPILE — asked of the app as it would be, before anything is
 * written. The app's own `tsconfig.json`, its own files, and the edited ones
 * laid over them in memory; the answer is the compiler's own sentences,
 * each at the file and line it is about.
 *
 * A declaration change the checker is happy with can still leave the code
 * around it wrong — an act whose body adds an edge the kind no longer
 * declares, a page that reads a field that is gone — and the only honest
 * judge of that is the compiler the app already builds with.
 */
export function typecheckWith(
  ts: typeof TS,
  root: string,
  overlay: ReadonlyMap<string, string>,
  limit = 20,
): readonly StudioDoorDiagnostic[] {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) return [{ path: "tsconfig.json", line: 0, message: `No tsconfig.json in ${root}, so nothing can say whether this compiles.` }];
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, { noEmit: true }, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: () => undefined,
  });
  if (!parsed) return [{ path: "tsconfig.json", line: 0, message: "The app's tsconfig.json could not be read." }];

  const options: TS.CompilerOptions = {
    ...parsed.options,
    noEmit: true,
    composite: false,
    incremental: false,
    declaration: false,
    declarationMap: false,
    emitDeclarationOnly: false,
  };
  const edited = new Map([...overlay].map(([path, text]) => [resolve(root, path), text]));
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = (file) => edited.get(resolve(file)) ?? readFile(file);
  host.fileExists = (file) => edited.has(resolve(file)) || fileExists(file);
  host.getSourceFile = (file, language, onError, fresh) => {
    const text = edited.get(resolve(file));
    return text === undefined ? getSourceFile(file, language, onError, fresh) : ts.createSourceFile(file, text, language, true);
  };

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options,
    host,
    ...(parsed.projectReferences ? { projectReferences: parsed.projectReferences } : {}),
  });
  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .slice(0, limit)
    .map((diagnostic) => ({
      path: diagnostic.file ? diagnostic.file.fileName.replace(`${resolve(root)}/`, "") : "the project",
      line: diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1 : 0,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    }));
}
