import { csvFileName, listCsv } from "@graview/core/csv";
import type { GraphReader } from "@graview/core";
import type { ShownListToExport } from "./list-export.js";

/*
 * WRITING A SHOWN LIST AND SAVING IT (Roadmap f-view-export-csv), fetched
 * with the first press of "Export CSV": the rows as the page says them
 * (`listCsv`), named for the place and the day, handed to the host where it
 * saves files itself (`onExport`), else downloaded by the browser through a
 * link that is in the page only for the click.
 */

/** Writes the list and saves it. */
export async function saveShownList(list: ShownListToExport): Promise<void> {
  const csv = listCsv({ schema: list.schema, graph: list.graph as unknown as GraphReader, kind: list.kind, groups: list.groups, grouped: list.grouped });
  const name = csvFileName(list.title);
  if (list.onExport) return void (await list.onExport(csv, name));
  download(csv, name);
}

/** The browser's own download of a file the page made: a link to it, clicked once and taken away. */
export function download(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked once the browser has begun the download.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
